const mongoose = require('mongoose');
const { LEAD_SOURCES, LEAD_STATUSES, PRIORITIES } = require('../config/constants');

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 100 },
    email: { type: String, required: [true, 'Email is required'], lowercase: true, trim: true },
    phone: { type: String, trim: true },
    company: { type: String, trim: true, maxlength: 150 },
    source: { type: String, enum: LEAD_SOURCES, default: 'Other' },
    status: { type: String, enum: LEAD_STATUSES, default: 'New' },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    description: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Conversion tracking (Lead -> Customer -> Deal)
    isConverted: { type: Boolean, default: false },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },
    convertedAt: Date,
  },
  { timestamps: true, versionKey: false }
);

leadSchema.index({ assignedTo: 1, status: 1 }); // executive's "my leads" + status filter
leadSchema.index({ status: 1 });
leadSchema.index({ source: 1 });
leadSchema.index({ priority: 1 });
leadSchema.index({ email: 1 });
leadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);
