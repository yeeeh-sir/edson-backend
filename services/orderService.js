const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorMiddleware');
const { generateOrderNumber } = require('../utils/generateOrderNumber');
const {
  VALID_ORDER_STATUSES,
  VALID_PAYMENT_STATUSES,
  isIn,
} = require('../utils/validation');

const ORDER_FIELDS = `
  o.id, o.user_id, o.order_number, o.full_name, o.phone, o.email, o.address, o.city, o.country,
  o.notes, o.subtotal, o.delivery_fee, o.total, o.status, o.payment_status,
  o.created_at, o.updated_at`;

const CUSTOMER_FIELDS = `
  ${ORDER_FIELDS}, u.full_name AS customer_name, u.email AS customer_email`;

async function buildOrderResponse(connOrPool, id) {
  const [rows] = await connOrPool.query(
    `SELECT ${CUSTOMER_FIELDS}
     FROM orders o LEFT JOIN users u ON o.user_id = u.id
     WHERE o.id = ?`,
    [id]
  );
  if (rows.length === 0) return null;

  const [items] = await connOrPool.query(
    `SELECT oi.id, oi.product_id, oi.product_name, oi.product_price, oi.quantity, oi.subtotal,
        p.main_image
     FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`,
    [id]
  );

  return { ...rows[0], items };
}

/**
 * Creates an order in a single MySQL transaction.
 * Server always recomputes prices from MySQL; frontend prices are ignored.
 */
async function createOrder(user, payload) {
  const items = Array.isArray(payload.items) && payload.items.length > 0
    ? payload.items
    : null;

  if (!items) {
    throw new AppError('Order items are required', 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let subtotal = 0;
    const orderItems = [];

    for (const it of items) {
      const productId = Number(it.product_id);
      const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));

      if (!productId) {
        throw new AppError('Invalid product in order', 400);
      }

      const [rows] = await conn.query(
        'SELECT id, name, price, stock, is_active FROM products WHERE id = ? FOR UPDATE',
        [productId]
      );

      if (rows.length === 0) {
        throw new AppError(`Product id ${productId} not found`, 400);
      }

      const product = rows[0];

      if (!product.is_active) {
        throw new AppError(`${product.name} is not available right now`, 400);
      }

      if (qty > Number(product.stock)) {
        throw new AppError(
          `Only ${product.stock} left in stock for ${product.name}`,
          400
        );
      }

      const lineTotal = Number(product.price) * qty;
      subtotal += lineTotal;

      orderItems.push({
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: qty,
        lineTotal,
      });

      await conn.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [qty, product.id]
      );
    }

    const deliveryFee = subtotal >= 100000 ? 0 : 5000;
    const total = subtotal + deliveryFee;

    const orderNumber = generateOrderNumber();

    const [orderResult] = await conn.query(
      `INSERT INTO orders
        (user_id, order_number, full_name, phone, email, address, city, country, notes,
         subtotal, delivery_fee, total, status, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')`,
      [
        user.id,
        orderNumber,
        payload.full_name || user.full_name,
        payload.phone || user.phone,
        payload.email || user.email,
        payload.address || user.address || '',
        payload.city || user.city || '',
        payload.country || user.country || '',
        payload.notes || null,
        subtotal,
        deliveryFee,
        total,
      ]
    );

    const orderId = orderResult.insertId;

    for (const oi of orderItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, oi.product_id, oi.name, oi.price, oi.quantity, oi.lineTotal]
      );
    }

    if (payload.clear_cart !== false) {
      await conn.query('DELETE FROM cart_items WHERE user_id = ?', [user.id]);
    }

    await conn.commit();

    return buildOrderResponse(conn, orderId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getOrders(user, isAdmin, params = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const offset = (page - 1) * limit;

  const countValues = [];
  let whereSql = '';
  if (!isAdmin) {
    whereSql = 'WHERE o.user_id = ?';
    countValues.push(user.id);
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM orders o ${whereSql}`,
    countValues
  );
  const total = Number(countRows[0].total);
  const totalPages = Math.ceil(total / limit) || 1;

  const values = [];
  if (!isAdmin) values.push(user.id);
  values.push(limit, offset);

  const [rows] = await pool.query(
    `SELECT ${CUSTOMER_FIELDS}
     FROM orders o LEFT JOIN users u ON o.user_id = u.id
     ${whereSql}
     ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    values
  );

  return {
    orders: rows,
    pagination: { page, limit, total, totalPages },
  };
}

async function getOrderById(id, user, isAdmin) {
  const [rows] = await pool.query(
    `SELECT ${CUSTOMER_FIELDS} FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?`,
    [id]
  );
  if (rows.length === 0) throw new AppError('Order not found', 404);

  const order = rows[0];

  if (!isAdmin && Number(order.user_id) !== Number(user.id)) {
    throw new AppError('Order not found', 404);
  }

  return buildOrderResponse(pool, id);
}

async function updateOrderStatus(orderId, status) {
  if (!isIn(status, VALID_ORDER_STATUSES)) {
    throw new AppError('Invalid order status', 400);
  }

  const [rows] = await pool.query(
    'SELECT id, status FROM orders WHERE id = ?',
    [orderId]
  );
  if (rows.length === 0) throw new AppError('Order not found', 404);

  const current = rows[0];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);

    // Restore stock when an order is cancelled.
    if (current.status !== 'cancelled' && status === 'cancelled') {
      const [items] = await conn.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ? AND product_id IS NOT NULL',
        [orderId]
      );
      for (const item of items) {
        await conn.query(
          'UPDATE products SET stock = stock + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    await conn.commit();
    return buildOrderResponse(conn, orderId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateOrderPaymentStatus(orderId, paymentStatus) {
  if (!isIn(paymentStatus, VALID_PAYMENT_STATUSES)) {
    throw new AppError('Invalid payment status', 400);
  }

  const [result] = await pool.query(
    'UPDATE orders SET payment_status = ? WHERE id = ?',
    [paymentStatus, orderId]
  );
  if (result.affectedRows === 0) throw new AppError('Order not found', 404);

  return buildOrderResponse(pool, orderId);
}

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderPaymentStatus,
};