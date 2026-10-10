const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'sales_manager',
  EXECUTIVE: 'sales_executive',
};

const LEAD_SOURCES = ['Website', 'Referral', 'Social Media', 'Email', 'Phone', 'Other'];
const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'];
const PRIORITIES = ['Low', 'Medium', 'High'];

// Allowed lead status changes. "Converted" is NOT here on purpose:
// a lead can only become Converted through POST /leads/:id/convert.
const LEAD_TRANSITIONS = {
  New: ['Contacted', 'Unqualified', 'Lost'],
  Contacted: ['Qualified', 'Unqualified', 'Lost'],
  Qualified: ['Contacted', 'Unqualified', 'Lost'],
  Unqualified: ['Contacted', 'Lost'],
  Lost: ['New'],
  Converted: [],
};

const CUSTOMER_STATUSES = ['Active', 'Inactive'];

const DEAL_STAGES = ['Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const OPEN_STAGES = ['Qualification', 'Discovery', 'Proposal', 'Negotiation'];
const DEAL_STATUSES = ['Open', 'Won', 'Lost'];

// Won / Lost are terminal: a closed deal can never go back to an active stage.
const DEAL_TRANSITIONS = {
  Qualification: ['Discovery', 'Lost'],
  Discovery: ['Qualification', 'Proposal', 'Lost'],
  Proposal: ['Discovery', 'Negotiation', 'Lost'],
  Negotiation: ['Proposal', 'Won', 'Lost'],
  Won: [],
  Lost: [],
};

// Used when the client does not send a probability for a stage change
const DEFAULT_STAGE_PROBABILITY = {
  Qualification: 10,
  Discovery: 25,
  Proposal: 50,
  Negotiation: 75,
  Won: 100,
  Lost: 0,
};

const ACTIVITY_TYPES = ['Call', 'Email', 'Meeting', 'Demo', 'Follow-up', 'Reminder', 'Note'];
// "Overdue" is never stored - it is derived from dueDate + status
const ACTIVITY_STATUSES = ['Pending', 'Completed', 'Overdue'];
const RELATED_MODELS = ['Lead', 'Customer', 'Deal', 'User'];

const TIMELINE_ENTITIES = ['Lead', 'Customer', 'Deal'];
const TIMELINE_ACTIONS = Object.fromEntries(
  [
    'LEAD_CREATED', 'LEAD_UPDATED', 'LEAD_ASSIGNED', 'LEAD_REASSIGNED', 'LEAD_STATUS_CHANGED',
    'LEAD_PRIORITY_CHANGED', 'LEAD_CONVERTED', 'LEAD_DELETED',
    'NOTE_ADDED', 'FOLLOWUP_CREATED', 'FOLLOWUP_COMPLETED',
    'CUSTOMER_CREATED', 'CUSTOMER_UPDATED', 'CUSTOMER_ASSIGNED',
    'DEAL_CREATED', 'DEAL_UPDATED', 'DEAL_STAGE_CHANGED', 'DEAL_ASSIGNED', 'DEAL_WON', 'DEAL_LOST',
  ].map((a) => [a, a])
);

module.exports = {
  ROLES, LEAD_SOURCES, LEAD_STATUSES, PRIORITIES, LEAD_TRANSITIONS, CUSTOMER_STATUSES,
  DEAL_STAGES, OPEN_STAGES, DEAL_STATUSES, DEAL_TRANSITIONS, DEFAULT_STAGE_PROBABILITY,
  ACTIVITY_TYPES, ACTIVITY_STATUSES, RELATED_MODELS, TIMELINE_ENTITIES, TIMELINE_ACTIONS,
};
