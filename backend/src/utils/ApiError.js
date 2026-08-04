// Custom error class: lets controllers/services throw errors that carry an
// HTTP status code. The centralized error middleware reads statusCode and
// builds the response - so no controller ever formats error JSON itself.
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // "expected" error (bad input etc.), safe to show message
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
