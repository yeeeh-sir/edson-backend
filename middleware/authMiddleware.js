const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const SAFE_FIELDS =
  'id, full_name, email, phone, role, profile_image, address, city, country, status, created_at';

async function authMiddleware(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.query(
      `SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`,
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user no longer exists',
      });
    }

    const user = rows[0];
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is disabled',
      });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, invalid token',
    });
  }
}

function extractToken(req) {
  if (req.cookies && req.cookies.token) return req.cookies.token;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/**
 * Tries to attach the current user but never rejects the request.
 * Used for endpoints that support both guests and authenticated users.
 */
async function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query(
      `SELECT ${SAFE_FIELDS} FROM users WHERE id = ? AND status = 'active'`,
      [decoded.id]
    );
    if (rows.length > 0) req.user = rows[0];
  } catch (_err) {
    /* invalid token -> treat as guest */
  }
  return next();
}

module.exports = { authMiddleware, optionalAuth, extractToken };