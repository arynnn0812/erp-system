// Centralized error handling.
// Express recognizes a 4-argument middleware as the error handler.
// Every route/controller just calls next(err); the response format for ALL
// errors is decided here, in one place.
const config = require('../config/env');

// 404 - reached only when no route matched
function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Multer throws its own error class, which carries no statusCode - without
  // this branch an oversized upload would fall through to a generic 500
  // "Internal server error" instead of telling the client what went wrong.
  if (err.name === 'MulterError') {
    const isTooLarge = err.code === 'LIMIT_FILE_SIZE';
    return res.status(isTooLarge ? 413 : 400).json({
      success: false,
      message: isTooLarge
        ? 'File too large (maximum 5 MB)'
        : `Upload error: ${err.message}`,
    });
  }

  const statusCode = err.statusCode || 500;

  // Operational errors (thrown as ApiError) are safe to show the client.
  // Unknown 500s get a generic message - never leak stack traces / SQL errors.
  const message =
    err.isOperational || statusCode < 500
      ? err.message
      : 'Internal server error';

  if (statusCode >= 500) {
    console.error(err); // in production this would go to a proper logger
  }

  res.status(statusCode).json({
    success: false,
    message,
    // stack trace only in development, for debugging
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
