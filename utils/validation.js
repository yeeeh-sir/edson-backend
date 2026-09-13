const { validationResult } = require('express-validator');

const VALID_ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

const VALID_GRAPHICS_REQUEST_STATUSES = [
  'pending',
  'reviewing',
  'approved',
  'in_progress',
  'completed',
  'cancelled',
];

const VALID_CONTACT_STATUSES = ['unread', 'read', 'replied'];
const VALID_REVIEW_STATUSES = ['pending', 'approved', 'rejected'];
const VALID_USER_STATUSES = ['active', 'inactive', 'blocked'];

function isIn(value, list) {
  return Array.isArray(list) && list.includes(value);
}

function isPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0;
}

function isPrice(value) {
  return typeof value === 'number' && isFinite(value) && value >= 0;
}

function runValidation(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  return res.status(422).json({
    success: false,
    message: 'Validation failed',
    errors: errors.array().map((e) => ({
      field: e.path || e.param,
      message: e.msg,
    })),
  });
}

module.exports = {
  VALID_ORDER_STATUSES,
  VALID_PAYMENT_STATUSES,
  VALID_GRAPHICS_REQUEST_STATUSES,
  VALID_CONTACT_STATUSES,
  VALID_REVIEW_STATUSES,
  VALID_USER_STATUSES,
  isIn,
  isPositiveInt,
  isPrice,
  runValidation,
};