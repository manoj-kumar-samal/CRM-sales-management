const Customer = require('../models/Customer');
const Deal = require('../models/Deal');
const AppError = require('../utils/AppError');
const timeline = require('./timeline.service');
const { ROLES, TIMELINE_ACTIONS: A } = require('../config/constants');
const { ownerFilter, canAccessOwner, assertAssignable } = require('./access.service');
const { getPagination, buildSort, searchCondition, dateRange, paginationMeta, combine } = require('../utils/query');
const { diffFields } = require('../utils/diff');

const SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'company', 'status'];
const UPDATABLE = ['name', 'email', 'phone', 'company', 'address', 'status'];

const getCustomerForUser = async (id, user) => {
  const customer = await Customer.findById(id);
  if (!customer) throw new AppError('Customer not found', 404);
  if (!(await canAccessOwner(user, customer.assignedTo))) throw new AppError('You do not have access to this customer', 403);
  return customer;
};

const createCustomer = async (data, user) => {
  let assignedTo = user._id;
  if (data.assignedTo && data.assignedTo !== user._id.toString()) {
    if (user.role === ROLES.EXECUTIVE) throw new AppError('Sales executives can only create customers for themselves', 403);
    assignedTo = (await assertAssignable(data.assignedTo, user))._id;
  }

  const customer = await Customer.create({ ...data, assignedTo, createdBy: user._id });
  await timeline.log({
    action: A.CUSTOMER_CREATED, entityType: 'Customer', entityId: customer._id, performedBy: user._id,
    newValue: { name: customer.name, assignedTo }, message: 'Customer created',
  });
  return customer;
};

const listCustomers = async (q, user) => {
  const { page, limit, skip } = getPagination(q);
  const filter = combine([
    await ownerFilter(user),
    q.status && { status: q.status },
    q.assignedTo && { assignedTo: q.assignedTo },
    (q.createdFrom || q.createdTo) && { createdAt: dateRange(q.createdFrom, q.createdTo) },
    q.search && searchCondition(q.search, ['name', 'email', 'company', 'phone']),
  ]);

  const [data, total] = await Promise.all([
    Customer.find(filter).populate('assignedTo', 'name email').sort(buildSort(q, SORT_FIELDS)).skip(skip).limit(limit).lean(),
    Customer.countDocuments(filter),
  ]);
  return { data, pagination: paginationMeta(total, page, limit) };
};

// Customer + its original lead + all its deals
const getCustomer = async (id, user) => {
  const customer = await getCustomerForUser(id, user);
  await customer.populate([
    { path: 'assignedTo', select: 'name email' },
    { path: 'lead', select: 'name status source' },
  ]);
  const deals = await Deal.find({ customer: customer._id })
    .select('dealName stage status value expectedRevenue expectedClosingDate')
    .sort({ createdAt: -1 })
    .lean();
  return { ...customer.toJSON(), deals };
};

const updateCustomer = async (id, data, user) => {
  const customer = await getCustomerForUser(id, user);
  const { previous, next, changed } = diffFields(customer, data, UPDATABLE);
  if (!changed) return customer;

  customer.set(next);
  await customer.save();
  await timeline.log({
    action: A.CUSTOMER_UPDATED, entityType: 'Customer', entityId: customer._id, performedBy: user._id,
    previousValue: previous, newValue: next, message: 'Customer updated',
  });
  return customer;
};

const assignCustomer = async (id, assigneeId, user) => {
  const customer = await getCustomerForUser(id, user);
  const assignee = await assertAssignable(assigneeId, user);
  if (customer.assignedTo.equals(assignee._id)) throw new AppError('Customer is already assigned to this user', 400);

  const previous = customer.assignedTo;
  customer.assignedTo = assignee._id;
  await customer.save();
  await timeline.log({
    action: A.CUSTOMER_ASSIGNED, entityType: 'Customer', entityId: customer._id, performedBy: user._id,
    previousValue: previous, newValue: assignee._id, message: `Customer assigned to ${assignee.name}`,
  });
  return customer.populate('assignedTo', 'name email');
};

const deleteCustomer = async (id, user) => {
  const customer = await getCustomerForUser(id, user);
  if (customer.lead) {
    throw new AppError('Customers created from a lead conversion cannot be deleted. Set their status to Inactive instead.', 409);
  }
  if (await Deal.exists({ customer: customer._id })) {
    throw new AppError('Customer has deals and cannot be deleted', 409);
  }
  await customer.deleteOne();
};

module.exports = { getCustomerForUser, createCustomer, listCustomers, getCustomer, updateCustomer, assignCustomer, deleteCustomer };
