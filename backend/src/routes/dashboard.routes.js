const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const ctrl = require('../controllers/dashboard.controller');

const router = express.Router();
router.use(authenticate);

// Summary is open to all roles - the CONTROLLER decides which numbers
// each role receives (role-aware view).
router.get('/summary', ctrl.summary);

// Chart data is sales-sensitive: ADMIN + MANAGER only.
router.get('/sales-trend', authorize('ADMIN', 'MANAGER'), ctrl.salesTrend);
router.get('/category-sales', authorize('ADMIN', 'MANAGER'), ctrl.categories);
router.get('/top-products', authorize('ADMIN', 'MANAGER'), ctrl.topProducts);

module.exports = router;
