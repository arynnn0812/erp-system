const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const validate = require('../middleware/validate');
const { trendRules, topRules } = require('../validators/dashboard.validator');
const ctrl = require('../controllers/dashboard.controller');
const { stream } = require('../controllers/stream.controller');

const router = express.Router();
router.use(authenticate);

// Summary is open to all roles - the CONTROLLER decides which numbers
// each role receives (role-aware view).
router.get('/summary', ctrl.summary);

// Live updates (Server-Sent Events): every role. Events only say "something
// changed"; the refetch goes through the role-checked endpoints above.
router.get('/stream', stream);

// Chart data is sales-sensitive: ADMIN + MANAGER only.
router.get('/sales-trend', authorize('ADMIN', 'MANAGER'), trendRules, validate, ctrl.salesTrend);
router.get('/category-sales', authorize('ADMIN', 'MANAGER'), ctrl.categories);
router.get('/top-products', authorize('ADMIN', 'MANAGER'), topRules, validate, ctrl.topProducts);

module.exports = router;
