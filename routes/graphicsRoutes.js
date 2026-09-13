const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const graphicsController = require('../controllers/graphicsController');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const { adminMiddleware } = require('../middleware/adminMiddleware');
const { uploadSingle, uploadArray } = require('../middleware/uploadMiddleware');
const { runValidation, isPositiveInt } = require('../utils/validation');

router.get('/', graphicsController.listGraphicsServices);

router.post(
  '/requests',
  optionalAuth,
  uploadSingle('reference_image'),
  [
    body('email').optional().isEmail().withMessage('A valid email is required'),
    body('phone').optional().isLength({ max: 30 }),
    body('service_id')
      .optional()
      .custom((value) => {
        if (value && !isPositiveInt(Number(value))) {
          throw new Error('Service id must be a number');
        }
        return true;
      }),
    body('quantity')
      .optional()
      .custom((value) => {
        if (value && !isPositiveInt(Number(value))) {
          throw new Error('Quantity must be a positive integer');
        }
        return true;
      }),
  ],
  runValidation,
  graphicsController.createGraphicsRequest
);

router.get(
  '/requests',
  authMiddleware,
  adminMiddleware,
  graphicsController.listGraphicsRequests
);
router.patch(
  '/requests/:id/status',
  authMiddleware,
  adminMiddleware,
  [
    body('status').notEmpty().withMessage('Status is required'),
  ],
  runValidation,
  graphicsController.updateGraphicsRequestStatus
);

router.get('/:id', graphicsController.getGraphicsService);

router.post(
  '/',
  authMiddleware,
  adminMiddleware,
  uploadSingle('image'),
  [
    body('name').trim().notEmpty().withMessage('Service name is required'),
    body('slug').trim().notEmpty().withMessage('Service slug is required'),
  ],
  runValidation,
  graphicsController.createGraphicsService
);

router.put(
  '/:id',
  authMiddleware,
  adminMiddleware,
  uploadSingle('image'),
  graphicsController.updateGraphicsService
);

router.delete('/:id', authMiddleware, adminMiddleware, graphicsController.deleteGraphicsService);

module.exports = router;