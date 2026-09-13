const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const productController = require('../controllers/productController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { adminMiddleware } = require('../middleware/adminMiddleware');
const { uploadArray } = require('../middleware/uploadMiddleware');
const { runValidation, isPositiveInt } = require('../utils/validation');

router.get('/', productController.getAllProducts);
router.get('/search', productController.searchProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/popular', productController.getPopularProducts);
router.get('/category/:slug', productController.getProductsByCategory);
router.get('/slug/:slug', productController.getProductBySlug);

router.post(
  '/',
  authMiddleware,
  adminMiddleware,
  [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('price').isNumeric().withMessage('Price must be a number'),
  ],
  runValidation,
  productController.createProduct
);

router.put('/:id', authMiddleware, adminMiddleware, productController.updateProduct);
router.delete('/:id', authMiddleware, adminMiddleware, productController.deleteProduct);
router.patch(
  '/:id/status',
  authMiddleware,
  adminMiddleware,
  productController.patchProductStatus
);

router.patch(
  '/:id/stock',
  authMiddleware,
  adminMiddleware,
  [
    body('stock').custom((value) => {
      if (!isPositiveInt(Number(value))) {
        throw new Error('Stock must be a positive integer');
      }
      return true;
    }),
  ],
  runValidation,
  productController.patchProductStock
);

router.post(
  '/:id/images',
  authMiddleware,
  adminMiddleware,
  uploadArray('images', 8),
  productController.addProductImages
);

router.delete(
  '/images/:imageId',
  authMiddleware,
  adminMiddleware,
  productController.removeProductImage
);
router.patch(
  '/images/:imageId/primary',
  authMiddleware,
  adminMiddleware,
  productController.setPrimaryProductImage
);

router.get('/:id', productController.getProductById);

module.exports = router;