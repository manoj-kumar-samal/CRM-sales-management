const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Deal = require('../models/Deal');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { ROLES, DEAL_STAGES, OPEN_STAGES } = require('../config/constants');
const { ownerFilter } = require('./access.service');
const { visibleFilter, statusCondition } = require('./activity.service');
const { dateRange, combine } = require('../utils/query');

const round = (n) => Math.round(n * 100) / 100;
const createdBetween = ({ from, to }) => (from || to ? { createdAt: dateRange(from, to) } : {});

// Deals grouped by stage - always returns every stage (0 if empty), in pipeline order.
const stageStats = async (dealFilter) => {
  const rows = await Deal.aggregate([
    { $match: dealFilter },
    { $group: { _id: '$stage', count: { $sum: 1 }, totalValue: { $sum: '$value' }, expectedRevenue: { $sum: '$expectedRevenue' } } },
  ]);
  const byStage = Object.fromEntries(rows.map((r) => [r._id, r]));
  return DEAL_STAGES.map((stage) => ({
    stage,
    count: byStage[stage] ? byStage[stage].count : 0,
    totalValue: round(byStage[stage] ? byStage[stage].totalValue : 0),
    expectedRevenue: round(byStage[stage] ? byStage[stage].expectedRevenue : 0),
  }));
};

// Numbers are scoped by role: admin = everything, manager = team, executive = own records.
const getStats = async (user, range) => {
  const now = new Date();
  const created = createdBetween(range);
  const [leadOwner, ownerOnly, activityVisible] = await Promise.all([
    ownerFilter(user, 'assignedTo', { includeUnassigned: true }),
    ownerFilter(user, 'assignedTo'),
    visibleFilter(user),
  ]);

  const [leadRows, totalCustomers, stages, pendingActivities, overdueActivities] = await Promise.all([
    Lead.aggregate([{ $match: combine([leadOwner, created]) }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Customer.countDocuments(combine([ownerOnly, created])),
    stageStats(combine([ownerOnly, created])),
    Activity.countDocuments(combine([activityVisible, statusCondition('Pending', now)])),
    Activity.countDocuments(combine([activityVisible, statusCondition('Overdue', now)])),
  ]);

  const leadCount = Object.fromEntries(leadRows.map((r) => [r._id, r.count]));
  const totalLeads = leadRows.reduce((sum, r) => sum + r.count, 0);
  const convertedLeads = leadCount.Converted || 0;

  const open = stages.filter((s) => OPEN_STAGES.includes(s.stage));
  const won = stages.find((s) => s.stage === 'Won');
  const lost = stages.find((s) => s.stage === 'Lost');

  return {
    leads: { total: totalLeads, new: leadCount.New || 0, qualified: leadCount.Qualified || 0, converted: convertedLeads },
    customers: { total: totalCustomers },
    deals: {
      total: stages.reduce((sum, s) => sum + s.count, 0),
      open: open.reduce((sum, s) => sum + s.count, 0),
      won: won.count,
      lost: lost.count,
    },
    revenue: {
      total: won.totalValue, // value of won deals
      expected: round(open.reduce((sum, s) => sum + s.expectedRevenue, 0)), // weighted value of open deals
    },
    conversionRate: totalLeads ? round((convertedLeads / totalLeads) * 100) : 0, // % of leads converted
    activities: { pending: pendingActivities, overdue: overdueActivities },
  };
};

const getPipeline = async (user, range) => {
  const filter = combine([await ownerFilter(user, 'assignedTo'), createdBetween(range)]);
  return stageStats(filter);
};

// Per-executive performance. Admin: all executives. Manager: their team only.
const getTeamPerformance = async (user, range) => {
  const now = new Date();
  const created = createdBetween(range);
  const executiveFilter = { role: ROLES.EXECUTIVE, isActive: true };
  if (user.role === ROLES.MANAGER) executiveFilter.manager = user._id;

  const executives = await User.find(executiveFilter).select('name email').sort({ name: 1 }).lean();
  const ids = executives.map((e) => e._id);
  const count = (condition) => ({ $sum: { $cond: [condition, 1, 0] } });

  const [leadRows, dealRows, activityRows] = await Promise.all([
    Lead.aggregate([
      { $match: combine([{ assignedTo: { $in: ids } }, created]) },
      { $group: { _id: '$assignedTo', total: { $sum: 1 }, converted: count({ $eq: ['$status', 'Converted'] }) } },
    ]),
    Deal.aggregate([
      { $match: combine([{ assignedTo: { $in: ids } }, created]) },
      {
        $group: {
          _id: '$assignedTo',
          total: { $sum: 1 },
          won: count({ $eq: ['$stage', 'Won'] }),
          lost: count({ $eq: ['$stage', 'Lost'] }),
          revenue: { $sum: { $cond: [{ $eq: ['$stage', 'Won'] }, '$value', 0] } },
          expectedRevenue: { $sum: { $cond: [{ $in: ['$stage', OPEN_STAGES] }, '$expectedRevenue', 0] } },
        },
      },
    ]),
    Activity.aggregate([
      { $match: { assignedTo: { $in: ids }, status: 'Pending' } },
      { $group: { _id: '$assignedTo', pending: count({ $gte: ['$dueDate', now] }), overdue: count({ $lt: ['$dueDate', now] }) } },
    ]),
  ]);

  const toMap = (rows) => Object.fromEntries(rows.map((r) => [String(r._id), r]));
  const leads = toMap(leadRows);
  const deals = toMap(dealRows);
  const activities = toMap(activityRows);

  return executives.map((exec) => {
    const l = leads[String(exec._id)] || { total: 0, converted: 0 };
    const d = deals[String(exec._id)] || { total: 0, won: 0, lost: 0, revenue: 0, expectedRevenue: 0 };
    const a = activities[String(exec._id)] || { pending: 0, overdue: 0 };
    return {
      executive: exec,
      leads: { total: l.total, converted: l.converted, conversionRate: l.total ? round((l.converted / l.total) * 100) : 0 },
      deals: { total: d.total, open: d.total - d.won - d.lost, won: d.won, lost: d.lost },
      revenue: round(d.revenue),
      expectedRevenue: round(d.expectedRevenue),
      activities: { pending: a.pending, overdue: a.overdue },
    };
  });
};

module.exports = { getStats, getPipeline, getTeamPerformance };
