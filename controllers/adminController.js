const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorMiddleware');
const { VALID_USER_STATUSES, isIn } = require('../utils/validation');
const imageService = require('../services/imageService');

async function logAdminActivity(req, action, entityType, entityId, description) {
  if (!req.user || req.user.role !== 'admin' || !req.user.id) return;
  try {
    await pool.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, description, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        action,
        entityType || null,
        entityId !== undefined && entityId !== null ? String(entityId) : null,
        description || null,
        req.ip || null,
      ]
    );
  } catch (err) {
    console.warn('[adminController] Activity log write failed:', err.message);
  }
}

async function getDashboard(req, res, next) {
  try {
    const [
      [productStats],
      [customerStats],
      [orderStats],
      [revenueStats],
      [pendingStats],
      [processingStats],
      [deliveredStats],
      [lowStockRows],
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total FROM products'),
      pool.query("SELECT COUNT(*) AS total FROM users WHERE role = 'customer'"),
      pool.query("SELECT COUNT(*) AS total FROM orders WHERE status != 'cancelled'"),
      pool.query(
        "SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE status != 'cancelled'"
      ),
      pool.query("SELECT COUNT(*) AS total FROM orders WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*) AS total FROM orders WHERE status = 'processing'"),
      pool.query("SELECT COUNT(*) AS total FROM orders WHERE status = 'delivered'"),
      pool.query('SELECT COUNT(*) AS total FROM products WHERE stock <= 10'),
    ]);

    const [recentRows] = await pool.query(
      `SELECT o.id, o.order_number, o.total, o.status, o.payment_status, o.created_at,
              u.full_name AS customer_name
       FROM orders o LEFT JOIN users u ON o.user_id = u.id
       ORDER BY o.id DESC LIMIT 5`
    );

    const [productRows] = await pool.query(
      `SELECT id, name, slug, price, stock, main_image, is_active FROM products
       ORDER BY id DESC LIMIT 5`
    );

    const [weeklyRows] = await pool.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
       FROM orders
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`
    );

    const [categoryRows] = await pool.query(
      `SELECT c.name, COUNT(p.id) AS products
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id, c.name`
    );

    const [monthlyRows] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COALESCE(SUM(total), 0) AS revenue
       FROM orders
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month ASC`
    );

    return res.json({
      success: true,
      message: 'Dashboard data retrieved',
      data: {
        stats: {
          total_products: productStats[0].total,
          total_customers: customerStats[0].total,
          total_orders: orderStats[0].total,
          total_revenue: Math.round(Number(revenueStats[0].total) * 100) / 100,
          pending_orders: pendingStats[0].total,
          processing_orders: processingStats[0].total,
          delivered_orders: deliveredStats[0].total,
          low_stock_products: lowStockRows[0].total,
        },
        recent_orders: recentRows,
        recent_products: productRows,
        charts: {
          weekly: weeklyRows,
          category_split: categoryRows,
          monthly_revenue: monthlyRows,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : null;

    const conditions = ["u.role = 'customer'"];
    const values = [];
    if (search) {
      conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
      const q = `%${search}%`;
      values.push(q, q, q);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM users u ${whereSql}`,
      values
    );
    const total = Number(countRows[0].total);
    const totalPages = Math.ceil(total / limit) || 1;

    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.profile_image, u.google_id, u.address, u.city,
              u.country, u.status, u.created_at,
              (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders_count,
              (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.user_id = u.id) AS spent
       FROM users u ${whereSql}
       ORDER BY u.id DESC LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );

    return res.json({
      success: true,
      message: 'Users retrieved',
      data: { users: rows, pagination: { page, limit, total, totalPages } },
    });
  } catch (err) {
    return next(err);
  }
}

async function getUserById(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, email, phone, role, profile_image, address, city, country, status, created_at
       FROM users WHERE id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) throw new AppError('User not found', 404);

    const user = rows[0];

    const [orderRows] = await pool.query(
      `SELECT COUNT(*) AS orders_count, COALESCE(SUM(total), 0) AS spent
       FROM orders WHERE user_id = ?`,
      [user.id]
    );

    const [recentOrders] = await pool.query(
      `SELECT id, order_number, total, status, payment_status, created_at
       FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 10`,
      [user.id]
    );

    return res.json({
      success: true,
      message: 'User retrieved',
      data: { user: { ...user, ...orderRows[0] }, recent_orders: recentOrders },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateUserStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!isIn(status, VALID_USER_STATUSES)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const [rows] = await pool.query('SELECT id, role, status FROM users WHERE id = ?', [
      req.params.id,
    ]);
    if (rows.length === 0) throw new AppError('User not found', 404);

    const target = rows[0];

    // Prevent an admin from deactivating their own account.
    if (Number(target.id) === Number(req.user.id) && status !== 'active') {
      return res
        .status(400)
        .json({ success: false, message: 'You cannot disable your own account' });
    }

    // Never remove the last active admin.
    if (target.role === 'admin' && status !== 'active') {
      const [adminRows] = await pool.query(
        "SELECT COUNT(*) AS active_admins FROM users WHERE role = 'admin' AND status = 'active'"
      );
      if (Number(adminRows[0].active_admins) <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the last active admin account',
        });
      }
    }

    await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, target.id]);

    await logAdminActivity(
      req,
      'USER_STATUS',
      'user',
      target.id,
      `User ${target.id} status → ${status}`
    );

    const [updated] = await pool.query(
      `SELECT id, full_name, email, role, status, updated_at FROM users WHERE id = ?`,
      [target.id]
    );

    return res.json({
      success: true,
      message: 'User status updated',
      data: { user: updated[0] },
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, role, profile_image, profile_image_public_id FROM users WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) throw new AppError('User not found', 404);
    const target = rows[0];

    if (target.role !== 'customer') {
      return res.status(400).json({ success: false, message: 'Only customer accounts can be deleted' });
    }
    if (Number(target.id) === Number(req.user.id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    const [orderRows] = await pool.query('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?', [target.id]);
    if (Number(orderRows[0].total) > 0) {
      return res.status(400).json({ success: false, message: 'This customer has order history and cannot be deleted' });
    }

    if (target.profile_image_public_id || target.profile_image) {
      await imageService.deleteImage(target.profile_image_public_id, target.profile_image);
    }
    await pool.query('DELETE FROM users WHERE id = ?', [target.id]);

    await logAdminActivity(req, 'USER_DELETE', 'user', target.id, `Deleted customer ${target.id}`);

    return res.json({ success: true, message: 'Customer deleted', data: { id: target.id } });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  logAdminActivity,
  getDashboard,
  listUsers,
  getUserById,
  updateUserStatus,
  deleteUser,
};