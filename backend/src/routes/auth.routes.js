const express = require('express');
const rateLimit = require('express-rate-limit');

const ctrl = require('../controllers/auth.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const validate = require('../middleware/validate');
const { registerRules, loginRules, changePasswordRules } = require('../validators/auth.validator');
const config = require('../config/env');

const router = express.Router();

// Brute-force protection: 10 FAILED attempts / 15 min per IP. Successful
// logins are not counted, so an office sharing one IP is not locked out by
// its own staff signing in.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.rateLimit.loginMax,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, try again in 15 minutes' },
});

// Middleware chains read left to right - the request passes each gate in order.
router.post('/register', authenticate, authorize('ADMIN'), registerRules, validate, ctrl.register);
router.post('/login', loginLimiter, loginRules, validate, ctrl.login);
router.post('/logout', ctrl.logout); // clearing a cookie needs no valid session
router.post('/logout-all', authenticate, ctrl.logoutAll);
router.post('/change-password', authenticate, loginLimiter, changePasswordRules, validate, ctrl.changePassword);
router.get('/me', authenticate, ctrl.me);
router.get('/profile', authenticate, ctrl.profile);

module.exports = router;
