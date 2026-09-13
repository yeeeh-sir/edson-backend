const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorMiddleware');

const SAFE_FIELDS =
  'id, full_name, email, phone, role, profile_image, address, city, country, status, created_at, updated_at';

function stripPassword(user) {
  if (!user) return user;
  const { password, ...safe } = user;
  return safe;
}

async function getSafeUserById(id) {
  const [rows] = await pool.query(`SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function registerUser({ full_name, email, phone, password }) {
  throw new AppError('Customers must sign in with Google', 403);
  /* istanbul ignore next */
  const normalizedEmail = String(email).trim().toLowerCase();

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [
    normalizedEmail,
  ]);
  if (existing.length > 0) {
    throw new AppError('Email already registered', 409);
  }

  const hash = await bcrypt.hash(password, 10);

  const [result] = await pool.query(
    `INSERT INTO users (full_name, email, phone, password, role, status)
     VALUES (?, ?, ?, ?, 'customer', 'active')`,
    [full_name.trim(), normalizedEmail, phone || null, hash]
  );

  return getSafeUserById(result.insertId);
}

async function loginUser(email, password) {
  const normalizedEmail = String(email).trim().toLowerCase();

  const [rows] = await pool.query(
    'SELECT * FROM users WHERE email = ?',
    [normalizedEmail]
  );

  if (rows.length === 0) {
    throw new AppError('Invalid email or password', 401);
  }

  const user = rows[0];

  if (user.role !== 'admin') {
    throw new AppError('Customers must sign in with Google', 403);
  }

  if (user.status !== 'active') {
    throw new AppError('Your account is disabled', 403);
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new AppError('Invalid email or password', 401);
  }

  return stripPassword(user);
}

module.exports = { registerUser, loginUser, getSafeUserById, stripPassword };