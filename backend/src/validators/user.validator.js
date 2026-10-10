const { z } = require('zod');
const { ROLES } = require('../config/constants');
const { objectId, email, phone, name, password, boolQuery, listQuery, atLeastOne } = require('./common');

const role = z.enum(Object.values(ROLES));

exports.createUser = z.object({
  name,
  email,
  phone: phone.optional(),
  password,
  role,
  manager: objectId.optional(), // only used for sales executives
  isActive: z.boolean().optional(),
});

exports.updateUser = z
  .object({
    name: name.optional(),
    email: email.optional(),
    phone: phone.optional(),
    password: password.optional(), // admin password reset
    role: role.optional(),
    manager: objectId.nullable().optional(),
  })
  .refine(...atLeastOne);

exports.setStatus = z.object({ isActive: z.boolean({ required_error: 'isActive (true/false) is required' }) });

exports.listUsers = listQuery(['name', 'email', 'role', 'createdAt', 'updatedAt']).extend({
  role: role.optional(),
  isActive: boolQuery.optional(),
});
