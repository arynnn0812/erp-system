// Input validation rules. Validation happens at the edge - before any
// business logic or SQL runs.
const { body } = require('express-validator');

const ROLES = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'];

// Lower-case + trim only. The default normalizeEmail() also strips dots and
// +tags from Gmail addresses, so the stored email silently differs from the
// real one (john.doe@gmail.com -> johndoe@gmail.com).
const emailRule = (field) => body(field).trim().isEmail().withMessage('Valid email required')
  .isLength({ max: 255 }).toLowerCase();

// bcrypt only uses the first 72 BYTES of a password; anything after that is
// silently ignored, so longer input would give a false sense of strength.
const passwordRule = (field) => body(field)
  .isString().withMessage('Password is required')
  .isLength({ min: 10 }).withMessage('Password must be at least 10 characters')
  .custom((v) => Buffer.byteLength(v, 'utf8') <= 72).withMessage('Password must be at most 72 bytes')
  .matches(/[A-Za-z]/).withMessage('Password must contain a letter')
  .matches(/\d/).withMessage('Password must contain a number');

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name too long'),
  emailRule('email'),
  passwordRule('password'),
  body('role').isIn(ROLES).withMessage('Role must be ADMIN, HR, MANAGER or EMPLOYEE'),
];

const loginRules = [
  emailRule('email'),
  body('password').notEmpty().withMessage('Password is required'),
];

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  passwordRule('newPassword'),
];

module.exports = { ROLES, passwordRule, registerRules, loginRules, changePasswordRules };
