const { z } = require('zod');
const { ACTIVITY_TYPES, ACTIVITY_STATUSES, RELATED_MODELS } = require('../config/constants');
const { objectId, listQuery } = require('./common');

const title = z.string().trim().min(2).max(200);
const description = z.string().trim().max(2000);
const dueDate = z.coerce.date({ invalid_type_error: 'Invalid due date' });

exports.createActivity = z
  .object({
    type: z.enum(ACTIVITY_TYPES),
    title,
    description: description.optional(),
    assignedTo: objectId.optional(),
    dueDate: dueDate.optional(),
    relatedModel: z.enum(RELATED_MODELS),
    relatedTo: objectId,
  })
  .superRefine((o, ctx) => {
    if (o.type !== 'Note' && !o.dueDate) {
      ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'dueDate is required for this activity type' });
    }
  });

exports.updateActivity = z
  .object({
    title: title.optional(),
    description: description.optional(),
    dueDate: dueDate.optional(),
    assignedTo: objectId.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field to update' });

exports.listActivities = listQuery(['createdAt', 'dueDate', 'title', 'type']).extend({
  type: z.enum(ACTIVITY_TYPES).optional(),
  status: z.enum(ACTIVITY_STATUSES).optional(),
  assignedTo: objectId.optional(),
  relatedModel: z.enum(RELATED_MODELS).optional(),
  relatedTo: objectId.optional(),
  dueFrom: z.coerce.date().optional(),
  dueTo: z.coerce.date().optional(),
});
