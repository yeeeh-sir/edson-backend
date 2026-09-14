const express = require('express');
const { body } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { adminMiddleware } = require('../middleware/adminMiddleware');
const { uploadSingleMemory } = require('../middleware/uploadMiddleware');
const { runValidation } = require('../utils/validation');

const router = express.Router();

router.post(
    '/submit',
    authMiddleware,
    uploadSingleMemory('screenshot'),
    [
        body('items').notEmpty().withMessage('Order items are required'),
        body('full_name').trim().notEmpty().withMessage('Full name is required'),
        body('phone').trim().notEmpty().withMessage('Phone is required'),
        body('address').trim().notEmpty().withMessage('Address is required'),
        body('city').trim().notEmpty().withMessage('City is required'),
        body('country').trim().notEmpty().withMessage('Country is required'),
    ],
    runValidation,
    paymentController.submitPayment
);

router.get('/my-payments', authMiddleware, paymentController.listPayments);
router.get('/:id/screenshot', authMiddleware, paymentController.getPaymentScreenshot);
router.get('/admin/payments', authMiddleware, adminMiddleware, paymentController.listPayments);
router.get('/admin/list', authMiddleware, adminMiddleware, paymentController.listPayments);
router.get('/admin/:id', authMiddleware, adminMiddleware, paymentController.getPayment);
router.patch('/admin/:id/approve', authMiddleware, adminMiddleware, paymentController.approvePayment);
router.patch('/admin/:id/reject', authMiddleware, adminMiddleware, [body('admin_note').optional().isLength({ max: 2000 })], runValidation, paymentController.rejectPayment);
router.get('/:id', authMiddleware, paymentController.getPayment);

module.exports = router;
