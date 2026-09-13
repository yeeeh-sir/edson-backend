const multer = require('multer');

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

function notifyNotFound(req, res, next) {
  return res.status(404).json({
    success: false,
    message: 'Route not found',
  });
}

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';

  if (err instanceof multer.MulterError) {
    statusCode = 400;
    message = `Upload error: ${err.message}`;
  }

  if (err.message && /image files are allowed/i.test(err.message)) {
    statusCode = 422;
  }

  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'A record with this value already exists';
  }

  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
    statusCode = 409;
    message = 'This record is still referenced by other data and cannot be deleted';
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    statusCode = 400;
    message = 'Referenced record does not exist';
  }

  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'Something went wrong';
  }

  if (statusCode >= 500) {
    console.error('[Server error]', err);
  }

  return res.status(statusCode).json({
    success: false,
    message,
  });
}

module.exports = { AppError, notifyNotFound, errorHandler };