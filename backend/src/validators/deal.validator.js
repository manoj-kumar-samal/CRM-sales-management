const { z } = require('zod');
const { DEAL_STAGES, DEAL_STATUSES } = require('../config/constants');
const { objectId, listQuery } = require('./common');

const value = z.number({ invalid_type_error: 'Deal value must be a number' }).positive('Deal value must be greater than zero').max(1e12);
const probability = z.number({ invalid_type_error: 'Probability must be a number' }).min(0, 'Probability must be 0-100').max(100, 'Probability must be 0-100');
const closingDate = z.coerce.date({ invalid_type_error: 'Invalid expected closing date' });
const dealName = z.string().trim().min(2).max(150);
const description = z.string().trim().max(2000);

exports.createDeal = z.object({
  dealName,
  customer: objectId,
  value,
  probability: probability.optional(), // defaults from the stage if missing
  expectedClosingDate: closingDate,
  description: description.optional(),
  assignedTo: objectId.optional(),
});

// stage / assignedTo / expectedRevenue cannot be changed here
exports.updateDeal = z
  .object({
    dealName: dealName.optional(),
    value: value.optional(),
    probability: probability.optional(),
    expectedClosingDate: closingDate.optional(),
    description: description.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field to update' });

exports.changeStage = z
  .object({
    stage: z.enum(DEAL_STAGES),
    probability: probability.optional(),
    lostReason: z.string().trim().min(5, 'Lost reason must be at least 5 characters').max(500).optional(),
  })
  .superRefine((o, ctx) => {
    if (o.stage === 'Lost' && !o.lostReason) {
      ctx.addIssue({ code: 'custom', path: ['lostReason'], message: 'A reason is required when marking a deal as Lost' });
    }
  });

exports.assign = z.object({ assignedTo: objectId });

exports.listDeals = listQuery(['createdAt', 'updatedAt', 'dealName', 'value', 'expectedRevenue', 'expectedClosingDate', 'probability'])
  .extend({
    stage: z.enum(DEAL_STAGES).optional(),
    status: z.enum(DEAL_STATUSES).optional(),
    assignedTo: objectId.optional(),
    customer: objectId.optional(),
    minAmount: z.coerce.number().min(0).optional(),
    maxAmount: z.coerce.number().min(0).optional(),
    closingFrom: z.coerce.date().optional(),
    closingTo: z.coerce.date().optional(),
  })
  .refine((q) => q.minAmount === undefined || q.maxAmount === undefined || q.minAmount <= q.maxAmount, {
    message: 'minAmount cannot be greater than maxAmount',
    path: ['minAmount'],
  });
