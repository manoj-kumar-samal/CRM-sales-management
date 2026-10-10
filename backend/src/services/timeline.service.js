const Timeline = require('../models/Timeline');
const { getPagination, paginationMeta } = require('../utils/query');

// entries: one object or an array. Pass a session when called inside a transaction.
exports.log = (entries, session) => {
  const list = Array.isArray(entries) ? entries : [entries];
  return Timeline.create(list, session ? { session } : {});
};

exports.listForEntity = async (entityType, entityId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { entityType, entityId };
  const [data, total] = await Promise.all([
    Timeline.find(filter)
      .populate('performedBy', 'name role')
      .sort({ createdAt: query.order === 'asc' ? 1 : -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Timeline.countDocuments(filter),
  ]);
  return { data, pagination: paginationMeta(total, page, limit) };
};
