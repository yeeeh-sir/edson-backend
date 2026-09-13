const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorMiddleware');
const { logAdminActivity } = require('./adminController');

async function recomputeProductRating(productId) {
  const [agg] = await pool.query(
    `SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS review_count
     FROM product_reviews
     WHERE product_id = ? AND status = 'approved'`,
    [productId]
  );
  const avg = Math.round(Number(agg[0].avg_rating) * 10) / 10;
  await pool.query(
    'UPDATE products SET rating = ?, reviews_count = ? WHERE id = ?',
    [avg, Number(agg[0].review_count), productId]
  );
}

async function listProductReviews(req, res, next) {
  try {
    const productId = req.params.productId || req.params.id;

    const [products] = await pool.query('SELECT id FROM products WHERE id = ?', [productId]);
    if (products.length === 0) throw new AppError('Product not found', 404);

    const [rows] = await pool.query(
      `SELECT pr.id, pr.product_id, pr.user_id, pr.rating, pr.review, pr.status, pr.created_at,
              u.full_name, u.profile_image
       FROM product_reviews pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.product_id = ? AND pr.status = 'approved'
       ORDER BY pr.id DESC`,
      [productId]
    );

    const [agg] = await pool.query(
      `SELECT COUNT(*) AS total, COALESCE(AVG(rating), 0) AS avg_rating
       FROM product_reviews WHERE product_id = ? AND status = 'approved'`,
      [productId]
    );

    return res.json({
      success: true,
      message: 'Reviews retrieved',
      data: {
        reviews: rows,
        summary: {
          total: Number(agg[0].total),
          average: Math.round(Number(agg[0].avg_rating) * 10) / 10,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function createReview(req, res, next) {
  try {
    const productId = Number(req.params.productId || req.params.id);
    const { rating, review } = req.body;

    const [products] = await pool.query('SELECT id FROM products WHERE id = ?', [productId]);
    if (products.length === 0) throw new AppError('Product not found', 404);

    await pool.query(
      `INSERT INTO product_reviews (product_id, user_id, rating, review, status)
       VALUES (?, ?, ?, ?, 'approved')`,
      [productId, req.user.id, rating, review || null]
    );

    await recomputeProductRating(productId);

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
    });
  } catch (err) {
    return next(err);
  }
}

async function updateReview(req, res, next) {
  try {
    const { rating, review } = req.body;

    const [rows] = await pool.query(
      'SELECT id, user_id, product_id, status FROM product_reviews WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) throw new AppError('Review not found', 404);

    const rev = rows[0];
    const isOwner = Number(rev.user_id) === Number(req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    await pool.query(
      `UPDATE product_reviews SET rating = COALESCE(?, rating), review = COALESCE(?, review)
       WHERE id = ?`,
      [rating, review, req.params.id]
    );

    await recomputeProductRating(rev.product_id);

    return res.json({ success: true, message: 'Review updated successfully' });
  } catch (err) {
    return next(err);
  }
}

async function deleteReview(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, user_id, product_id FROM product_reviews WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) throw new AppError('Review not found', 404);

    const rev = rows[0];
    const isOwner = Number(rev.user_id) === Number(req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    await pool.query('DELETE FROM product_reviews WHERE id = ?', [req.params.id]);
    await recomputeProductRating(rev.product_id);

    return res.json({ success: true, message: 'Review deleted successfully' });
  } catch (err) {
    return next(err);
  }
}

async function moderateReview(req, res, next) {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const [rows] = await pool.query(
      'SELECT id, product_id FROM product_reviews WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) throw new AppError('Review not found', 404);

    await pool.query('UPDATE product_reviews SET status = ? WHERE id = ?', [
      status,
      req.params.id,
    ]);
    await recomputeProductRating(rows[0].product_id);

    await logAdminActivity(req, 'REVIEW_MODERATE', 'review', req.params.id, `Review status → ${status}`);

    return res.json({ success: true, message: 'Review status updated' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listProductReviews,
  createReview,
  updateReview,
  deleteReview,
  moderateReview,
  recomputeProductRating,
};