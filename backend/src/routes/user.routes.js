// Account administration: ADMIN only.
const express = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const validate = require('../middleware/validate');
const { ROLES, passwordRule } = require('../validators/auth.validator');
const asyncHandler = require('../utils/asyncHandler');
const userModel = require('../models/user.model');
const userService = require('../services/user.service');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

const idRule = param('id').isInt({ min: 1 }).toInt();

router.get('/', asyncHandler(async (req, res) => {
  const users = await userModel.listAll();
  res.status(200).json({ success: true, count: users.length, data: users });
}));

// PATCH /api/users/:id  { role?, isActive? }
router.patch(
  '/:id',
  idRule,
  body('role').optional().isIn(ROLES).withMessage('Invalid role'),
  body('isActive').optional().isBoolean({ strict: true }).withMessage('isActive must be true or false'),
  validate,
  asyncHandler(async (req, res) => {
    const user = await userService.updateAccess(req.params.id, req.body, req.user, req.ip);
    res.json({ success: true, data: user });
  })
);

// POST /api/users/:id/reset-password  { newPassword }
router.post(
  '/:id/reset-password',
  idRule,
  passwordRule('newPassword'),
  validate,
  asyncHandler(async (req, res) => {
    await userService.resetPassword(req.params.id, req.body.newPassword, req.user, req.ip);
    res.json({ success: true, message: 'Password reset; existing sessions were signed out' });
  })
);

module.exports = router;
