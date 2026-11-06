// Audit log viewer: ADMIN only, read only. There is deliberately no write or
// delete endpoint - the log is append-only from the application's side.
const express = require('express');
const { query } = require('express-validator');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const auditModel = require('../models/audit.model');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

const listRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('action').optional().isString().trim().isLength({ max: 50 }),
  query('entity').optional().isString().trim().isLength({ max: 50 }),
  query('userId').optional().isInt({ min: 1 }).toInt(),
  query('from').optional().isDate().withMessage('from must be YYYY-MM-DD'),
  query('to').optional().isDate().withMessage('to must be YYYY-MM-DD'),
];

// GET /api/audit-logs?action=&userId=&entity=&from=&to=&page=&limit=
router.get('/', listRules, validate, asyncHandler(async (req, res) => {
  const { action, userId, entity, from, to, page = 1, limit = 25 } = req.query;
  const result = await auditModel.list({ action, userId, entity, from, to, page, limit });
  res.json({ success: true, ...result });
}));

// GET /api/audit-logs/actions -> ["LOGIN", "ORDER_CONFIRM", ...]
router.get('/actions', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await auditModel.actions() });
}));

module.exports = router;
