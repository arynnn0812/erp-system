// Controllers: read the request, call the service, shape the response.
// No business logic, no SQL.
const authService = require('../services/auth.service');
const userModel = require('../models/user.model');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { setSessionCookie, clearSessionCookie } = require('../utils/cookies');

// POST /api/auth/register  (ADMIN only - an open ERP registration would let
// anyone create an ADMIN account)
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const user = await authService.register({ name, email, password, role }, req.user, req.ip);
  res.status(201).json({ success: true, data: user }); // 201 Created
});

// POST /api/auth/login  (public)
// The browser gets the token as an httpOnly cookie. It is also returned in the
// body for non-browser clients (Postman, scripts) that send a Bearer header;
// the web app ignores it and never stores it.
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { token, expiresAt, user } = await authService.login({ email, password }, req.ip);
  setSessionCookie(res, token, expiresAt);
  res.status(200).json({ success: true, data: { token, expiresAt, user } });
});

// POST /api/auth/logout  (authenticated) - ends this browser's session.
const logout = asyncHandler(async (req, res) => {
  clearSessionCookie(res);
  res.status(200).json({ success: true, message: 'Logged out' });
});

// POST /api/auth/logout-all  (authenticated) - revokes every token this user
// holds, on every device, including the current one.
const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutEverywhere(req.user.id, req.ip);
  clearSessionCookie(res);
  res.status(200).json({ success: true, message: 'Logged out on all devices' });
});

// POST /api/auth/change-password  (authenticated)
const changePassword = asyncHandler(async (req, res) => {
  const { token, expiresAt } = await authService.changePassword(req.user.id, req.body, req.ip);
  setSessionCookie(res, token, expiresAt); // other sessions are revoked; keep this one
  res.status(200).json({ success: true, message: 'Password changed', data: { token, expiresAt } });
});

// GET /api/auth/me  (authenticated) - "who am I", used by the frontend on load
const me = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  if (!user) throw new ApiError(404, 'User not found');
  res.status(200).json({ success: true, data: user });
});

module.exports = { register, login, logout, logoutAll, changePassword, me };
