const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const authService = require('../services/auth.service');

exports.register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  sendSuccess(res, { statusCode: 201, message: 'Registration successful', data: user });
});

exports.login = asyncHandler(async (req, res) => {
  const { user, accessToken } = await authService.login(req.body, res);
  sendSuccess(res, { message: 'Login successful', data: { user, accessToken } });
});

exports.refresh = asyncHandler(async (req, res) => {
  const data = await authService.refresh(req.cookies && req.cookies.refreshToken, res);
  sendSuccess(res, { message: 'Token refreshed successfully', data });
});

exports.logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user, res);
  sendSuccess(res, { message: 'Logged out successfully' });
});

exports.me = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Profile fetched successfully', data: req.user });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user, req.body);
  sendSuccess(res, { message: 'Profile updated successfully', data: user });
});
