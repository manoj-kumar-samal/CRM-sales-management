const User = require('../models/User');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Deal = require('../models/Deal');
const Activity = require('../models/Activity');
const AppError = require('../utils/AppError');
const { ROLES } = require('../config/constants');
const { getPagination, buildSort, searchCondition, paginationMeta, combine } = require('../utils/query');

const SORT_FIELDS = ['name', 'email', 'role', 'createdAt', 'updatedAt'];

// Only executives belong to a team; the manager must exist, be active and have the manager role.
const resolveManager = async (role, managerId) => {
  if (role !== ROLES.EXECUTIVE || !managerId) return null;
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== ROLES.MANAGER || !manager.isActive) {
    throw new AppError('Manager must be an active sales manager', 400);
  }
  return manager._id;
};

exports.createUser = async (data) => {
  const manager = await resolveManager(data.role, data.manager);
  return User.create({ ...data, manager });
};

exports.listUsers = async (q) => {
  const { page, limit, skip } = getPagination(q);
  const filter = combine([
    q.role && { role: q.role },
    q.isActive !== undefined && { isActive: q.isActive },
    q.search && searchCondition(q.search, ['name', 'email']),
  ]);
  const [data, total] = await Promise.all([
    User.find(filter).populate('manager', 'name email').sort(buildSort(q, SORT_FIELDS)).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return { data, pagination: paginationMeta(total, page, limit) };
};

// Users the current admin/manager is allowed to assign records to (for dropdowns)
exports.listAssignable = async (actor) => {
  const filter = { role: ROLES.EXECUTIVE, isActive: true };
  if (actor.role === ROLES.MANAGER) filter.manager = actor._id;
  return User.find(filter).select('name email').sort({ name: 1 });
};

exports.getUser = async (id) => {
  const user = await User.findById(id).populate('manager', 'name email');
  if (!user) throw new AppError('User not found', 404);
  return user;
};

exports.updateUser = async (id, data, actor) => {
  const user = await User.findById(id);
  if (!user) throw new AppError('User not found', 404);

  if (actor._id.equals(user._id) && data.role && data.role !== user.role) {
    throw new AppError('You cannot change your own role', 400);
  }

  const newRole = data.role || user.role;
  const { manager, ...rest } = data;
  user.set(rest);

  if (newRole !== ROLES.EXECUTIVE) user.manager = null;
  else if (manager !== undefined) user.manager = await resolveManager(newRole, manager);

  // A manager who is demoted should not leave executives pointing at a non-manager
  if (user.isModified('role') && user.role !== ROLES.MANAGER) {
    await User.updateMany({ manager: user._id }, { $set: { manager: null } });
  }

  await user.save();
  return user;
};

exports.setStatus = async (id, isActive, actor) => {
  const user = await User.findById(id);
  if (!user) throw new AppError('User not found', 404);
  if (actor._id.equals(user._id) && !isActive) throw new AppError('You cannot deactivate your own account', 400);

  user.isActive = isActive;
  if (!isActive) user.refreshTokenHash = undefined; // kill refresh capability too
  await user.save({ validateModifiedOnly: true });
  return user;
};

exports.deleteUser = async (id, actor) => {
  const user = await User.findById(id);
  if (!user) throw new AppError('User not found', 404);
  if (actor._id.equals(user._id)) throw new AppError('You cannot delete your own account', 400);

  // Deleting a user who owns records would orphan them - deactivate instead.
  const [leads, customers, deals, activities] = await Promise.all([
    Lead.exists({ assignedTo: id }),
    Customer.exists({ assignedTo: id }),
    Deal.exists({ assignedTo: id }),
    Activity.exists({ $or: [{ assignedTo: id }, { createdBy: id }] }),
  ]);
  if (leads || customers || deals || activities) {
    throw new AppError('User has CRM records. Reassign them or deactivate the user instead of deleting.', 409);
  }

  await User.updateMany({ manager: id }, { $set: { manager: null } });
  await user.deleteOne();
};
