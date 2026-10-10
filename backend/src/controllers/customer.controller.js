const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const customerService = require('../services/customer.service');
const timelineService = require('../services/timeline.service');

exports.createCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.createCustomer(req.body, req.user);
  sendSuccess(res, { statusCode: 201, message: 'Customer created successfully', data: customer });
});

exports.listCustomers = asyncHandler(async (req, res) => {
  const { data, pagination } = await customerService.listCustomers(req.query, req.user);
  sendSuccess(res, { message: 'Customers fetched successfully', data, pagination });
});

exports.getCustomer = asyncHandler(async (req, res) => {
  const data = await customerService.getCustomer(req.params.id, req.user);
  sendSuccess(res, { message: 'Customer fetched successfully', data });
});

exports.updateCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.updateCustomer(req.params.id, req.body, req.user);
  sendSuccess(res, { message: 'Customer updated successfully', data: customer });
});

exports.assignCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.assignCustomer(req.params.id, req.body.assignedTo, req.user);
  sendSuccess(res, { message: 'Customer assigned successfully', data: customer });
});

exports.deleteCustomer = asyncHandler(async (req, res) => {
  await customerService.deleteCustomer(req.params.id, req.user);
  sendSuccess(res, { message: 'Customer deleted successfully' });
});

exports.getTimeline = asyncHandler(async (req, res) => {
  await customerService.getCustomerForUser(req.params.id, req.user); // access check
  const { data, pagination } = await timelineService.listForEntity('Customer', req.params.id, req.query);
  sendSuccess(res, { message: 'Customer timeline fetched successfully', data, pagination });
});
