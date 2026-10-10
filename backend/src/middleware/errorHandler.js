const env = require('../config/env');
const AppError = require('../utils/AppError');

const notFound = (req, res, next) => next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));

// Single place where every error becomes a consistent { success: false, message, errors? } response.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message;
  let errors = err.errors;
  let trusted = err.isOperational === true;

  if (err.name === 'CastError') {
    statusCode = 400; message = `Invalid value for ${err.path}`; trusted = true;
  } else if (err.name === 'ValidationError') {
    statusCode = 400; message = 'Validation failed'; trusted = true;
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    statusCode = 409; message = `A record with this ${field} already exists`; trusted = true;
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401; message = 'Token expired. Please log in again.'; trusted = true;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401; message = 'Invalid token. Please log in again.'; trusted = true;
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400; message = 'Malformed JSON in request body'; trusted = true;
  } else if (err.type === 'entity.too.large') {
    statusCode = 413; message = 'Request body too large'; trusted = true;
  }

  // Unexpected errors: log on the server, hide details from the client in production.
  if (!trusted) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
    statusCode = 500;
    if (env.nodeEnv === 'production') message = 'Something went wrong. Please try again later.';
  }

  const body = { success: false, message };
  if (errors) body.errors = errors;
  if (env.nodeEnv !== 'production' && !trusted) body.stack = err.stack;

  res.status(statusCode).json(body);
};

module.exports = { notFound, errorHandler };
