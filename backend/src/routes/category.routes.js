// RBAC policy: everyone logged-in can READ; only ADMIN and MANAGER can WRITE.
const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const validate = require('../middleware/validate');
const { categoryRules, idRule } = require('../validators/inventory.validator');
const ctrl = require('../controllers/category.controller');

const router = express.Router();

router.use(authenticate); // everything below requires a valid token

router.get('/', ctrl.list);
router.post('/', authorize('ADMIN', 'MANAGER'), categoryRules, validate, ctrl.create);
router.put('/:id', authorize('ADMIN', 'MANAGER'), idRule, categoryRules, validate, ctrl.update);
router.delete('/:id', authorize('ADMIN'), idRule, validate, ctrl.remove);

module.exports = router;
