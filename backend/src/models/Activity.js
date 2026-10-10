const mongoose = require('mongoose');
const { ACTIVITY_TYPES, RELATED_MODELS } = require('../config/constants');

const activitySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: Date, // optional only for notes
    // Only Pending / Completed are stored. "Overdue" is calculated (see toJSON below).
    status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
    relatedModel: { type: String, enum: RELATED_MODELS, required: true },
    relatedTo: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'relatedModel' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: Date,
  },
  { timestamps: true, versionKey: false }
);

activitySchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
activitySchema.index({ relatedModel: 1, relatedTo: 1 });
activitySchema.index({ dueDate: 1 });
activitySchema.index({ createdAt: -1 });

// The backend decides what "Overdue" means: still pending and the due date has passed.
activitySchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.status === 'Pending' && ret.dueDate && new Date(ret.dueDate) < new Date()) {
      ret.status = 'Overdue';
    }
    return ret;
  },
});

module.exports = mongoose.model('Activity', activitySchema);
