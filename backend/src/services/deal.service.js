const Deal = require('../models/Deal');
const Customer = require('../models/Customer');
const AppError = require('../utils/AppError');
const timeline = require('./timeline.service');
const { ROLES, DEAL_TRANSITIONS, DEFAULT_STAGE_PROBABILITY, TIMELINE_ACTIONS: A } = require('../config/constants');
const { ownerFilter, canAccessOwner, assertAssignable } = require('./access.service');
const { getPagination, buildSort, searchCondition, dateRange, paginationMeta, combine } = require('../utils/query');
const { diffFields } = require('../utils/diff');

const SORT_FIELDS = ['createdAt', 'updatedAt', 'dealName', 'value', 'expectedRevenue', 'expectedClosingDate', 'probability'];
const UPDATABLE = ['dealName', 'value', 'probability', 'expectedClosingDate', 'description'];

const isClosed = (deal) => deal.stage === 'Won' || deal.stage === 'Lost';

// Business validation for the expected closing date: not in the past, not absurdly far away.
const assertValidClosingDate = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() + 5);
  if (date < today) throw new AppError('Expected closing date cannot be in the past', 400);
  if (date > limit) throw new AppError('Expected closing date cannot be more than 5 years ahead', 400);
};

const getDealForUser = async (id, user) => {
  const deal = await Deal.findById(id);
  if (!deal) throw new AppError('Deal not found', 404);
  if (!(await canAccessOwner(user, deal.assignedTo))) throw new AppError('You do not have access to this deal', 403);
  return deal;
};

const createDeal = async (data, user) => {
  const customer = await Customer.findById(data.customer);
  if (!customer) throw new AppError('Customer not found', 404);
  if (!(await canAccessOwner(user, customer.assignedTo))) throw new AppError('You do not have access to this customer', 403);

  assertValidClosingDate(data.expectedClosingDate);

  let assignedTo = customer.assignedTo;
  if (data.assignedTo && !customer.assignedTo.equals(data.assignedTo)) {
    if (user.role === ROLES.EXECUTIVE) throw new AppError('Sales executives cannot assign deals to other users', 403);
    assignedTo = (await assertAssignable(data.assignedTo, user))._id;
  }

  const deal = await Deal.create({
    dealName: data.dealName,
    customer: customer._id,
    lead: customer.lead, // keep the Lead -> Customer -> Deal chain
    assignedTo,
    value: data.value,
    probability: data.probability ?? DEFAULT_STAGE_PROBABILITY.Qualification,
    expectedClosingDate: data.expectedClosingDate,
    description: data.description,
    stage: 'Qualification',
    createdBy: user._id,
  });

  await timeline.log({
    action: A.DEAL_CREATED, entityType: 'Deal', entityId: deal._id, performedBy: user._id,
    newValue: { value: deal.value, stage: deal.stage, customer: customer._id }, message: 'Deal created',
  });
  return deal;
};

const listDeals = async (q, user) => {
  const { page, limit, skip } = getPagination(q);
  const amount = {};
  if (q.minAmount !== undefined) amount.$gte = q.minAmount;
  if (q.maxAmount !== undefined) amount.$lte = q.maxAmount;

  const filter = combine([
    await ownerFilter(user),
    q.stage && { stage: q.stage },
    q.status && { status: q.status },
    q.assignedTo && { assignedTo: q.assignedTo },
    q.customer && { customer: q.customer },
    Object.keys(amount).length && { value: amount },
    (q.closingFrom || q.closingTo) && { expectedClosingDate: dateRange(q.closingFrom, q.closingTo) },
    q.search && searchCondition(q.search, ['dealName']),
  ]);

  const [data, total] = await Promise.all([
    Deal.find(filter)
      .populate('customer', 'name company')
      .populate('assignedTo', 'name email')
      .sort(buildSort(q, SORT_FIELDS))
      .skip(skip)
      .limit(limit)
      .lean(),
    Deal.countDocuments(filter),
  ]);
  return { data, pagination: paginationMeta(total, page, limit) };
};

const getDeal = async (id, user) => {
  const deal = await getDealForUser(id, user);
  return deal.populate([
    { path: 'customer', select: 'name email company' },
    { path: 'lead', select: 'name status' },
    { path: 'assignedTo', select: 'name email' },
  ]);
};

const updateDeal = async (id, data, user) => {
  const deal = await getDealForUser(id, user);
  if (isClosed(deal)) throw new AppError(`A ${deal.stage} deal can no longer be modified`, 409);

  if (data.expectedClosingDate && data.expectedClosingDate.getTime() !== deal.expectedClosingDate.getTime()) {
    assertValidClosingDate(data.expectedClosingDate);
  }

  const { previous, next, changed } = diffFields(deal, data, UPDATABLE);
  if (!changed) return deal;

  deal.set(next);
  await deal.save(); // pre-validate hook recalculates expectedRevenue
  await timeline.log({
    action: A.DEAL_UPDATED, entityType: 'Deal', entityId: deal._id, performedBy: user._id,
    previousValue: previous, newValue: next, message: 'Deal updated',
  });
  return deal;
};

// Stage changes are the core business rule of this module.
const changeStage = async (id, { stage, probability, lostReason }, user) => {
  const deal = await getDealForUser(id, user);

  if (isClosed(deal)) throw new AppError(`A ${deal.stage} deal cannot be moved to another stage`, 409);
  if (deal.stage === stage) throw new AppError(`Deal is already in ${stage}`, 400);

  const allowed = DEAL_TRANSITIONS[deal.stage];
  if (!allowed.includes(stage)) {
    throw new AppError(`Cannot move a deal from ${deal.stage} to ${stage}. Allowed: ${allowed.join(', ')}`, 400);
  }

  const previous = { stage: deal.stage, probability: deal.probability };

  if (stage === 'Lost') {
    if (!lostReason) throw new AppError('A reason is required when marking a deal as Lost', 400);
    deal.lostReason = lostReason;
    deal.probability = 0;
    deal.closedAt = new Date();
  } else if (stage === 'Won') {
    // A won deal must have valid information (the schema also enforces value > 0)
    if (!(deal.value > 0)) throw new AppError('A deal needs a value greater than zero to be marked as Won', 400);
    deal.probability = 100;
    deal.closedAt = new Date();
  } else {
    deal.probability = probability ?? DEFAULT_STAGE_PROBABILITY[stage];
  }

  deal.stage = stage;
  await deal.save(); // recalculates status + expectedRevenue

  const base = { entityType: 'Deal', entityId: deal._id, performedBy: user._id };
  const entries = [
    { ...base, action: A.DEAL_STAGE_CHANGED, previousValue: previous, newValue: { stage, probability: deal.probability }, message: `Deal moved from ${previous.stage} to ${stage}` },
  ];
  if (stage === 'Won') entries.push({ ...base, action: A.DEAL_WON, newValue: { value: deal.value }, message: 'Deal won' });
  if (stage === 'Lost') entries.push({ ...base, action: A.DEAL_LOST, newValue: { reason: lostReason }, message: 'Deal lost' });
  await timeline.log(entries);

  return deal;
};

const assignDeal = async (id, assigneeId, user) => {
  const deal = await getDealForUser(id, user);
  if (isClosed(deal)) throw new AppError(`A ${deal.stage} deal cannot be reassigned`, 409);

  const assignee = await assertAssignable(assigneeId, user);
  if (deal.assignedTo.equals(assignee._id)) throw new AppError('Deal is already assigned to this user', 400);

  const previous = deal.assignedTo;
  deal.assignedTo = assignee._id;
  await deal.save();
  await timeline.log({
    action: A.DEAL_ASSIGNED, entityType: 'Deal', entityId: deal._id, performedBy: user._id,
    previousValue: previous, newValue: assignee._id, message: `Deal assigned to ${assignee.name}`,
  });
  return deal.populate('assignedTo', 'name email');
};

module.exports = { assertValidClosingDate, getDealForUser, createDeal, listDeals, getDeal, updateDeal, changeStage, assignDeal };
