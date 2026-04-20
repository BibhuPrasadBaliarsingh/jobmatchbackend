const User = require('../models/User');
const Match = require('../models/Match');
const Notification = require('../models/Notification');

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

module.exports = { updateProfile, getDashboard, respondToMatch };
