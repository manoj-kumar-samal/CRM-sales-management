const mongoose = require('mongoose');
const { DEAL_STAGES, DEAL_STATUSES } = require('../config/constants');

const dealSchema = new mongoose.Schema(
  {
    dealName: { type: String, required: [true, 'Deal name is required'], trim: true, maxlength: 150 },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    value: {
      type: Number,
      required: [true, 'Deal value is required'],
      validate: { validator: (v) => v > 0, message: 'Deal value must be greater than zero' },
    },
    probability: { type: Number, required: true, min: [0, 'Probability must be 0-100'], max: [100, 'Probability must be 0-100'] },
    expectedRevenue: { type: Number, default: 0 }, // always calculated: value * probability / 100
    expectedClosingDate: { type: Date, required: [true, 'Expected closing date is required'] },
    stage: { type: String, enum: DEAL_STAGES, default: 'Qualification' },
    status: { type: String, enum: DEAL_STATUSES, default: 'Open' }, // derived from stage
    description: { type: String, trim: true, maxlength: 2000 },
    lostReason: { type: String, trim: true, maxlength: 500 },
    closedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false }
);

// expectedRevenue and status are never trusted from the client - always recalculated here.
// (Always use doc.save() / Model.create() for deals so this hook runs.)
dealSchema.pre('validate', function () {
  this.expectedRevenue = Math.round(this.value * this.probability) / 100;
  this.status = this.stage === 'Won' ? 'Won' : this.stage === 'Lost' ? 'Lost' : 'Open';
});

dealSchema.index({ assignedTo: 1, stage: 1 });
dealSchema.index({ stage: 1 });
dealSchema.index({ customer: 1 });
dealSchema.index({ lead: 1 });
dealSchema.index({ expectedClosingDate: 1 });
dealSchema.index({ value: 1 });
dealSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Deal', dealSchema);
