const { z } = require('zod');
const { email, phone, name, password, atLeastOne } = require('./common');

exports.register = z.object({ name, email, phone: phone.optional(), password });

exports.login = z.object({ email, password: z.string().min(1, 'Password is required') });

exports.updateProfile = z
  .object({ name: name.optional(), phone: phone.optional() })
  .refine(...atLeastOne);
