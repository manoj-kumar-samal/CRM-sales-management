// Returns only the fields that actually changed (used for timeline previous/new values).
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const diffFields = (doc, updates, fields) => {
  const previous = {};
  const next = {};
  fields.forEach((field) => {
    if (updates[field] === undefined) return;
    if (!same(doc[field], updates[field])) {
      previous[field] = doc[field];
      next[field] = updates[field];
    }
  });
  return { previous, next, changed: Object.keys(next).length > 0 };
};

module.exports = { diffFields };
