const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const validate = require('../middleware/validate');
const { orderRules, orderListRules, reportRules, idRule } = require('../validators/sales.validator');
const ctrl = require('../controllers/order.controller');

const router = express.Router();
router.use(authenticate);

// Orders expose revenue, customers and margins - reads are ADMIN/MANAGER only,
// matching the dashboard's sales endpoints. (The frontend hides these routes
// too, but that is UX; this is the enforcement.)
const salesRead = authorize('ADMIN', 'MANAGER');

// Reports before /:id (route order - same trap as /alerts/low-stock)
router.get('/reports/summary', salesRead, reportRules, validate, ctrl.summary);
router.get('/reports/top-products', salesRead, reportRules, validate, ctrl.top);

router.get('/', salesRead, orderListRules, validate, ctrl.list);
router.get('/:id', salesRead, idRule, validate, ctrl.getOne);
router.post('/', authorize('ADMIN', 'MANAGER'), orderRules, validate, ctrl.create);
router.post('/:id/cancel', authorize('ADMIN', 'MANAGER'), idRule, validate, ctrl.cancel);

module.exports = router;
