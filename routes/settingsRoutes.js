const express = require('express');
const { body } = require('express-validator');
const settingsController = require('../controllers/settingsController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { adminMiddleware } = require('../middleware/adminMiddleware');
const { runValidation } = require('../utils/validation');

const router = express.Router();

router.get('/', settingsController.getSettings);
router.put('/', authMiddleware, adminMiddleware, [
    body('shopName').optional().isLength({ max: 200 }),
    body('tagline').optional().isLength({ max: 500 }),
    body('currency').optional().equals('RWF'),
    body('email').optional().isEmail(),
    body('deliveryFee').optional().isNumeric(),
    body('freeDeliveryThreshold').optional().isNumeric(),
], runValidation, settingsController.updateSettings);

module.exports = router;
