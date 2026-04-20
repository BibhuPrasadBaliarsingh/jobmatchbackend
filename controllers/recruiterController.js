const User = require('../models/User');
const Job = require('../models/Job');
const Match = require('../models/Match');
const Notification = require('../models/Notification');

// @desc    Update recruiter profile
// @route   PUT /api/recruiter/profile
// @access  Private (recruiter)
const updateProfile = async (req, res) => {
  try {
    const { name, phone, location, companyName, companyDescription } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (location) user.location = location;
    if (companyName) user.companyName = companyName;
    if (companyDescription) user.companyDescription = companyDescription;

    user.checkProfileComplete();
    await user.save();

    res.json({ success: true, message: 'Profile updated.', data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get recruiter dashboard
// @route   GET /api/recruiter/dashboard
// @access  Private (recruiter)
const getDashboard = async (req, res) => {
  try {
    const recruiterId = req.user._id;

    const [profile, jobs, matches, unreadNotifications] = await Promise.all([
      User.findById(recruiterId),
      Job.find({ recruiter: recruiterId }).sort({ createdAt: -1 }),
      Match.find({ recruiter: recruiterId })
        .populate('seeker', 'name email skills experienceYears location phone')
        .populate('job', 'title requiredSkills')
        .sort({ createdAt: -1 }),
      Notification.countDocuments({ recipient: recruiterId, isRead: false }),
    ]);

    const stats = {
      totalJobs: jobs.length,
      activeJobs: jobs.filter((j) => j.status === 'active').length,
      totalCandidates: matches.length,
      pendingReview: matches.filter((m) => m.recruiterStatus === 'pending').length,
      accepted: matches.filter((m) => m.recruiterStatus === 'accepted').length,
      unreadNotifications,
    };

    res.json({ success: true, data: { profile, jobs, matches, stats } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Recruiter responds to a candidate
// @route   PUT /api/recruiter/matches/:matchId/respond
// @access  Private (recruiter)
const respondToMatch = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const match = await Match.findOne({ _id: req.params.matchId, recruiter: req.user._id });
    if (!match) return res.status(404).json({ success: false, message: 'Match not found.' });

    if (match.recruiterStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'Already responded to this candidate.' });
    }

    match.recruiterStatus = status;
    if (match.seekerStatus === 'accepted' && status === 'accepted') {
      match.status = 'hired';
    }
    await match.save();

    // Notify seeker
    await Notification.create({
      recipient: match.seeker,
      type: 'application_update',
      title: `Application ${status === 'accepted' ? 'Shortlisted! 🎉' : 'Not Moving Forward'}`,
      message:
        status === 'accepted'
          ? 'Great news! The recruiter is interested in your profile. Expect to hear from them soon.'
          : 'The recruiter has decided not to move forward at this time. Keep exploring other opportunities!',
      relatedMatch: match._id,
    });

    res.json({ success: true, message: `Candidate ${status}.`, data: match });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { updateProfile, getDashboard, respondToMatch };
