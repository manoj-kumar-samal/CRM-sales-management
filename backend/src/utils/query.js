// Small helpers shared by every list endpoint (pagination, sorting, search, date range).

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPagination = ({ page = 1, limit = 10 }) => ({ page, limit, skip: (page - 1) * limit });

// sortBy is already validated by zod; the fallback is just a safety net.
// _id is added as a tie-breaker so pages stay stable when many rows share a value.
const buildSort = ({ sortBy, order }, allowed, fallback = 'createdAt') => ({
  [allowed.includes(sortBy) ? sortBy : fallback]: order === 'asc' ? 1 : -1,
  _id: -1,
});

// Case-insensitive "contains" search across several fields. User input is regex-escaped.
const searchCondition = (search, fields) => ({
  $or: fields.map((field) => ({ [field]: { $regex: escapeRegex(search), $options: 'i' } })),
});

// "to" is inclusive of the whole day.
const dateRange = (from, to) => {
  const range = {};
  if (from) range.$gte = from;
  if (to) {
    const end = new Date(to);
    end.setUTCHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return range;
};

const paginationMeta = (totalRecords, page, limit) => ({
  currentPage: page,
  pageSize: limit,
  totalRecords,
  totalPages: Math.ceil(totalRecords / limit),
});

// Merge several conditions with $and (skips empty / falsy ones) so $or filters never collide.
const combine = (conditions) => {
  const valid = conditions.filter((c) => c && Object.keys(c).length);
  return valid.length ? { $and: valid } : {};
};

module.exports = { getPagination, buildSort, searchCondition, dateRange, paginationMeta, combine };
