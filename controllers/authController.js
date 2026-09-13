const authService = require('../services/authService');
const { pool } = require('../config/db');
const { generateToken, setAuthCookie, clearAuthCookie } = require('../utils/generateToken');
const googleAuthService = require('../services/googleAuthService');

async function register(req, res, next) {
  try {
    return res.status(403).json({ success: false, message: 'Customers must sign in with Google' });
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await authService.loginUser(email, password);
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Customers must sign in with Google' });
    }
    const token = generateToken(user);
    setAuthCookie(res, token);

    return res.json({
      success: true,
      message: 'Logged in successfully',
      data: { user, token },
    });
  } catch (err) {
    return next(err);
  }
}

async function googleLogin(req, res, next) {
  try {
    const user = await googleAuthService.findOrCreateCustomer(req.body.credential);
    const token = generateToken(user);
    setAuthCookie(res, token);

    return res.json({
      success: true,
      message: 'Google login successful',
      data: { user },
    });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const safeUser = await authService.getSafeUserById(req.user.id);
    if (!safeUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, message: 'Current user', data: { user: safeUser } });
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res, next) {
  try {
    clearAuthCookie(res);
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login, googleLogin, me, logout };