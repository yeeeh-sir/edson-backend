const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorMiddleware');
const { stripPassword, getSafeUserById } = require('./authService');

function getGoogleClient() {
    if (!process.env.GOOGLE_CLIENT_ID) {
        throw new AppError('Google authentication is not configured', 503);
    }
    return new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
}

function decodeSafeMetadata(credential) {
    const data = jwt.decode(credential, { json: true });
    if (!data || typeof data !== 'object') return null;
    const { iss, aud, sub, exp, iat, nbf } = data;
    const safe = {};
    if (iss !== undefined) safe.iss = iss;
    if (aud !== undefined) safe.aud = aud;
    if (sub !== undefined) safe.sub = sub;
    if (exp !== undefined) safe.exp = exp;
    if (iat !== undefined) safe.iat = iat;
    if (nbf !== undefined) safe.nbf = nbf;
    return safe;
}

// Classify a google-auth-library verifyIdToken failure so real problems are
// surfaced instead of a single generic message. Only the error NAME/CODE is
// inspected here; err.message may embed token payload data, so it is never
// logged and never sent back to the client.
function classifyGoogleError(err) {
    const msg = String((err && err.message) || '');
    const code = String((err && (err.code || err.name)) || 'unknown');

    if (/used too early/i.test(msg)) {
        return { reason: 'used_too_early', userMessage: 'Google credential time validation failed.' };
    }
    if (/used too late|expired|expiration time too far/i.test(msg)) {
        return { reason: 'expired', userMessage: 'Google credential has expired.' };
    }
    if (/wrong recipient|audience/i.test(msg)) {
        return { reason: 'audience', userMessage: 'Google credential has an invalid audience.' };
    }
    if (/invalid issuer/i.test(msg)) {
        return { reason: 'issuer', userMessage: 'Google credential issuer is invalid.' };
    }
    if (/no pem found|invalid token signature|can't parse token|wrong number of segments|requires an id token/i.test(msg)) {
        return { reason: 'malformed', userMessage: 'Google authentication failed.' };
    }
    return { reason: code, userMessage: 'Google authentication failed.' };
}

async function verifyGoogleCredential(credential) {
    if (!credential || typeof credential !== 'string') {
        throw new AppError('Google credential is missing', 422);
    }

    let ticket;
    try {
        ticket = await getGoogleClient().verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
    } catch (err) {
        const { reason, userMessage } = classifyGoogleError(err);
        const meta = decodeSafeMetadata(credential);
        console.error('[Google verification failed]', JSON.stringify({
            reason,
            errorName: err.name,
            audience: process.env.GOOGLE_CLIENT_ID,
            serverNow: Math.floor(Date.now() / 1000),
            metadata: meta,
        }));
        throw new AppError(userMessage, 401);
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
        console.error('[Google verification failed] email not verified or payload incomplete');
        throw new AppError('Google account email is not verified', 401);
    }

    return payload;
}

async function findOrCreateCustomer(credential) {
    const google = await verifyGoogleCredential(credential);
    const email = google.email.trim().toLowerCase();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        const [byGoogleId] = await connection.query(
            'SELECT * FROM users WHERE google_id = ? FOR UPDATE',
            [google.sub]
        );
        let user = byGoogleId[0];

        if (!user) {
            const [byEmail] = await connection.query(
                'SELECT * FROM users WHERE email = ? FOR UPDATE',
                [email]
            );
            user = byEmail[0];

            if (user && user.role !== 'customer') {
                throw new AppError('This Google account cannot access the customer area', 403);
            }

            if (user) {
                if (user.google_id && user.google_id !== google.sub) {
                    throw new AppError('This email is linked to another Google account', 409);
                }
                await connection.query(
                    `UPDATE users SET google_id = ?, full_name = ?, profile_image = COALESCE(?, profile_image)
           WHERE id = ? AND role = 'customer'`,
                    [google.sub, google.name || user.full_name, google.picture || null, user.id]
                );
            } else {
                const [result] = await connection.query(
                    `INSERT INTO users (full_name, email, google_id, password, profile_image, role, status)
           VALUES (?, ?, ?, NULL, ?, 'customer', 'active')`,
                    [google.name || email.split('@')[0], email, google.sub, google.picture || null]
                );
                user = { id: result.insertId };
            }
        }

        const [freshRows] = await connection.query(
            `SELECT id, full_name, email, phone, role, profile_image, address, city, country, status, created_at, updated_at
       FROM users WHERE id = ? AND role = 'customer' AND status = 'active'`,
            [user.id]
        );
        if (freshRows.length === 0) throw new AppError('Customer account is unavailable', 403);

        await connection.commit();
        return stripPassword(freshRows[0]);
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

module.exports = { findOrCreateCustomer, getSafeUserById };