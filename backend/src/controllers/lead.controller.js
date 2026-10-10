const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const leadService = require('../services/lead.service');
const timelineService = require('../services/timeline.service');

exports.createLead = asyncHandler(async (req, res) => {
  const lead = await leadService.createLead(req.body, req.user);
  sendSuccess(res, { statusCode: 201, message: 'Lead created successfully', data: lead });
});

exports.listLeads = asyncHandler(async (req, res) => {
  const { data, pagination } = await leadService.listLeads(req.query, req.user);
  sendSuccess(res, { message: 'Leads fetched successfully', data, pagination });
});

exports.getLead = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Lead fetched successfully', data: await leadService.getLead(req.params.id, req.user) });
});

exports.updateLead = asyncHandler(async (req, res) => {
  const lead = await leadService.updateLead(req.params.id, req.body, req.user);
  sendSuccess(res, { message: 'Lead updated successfully', data: lead });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const lead = await leadService.updateStatus(req.params.id, req.body.status, req.user);
  sendSuccess(res, { message: 'Lead status updated successfully', data: lead });
});

exports.assignLead = asyncHandler(async (req, res) => {
  const lead = await leadService.assignLead(req.params.id, req.body.assignedTo, req.user);
  sendSuccess(res, { message: 'Lead assigned successfully', data: lead });
});

exports.convertLead = asyncHandler(async (req, res) => {
  const data = await leadService.convertLead(req.params.id, req.body, req.user);
  sendSuccess(res, { statusCode: 201, message: 'Lead converted to customer and deal successfully', data });
});

exports.deleteLead = asyncHandler(async (req, res) => {
  await leadService.deleteLead(req.params.id, req.user);
  sendSuccess(res, { message: 'Lead deleted successfully' });
});

exports.getTimeline = asyncHandler(async (req, res) => {
  await leadService.getLeadForUser(req.params.id, req.user); // access check
  const { data, pagination } = await timelineService.listForEntity('Lead', req.params.id, req.query);
  sendSuccess(res, { message: 'Lead timeline fetched successfully', data, pagination });
});
