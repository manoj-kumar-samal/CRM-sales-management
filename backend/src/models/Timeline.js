const mongoose = require('mongoose');
const { TIMELINE_ACTIONS, TIMELINE_ENTITIES } = require('../config/constants');

// Append-only audit log: there are no update / delete endpoints for it.
const timelineSchema = new mongoose.Schema(
  {
    action: { type: String, enum: Object.values(TIMELINE_ACTIONS), required: true },
    entityType: { type: String, enum: TIMELINE_ENTITIES, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'entityType' },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    previousValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    message: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

timelineSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
timelineSchema.index({ performedBy: 1 });

module.exports = mongoose.model('Timeline', timelineSchema);
