const User = require('../models/User');
const AppError = require('../utils/AppError');
const { ROLES } = require('../config/constants');

// Which users' records can this user see?
//   admin     -> everyone   (returns null = no restriction)
//   manager   -> self + executives in their team
//   executive -> only self
const getVisibleUserIds = async (user) => {
  if (user.role === ROLES.ADMIN) return null;
  if (user.role === ROLES.MANAGER) {
    const teamIds = await User.find({ manager: user._id }).distinct('_id');
    return [user._id, ...teamIds];
  }
  return [user._id];
};

// Mongo filter that limits a collection to records owned by visible users.
// Managers can also see unassigned leads (so they can assign them).
const ownerFilter = async (user, field = 'assignedTo', { includeUnassigned = false } = {}) => {
  const ids = await getVisibleUserIds(user);
  if (ids === null) return {};
  const condition = { [field]: { $in: ids } };
  if (includeUnassigned && user.role === ROLES.MANAGER) return { $or: [condition, { [field]: null }] };
  return condition;
};

// Same rule as ownerFilter, but for a single already-loaded record.
const canAccessOwner = async (user, ownerId, { includeUnassigned = false } = {}) => {
  const ids = await getVisibleUserIds(user);
  if (ids === null) return true;
  if (!ownerId) return includeUnassigned && user.role === ROLES.MANAGER;
  return ids.some((id) => id.equals(ownerId));
};

// A record can only be assigned to an ACTIVE sales executive.
// Managers can only pick executives from their own team.
const assertAssignable = async (assigneeId, actor) => {
  const assignee = await User.findById(assigneeId);
  if (!assignee) throw new AppError('Assignee not found', 404);
  if (!assignee.isActive) throw new AppError('Cannot assign to an inactive user', 400);
  if (assignee.role !== ROLES.EXECUTIVE) throw new AppError('Records can only be assigned to sales executives', 400);
  if (actor.role === ROLES.MANAGER && !(assignee.manager && assignee.manager.equals(actor._id))) {
    throw new AppError('You can only assign to sales executives in your team', 403);
  }
  return assignee;
};

module.exports = { getVisibleUserIds, ownerFilter, canAccessOwner, assertAssignable };
