const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorMiddleware');

const WISHLIST_FIELDS = `
  w.id AS wishlist_id, w.product_id, w.created_at,
  p.name AS product_name, p.slug AS product_slug, p.sku,
  p.price, p.old_price, p.discount, p.stock,
  p.main_image, p.rating, p.reviews_count,
  c.slug AS category_slug, c.name AS category_name`;

async function getWishlist(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT ${WISHLIST_FIELDS}
       FROM wishlists w
       JOIN products p ON p.id = w.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE w.user_id = ? AND p.is_active = 1
       ORDER BY w.id DESC`,
      [req.user.id]
    );

    return res.json({
      success: true,
      message: 'Wishlist retrieved',
      data: { items: rows, count: rows.length },
    });
  } catch (err) {
    return next(err);
  }
}

async function addToWishlist(req, res, next) {
  try {
    const productId = Number(req.params.productId);

    const [products] = await pool.query('SELECT id FROM products WHERE id = ?', [productId]);
    if (products.length === 0) throw new AppError('Product not found', 404);

    await pool.query(
      'INSERT IGNORE INTO wishlists (user_id, product_id) VALUES (?, ?)',
      [req.user.id, productId]
    );

    return res.status(201).json({ success: true, message: 'Added to wishlist' });
  } catch (err) {
    return next(err);
  }
}

async function removeFromWishlist(req, res, next) {
  try {
    await pool.query(
      'DELETE FROM wishlists WHERE user_id = ? AND product_id = ?',
      [req.user.id, Number(req.params.productId)]
    );

    return res.json({ success: true, message: 'Removed from wishlist' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getWishlist, addToWishlist, removeFromWishlist };