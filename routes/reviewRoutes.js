const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const reviewController = require('../controllers/reviewController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { adminMiddleware } = require('../middleware/adminMiddleware');
const { runValidation } = require('../utils/validation');

const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many reviews submitted, please try again later' },
});

router.get('/products/:id/reviews', reviewController.listProductReviews);

router.post(
  '/products/:id/reviews',
  authMiddleware,
  reviewLimiter,
  [
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('review').optional().isLength({ max: 2000 }),
  ],
  runValidation,
  reviewController.createReview
);

router.put(
  '/reviews/:id',
  authMiddleware,
  [
    body('rating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('review').optional().isLength({ max: 2000 }),
  ],
  runValidation,
  reviewController.updateReview
);

router.delete('/reviews/:id', authMiddleware, reviewController.deleteReview);

router.patch(
  '/reviews/:id/status',
  authMiddleware,
  adminMiddleware,
  [
    body('status').notEmpty().withMessage('Status is required'),
  ],
  runValidation,
  reviewController.moderateReview
);

module.exports = router;