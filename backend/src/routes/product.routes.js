// RBAC policy: read = any authenticated user; create/update/stock =
// ADMIN or MANAGER; delete = ADMIN only.
const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const validate = require('../middleware/validate');
const {
  productRules, stockRules, listRules, idRule,
} = require('../validators/inventory.validator');
const ctrl = require('../controllers/product.controller');

const router = express.Router();

router.use(authenticate);

// NOTE: /alerts/low-stock is declared BEFORE /:id, otherwise Express would
// match "alerts" as an :id value. Route order matters.
router.get('/alerts/low-stock', ctrl.lowStock);

router.get('/', listRules, validate, ctrl.list);
router.get('/:id', idRule, validate, ctrl.getOne);
router.post('/', authorize('ADMIN', 'MANAGER'), productRules, validate, ctrl.create);
router.put('/:id', authorize('ADMIN', 'MANAGER'), idRule, productRules, validate, ctrl.update);
router.delete('/:id', authorize('ADMIN'), idRule, validate, ctrl.remove);

router.post('/:id/stock', authorize('ADMIN', 'MANAGER'), stockRules, validate, ctrl.adjustStock);
router.get('/:id/transactions', idRule, listRules, validate, ctrl.transactions);

module.exports = router;
