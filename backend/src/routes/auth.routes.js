const express = require('express');
const rateLimit = require('express-rate-limit');

const { register, login, logout, me } = require('../controllers/auth.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const validate = require('../middleware/validate');
const { registerRules, loginRules } = require('../validators/auth.validator');

const router = express.Router();

// Brute-force protection on login only: 10 attempts / 15 min per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, try again in 15 minutes' },
});

// Middleware chains read left to right - the request passes each gate in order.
router.post('/register', authenticate, authorize('ADMIN'), registerRules, validate, register);
router.post('/login', loginLimiter, loginRules, validate, login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

module.exports = router;
