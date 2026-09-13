const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorMiddleware');
const { VALID_CONTACT_STATUSES, isIn } = require('../utils/validation');
const { logAdminActivity } = require('./adminController');

async function createMessage(req, res, next) {
  try {
    const { name, email, phone, subject, message } = req.body;

    await pool.query(
      `INSERT INTO contact_messages (name, email, phone, subject, message, status)
       VALUES (?, ?, ?, ?, ?, 'unread')`,
      [name, email, phone || null, subject || null, message]
    );

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully, we will get back to you soon',
    });
  } catch (err) {
    return next(err);
  }
}

async function listMessages(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM contact_messages ORDER BY id DESC'
    );
    return res.json({
      success: true,
      message: 'Contact messages retrieved',
      data: { messages: rows },
    });
  } catch (err) {
    return next(err);
  }
}

async function getMessage(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM contact_messages WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) throw new AppError('Message not found', 404);
    return res.json({
      success: true,
      message: 'Message retrieved',
      data: { message: rows[0] },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateMessageStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!isIn(status, VALID_CONTACT_STATUSES)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const [result] = await pool.query(
      'UPDATE contact_messages SET status = ? WHERE id = ?',
      [status, req.params.id]
    );
    if (result.affectedRows === 0) throw new AppError('Message not found', 404);

    const [rows] = await pool.query(
      'SELECT * FROM contact_messages WHERE id = ?',
      [req.params.id]
    );

    return res.json({
      success: true,
      message: 'Message status updated',
      data: { message: rows[0] },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { createMessage, listMessages, getMessage, updateMessageStatus };