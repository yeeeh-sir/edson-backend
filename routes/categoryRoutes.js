const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const categoryController = require('../controllers/categoryController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { adminMiddleware } = require('../middleware/adminMiddleware');
const { runValidation } = require('../utils/validation');

router.get('/', categoryController.getAllCategories);
router.get('/:slug', categoryController.getCategoryBySlug);

router.post(
  '/',
  authMiddleware,
  adminMiddleware,
  [
    body('name').trim().notEmpty().withMessage('Category name is required'),
    body('slug').trim().notEmpty().withMessage('Category slug is required'),
  ],
  runValidation,
  categoryController.createCategory
);

router.put('/:id', authMiddleware, adminMiddleware, categoryController.updateCategory);
router.delete('/:id', authMiddleware, adminMiddleware, categoryController.deleteCategory);
router.patch(
  '/:id/status',
  authMiddleware,
  adminMiddleware,
  categoryController.updateCategoryStatus
);

module.exports = router;