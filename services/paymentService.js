const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorMiddleware');
const { generateOrderNumber } = require('../utils/generateOrderNumber');
const { storeImageBuffer, deleteImage } = require('./imageService');

const ORDER_FIELDS = `
  o.id, o.user_id, o.order_number, o.full_name, o.phone, o.email, o.address, o.city, o.country,
  o.notes, o.subtotal, o.delivery_fee, o.total, o.status, o.payment_status,
  o.created_at, o.updated_at`;

async function getPayment(id, user, isAdmin) {
    const [rows] = await pool.query(
        `SELECT ps.id AS payment_id, ps.order_id, ps.user_id AS payment_user_id,
                ps.amount, ps.payment_method, ps.payment_number, ps.transaction_reference,
                ps.screenshot_url, ps.screenshot_public_id, ps.customer_note, ps.status,
                ps.admin_note, ps.reviewed_by, ps.reviewed_at, ps.created_at AS payment_created_at,
                ps.updated_at AS payment_updated_at,
                ${ORDER_FIELDS}, u.full_name AS customer_name, u.email AS customer_email
     FROM payment_submissions ps
     JOIN orders o ON o.id = ps.order_id
     JOIN users u ON u.id = ps.user_id
     WHERE ps.id = ?`,
        [id]
    );
    if (!rows.length || (!isAdmin && Number(rows[0].payment_user_id) !== Number(user.id))) {
        throw new AppError('Payment not found', 404);
    }
    const payment = rows[0];
    const [items] = await pool.query(
        `SELECT oi.id, oi.product_id, oi.product_name, oi.product_price, oi.quantity, oi.subtotal,
            p.main_image
     FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`, [payment.order_id]
    );
    return {
        ...payment,
        id: payment.payment_id,
        screenshot_url: payment.screenshot_url,
        created_at: payment.payment_created_at,
        updated_at: payment.payment_updated_at,
        items,
    };
}

async function submitPayment(user, payload, file) {
    if (!file) throw new AppError('Payment screenshot is required', 400);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
        throw new AppError('Payment screenshot must be JPG, PNG, or WEBP', 400);
    }
    let items;
    try {
        items = JSON.parse(payload.items || '[]');
    } catch (_err) {
        throw new AppError('Order items are invalid', 400);
    }
    if (!Array.isArray(items) || !items.length) throw new AppError('At least one order item is required', 400);

    // Upload the screenshot (memory buffer) to Cloudinary before creating the order.
    // No temporary file is written to disk; the screenshot lives only in Cloudinary.
    const uploaded = await storeImageBuffer(file.buffer, file.originalname, file.mimetype, {
        folder: 'payment-screenshots',
    });
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        let subtotal = 0;
        const orderItems = [];
        for (const item of items) {
            const productId = Number(item.product_id || item.id);
            const quantity = Number(item.quantity || item.qty);
            if (!Number.isInteger(productId) || productId <= 0) throw new AppError('Invalid product', 400);
            if (!Number.isInteger(quantity) || quantity <= 0) throw new AppError('Invalid quantity', 400);
            const [rows] = await conn.query(
                'SELECT id, name, price, stock, is_active, main_image FROM products WHERE id = ? FOR UPDATE', [productId]
            );
            if (!rows.length) throw new AppError('Product not found', 404);
            const product = rows[0];
            if (!product.is_active) throw new AppError('Product unavailable', 400);
            if (quantity > Number(product.stock)) throw new AppError(`Only ${product.stock} left in stock`, 400);
            const lineTotal = Number(product.price) * quantity;
            subtotal += lineTotal;
            orderItems.push([product.id, product.name, product.price, quantity, lineTotal]);
        }
        const deliveryFee = subtotal >= 100000 ? 0 : 5000;
        const total = subtotal + deliveryFee;
        const [orderResult] = await conn.query(
            `INSERT INTO orders (user_id, order_number, full_name, phone, email, address, city, country, notes,
        subtotal, delivery_fee, total, status, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')`,
            [user.id, generateOrderNumber(), payload.full_name || user.full_name, payload.phone || user.phone,
            user.email, payload.address || user.address || '', payload.city || user.city || '',
            payload.country || user.country || '', payload.notes || null, subtotal, deliveryFee, total]
        );
        const orderId = orderResult.insertId;
        for (const item of orderItems) {
            await conn.query(
                `INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`, [orderId, ...item]
            );
        }
        const [paymentResult] = await conn.query(
            `INSERT INTO payment_submissions
       (order_id, user_id, amount, payment_method, payment_number, transaction_reference, screenshot_url, screenshot_public_id, customer_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, user.id, total, payload.payment_method || 'mobile_money', payload.payment_number || null,
                payload.transaction_reference || null, uploaded.url, uploaded.publicId, payload.customer_note || null]
        );
        await conn.commit();
        return getPayment(paymentResult.insertId, user, false);
    } catch (err) {
        await conn.rollback();
        if (uploaded.url) await deleteImage(uploaded.publicId, uploaded.url);
        throw err;
    } finally {
        conn.release();
    }
}

async function listPayments(user, isAdmin, params = {}) {
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const values = [];
    const where = [];
    if (!isAdmin) { where.push('ps.user_id = ?'); values.push(user.id); }
    if (params.status && params.status !== 'all') { where.push('ps.status = ?'); values.push(params.status); }
    if (params.search) {
        where.push('(o.order_number LIKE ? OR o.full_name LIKE ? OR o.email LIKE ? OR o.phone LIKE ? OR ps.transaction_reference LIKE ? OR oi.product_name LIKE ?)');
        const q = `%${params.search}%`; values.push(q, q, q, q, q, q);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
        `SELECT ps.id, ps.order_id, ps.user_id, ps.amount, ps.payment_method, ps.payment_number,
            ps.transaction_reference, ps.screenshot_url, ps.customer_note, ps.status, ps.admin_note,
            ps.reviewed_at, ps.created_at, o.order_number, o.full_name, o.email, o.phone, o.address,
            o.city, o.country, o.total, o.status AS order_status,
            GROUP_CONCAT(DISTINCT oi.product_name SEPARATOR ', ') AS products
     FROM payment_submissions ps JOIN orders o ON o.id = ps.order_id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     ${whereSql} GROUP BY ps.id ORDER BY ps.created_at DESC LIMIT ?`, [...values, limit]
    );
    return { payments: rows.map((payment) => ({ ...payment, screenshot_url: payment.screenshot_url })) };
}

async function reviewPayment(paymentId, admin, approved, adminNote) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query(
            `SELECT ps.*, o.total, o.id AS order_id FROM payment_submissions ps
       JOIN orders o ON o.id = ps.order_id WHERE ps.id = ? FOR UPDATE`, [paymentId]
        );
        if (!rows.length) throw new AppError('Payment not found', 404);
        const payment = rows[0];
        if (payment.status !== 'pending') throw new AppError('Payment has already been reviewed', 409);
        if (approved) {
            const [items] = await conn.query('SELECT product_id, quantity FROM order_items WHERE order_id = ? FOR UPDATE', [payment.order_id]);
            for (const item of items) {
                if (!item.product_id) continue;
                const [updated] = await conn.query(
                    'UPDATE products SET stock = stock - ? WHERE id = ? AND is_active = 1 AND stock >= ?',
                    [item.quantity, item.product_id, item.quantity]
                );
                if (!updated.affectedRows) throw new AppError('Product stock is no longer available', 409);
            }
            await conn.query("UPDATE payment_submissions SET status = 'approved', admin_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?", [adminNote || null, admin.id, paymentId]);
            await conn.query("UPDATE orders SET payment_status = 'paid', status = 'processing' WHERE id = ?", [payment.order_id]);
        } else {
            await conn.query("UPDATE payment_submissions SET status = 'rejected', admin_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?", [adminNote || null, admin.id, paymentId]);
            await conn.query("UPDATE orders SET payment_status = 'failed', status = 'pending' WHERE id = ?", [payment.order_id]);
        }
        await conn.commit();
        return getPayment(paymentId, admin, true);
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally { conn.release(); }
}

module.exports = { submitPayment, listPayments, getPayment, reviewPayment };
