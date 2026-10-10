const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const activityService = require('../services/activity.service');

exports.createActivity = asyncHandler(async (req, res) => {
  const activity = await activityService.createActivity(req.body, req.user);
  sendSuccess(res, { statusCode: 201, message: 'Activity created successfully', data: activity });
});

exports.listActivities = asyncHandler(async (req, res) => {
  const { data, pagination } = await activityService.listActivities(req.query, req.user);
  sendSuccess(res, { message: 'Activities fetched successfully', data, pagination });
});

exports.getActivity = asyncHandler(async (req, res) => {
  const data = await activityService.getActivity(req.params.id, req.user);
  sendSuccess(res, { message: 'Activity fetched successfully', data });
});

exports.updateActivity = asyncHandler(async (req, res) => {
  const data = await activityService.updateActivity(req.params.id, req.body, req.user);
  sendSuccess(res, { message: 'Activity updated successfully', data });
});

exports.completeActivity = asyncHandler(async (req, res) => {
  const data = await activityService.completeActivity(req.params.id, req.user);
  sendSuccess(res, { message: 'Activity marked as completed', data });
});

exports.deleteActivity = asyncHandler(async (req, res) => {
  await activityService.deleteActivity(req.params.id, req.user);
  sendSuccess(res, { message: 'Activity deleted successfully' });
});
