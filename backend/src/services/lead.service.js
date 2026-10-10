const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Deal = require('../models/Deal');
const Activity = require('../models/Activity');
const AppError = require('../utils/AppError');
const timeline = require('./timeline.service');
const { ROLES, LEAD_TRANSITIONS, TIMELINE_ACTIONS: A, DEFAULT_STAGE_PROBABILITY } = require('../config/constants');
const { ownerFilter, canAccessOwner, assertAssignable } = require('./access.service');
const { assertValidClosingDate } = require('./deal.service');
const { getPagination, buildSort, searchCondition, dateRange, paginationMeta, combine } = require('../utils/query');
const { diffFields } = require('../utils/diff');

const SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'company', 'status', 'priority', 'source'];
const UPDATABLE = ['name', 'email', 'phone', 'company', 'source', 'priority', 'description'];

// Load a lead and make sure THIS user is allowed to touch it.
const getLeadForUser = async (id, user) => {
  const lead = await Lead.findById(id);
  if (!lead) throw new AppError('Lead not found', 404);
  if (!(await canAccessOwner(user, lead.assignedTo, { includeUnassigned: true }))) {
    throw new AppError('You do not have access to this lead', 403);
  }
  return lead;
};

const createLead = async (data, user) => {
  let assignedTo = null;
  if (user.role === ROLES.EXECUTIVE) {
    // executives can only create leads for themselves
    if (data.assignedTo && data.assignedTo !== user._id.toString()) {
      throw new AppError('Sales executives can only create leads assigned to themselves', 403);
    }
    assignedTo = user._id;
  } else if (data.assignedTo) {
    assignedTo = (await assertAssignable(data.assignedTo, user))._id;
  }

  const lead = await Lead.create({ ...data, assignedTo, createdBy: user._id, status: 'New' });

  const base = { entityType: 'Lead', entityId: lead._id, performedBy: user._id };
  const entries = [{ ...base, action: A.LEAD_CREATED, newValue: { name: lead.name, status: lead.status, assignedTo }, message: 'Lead created' }];
  if (assignedTo && !assignedTo.equals(user._id)) {
    entries.push({ ...base, action: A.LEAD_ASSIGNED, newValue: assignedTo, message: 'Lead assigned on creation' });
  }
  await timeline.log(entries);
  return lead;
};

const listLeads = async (q, user) => {
  const { page, limit, skip } = getPagination(q);
  const filter = combine([
    await ownerFilter(user, 'assignedTo', { includeUnassigned: true }),
    q.status && { status: q.status },
    q.priority && { priority: q.priority },
    q.source && { source: q.source },
    q.assignedTo && { assignedTo: q.assignedTo },
    q.unassigned && { assignedTo: null },
    (q.createdFrom || q.createdTo) && { createdAt: dateRange(q.createdFrom, q.createdTo) },
    q.search && searchCondition(q.search, ['name', 'email', 'company', 'phone']),
  ]);

  const [data, total] = await Promise.all([
    Lead.find(filter).populate('assignedTo', 'name email').sort(buildSort(q, SORT_FIELDS)).skip(skip).limit(limit).lean(),
    Lead.countDocuments(filter),
  ]);
  return { data, pagination: paginationMeta(total, page, limit) };
};

const getLead = async (id, user) => {
  const lead = await getLeadForUser(id, user);
  return lead.populate([
    { path: 'assignedTo', select: 'name email' },
    { path: 'customer', select: 'name email' },
    { path: 'deal', select: 'dealName stage value' },
  ]);
};

const updateLead = async (id, data, user) => {
  const lead = await getLeadForUser(id, user);
  if (lead.isConverted) throw new AppError('Converted leads cannot be edited', 409);

  const { previous, next, changed } = diffFields(lead, data, UPDATABLE);
  if (!changed) return lead;

  lead.set(next);
  await lead.save();

  const base = { entityType: 'Lead', entityId: lead._id, performedBy: user._id };
  const entries = [];
  if (next.priority !== undefined) {
    entries.push({ ...base, action: A.LEAD_PRIORITY_CHANGED, previousValue: previous.priority, newValue: next.priority, message: 'Lead priority changed' });
    delete previous.priority;
    delete next.priority;
  }
  if (Object.keys(next).length) {
    entries.push({ ...base, action: A.LEAD_UPDATED, previousValue: previous, newValue: next, message: 'Lead details updated' });
  }
  await timeline.log(entries);
  return lead;
};

const updateStatus = async (id, status, user) => {
  const lead = await getLeadForUser(id, user);
  if (lead.isConverted) throw new AppError('Converted leads cannot change status', 409);
  if (lead.status === status) throw new AppError(`Lead is already ${status}`, 400);
  if (status === 'Converted') throw new AppError('Use POST /leads/:id/convert to convert a lead', 400);

  const allowed = LEAD_TRANSITIONS[lead.status];
  if (!allowed.includes(status)) {
    throw new AppError(`Cannot change status from ${lead.status} to ${status}. Allowed: ${allowed.join(', ') || 'none'}`, 400);
  }

  const previous = lead.status;
  lead.status = status;
  await lead.save();

  await timeline.log({
    action: A.LEAD_STATUS_CHANGED, entityType: 'Lead', entityId: lead._id, performedBy: user._id,
    previousValue: previous, newValue: status, message: `Lead status changed from ${previous} to ${status}`,
  });
  return lead;
};

const assignLead = async (id, assigneeId, user) => {
  const lead = await getLeadForUser(id, user);
  if (lead.isConverted) throw new AppError('Converted leads cannot be reassigned', 409);

  const assignee = await assertAssignable(assigneeId, user);
  if (lead.assignedTo && lead.assignedTo.equals(assignee._id)) {
    throw new AppError('Lead is already assigned to this user', 400);
  }

  const previous = lead.assignedTo;
  lead.assignedTo = assignee._id;
  await lead.save();

  await timeline.log({
    action: previous ? A.LEAD_REASSIGNED : A.LEAD_ASSIGNED,
    entityType: 'Lead', entityId: lead._id, performedBy: user._id,
    previousValue: previous, newValue: assignee._id,
    message: `Lead ${previous ? 'reassigned' : 'assigned'} to ${assignee.name}`,
  });
  return lead.populate('assignedTo', 'name email');
};

const deleteLead = async (id, user) => {
  const lead = await getLeadForUser(id, user);
  if (lead.isConverted) throw new AppError('Converted leads cannot be deleted (a customer and deal reference them)', 409);

  await lead.deleteOne();
  await Activity.deleteMany({ relatedModel: 'Lead', relatedTo: lead._id });
  // The timeline is an audit log, so it is kept and we add a "deleted" entry
  await timeline.log({
    action: A.LEAD_DELETED, entityType: 'Lead', entityId: lead._id, performedBy: user._id,
    previousValue: { name: lead.name, status: lead.status }, message: 'Lead deleted',
  });
};

// Lead -> Customer -> Deal inside ONE transaction: either everything is created or nothing is.
const convertLead = async (id, payload, user) => {
  const lead = await getLeadForUser(id, user);

  if (lead.isConverted || lead.status === 'Converted') throw new AppError('Lead has already been converted', 409);
  if (lead.status !== 'Qualified') throw new AppError('Only leads with Qualified status can be converted', 400);
  if (!lead.assignedTo) throw new AppError('Assign the lead to a sales executive before converting', 400);

  const dealInput = payload.deal;
  assertValidClosingDate(dealInput.expectedClosingDate);

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const [customer] = await Customer.create(
        [{
          name: lead.name, email: lead.email, phone: lead.phone, company: lead.company,
          address: payload.customer && payload.customer.address,
          lead: lead._id, assignedTo: lead.assignedTo, createdBy: user._id,
        }],
        { session }
      );

      const [deal] = await Deal.create(
        [{
          dealName: dealInput.dealName || `${lead.company || lead.name} - Deal`,
          lead: lead._id, customer: customer._id, assignedTo: lead.assignedTo,
          value: dealInput.value,
          probability: dealInput.probability ?? DEFAULT_STAGE_PROBABILITY.Qualification,
          expectedClosingDate: dealInput.expectedClosingDate,
          description: dealInput.description,
          stage: 'Qualification', createdBy: user._id,
        }],
        { session }
      );

      // Conditional update = guard against two people converting the same lead at once
      const updatedLead = await Lead.findOneAndUpdate(
        { _id: lead._id, isConverted: false, status: 'Qualified' },
        { $set: { status: 'Converted', isConverted: true, customer: customer._id, deal: deal._id, convertedAt: new Date() } },
        { new: true, session }
      );
      if (!updatedLead) throw new AppError('Lead has already been converted or is no longer qualified', 409);

      const by = user._id;
      await timeline.log(
        [
          { action: A.LEAD_CONVERTED, entityType: 'Lead', entityId: lead._id, performedBy: by, previousValue: 'Qualified', newValue: { customer: customer._id, deal: deal._id }, message: 'Lead converted to customer and deal' },
          { action: A.CUSTOMER_CREATED, entityType: 'Customer', entityId: customer._id, performedBy: by, newValue: { lead: lead._id }, message: 'Customer created from lead conversion' },
          { action: A.DEAL_CREATED, entityType: 'Deal', entityId: deal._id, performedBy: by, newValue: { value: deal.value, stage: deal.stage, customer: customer._id }, message: 'Deal created from lead conversion' },
        ],
        session
      );

      result = { lead: updatedLead, customer, deal };
    });
  } finally {
    await session.endSession();
  }
  return result;
};

module.exports = { getLeadForUser, createLead, listLeads, getLead, updateLead, updateStatus, assignLead, deleteLead, convertLead };
