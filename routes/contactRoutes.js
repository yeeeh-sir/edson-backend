const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const contactController = require('../controllers/contactController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { adminMiddleware } = require('../middleware/adminMiddleware');
const { runValidation } = require('../utils/validation');

router.post(
  '/',
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
    body('email').isEmail().withMessage('A valid email is required'),
    body('subject').optional().isLength({ max: 200 }),
    body('message').trim().isLength({ min: 2 }).withMessage('Message is required'),
  ],
  runValidation,
  contactController.createMessage
);

router.get('/', authMiddleware, adminMiddleware, contactController.listMessages);
router.get('/:id', authMiddleware, adminMiddleware, contactController.getMessage);
router.patch(
  '/:id/status',
  authMiddleware,
  adminMiddleware,
  [
    body('status').notEmpty().withMessage('Status is required'),
  ],
  runValidation,
  contactController.updateMessageStatus
);

module.exports = router;