const AppError = require('../utils/AppError');

// validate({ body, query, params }) - each value is a zod schema.
// Parsed (coerced + stripped) data replaces the raw request data, so controllers only see clean input.
const validate = (schemas) => (req, res, next) => {
  const errors = [];

  ['params', 'query', 'body'].forEach((key) => {
    if (!schemas[key]) return;
    const result = schemas[key].safeParse(req[key] || {});
    if (result.success) {
      req[key] = result.data;
    } else {
      result.error.issues.forEach((issue) =>
        errors.push({ field: [key, ...issue.path].join('.'), message: issue.message })
      );
    }
  });

  if (errors.length) return next(new AppError('Validation failed', 400, errors));
  next();
};

module.exports = validate;
