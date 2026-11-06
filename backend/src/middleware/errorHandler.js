// Centralized error handling.
// Express recognizes a 4-argument middleware as the error handler.
// Every route/controller just calls next(err); the response format for ALL
// errors is decided here, in one place.
const config = require('../config/env');
const logger = require('../utils/logger');

// 404 - reached only when no route matched
function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

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

  // Constraint violations are client errors, not crashes. Services check the
  // common cases first for friendlier messages; this catches the rest, including
  // two requests racing past the same "does it exist?" check.
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'A record with this value already exists' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ success: false, message: 'A referenced record does not exist' });
  }

  const statusCode = err.statusCode || 500;

  // Operational errors (thrown as ApiError) are safe to show the client.
  // Unknown 500s get a generic message - never leak stack traces / SQL errors.
  const message =
    err.isOperational || statusCode < 500
      ? err.message
      : 'Internal server error';

  if (statusCode >= 500) {
    (req.log || logger).error({ err }, 'unhandled error'); // carries the request id
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Lets a user report "it failed" with an id support can find in the logs.
    ...(statusCode >= 500 && { requestId: req.id }),
    // stack trace only in development, for debugging
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
