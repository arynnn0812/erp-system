const { body, param, query } = require('express-validator');

const departmentRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
];

const employeeRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('Valid email required').toLowerCase(),
  body('departmentId').isInt({ min: 1 }).withMessage('departmentId required').toInt(),
  body('designation').trim().notEmpty().withMessage('Designation is required').isLength({ max: 100 }),
  body('joiningDate').isDate().withMessage('joiningDate must be YYYY-MM-DD'),
  body('salary').isFloat({ min: 0 }).withMessage('salary must be >= 0').toFloat(),
  // undefined = leave the link as is, null = unlink, id = link to that login
  body('userId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(),
];

// Same reason as the sales validators: page/limit reach LIMIT/OFFSET directly.
const employeeListRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('departmentId').optional().isInt({ min: 1 }),
];

const idRule = [param('id').isInt({ min: 1 })];

module.exports = { departmentRules, employeeRules, employeeListRules, idRule };
