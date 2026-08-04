// Input validation rules. Validation happens at the edge - before any
// business logic or SQL runs.
const { body } = require('express-validator');

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name too long'),
  body('email').trim().isEmail().withMessage('Valid email required')
    .normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'])
    .withMessage('Role must be ADMIN, HR, MANAGER or EMPLOYEE'),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

module.exports = { registerRules, loginRules };
