// Authorization middleware (RBAC). Factory pattern: authorize('ADMIN','HR')
// returns a middleware allowing only those roles.
// Must run AFTER authenticate (it needs req.user).
const ApiError = require('../utils/ApiError');

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      // Programming error: authorize used without authenticate before it
      return next(new ApiError(401, 'Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      // 403 = we know who you are, you're just not allowed (vs 401 = who are you?)
      return next(new ApiError(403, 'Forbidden: insufficient role'));
    }
    next();
  };
}

module.exports = authorize;
