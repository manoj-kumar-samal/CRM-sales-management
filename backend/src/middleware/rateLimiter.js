const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const message = { success: false, message: 'Too many requests, please try again later' };

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

// Stricter limit for login / register / refresh (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

module.exports = { apiLimiter, authLimiter };
