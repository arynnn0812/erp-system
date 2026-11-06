const { body, param, query } = require('express-validator');

const customerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Invalid email'),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
  body('address').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
];

const orderRules = [
  body('customerId').isInt({ min: 1 }).withMessage('customerId required').toInt(),
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.productId').isInt({ min: 1 }).withMessage('each item needs a productId').toInt(),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('each item quantity must be >= 1').toInt(),
  body('taxPercent').optional().isFloat({ min: 0, max: 100 }).toFloat(),
  body('discount').optional().isFloat({ min: 0 }).toFloat(),
];

// Pagination values are interpolated into LIMIT/OFFSET (mysql2 cannot bind
// them), so they MUST be validated here: an unvalidated ?limit=abc becomes
// "LIMIT NaN" -> SQL parse error -> 500, and ?limit=999999 is a free table scan.
const pageRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100').toInt(),
  query('search').optional().isString().trim().isLength({ max: 100 }),
];

const orderListRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }), // cap page size
  query('customerId').optional().isInt({ min: 1 }).toInt(),
  query('status').optional().isIn(['PENDING', 'CONFIRMED', 'CANCELLED']),
  query('from').optional().isDate().withMessage('from must be YYYY-MM-DD'),
  query('to').optional().isDate().withMessage('to must be YYYY-MM-DD'),
];

// A report covers at most about a year: enough for any real question, and it
// bounds the work one request can ask of the database (and the CSV size).
const MAX_REPORT_DAYS = 366;
const reportRules = [
  query('from').isDate().withMessage('from date required (YYYY-MM-DD)'),
  query('to').isDate().withMessage('to date required (YYYY-MM-DD)')
    .custom((to, { req }) => {
      const days = (Date.parse(to) - Date.parse(req.query.from)) / 86400000;
      if (days < 0) throw new Error('to must be on or after from');
      if (days > MAX_REPORT_DAYS) throw new Error(`a report can cover at most ${MAX_REPORT_DAYS} days`);
      return true;
    }),
  query('limit').optional().isInt({ min: 1, max: 50 }), // top-products row cap
];

const idRule = [param('id').isInt({ min: 1 })];

module.exports = { customerRules, pageRules, orderRules, orderListRules, reportRules, idRule };
