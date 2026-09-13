const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const orderController = require('../controllers/orderController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { adminMiddleware } = require('../middleware/adminMiddleware');
const { runValidation, isPositiveInt } = require('../utils/validation');

router.post(
  '/',
  authMiddleware,
  [
    body('items')
      .isArray({ min: 1 })
      .withMessage('At least one order item is required'),
    body('items.*.product_id').custom((value) => {
      if (!isPositiveInt(Number(value))) throw new Error('A valid product_id is required');
      return true;
    }),
    body('items.*.quantity').custom((value) => {
      if (!isPositiveInt(Number(value))) throw new Error('Quantity must be a positive integer');
      return true;
    }),
    body('full_name').optional().isLength({ max: 150 }),
    body('phone').optional().isLength({ max: 30 }),
    body('email').optional().isEmail(),
  ],
  runValidation,
  orderController.createOrder
);

router.get('/', authMiddleware, orderController.getOrders);
router.get('/:id', authMiddleware, orderController.getOrderById);

router.patch(
  '/:id/status',
  authMiddleware,
  adminMiddleware,
  [
    body('status').notEmpty().withMessage('Status is required'),
  ],
  runValidation,
  orderController.updateOrderStatus
);

router.patch(
  '/:id/payment-status',
  authMiddleware,
  adminMiddleware,
  [
    body('payment_status').notEmpty().withMessage('Payment status is required'),
  ],
  runValidation,
  orderController.updateOrderPaymentStatus
);

module.exports = router;