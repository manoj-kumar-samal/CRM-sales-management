const { z } = require('zod');

// Optional created-date range applied to the metrics
exports.rangeQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
