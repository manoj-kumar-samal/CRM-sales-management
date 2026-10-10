const { z } = require('zod');

const objectId = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');
const email = z.string().trim().toLowerCase().email('Invalid email address').max(254);
const phone = z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Invalid phone number');
const name = z.string().trim().min(2, 'Must be at least 2 characters').max(100);
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(64, 'Password must be at most 64 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

// ?isActive=true / ?unassigned=true  ->  real booleans
const boolQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

const idParams = z.object({ id: objectId });

// Shared pagination / sorting / search query. Each resource passes the fields it allows sorting by.
const listQuery = (sortFields) =>
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sortBy: z.enum(sortFields).optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().trim().max(100).optional(),
  });

const timelineQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const address = z.object({
  street: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  zipCode: z.string().trim().max(20).optional(),
});

const atLeastOne = [(obj) => Object.keys(obj).length > 0, { message: 'Provide at least one field to update' }];

module.exports = {
  objectId, email, phone, name, password, boolQuery, idParams,
  listQuery, timelineQuery, address, atLeastOne,
};
