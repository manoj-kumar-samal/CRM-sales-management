const mongoose = require('mongoose');
const { CUSTOMER_STATUSES } = require('../config/constants');

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 100 },
    email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    company: { type: String, trim: true, maxlength: 150 },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }, // original lead (absent if created manually)
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: CUSTOMER_STATUSES, default: 'Active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false }
);

customerSchema.index({ assignedTo: 1, status: 1 });
customerSchema.index({ createdAt: -1 });
// One customer per lead: a database-level guard against converting the same lead twice
customerSchema.index({ lead: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Customer', customerSchema);
