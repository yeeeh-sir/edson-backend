const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later' },
});

const { register, login, googleLogin, me, logout } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { runValidation } = require('../utils/validation');

router.post(
  '/register',
  authLimiter,
  [
    body('full_name')
      .trim()
      .isLength({ min: 2 })
      .withMessage('Name must be at least 2 characters'),
    body('email').isEmail().withMessage('A valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('phone').optional().isLength({ max: 30 }),
  ],
  runValidation,
  register
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  runValidation,
  login
);

router.post(
  '/google',
  authLimiter,
  [body('credential').isString().isLength({ min: 20 }).withMessage('A Google credential is required')],
  runValidation,
  googleLogin
);

router.get('/me', authMiddleware, me);
router.post('/logout', logout);

module.exports = router;