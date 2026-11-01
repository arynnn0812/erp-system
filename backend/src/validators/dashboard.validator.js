const { query } = require('express-validator');

// Both values reach SQL as interpolated INTERVAL/LIMIT numbers, so they are
// range-checked here rather than silently clamped in the controller.
const trendRules = [
  query('months').optional().isInt({ min: 1, max: 24 }).withMessage('months must be 1-24').toInt(),
];

const topRules = [
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('limit must be 1-20').toInt(),
];

module.exports = { trendRules, topRules };
