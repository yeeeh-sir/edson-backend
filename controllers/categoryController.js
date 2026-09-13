const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorMiddleware');
const imageService = require('../services/imageService');
const { logAdminActivity } = require('./adminController');

async function getAllCategories(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
       WHERE c.status = 'active'
       GROUP BY c.id
       ORDER BY c.id ASC`
    );
    return res.json({
      success: true,
      message: 'Categories retrieved',
      data: { categories: rows },
    });
  } catch (err) {
    return next(err);
  }
}

async function getCategoryBySlug(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
       WHERE (LOWER(c.slug) = LOWER(?) OR LOWER(c.name) = LOWER(?) OR c.id = ?) AND c.status = 'active'
       GROUP BY c.id`,
      [
        String(req.params.slug || '').trim(),
        String(req.params.slug || '').trim(),
        String(req.params.slug || '').trim(),
      ]
    );

    if (rows.length === 0) throw new AppError('Category not found', 404);
    const category = rows[0];

    const [subcategories] = await pool.query(
      `SELECT id, name, slug, description FROM subcategories
       WHERE category_id = ? AND status = 'active' ORDER BY id ASC`,
      [category.id]
    );

    return res.json({
      success: true,
      message: 'Category retrieved',
      data: { category: { ...category, subcategories } },
    });
  } catch (err) {
    return next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const { name, slug, description, image } = req.body;

    await pool.query(
      `INSERT INTO categories (name, slug, description, image, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [name, slug, description || null, image || null]
    );

    const [rows] = await pool.query('SELECT * FROM categories WHERE slug = ?', [slug]);
    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category: rows[0] },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const { name, slug, description, image } = req.body;

    const [result] = await pool.query(
      `UPDATE categories SET name = COALESCE(?, name), slug = COALESCE(?, slug),
        description = COALESCE(?, description), image = COALESCE(?, image)
       WHERE id = ?`,
      [name, slug, description, image, req.params.id]
    );
    if (result.affectedRows === 0) throw new AppError('Category not found', 404);

    const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    return res.json({
      success: true,
      message: 'Category updated successfully',
      data: { category: rows[0] },
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) throw new AppError('Category not found', 404);

    return res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(409).json({
        success: false,
        message: 'Category has products or subcategories and cannot be deleted. Deactivate it instead.',
      });
    }
    return next(err);
  }
}

async function updateCategoryStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const [result] = await pool.query(
      'UPDATE categories SET status = ? WHERE id = ?',
      [status, req.params.id]
    );
    if (result.affectedRows === 0) throw new AppError('Category not found', 404);

    const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    return res.json({
      success: true,
      message: 'Category status updated',
      data: { category: rows[0] },
    });
  } catch (err) {
    return next(err);
  }
}

async function uploadCategoryImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    const [rows] = await pool.query(
      'SELECT id, image, image_public_id FROM categories WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) throw new AppError('Category not found', 404);
    const previous = rows[0];

    const uploaded = await imageService.storeImage(req.file, { folder: 'categories' });
    await pool.query(
      'UPDATE categories SET image = ?, image_public_id = ? WHERE id = ?',
      [uploaded.url, uploaded.publicId, req.params.id]
    );

    // Delete the previous asset only after the new upload was saved.
    // Deletes local (dev) files too, not just Cloudinary assets.
    const hasPrevious = previous.image_public_id || previous.image;
    const isSameAsset = previous.image_public_id && previous.image_public_id === uploaded.publicId;
    if (hasPrevious && !isSameAsset) {
      await imageService.deleteImage(previous.image_public_id, previous.image);
    }

    await logAdminActivity(req, 'IMAGE_UPLOAD', 'category', req.params.id, 'Updated category image');

    const [after] = await pool.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    return res.json({
      success: true,
      message: 'Category image updated',
      data: { category: after[0] },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getAllCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
  updateCategoryStatus,
  uploadCategoryImage,
};