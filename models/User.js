const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['seeker', 'recruiter', 'admin'],
      default: 'seeker',
    },
    phone: { type: String, trim: true },
    location: { type: String, trim: true },
    // Seeker-specific fields
    skills: [{ type: String, trim: true }],
    experienceYears: { type: Number, min: 0, max: 50, default: 0 },
    experienceDescription: { type: String, maxlength: 2000 },
    preferredRoles: [{ type: String, trim: true }],
    bio: { type: String, maxlength: 500 },
    resumeUrl: { type: String },
    isProfileComplete: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check profile completeness
userSchema.methods.checkProfileComplete = function () {
  const requiredFields = ['name', 'email', 'phone', 'location', 'skills', 'experienceYears'];
  const filled = requiredFields.filter((f) => {
    const val = this[f];
    return Array.isArray(val) ? val.length > 0 : !!val || val === 0;
  });
  this.isProfileComplete = filled.length === requiredFields.length;
};

module.exports = mongoose.model('User', userSchema);
