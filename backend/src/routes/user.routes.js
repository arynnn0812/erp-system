// RBAC demonstration route: only ADMIN can list users.
// Hit this with a MANAGER token in Postman to show the 403.
const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const asyncHandler = require('../utils/asyncHandler');
const userModel = require('../models/user.model');

const router = express.Router();

router.get(
  '/',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const users = await userModel.listAll();
    res.status(200).json({ success: true, count: users.length, data: users });
  })
);

module.exports = router;
