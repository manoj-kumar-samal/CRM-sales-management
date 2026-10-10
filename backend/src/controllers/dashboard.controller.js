const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const dashboardService = require('../services/dashboard.service');

exports.getStats = asyncHandler(async (req, res) => {
  const data = await dashboardService.getStats(req.user, req.query);
  sendSuccess(res, { message: 'Sales statistics fetched successfully', data });
});

exports.getPipeline = asyncHandler(async (req, res) => {
  const data = await dashboardService.getPipeline(req.user, req.query);
  sendSuccess(res, { message: 'Sales pipeline fetched successfully', data });
});

exports.getTeamPerformance = asyncHandler(async (req, res) => {
  const data = await dashboardService.getTeamPerformance(req.user, req.query);
  sendSuccess(res, { message: 'Team performance fetched successfully', data });
});
