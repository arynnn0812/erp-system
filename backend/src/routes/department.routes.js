// Read: any authenticated user. Write: ADMIN or HR.
const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const validate = require('../middleware/validate');
const { departmentRules, idRule } = require('../validators/hr.validator');
const ctrl = require('../controllers/department.controller');

const router = express.Router();
router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', authorize('ADMIN', 'HR'), departmentRules, validate, ctrl.create);
router.put('/:id', authorize('ADMIN', 'HR'), idRule, departmentRules, validate, ctrl.update);
router.delete('/:id', authorize('ADMIN'), idRule, validate, ctrl.remove);

module.exports = router;
