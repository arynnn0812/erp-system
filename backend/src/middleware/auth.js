// Authentication middleware: verifies the JWT and attaches req.user.
// Runs BEFORE any protected controller.
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

function authenticate(req, res, next) {
  // Expected header:  Authorization: Bearer <token>
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Authentication required')); // 401 = who are you?
  }

  try {
    // verify() checks the signature AND the exp claim. If either fails
    // it throws - an attacker can't forge or extend a token without the secret.
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Token expired, please log in again'
      : 'Invalid token';
    next(new ApiError(401, msg));
  }
}

module.exports = authenticate;
