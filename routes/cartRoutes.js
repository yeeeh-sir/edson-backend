const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const cartController = require('../controllers/cartController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { runValidation, isPositiveInt } = require('../utils/validation');

router.use(authMiddleware);

router.get('/', cartController.getCart);

router.post(
  '/',
  [
    body('product_id').custom((value) => {
      if (!isPositiveInt(Number(value))) throw new Error('A valid product_id is required');
      return true;
    }),
    body('quantity')
      .optional()
      .custom((value) => {
        if (!isPositiveInt(Number(value))) throw new Error('Quantity must be a positive integer');
        return true;
      }),
  ],
  runValidation,
  cartController.addToCart
);

router.put(
  '/:id',
  [
    body('quantity').custom((value) => {
      if (!isPositiveInt(Number(value))) throw new Error('Quantity must be a positive integer');
      return true;
    }),
  ],
  runValidation,
  cartController.updateCartItem
);

router.delete('/', cartController.clearCart);
router.delete('/:id', cartController.removeCartItem);

module.exports = router;