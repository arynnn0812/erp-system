// Controllers: read the request, call the service, shape the response.
// No business logic, no SQL.
const authService = require('../services/auth.service');
const userModel = require('../models/user.model');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// POST /api/auth/register  (ADMIN only - an open ERP registration would let
// anyone create an ADMIN account)
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const user = await authService.register({ name, email, password, role });
  res.status(201).json({ success: true, data: user }); // 201 Created
});

// POST /api/auth/login  (public)
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });
  res.status(200).json({ success: true, data: result });
});

// POST /api/auth/logout  (authenticated)
// JWT is stateless: the server keeps no session to destroy. Logout means the
// CLIENT discards the token. This endpoint exists so the frontend has a hook
// (and where a token blacklist would plug in if we ever need forced revocation).
const logout = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out - discard the token client-side' });
});

// GET /api/auth/me  (authenticated) - "who am I", used by the frontend on load
const me = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  if (!user) throw new ApiError(404, 'User not found');
  res.status(200).json({ success: true, data: user });
});

module.exports = { register, login, logout, me };
