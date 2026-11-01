const { body, query, param } = require('express-validator');

const uploadRules = [
  body('ownerType').isIn(['EMPLOYEE', 'PRODUCT']).withMessage("ownerType must be EMPLOYEE or PRODUCT"),
  body('ownerId').isInt({ min: 1 }).withMessage('ownerId required').toInt(),
];

const listRules = [
  query('ownerType').isIn(['EMPLOYEE', 'PRODUCT']).withMessage("ownerType must be EMPLOYEE or PRODUCT"),
  query('ownerId').isInt({ min: 1 }).withMessage('ownerId required'),
];

const idRule = [param('id').isInt({ min: 1 })];

module.exports = { uploadRules, listRules, idRule };
