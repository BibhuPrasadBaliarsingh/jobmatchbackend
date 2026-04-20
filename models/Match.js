const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    seeker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    matchScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    matchedSkills: [{ type: String }],
    adminNote: { type: String, maxlength: 500 },
    // Seeker's response to the job opportunity
    seekerStatus: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    // Recruiter's response to the candidate
    recruiterStatus: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    // Overall match status
    status: {
      type: String,
      enum: ['active', 'hired', 'closed'],
      default: 'active',
    },
    sentToSeekerAt: { type: Date },
    sentToRecruiterAt: { type: Date },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Prevent duplicate matches for same seeker+job
matchSchema.index({ job: 1, seeker: 1 }, { unique: true });

module.exports = mongoose.model('Match', matchSchema);
