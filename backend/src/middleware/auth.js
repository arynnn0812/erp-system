// Authentication middleware: verifies the JWT and attaches req.user.
// Runs BEFORE any protected controller.
//
// The token is accepted from the httpOnly session cookie (browser) or an
// Authorization: Bearer header (Postman, scripts, other services).
//
// A valid signature is not enough on its own: the user row is re-read on every
// request, so deactivation, role changes and "log out everywhere" apply to
// tokens already in circulation instead of waiting out their expiry.
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const userModel = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { SESSION_COOKIE, readCookie } = require('../utils/cookies');

function extractToken(req) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme === 'Bearer' && token) return token;
  return readCookie(req, SESSION_COOKIE);
}

async function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return next(new ApiError(401, 'Authentication required')); // 401 = who are you?
  }

  let payload;
  try {
    // verify() checks the signature AND the exp claim. Pinning the algorithm
    // stops a token from choosing how it gets verified.
    payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Token expired, please log in again'
      : 'Invalid token';
    return next(new ApiError(401, msg));
  }

  try {
    const user = await userModel.findAuthState(payload.id);
    if (!user || !user.is_active || user.token_version !== payload.tv) {
      return next(new ApiError(401, 'Session is no longer valid, please log in again'));
    }
    // Role from the database, not the token: a demotion takes effect now.
    req.user = { id: user.id, role: user.role };
    // Kept for long-lived requests (the live stream) that re-check the session.
    req.auth = { tv: payload.tv, exp: payload.exp };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authenticate;
