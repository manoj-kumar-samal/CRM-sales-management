const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const dealService = require('../services/deal.service');
const timelineService = require('../services/timeline.service');

exports.createDeal = asyncHandler(async (req, res) => {
  const deal = await dealService.createDeal(req.body, req.user);
  sendSuccess(res, { statusCode: 201, message: 'Deal created successfully', data: deal });
});

exports.listDeals = asyncHandler(async (req, res) => {
  const { data, pagination } = await dealService.listDeals(req.query, req.user);
  sendSuccess(res, { message: 'Deals fetched successfully', data, pagination });
});

exports.getDeal = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Deal fetched successfully', data: await dealService.getDeal(req.params.id, req.user) });
});

exports.updateDeal = asyncHandler(async (req, res) => {
  const deal = await dealService.updateDeal(req.params.id, req.body, req.user);
  sendSuccess(res, { message: 'Deal updated successfully', data: deal });
});

exports.changeStage = asyncHandler(async (req, res) => {
  const deal = await dealService.changeStage(req.params.id, req.body, req.user);
  sendSuccess(res, { message: `Deal moved to ${deal.stage} successfully`, data: deal });
});

exports.assignDeal = asyncHandler(async (req, res) => {
  const deal = await dealService.assignDeal(req.params.id, req.body.assignedTo, req.user);
  sendSuccess(res, { message: 'Deal assigned successfully', data: deal });
});

exports.getTimeline = asyncHandler(async (req, res) => {
  await dealService.getDealForUser(req.params.id, req.user); // access check
  const { data, pagination } = await timelineService.listForEntity('Deal', req.params.id, req.query);
  sendSuccess(res, { message: 'Deal timeline fetched successfully', data, pagination });
});
