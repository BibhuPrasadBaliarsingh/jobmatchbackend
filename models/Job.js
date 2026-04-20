const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    requiredSkills: {
      type: [String],
      required: [true, 'At least one skill is required'],
      validate: [(arr) => arr.length > 0, 'At least one skill required'],
    },
    experienceRequired: {
      type: Number,
      required: true,
      min: 0,
      max: 50,
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    jobType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'internship', 'remote'],
      default: 'full-time',
    },
    salaryRange: {
      min: { type: Number },
      max: { type: Number },
      currency: { type: String, default: 'INR' },
    },
    status: {
      type: String,
      enum: ['active', 'closed', 'draft'],
      default: 'active',
    },
    applicantsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Text index for search
jobSchema.index({ title: 'text', description: 'text', requiredSkills: 'text' });

module.exports = mongoose.model('Job', jobSchema);
