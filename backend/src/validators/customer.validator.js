const { z } = require('zod');
const { CUSTOMER_STATUSES } = require('../config/constants');
const { objectId, email, phone, name, address, listQuery, atLeastOne } = require('./common');

const company = z.string().trim().max(150);
const status = z.enum(CUSTOMER_STATUSES);

exports.createCustomer = z.object({
  name,
  email,
  phone: phone.optional(),
  company: company.optional(),
  address: address.optional(),
  status: status.optional(),
  assignedTo: objectId.optional(),
});

exports.updateCustomer = z
  .object({
    name: name.optional(),
    email: email.optional(),
    phone: phone.optional(),
    company: company.optional(),
    address: address.optional(),
    status: status.optional(),
  })
  .refine(...atLeastOne);

exports.assign = z.object({ assignedTo: objectId });

exports.listCustomers = listQuery(['createdAt', 'updatedAt', 'name', 'company', 'status']).extend({
  status: status.optional(),
  assignedTo: objectId.optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
});
