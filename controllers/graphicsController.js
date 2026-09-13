const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorMiddleware');
const imageService = require('../services/imageService');
const { logAdminActivity } = require('./adminController');
const { VALID_GRAPHICS_REQUEST_STATUSES, isIn } = require('../utils/validation');

async function listGraphicsServices(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, slug, description, category, starting_price, image,
              is_featured, is_active, created_at
       FROM graphics_services WHERE is_active = 1 ORDER BY id ASC`
    );
    return res.json({
      success: true,
      message: 'Graphics services retrieved',
      data: { services: rows },
    });
  } catch (err) {
    return next(err);
  }
}

async function getGraphicsService(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM graphics_services WHERE id = ? AND is_active = 1',
      [req.params.id]
    );
    if (rows.length === 0) throw new AppError('Graphics service not found', 404);
    return res.json({
      success: true,
      message: 'Graphics service retrieved',
      data: { service: rows[0] },
    });
  } catch (err) {
    return next(err);
  }
}

async function createGraphicsService(req, res, next) {
  try {
    const { name, slug, description, category, starting_price, is_featured } = req.body;

    let image = req.body.image || null;
    if (req.file) {
      const uploaded = await imageService.storeImage(req.file, { folder: 'graphics' });
      image = uploaded.url;
    }

    const [result] = await pool.query(
      `INSERT INTO graphics_services
        (name, slug, description, category, starting_price, image, is_featured, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [name, slug, description || null, category || null, starting_price || 0, image, is_featured ? 1 : 0]
    );

    await logAdminActivity(req, 'CREATE', 'graphics_service', result.insertId, `Created graphics service "${name}"`);

    const [rows] = await pool.query('SELECT * FROM graphics_services WHERE id = ?', [result.insertId]);
    return res.status(201).json({
      success: true,
      message: 'Graphics service created',
      data: { service: rows[0] },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateGraphicsService(req, res, next) {
  try {
    const { name, slug, description, category, starting_price, is_featured, is_active } = req.body;

    let image = req.body.image;
    if (req.file) {
      const uploaded = await imageService.storeImage(req.file, { folder: 'graphics' });
      image = uploaded.url;
    }

    const [result] = await pool.query(
      `UPDATE graphics_services SET
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        starting_price = COALESCE(?, starting_price),
        is_featured = COALESCE(?, is_featured),
        is_active = COALESCE(?, is_active),
        image = COALESCE(?, image)
       WHERE id = ?`,
      [
        name,
        slug,
        description,
        category,
        starting_price,
        is_featured !== undefined ? (is_featured ? 1 : 0) : undefined,
        is_active !== undefined ? (is_active ? 1 : 0) : undefined,
        image,
        req.params.id,
      ]
    );
    if (result.affectedRows === 0) throw new AppError('Graphics service not found', 404);

    const [rows] = await pool.query('SELECT * FROM graphics_services WHERE id = ?', [req.params.id]);
    return res.json({
      success: true,
      message: 'Graphics service updated',
      data: { service: rows[0] },
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteGraphicsService(req, res, next) {
  try {
    const [result] = await pool.query('DELETE FROM graphics_services WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) throw new AppError('Graphics service not found', 404);

    if (req.user && req.user.id) {
      await logAdminActivity(req, 'DELETE', 'graphics_service', req.params.id, 'Deleted graphics service');
    }

    return res.json({ success: true, message: 'Graphics service deleted' });
  } catch (err) {
    return next(err);
  }
}

async function createGraphicsRequest(req, res, next) {
  try {
    const {
      customer_name,
      phone,
      email,
      service_id,
      design_type,
      size,
      quantity,
      description,
    } = req.body;

    let referenceImage = req.body.reference_image || null;
    if (req.file) {
      const uploaded = await imageService.storeImage(req.file, { folder: 'graphics' });
      referenceImage = uploaded.url;
    }

    const userId = req.user ? req.user.id : null;
    const name = customer_name || (req.user && req.user.full_name) || null;
    const emailValue = email || (req.user && req.user.email) || null;

    const [result] = await pool.query(
      `INSERT INTO graphics_requests
        (user_id, customer_name, phone, email, service_id, design_type, size, quantity, description, reference_image, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        userId,
        name,
        phone || null,
        emailValue,
        service_id || null,
        design_type || null,
        size || null,
        quantity || 1,
        description || null,
        referenceImage,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Design request received! Our studio will contact you shortly.',
      data: { request_id: result.insertId, status: 'pending' },
    });
  } catch (err) {
    return next(err);
  }
}

async function listGraphicsRequests(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT gr.*, gs.name AS service_name
       FROM graphics_requests gr
       LEFT JOIN graphics_services gs ON gs.id = gr.service_id
       ORDER BY gr.id DESC`
    );
    return res.json({
      success: true,
      message: 'Graphics requests retrieved',
      data: { requests: rows },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateGraphicsRequestStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!isIn(status, VALID_GRAPHICS_REQUEST_STATUSES)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const [result] = await pool.query(
      'UPDATE graphics_requests SET status = ? WHERE id = ?',
      [status, req.params.id]
    );
    if (result.affectedRows === 0) throw new AppError('Request not found', 404);

    await logAdminActivity(req, 'REQUEST_STATUS', 'graphics_request', req.params.id, `Request status → ${status}`);

    const [rows] = await pool.query('SELECT * FROM graphics_requests WHERE id = ?', [req.params.id]);
    return res.json({
      success: true,
      message: 'Request status updated',
      data: { request: rows[0] },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listGraphicsServices,
  getGraphicsService,
  createGraphicsService,
  updateGraphicsService,
  deleteGraphicsService,
  createGraphicsRequest,
  listGraphicsRequests,
  updateGraphicsRequestStatus,
};