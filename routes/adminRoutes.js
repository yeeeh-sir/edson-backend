const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const productController = require('../controllers/productController');
const categoryController = require('../controllers/categoryController');
const graphicsController = require('../controllers/graphicsController');
const orderController = require('../controllers/orderController');
const adminProfileController = require('../controllers/adminProfileController');
const paymentController = require('../controllers/paymentController');
const bannerController = require('../controllers/bannerController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { adminMiddleware } = require('../middleware/adminMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { runValidation } = require('../utils/validation');

router.use(authMiddleware, adminMiddleware);

const profileLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many profile security changes, please try again later' },
});

router.get('/profile', adminProfileController.getAdminProfile);
router.put(
    '/profile/email',
    profileLimiter,
    [
        body().custom((_, { req }) => {
            if (!req.body.newEmail && !req.body.email) throw new Error('A new email is required');
            return true;
        }),
        body('newEmail').optional().isEmail().withMessage('A valid new email is required'),
        body('email').optional().isEmail().withMessage('A valid new email is required'),
        body('currentPassword').isString().isLength({ min: 1 }).withMessage('Current password is required'),
    ],
    runValidation,
    adminProfileController.updateAdminEmail
);
router.put(
    '/profile/password',
    profileLimiter,
    [
        body('currentPassword').isString().isLength({ min: 1 }).withMessage('Current password is required'),
        body('newPassword').isString().isLength({ min: 8, max: 128 }).withMessage('New password must be 8 to 128 characters'),
        body('confirmPassword').isString().isLength({ min: 1 }).withMessage('Password confirmation is required'),
    ],
    runValidation,
    adminProfileController.updateAdminPassword
);

router.get('/dashboard', adminController.getDashboard);
router.get('/products', productController.getAllProducts);
router.post('/products', productController.createProduct);
router.put('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);
router.get('/categories', categoryController.getAllCategories);
router.post('/categories', categoryController.createCategory);
router.put('/categories/:id', categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);
router.patch('/categories/:id/status', categoryController.updateCategoryStatus);
router.post('/categories/:id/image', uploadSingle('image'), categoryController.uploadCategoryImage);
router.get('/graphics', graphicsController.listGraphicsServices);
router.post('/graphics', graphicsController.createGraphicsService);
router.put('/graphics/:id', graphicsController.updateGraphicsService);
router.delete('/graphics/:id', graphicsController.deleteGraphicsService);
router.get('/graphics-requests', graphicsController.listGraphicsRequests);
router.patch('/graphics-requests/:id/status', graphicsController.updateGraphicsRequestStatus);
router.get('/orders', orderController.getOrders);
router.get('/orders/:id', orderController.getOrderById);
router.patch('/orders/:id/status', orderController.updateOrderStatus);
router.patch('/orders/:id/payment-status', orderController.updateOrderPaymentStatus);
router.get('/payments', paymentController.listPayments);
router.get('/payments/:id', paymentController.getPayment);
router.patch('/payments/:id/approve', paymentController.approvePayment);
router.patch('/payments/:id/reject', paymentController.rejectPayment);
router.delete('/payments/:id', paymentController.deletePayment);
router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUserById);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.delete('/users/:id', adminController.deleteUser);
router.get('/banners', bannerController.listBanners);
router.post('/banners', bannerController.createBanner);
router.put('/banners/:id', bannerController.updateBanner);
router.delete('/banners/:id', bannerController.deleteBanner);
router.post('/banners/:id/image', uploadSingle('image'), bannerController.uploadBannerImage);

module.exports = router;