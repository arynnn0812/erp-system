const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const validate = require('../middleware/validate');
const { customerRules, idRule } = require('../validators/sales.validator');
const ctrl = require('../controllers/customer.controller');

const router = express.Router();
router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', idRule, validate, ctrl.getOne);
router.post('/', authorize('ADMIN', 'MANAGER'), customerRules, validate, ctrl.create);
router.put('/:id', authorize('ADMIN', 'MANAGER'), idRule, customerRules, validate, ctrl.update);

module.exports = router;
