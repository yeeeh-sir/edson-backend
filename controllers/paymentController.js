const paymentService = require('../services/paymentService');
const { logAdminActivity } = require('./adminController');
const path = require('path');
const { pool } = require('../config/db');
const { uploadsDir } = require('../middleware/uploadMiddleware');

async function submitPayment(req, res, next) {
    try {
        const payment = await paymentService.submitPayment(req.user, req.body, req.file);
        return res.status(201).json({ success: true, message: 'Payment confirmation submitted and is awaiting verification.', data: { payment } });
    } catch (err) { return next(err); }
}

async function listPayments(req, res, next) {
    try {
        const data = await paymentService.listPayments(req.user, req.user.role === 'admin', req.query);
        return res.json({ success: true, message: 'Payments retrieved', data });
    } catch (err) { return next(err); }
}

async function getPayment(req, res, next) {
    try {
        const payment = await paymentService.getPayment(req.params.id, req.user, req.user.role === 'admin');
        return res.json({ success: true, message: 'Payment retrieved', data: { payment } });
    } catch (err) { return next(err); }
}

async function getPaymentScreenshot(req, res, next) {
    try {
        const [rows] = await pool.query(
            'SELECT screenshot_url, screenshot_public_id, user_id FROM payment_submissions WHERE id = ?',
            [req.params.id]
        );
        if (!rows.length || (req.user.role !== 'admin' && Number(rows[0].user_id) !== Number(req.user.id))) {
            return res.status(404).json({ success: false, message: 'Payment screenshot not found' });
        }
        const url = rows[0].screenshot_url;
        // Payment screenshots are stored in Cloudinary (never web-host static files).
        // Redirect straight to the secure Cloudinary URL so the image is served by CDN.
        if (/^https?:\/\//i.test(url) && !url.includes('/uploads/')) return res.redirect(url);
        // Legacy/development records pointing at local /uploads are served only outside production.
        if (process.env.NODE_ENV !== 'production' && url) {
            return res.sendFile(path.join(uploadsDir, path.basename(url)));
        }
        return res.status(404).json({ success: false, message: 'Payment screenshot not available' });
    } catch (err) { return next(err); }
}

async function approvePayment(req, res, next) {
    try {
        const payment = await paymentService.reviewPayment(req.params.id, req.user, true, req.body.admin_note);
        await logAdminActivity(req, 'PAYMENT_APPROVE', 'payment', payment.id, `Approved payment for order ${payment.order_number}`);
        return res.json({ success: true, message: 'Payment approved', data: { payment } });
    } catch (err) { return next(err); }
}

async function rejectPayment(req, res, next) {
    try {
        const payment = await paymentService.reviewPayment(req.params.id, req.user, false, req.body.admin_note);
        await logAdminActivity(req, 'PAYMENT_REJECT', 'payment', payment.id, `Rejected payment for order ${payment.order_number}`);
        return res.json({ success: true, message: 'Payment rejected', data: { payment } });
    } catch (err) { return next(err); }
}

async function deletePayment(req, res, next) {
    try {
        const deleted = await paymentService.deletePayment(req.params.id);
        await logAdminActivity(req, 'PAYMENT_DELETE', 'payment', deleted.id, `Deleted payment history ${deleted.id} (order ${deleted.orderId})`);
        return res.json({ success: true, message: 'Payment deleted', data: deleted });
    } catch (err) { return next(err); }
}

module.exports = { submitPayment, listPayments, getPayment, getPaymentScreenshot, approvePayment, rejectPayment, deletePayment };
