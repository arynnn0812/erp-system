const { body, param, query } = require('express-validator');

const customerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Invalid email'),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
  body('address').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
];

const orderRules = [
  body('customerId').isInt({ min: 1 }).withMessage('customerId required'),
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.productId').isInt({ min: 1 }).withMessage('each item needs a productId'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('each item quantity must be >= 1'),
  body('taxPercent').optional().isFloat({ min: 0, max: 100 }),
  body('discount').optional().isFloat({ min: 0 }),
];

// Pagination values are interpolated into LIMIT/OFFSET (mysql2 cannot bind
// them), so they MUST be validated here: an unvalidated ?limit=abc becomes
// "LIMIT NaN" -> SQL parse error -> 500, and ?limit=999999 is a free table scan.
const orderListRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }), // cap page size
  query('customerId').optional().isInt({ min: 1 }),
  query('status').optional().isIn(['PENDING', 'CONFIRMED', 'CANCELLED']),
  query('from').optional().isDate().withMessage('from must be YYYY-MM-DD'),
  query('to').optional().isDate().withMessage('to must be YYYY-MM-DD'),
];

const reportRules = [
  query('from').isDate().withMessage('from date required (YYYY-MM-DD)'),
  query('to').isDate().withMessage('to date required (YYYY-MM-DD)'),
  query('limit').optional().isInt({ min: 1, max: 50 }), // top-products row cap
];

const idRule = [param('id').isInt({ min: 1 })];

module.exports = { customerRules, orderRules, orderListRules, reportRules, idRule };
