// Wraps async controllers so a rejected promise reaches the error middleware.
// Without this, every controller would need its own try/catch { next(err) }.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
