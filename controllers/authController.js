const User = require('../models/User');
const { generateToken } = require('../middleware/auth');

// @desc    Register new user (seeker or recruiter)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
      let { name, email, password, role, phone, location, companyName } = req.body;
    phone = phone?.trim();
    email = email?.trim();

    // Only allow seeker/recruiter registration via this route
    if (!['seeker', 'recruiter'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role specified.' });
    }

    if (!email) {
      email = `${phone}@jobmatch.local`;
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(409).json({ success: false, message: existingUser.phone === phone ? 'Phone already registered.' : 'Email already registered.' });
    }

    const userData = { name, email, password, role, phone, location };
    if (role === 'recruiter' && companyName) {
      userData.companyName = companyName;
    }

    const user = await User.create(userData);
    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          location: user.location,
          companyName: user.companyName,
          isProfileComplete: user.isProfileComplete,
        },
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    const query = email ? { email } : { phone };
    let user = await User.findOne(query).select('+password');

    const adminLoginMatch =
      process.env.ADMIN_EMAIL && email && email === process.env.ADMIN_EMAIL ||
      process.env.ADMIN_PHONE && phone && phone === process.env.ADMIN_PHONE;

    if (!user && adminLoginMatch) {
      user = await User.findOne({ email: process.env.ADMIN_EMAIL, role: 'admin' }).select('+password');
      if (!user) {
        user = await User.create({
          name: 'Administrator',
          email: process.env.ADMIN_EMAIL,
          phone: process.env.ADMIN_PHONE || phone,
          password: process.env.ADMIN_PASSWORD,
          role: 'admin',
        });
        user = await User.findById(user._id).select('+password');
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid phone or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account deactivated. Contact support.' });
    }

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          location: user.location,
          companyName: user.companyName,
          isProfileComplete: user.isProfileComplete,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // For admin users created via env credentials, they may not have a stored password hash
    if (!user.password) {
      return res.status(400).json({ success: false, message: 'Password change not available for this account type.' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { register, login, getMe, changePassword };
