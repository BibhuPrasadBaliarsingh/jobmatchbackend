const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logoUpload } = require('../middleware/upload');
const { createJob, getJobs, getJob, updateJob, deleteJob } = require('../controllers/jobController');

const router = express.Router();

router.get('/', getJobs);
router.get('/:id', getJob);

router.post(
  '/',
  protect,
  authorize('recruiter', 'admin'),
  logoUpload.single('logo'),
  [
    body('title').trim().notEmpty().withMessage('Job title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('requiredSkills').custom(val => {
      try {
        const arr = typeof val === 'string' ? JSON.parse(val) : val;
        return Array.isArray(arr) && arr.length > 0;
      } catch {
        return false;
      }
    }).withMessage('At least one skill is required'),
    body('experienceRequired').isNumeric().withMessage('Experience must be a number'),
    body('location').trim().notEmpty().withMessage('Location is required'),
  ],
  validate,
  createJob
);

router.put('/:id', protect, authorize('recruiter', 'admin'), updateJob);
router.delete('/:id', protect, authorize('recruiter', 'admin'), deleteJob);

module.exports = router;
