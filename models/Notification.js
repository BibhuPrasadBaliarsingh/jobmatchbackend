const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'match_sent',
        'match_accepted',
        'match_rejected',
        'job_opportunity',
        'candidate_sent',
        'application_update',
        'general',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    relatedMatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
    },
    relatedJob: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
