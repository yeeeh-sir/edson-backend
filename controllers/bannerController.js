const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorMiddleware');
const imageService = require('../services/imageService');
const { logAdminActivity } = require('./adminController');

const BANNER_FIELDS = 'id, title, subtitle, image_url, image_public_id, link_url, sort_order, is_active, created_at, updated_at';

async function listBanners(req, res, next) {
  try {
    const where = req.query.active === '1' ? ' WHERE is_active = 1' : '';
    const [rows] = await pool.query(
      `SELECT ${BANNER_FIELDS} FROM banners${where} ORDER BY sort_order ASC, id ASC`
    );
    return res.json({
      success: true,
      message: 'Banners retrieved',
      data: { banners: rows },
    });
  } catch (err) {
    return next(err);
  }
}

async function createBanner(req, res, next) {
  try {
    const { title, subtitle, link_url, sort_order } = req.body;
    const [result] = await pool.query(
      `INSERT INTO banners (title, subtitle, link_url, sort_order, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [title || null, subtitle || null, link_url || null, Number(sort_order) || 0]
    );

    await logAdminActivity(req, 'CREATE', 'banner', result.insertId, `Created banner "${title || 'Untitled'}"`);

    const [rows] = await pool.query('SELECT * FROM banners WHERE id = ?', [result.insertId]);
    return res.status(201).json({
      success: true,
      message: 'Banner created. Upload an image to display it.',
      data: { banner: rows[0] },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateBanner(req, res, next) {
  try {
    const { title, subtitle, link_url, sort_order, is_active } = req.body;
    const [result] = await pool.query(
      `UPDATE banners SET
         title = COALESCE(?, title),
         subtitle = COALESCE(?, subtitle),
         link_url = COALESCE(?, link_url),
         sort_order = COALESCE(?, sort_order),
         is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        title ?? null,
        subtitle ?? null,
        link_url ?? null,
        sort_order !== undefined ? Number(sort_order) : undefined,
        is_active !== undefined ? (is_active ? 1 : 0) : undefined,
        req.params.id,
      ]
    );
    if (result.affectedRows === 0) throw new AppError('Banner not found', 404);

    await logAdminActivity(req, 'UPDATE', 'banner', req.params.id, 'Updated banner');

    const [rows] = await pool.query('SELECT * FROM banners WHERE id = ?', [req.params.id]);
    return res.json({
      success: true,
      message: 'Banner updated',
      data: { banner: rows[0] },
    });
  } catch (err) {
    return next(err);
  }
}

async function uploadBannerImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    const [rows] = await pool.query(
      'SELECT id, image_url, image_public_id FROM banners WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) throw new AppError('Banner not found', 404);
    const previous = rows[0];

    const uploaded = await imageService.storeImage(req.file, { folder: 'banners' });
    await pool.query(
      'UPDATE banners SET image_url = ?, image_public_id = ? WHERE id = ?',
      [uploaded.url, uploaded.publicId, req.params.id]
    );

    // Only delete the previous asset after the new upload was saved.
    // Deletes local (dev) files too, not just Cloudinary assets.
    const hasPrevious = previous.image_public_id || previous.image_url;
    const isSameAsset = previous.image_public_id && previous.image_public_id === uploaded.publicId;
    if (hasPrevious && !isSameAsset) {
      await imageService.deleteImage(previous.image_public_id, previous.image_url);
    }

    await logAdminActivity(req, 'IMAGE_UPLOAD', 'banner', req.params.id, 'Updated banner image');

    const [after] = await pool.query('SELECT * FROM banners WHERE id = ?', [req.params.id]);
    return res.json({
      success: true,
      message: 'Banner image updated',
      data: { banner: after[0] },
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteBanner(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, image_url, image_public_id FROM banners WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) throw new AppError('Banner not found', 404);

    await pool.query('DELETE FROM banners WHERE id = ?', [req.params.id]);
    await imageService.deleteImage(rows[0].image_public_id, rows[0].image_url);

    await logAdminActivity(req, 'DELETE', 'banner', req.params.id, 'Deleted banner');

    return res.json({ success: true, message: 'Banner deleted' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listBanners, createBanner, updateBanner, uploadBannerImage, deleteBanner };