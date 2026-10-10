const { z } = require('zod');
const { LEAD_SOURCES, LEAD_STATUSES, PRIORITIES } = require('../config/constants');
const { objectId, email, phone, name, boolQuery, listQuery, atLeastOne } = require('./common');

const source = z.enum(LEAD_SOURCES);
const priority = z.enum(PRIORITIES);
const company = z.string().trim().max(150);
const description = z.string().trim().max(2000);

exports.createLead = z.object({
  name,
  email,
  phone: phone.optional(),
  company: company.optional(),
  source: source.optional(),
  priority: priority.optional(),
  description: description.optional(),
  assignedTo: objectId.optional(),
});

// status and assignedTo have their own endpoints (they have business rules)
exports.updateLead = z
  .object({
    name: name.optional(),
    email: email.optional(),
    phone: phone.optional(),
    company: company.optional(),
    source: source.optional(),
    priority: priority.optional(),
    description: description.optional(),
  })
  .refine(...atLeastOne);

exports.updateStatus = z.object({ status: z.enum(LEAD_STATUSES) });

exports.assign = z.object({ assignedTo: objectId });

exports.convert = z.object({
  customer: z.object({ address: require('./common').address.optional() }).optional(),
  deal: z.object({
    dealName: z.string().trim().min(2).max(150).optional(),
    value: z.number({ invalid_type_error: 'Deal value must be a number' }).positive('Deal value must be greater than zero').max(1e12),
    probability: z.number().min(0, 'Probability must be 0-100').max(100, 'Probability must be 0-100').optional(),
    expectedClosingDate: z.coerce.date({ invalid_type_error: 'Invalid expected closing date' }),
    description: description.optional(),
  }),
});

exports.listLeads = listQuery(['createdAt', 'updatedAt', 'name', 'company', 'status', 'priority', 'source']).extend({
  status: z.enum(LEAD_STATUSES).optional(),
  priority: priority.optional(),
  source: source.optional(),
  assignedTo: objectId.optional(),
  unassigned: boolQuery.optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
});
