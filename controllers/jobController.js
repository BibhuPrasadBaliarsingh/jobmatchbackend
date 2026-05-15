const Job = require('../models/Job');
const User = require('../models/User');

// @desc    Create a job posting
// @route   POST /api/jobs
// @access  Private (recruiter)
const createJob = async (req, res) => {
  try {
    const recruiter = await User.findById(req.user._id);
    const jobData = {
      ...req.body,
      recruiter: req.user._id,
      companyName: req.body.companyName || recruiter.companyName || recruiter.name,
    };

    const job = await Job.create(jobData);
    res.status(201).json({ success: true, message: 'Job posted successfully.', data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all active jobs (public) with filters
// @route   GET /api/jobs
// @access  Public
const getJobs = async (req, res) => {
  try {
    const { search, location, jobType, minExp, maxExp, page = 1, limit = 10 } = req.query;
    const query = { status: 'active' };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { requiredSkills: { $in: [new RegExp(search, 'i')] } },
      ];
    }
    if (location) query.location = { $regex: location, $options: 'i' };
    if (jobType) query.jobType = jobType;
    if (minExp) query.experienceRequired = { $gte: Number(minExp) };
    if (maxExp) query.experienceRequired = { ...query.experienceRequired, $lte: Number(maxExp) };

    const skip = (Number(page) - 1) * Number(limit);
    const [jobs, total] = await Promise.all([
      Job.find(query)
        .populate('recruiter', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Job.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: jobs,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get single job
// @route   GET /api/jobs/:id
// @access  Public
const getJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('recruiter', 'name email companyName location');
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
    res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Private (recruiter - own jobs / admin)
const updateJob = async (req, res) => {
  try {
    const filter = req.user.role === 'admin'
      ? { _id: req.params.id }
      : { _id: req.params.id, recruiter: req.user._id };

    const job = await Job.findOne(filter);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found or unauthorized.' });

    Object.assign(job, req.body);
    await job.save();

    res.json({ success: true, message: 'Job updated.', data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Private (recruiter - own jobs / admin)
const deleteJob = async (req, res) => {
  try {
    const filter =
      req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, recruiter: req.user._id };

    const job = await Job.findOneAndDelete(filter);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found or unauthorized.' });

    res.json({ success: true, message: 'Job deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createJob, getJobs, getJob, updateJob, deleteJob };
