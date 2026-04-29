const User = require('../models/User');
const Match = require('../models/Match');
const Notification = require('../models/Notification');
const fs = require('fs');
const path = require('path');

// @desc    Upload/replace seeker resume
// @route   POST /api/seeker/resume
// @access  Private (seeker)
const uploadResume = async (req, res) => {
  try {
    const { fileName, mimeType, dataBase64 } = req.body || {};
    if (!dataBase64 || !mimeType) {
      return res.status(400).json({ success: false, message: 'Missing resume data. Provide mimeType and dataBase64.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const allowed = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    if (!allowed.has(mimeType)) {
      return res.status(400).json({ success: false, message: 'Only PDF/DOC/DOCX resumes are allowed.' });
    }

    // Rough size check: base64 length * 3/4 = bytes (minus padding)
    const approxBytes = Math.floor((dataBase64.length * 3) / 4);
    if (approxBytes > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Resume must be 5MB or less.' });
    }

    const resumesDir = path.join(__dirname, '..', 'uploads', 'resumes');
    if (!fs.existsSync(resumesDir)) fs.mkdirSync(resumesDir, { recursive: true });

    const safeOriginal = (fileName || 'resume')
      .replace(/[^a-zA-Z0-9.\-_]/g, '_')
      .slice(0, 80);
    const extFromName = path.extname(safeOriginal);
    const ext =
      extFromName ||
      (mimeType === 'application/pdf'
        ? '.pdf'
        : mimeType === 'application/msword'
          ? '.doc'
          : '.docx');
    const base = path.basename(safeOriginal, ext) || 'resume';
    const filename = `${req.user._id.toString()}_${Date.now()}_${base}${ext}`;

    const filePath = path.join(resumesDir, filename);
    fs.writeFileSync(filePath, Buffer.from(dataBase64, 'base64'));

    const resumeUrl = `${req.protocol}://${req.get('host')}/uploads/resumes/${filename}`;
    user.resumeUrl = resumeUrl;
    await user.save();

    res.json({ success: true, message: 'Resume uploaded successfully.', data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update seeker profile
// @route   PUT /api/seeker/profile
// @access  Private (seeker)
const updateProfile = async (req, res) => {
  try {
    const { name, phone, location, skills, experienceYears, experienceDescription, preferredRoles, bio } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (location) user.location = location;
    if (skills) user.skills = skills;
    if (experienceYears !== undefined) user.experienceYears = experienceYears;
    if (experienceDescription) user.experienceDescription = experienceDescription;
    if (preferredRoles) user.preferredRoles = preferredRoles;
    if (bio) user.bio = bio;

    user.checkProfileComplete();
    await user.save();

    res.json({ success: true, message: 'Profile updated successfully.', data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get seeker dashboard data
// @route   GET /api/seeker/dashboard
// @access  Private (seeker)
const getDashboard = async (req, res) => {
  try {
    const seekerId = req.user._id;

    const [profile, matches, unreadNotifications] = await Promise.all([
      User.findById(seekerId),
      Match.find({ seeker: seekerId })
        .populate('job', 'title companyName location jobType requiredSkills experienceRequired salaryRange')
        .populate('recruiter', 'name email')
        .sort({ createdAt: -1 }),
      Notification.countDocuments({ recipient: seekerId, isRead: false }),
    ]);

    const stats = {
      totalOpportunities: matches.length,
      pending: matches.filter((m) => m.seekerStatus === 'pending').length,
      accepted: matches.filter((m) => m.seekerStatus === 'accepted').length,
      rejected: matches.filter((m) => m.seekerStatus === 'rejected').length,
      unreadNotifications,
    };

    res.json({ success: true, data: { profile, matches, stats } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Seeker responds to a job opportunity (accept/reject)
// @route   PUT /api/seeker/matches/:matchId/respond
// @access  Private (seeker)
const respondToMatch = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Use accepted or rejected.' });
    }

    const match = await Match.findOne({ _id: req.params.matchId, seeker: req.user._id });
    if (!match) return res.status(404).json({ success: false, message: 'Match not found.' });

    if (match.seekerStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'You have already responded to this opportunity.' });
    }

    match.seekerStatus = status;
    await match.save();

    // Notify recruiter about seeker's response
    const seekerName = req.user.name;
    await Notification.create({
      recipient: match.recruiter,
      type: status === 'accepted' ? 'match_accepted' : 'match_rejected',
      title: `Candidate ${status === 'accepted' ? 'Accepted' : 'Declined'}`,
      message: `${seekerName} has ${status} the opportunity. Check your dashboard for details.`,
      relatedMatch: match._id,
    });

    res.json({ success: true, message: `Opportunity ${status} successfully.`, data: match });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { uploadResume, updateProfile, getDashboard, respondToMatch };
