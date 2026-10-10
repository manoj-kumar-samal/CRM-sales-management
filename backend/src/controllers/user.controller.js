const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const userService = require('../services/user.service');

exports.createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body);
  sendSuccess(res, { statusCode: 201, message: 'User created successfully', data: user });
});

exports.listUsers = asyncHandler(async (req, res) => {
  const { data, pagination } = await userService.listUsers(req.query);
  sendSuccess(res, { message: 'Users fetched successfully', data, pagination });
});

exports.listAssignable = asyncHandler(async (req, res) => {
  const data = await userService.listAssignable(req.user);
  sendSuccess(res, { message: 'Assignable users fetched successfully', data });
});

exports.getUser = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'User fetched successfully', data: await userService.getUser(req.params.id) });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user);
  sendSuccess(res, { message: 'User updated successfully', data: user });
});

exports.setStatus = asyncHandler(async (req, res) => {
  const user = await userService.setStatus(req.params.id, req.body.isActive, req.user);
  sendSuccess(res, { message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`, data: user });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  await userService.deleteUser(req.params.id, req.user);
  sendSuccess(res, { message: 'User deleted successfully' });
});
