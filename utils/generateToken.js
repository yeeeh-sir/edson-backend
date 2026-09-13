const jwt = require('jsonwebtoken');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

function setAuthCookie(res, token) {
  res.cookie('token', token, COOKIE_OPTIONS);
}

function clearAuthCookie(res) {
  res.clearCookie('token', { ...COOKIE_OPTIONS, maxAge: undefined });
}

module.exports = { generateToken, setAuthCookie, clearAuthCookie };