const User = require('../models/User');
const Job = require('../models/Job');
const Match = require('../models/Match');
const Notification = require('../models/Notification');

// ─── Matching Algorithm ───────────────────────────────────────────────────────
const computeMatchScore = (seeker, job) => {
  if (!seeker.skills || !job.requiredSkills) return 0;

  const seekerSkills = seeker.skills.map((s) => s.toLowerCase().trim());
  const jobSkills = job.requiredSkills.map((s) => s.toLowerCase().trim());

  // Skills intersection
  const matchedSkills = jobSkills.filter((skill) =>
    seekerSkills.some((s) => s.includes(skill) || skill.includes(s))
  );
  const skillScore = jobSkills.length > 0 ? (matchedSkills.length / jobSkills.length) * 70 : 0;

  // Experience score (within range scores full, under/over loses points)
  const expDiff = seeker.experienceYears - job.experienceRequired;
  const expScore = expDiff >= 0 ? Math.min(30, 30 - Math.abs(expDiff) * 2) : Math.max(0, 30 + expDiff * 5);

  return Math.round(Math.min(100, skillScore + expScore));
};

// @desc    Get admin dashboard analytics
// @route   GET /api/admin/dashboard
// @access  Private (admin)
const getDashboard = async (req, res) => {
  try {
    const [
      totalSeekers,
      totalRecruiters,
      totalJobs,
      totalMatches,
      recentUsers,
      recentJobs,
      matchStats,
    ] = await Promise.all([
      User.countDocuments({ role: 'seeker' }),
      User.countDocuments({ role: 'recruiter' }),
      Job.countDocuments({ status: 'active' }),
      Match.countDocuments(),
      User.find({ role: { $in: ['seeker', 'recruiter'] } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name email role createdAt'),
      Job.find().sort({ createdAt: -1 }).limit(5).populate('recruiter', 'name'),
      Match.aggregate([
        {
          $group: {
            _id: null,
            avgScore: { $avg: '$matchScore' },
            hired: { $sum: { $cond: [{ $eq: ['$status', 'hired'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$seekerStatus', 'pending'] }, 1, 0] } },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalSeekers,
          totalRecruiters,
          totalJobs,
          totalMatches,
          avgMatchScore: matchStats[0]?.avgScore?.toFixed(1) || 0,
          hiredCount: matchStats[0]?.hired || 0,
          pendingMatches: matchStats[0]?.pending || 0,
        },
        recentUsers,
        recentJobs,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all seekers with optional filters
// @route   GET /api/admin/seekers
// @access  Private (admin)
const getSeekers = async (req, res) => {
  try {
    const { search, skill, minExp, page = 1, limit = 20 } = req.query;
    const query = { role: 'seeker' };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }
    if (skill) query.skills = { $in: [new RegExp(skill, 'i')] };
    if (minExp) query.experienceYears = { $gte: Number(minExp) };

    const skip = (Number(page) - 1) * Number(limit);
    const [seekers, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: seekers,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all recruiters
// @route   GET /api/admin/recruiters
// @access  Private (admin)
const getRecruiters = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = { role: 'recruiter' };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [recruiters, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(query),
    ]);
    res.json({
      success: true,
      data: recruiters,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all jobs (admin view)
// @route   GET /api/admin/jobs
// @access  Private (admin)
const getAllJobs = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) query.title = { $regex: search, $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    const [jobs, total] = await Promise.all([
      Job.find(query)
        .populate('recruiter', 'name email companyName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Job.countDocuments(query),
    ]);
    res.json({
      success: true,
      data: jobs,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Find best-matching seekers for a job
// @route   GET /api/admin/match-candidates/:jobId
// @access  Private (admin)
const matchCandidatesForJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });

    // Get existing matches for this job
    const existingMatches = await Match.find({ job: job._id }).select('seeker');
    const alreadyMatchedIds = existingMatches.map((m) => m.seeker.toString());

    const seekers = await User.find({
      role: 'seeker',
      _id: { $nin: alreadyMatchedIds },
    });

    const scored = seekers
      .map((seeker) => {
        const score = computeMatchScore(seeker, job);
        const matchedSkills = job.requiredSkills.filter((skill) =>
          seeker.skills?.some((s) => s.toLowerCase().includes(skill.toLowerCase()))
        );
        return { seeker, score, matchedSkills };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    res.json({ success: true, data: { job, candidates: scored } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Admin sends a match (candidate → recruiter)
// @route   POST /api/admin/send-match
// @access  Private (admin)
const sendMatch = async (req, res) => {
  try {
    const { seekerId, jobId, adminNote } = req.body;

    const [seeker, job] = await Promise.all([
      User.findById(seekerId),
      Job.findById(jobId).populate('recruiter'),
    ]);

    if (!seeker || !job) {
      return res.status(404).json({ success: false, message: 'Seeker or Job not found.' });
    }

    const score = computeMatchScore(seeker, job);
    const matchedSkills = job.requiredSkills.filter((skill) =>
      seeker.skills?.some((s) => s.toLowerCase().includes(skill.toLowerCase()))
    );

    // Create or update match
    let match = await Match.findOne({ job: jobId, seeker: seekerId });
    if (match) {
      return res.status(409).json({ success: false, message: 'This candidate has already been matched to this job.' });
    }

    match = await Match.create({
      job: jobId,
      seeker: seekerId,
      recruiter: job.recruiter._id,
      matchScore: score,
      matchedSkills,
      adminNote,
      createdBy: req.user._id,
      sentToSeekerAt: new Date(),
      sentToRecruiterAt: new Date(),
    });

    // Notify seeker about the job opportunity
    await Notification.create({
      recipient: seekerId,
      type: 'job_opportunity',
      title: `New Job Opportunity: ${job.title}`,
      message: `An admin has matched you with a ${job.title} role at ${job.companyName}. Match score: ${score}%. Check your dashboard to accept or decline.`,
      relatedMatch: match._id,
      relatedJob: jobId,
    });

    // Notify recruiter about the candidate
    await Notification.create({
      recipient: job.recruiter._id,
      type: 'candidate_sent',
      title: `New Candidate Match: ${seeker.name}`,
      message: `Admin has sent a candidate for your ${job.title} position. Match score: ${score}%. Review their profile on your dashboard.`,
      relatedMatch: match._id,
      relatedJob: jobId,
    });

    await match.populate([
      { path: 'seeker', select: 'name email skills' },
      { path: 'job', select: 'title companyName' },
    ]);

    res.status(201).json({ success: true, message: 'Match sent successfully.', data: match });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Match already exists.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all matches
// @route   GET /api/admin/matches
// @access  Private (admin)
const getAllMatches = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [matches, total] = await Promise.all([
      Match.find(query)
        .populate('seeker', 'name email skills experienceYears')
        .populate('recruiter', 'name email companyName')
        .populate('job', 'title companyName location')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Match.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: matches,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Toggle user active status
// @route   PUT /api/admin/users/:id/toggle
// @access  Private (admin)
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}.`, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getDashboard,
  getSeekers,
  getRecruiters,
  getAllJobs,
  matchCandidatesForJob,
  sendMatch,
  getAllMatches,
  toggleUserStatus,
};
