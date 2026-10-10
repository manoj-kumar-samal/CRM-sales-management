// Every success response has the same shape: { success, message, data, pagination? }
const sendSuccess = (res, { statusCode = 200, message = 'Success', data = null, pagination } = {}) => {
  const body = { success: true, message, data };
  if (pagination) body.pagination = pagination;
  return res.status(statusCode).json(body);
};

module.exports = { sendSuccess };
