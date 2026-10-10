const Activity = require('../models/Activity');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const timeline = require('./timeline.service');
const { ROLES, TIMELINE_ACTIONS: A } = require('../config/constants');
const { getVisibleUserIds, canAccessOwner } = require('./access.service');
const { getLeadForUser } = require('./lead.service');
const { getCustomerForUser } = require('./customer.service');
const { getDealForUser } = require('./deal.service');
const { getPagination, buildSort, searchCondition, dateRange, paginationMeta, combine } = require('../utils/query');

const SORT_FIELDS = ['createdAt', 'dueDate', 'title', 'type'];
const POPULATE = [
  { path: 'assignedTo', select: 'name email' },
  { path: 'createdBy', select: 'name' },
];

// A user sees activities assigned to them or created by them (managers: the same for their team).
const visibleFilter = async (user) => {
  const ids = await getVisibleUserIds(user);
  return ids ? { $or: [{ assignedTo: { $in: ids } }, { createdBy: { $in: ids } }] } : {};
};

// The backend decides what "Pending" and "Overdue" mean:
//   Overdue = still pending AND due date already passed
//   Pending = still pending AND not due yet
const statusCondition = (status, now = new Date()) => {
  if (status === 'Completed') return { status: 'Completed' };
  if (status === 'Overdue') return { status: 'Pending', dueDate: { $lt: now } };
  if (status === 'Pending') return { status: 'Pending', dueDate: { $gte: now } };
  return null;
};

// The related Lead / Customer / Deal / User must exist AND be accessible to this user.
const assertRelatedAccess = async (model, id, user) => {
  if (model === 'Lead') return getLeadForUser(id, user);
  if (model === 'Customer') return getCustomerForUser(id, user);
  if (model === 'Deal') return getDealForUser(id, user);

  const target = await User.findById(id);
  if (!target) throw new AppError('Related user not found', 404);
  if (!(await canAccessOwner(user, target._id))) throw new AppError('You do not have access to this user', 403);
  return target;
};

const assertFutureDate = (date) => {
  if (date.getTime() < Date.now() - 60 * 1000) throw new AppError('Due date cannot be in the past', 400);
};

const getActivityForUser = async (id, user) => {
  const activity = await Activity.findById(id);
  if (!activity) throw new AppError('Activity not found', 404);
  const visible =
    (await canAccessOwner(user, activity.assignedTo)) || (await canAccessOwner(user, activity.createdBy));
  if (!visible) throw new AppError('You do not have access to this activity', 403);
  return activity;
};

const logToTimeline = (activity, action, user, extra = {}) => {
  if (!['Lead', 'Customer', 'Deal'].includes(activity.relatedModel)) return null; // User-level activities have no timeline
  return timeline.log({
    action, entityType: activity.relatedModel, entityId: activity.relatedTo, performedBy: user._id,
    newValue: { activityId: activity._id, type: activity.type, title: activity.title, ...extra },
    message: `${activity.type}: ${activity.title}`,
  });
};

const resolveAssignee = async (assigneeId, user) => {
  if (!assigneeId || user._id.equals(assigneeId)) return user._id;
  if (user.role === ROLES.EXECUTIVE) throw new AppError('Sales executives can only assign activities to themselves', 403);
  const assignee = await User.findById(assigneeId);
  if (!assignee || !assignee.isActive) throw new AppError('Assignee not found or inactive', 400);
  if (!(await canAccessOwner(user, assignee._id))) throw new AppError('You cannot assign activities to this user', 403);
  return assignee._id;
};

const createActivity = async (data, user) => {
  await assertRelatedAccess(data.relatedModel, data.relatedTo, user);
  const assignedTo = await resolveAssignee(data.assignedTo, user);

  const isNote = data.type === 'Note';
  if (!isNote) assertFutureDate(data.dueDate);

  const activity = await Activity.create({
    ...data,
    assignedTo,
    createdBy: user._id,
    status: isNote ? 'Completed' : 'Pending', // a note has nothing left to do
    completedAt: isNote ? new Date() : undefined,
  });

  await logToTimeline(activity, isNote ? A.NOTE_ADDED : A.FOLLOWUP_CREATED, user, { dueDate: activity.dueDate });
  return activity.populate(POPULATE);
};

const listActivities = async (q, user) => {
  const { page, limit, skip } = getPagination(q);
  const filter = combine([
    await visibleFilter(user),
    q.type && { type: q.type },
    q.status && statusCondition(q.status),
    q.assignedTo && { assignedTo: q.assignedTo },
    q.relatedModel && { relatedModel: q.relatedModel },
    q.relatedTo && { relatedTo: q.relatedTo },
    (q.dueFrom || q.dueTo) && { dueDate: dateRange(q.dueFrom, q.dueTo) },
    q.search && searchCondition(q.search, ['title', 'description']),
  ]);

  const [data, total] = await Promise.all([
    Activity.find(filter).populate(POPULATE).sort(buildSort(q, SORT_FIELDS)).skip(skip).limit(limit), // not lean: toJSON computes "Overdue"
    Activity.countDocuments(filter),
  ]);
  return { data, pagination: paginationMeta(total, page, limit) };
};

const getActivity = async (id, user) => {
  const activity = await getActivityForUser(id, user);
  return activity.populate(POPULATE);
};

const updateActivity = async (id, data, user) => {
  const activity = await getActivityForUser(id, user);
  if (activity.status === 'Completed') throw new AppError('Completed activities cannot be edited', 409);

  if (data.dueDate) assertFutureDate(data.dueDate);
  if (data.assignedTo) data.assignedTo = await resolveAssignee(data.assignedTo, user);

  activity.set(data);
  await activity.save();
  return activity.populate(POPULATE);
};

const completeActivity = async (id, user) => {
  const activity = await getActivityForUser(id, user);
  if (activity.status === 'Completed') throw new AppError('Activity is already completed', 409);

  activity.status = 'Completed';
  activity.completedAt = new Date();
  await activity.save();

  await logToTimeline(activity, A.FOLLOWUP_COMPLETED, user);
  return activity.populate(POPULATE);
};

const deleteActivity = async (id, user) => {
  const activity = await getActivityForUser(id, user);
  const isCreator = activity.createdBy.equals(user._id);
  // Creator can always delete; admin/manager can delete anything they can see. Executives only their own.
  if (!isCreator && user.role === ROLES.EXECUTIVE) {
    throw new AppError('You can only delete activities you created', 403);
  }
  await activity.deleteOne();
};

module.exports = {
  visibleFilter, statusCondition, createActivity, listActivities, getActivity,
  updateActivity, completeActivity, deleteActivity,
};
