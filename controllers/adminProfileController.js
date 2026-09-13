const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { clearAuthCookie } = require('../utils/generateToken');
const { AppError } = require('../middleware/errorMiddleware');
const { logAdminActivity } = require('./adminController');

const PROFILE_FIELDS = 'id, full_name, email, role, profile_image, phone, status, created_at, updated_at';

async function getAdminProfile(req, res, next) {
    try {
        const [rows] = await pool.query(
            `SELECT ${PROFILE_FIELDS} FROM users WHERE id = ? AND role = 'admin'`,
            [req.user.id]
        );
        if (rows.length === 0) throw new AppError('Admin profile not found', 404);

        return res.json({
            success: true,
            message: 'Admin profile retrieved',
            data: { profile: rows[0] },
        });
    } catch (err) {
        return next(err);
    }
}

async function updateAdminEmail(req, res, next) {
    try {
        const newEmail = String(req.body.newEmail || req.body.email || '').trim().toLowerCase();
        const currentPassword = String(req.body.currentPassword || '').trim();

        const [rows] = await pool.query(
            'SELECT id, email, password FROM users WHERE id = ? AND role = \'admin\' AND status = \'active\'',
            [req.user.id]
        );
        if (rows.length === 0) throw new AppError('Admin profile not found', 404);

        const passwordMatches = await bcrypt.compare(currentPassword, rows[0].password);
        if (!passwordMatches) throw new AppError('Current password is incorrect', 401);

        const [duplicate] = await pool.query(
            'SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1',
            [newEmail, req.user.id]
        );
        if (duplicate.length > 0) throw new AppError('Email is already in use', 409);

        await pool.query('UPDATE users SET email = ? WHERE id = ?', [newEmail, req.user.id]);
        await logAdminActivity(req, 'UPDATE', 'admin_profile', req.user.id, 'Updated admin email');

        return res.json({ success: true, message: 'Email updated successfully' });
    } catch (err) {
        return next(err);
    }
}

async function updateAdminPassword(req, res, next) {
    try {
        const currentPassword = String(req.body.currentPassword || '');
        const newPassword = String(req.body.newPassword || '');
        const confirmPassword = String(req.body.confirmPassword || '');

        const [rows] = await pool.query(
            'SELECT id, password FROM users WHERE id = ? AND role = \'admin\' AND status = \'active\'',
            [req.user.id]
        );
        if (rows.length === 0) throw new AppError('Admin profile not found', 404);

        const passwordMatches = await bcrypt.compare(currentPassword, rows[0].password);
        if (!passwordMatches) throw new AppError('Current password is incorrect', 401);
        if (newPassword !== confirmPassword) throw new AppError('New passwords do not match', 422);
        if (await bcrypt.compare(newPassword, rows[0].password)) {
            throw new AppError('New password must be different from the current password', 422);
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [passwordHash, req.user.id]);
        await logAdminActivity(req, 'UPDATE', 'admin_profile', req.user.id, 'Updated admin password');

        clearAuthCookie(res);
        return res.json({ success: true, message: 'Password updated successfully. Please log in again.' });
    } catch (err) {
        return next(err);
    }
}

module.exports = { getAdminProfile, updateAdminEmail, updateAdminPassword };
