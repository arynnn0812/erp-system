// Two-level access control:
//  - Route level: who can call the endpoint at all
//    (read: ADMIN/HR/MANAGER; write: ADMIN/HR only)
//  - Field level (in the model): MANAGER reads employees WITHOUT salary
const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const validate = require('../middleware/validate');
const { employeeRules, employeeListRules, idRule } = require('../validators/hr.validator');
const ctrl = require('../controllers/employee.controller');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('ADMIN', 'HR', 'MANAGER'), employeeListRules, validate, ctrl.list);
router.get('/:id', authorize('ADMIN', 'HR', 'MANAGER'), idRule, validate, ctrl.getOne);
router.post('/', authorize('ADMIN', 'HR'), employeeRules, validate, ctrl.create);
router.put('/:id', authorize('ADMIN', 'HR'), idRule, employeeRules, validate, ctrl.update);
router.delete('/:id', authorize('ADMIN'), idRule, validate, ctrl.remove);

module.exports = router;
