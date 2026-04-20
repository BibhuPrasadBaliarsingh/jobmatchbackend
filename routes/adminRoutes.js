const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getDashboard,
  getSeekers,
  getRecruiters,
  getAllJobs,
  matchCandidatesForJob,
  sendMatch,
  getAllMatches,
  toggleUserStatus,
} = require('../controllers/adminController');

const router = express.Router();
router.use(protect, authorize('admin'));

router.get('/dashboard', getDashboard);
router.get('/seekers', getSeekers);
router.get('/recruiters', getRecruiters);
router.get('/jobs', getAllJobs);
router.get('/matches', getAllMatches);
router.get('/match-candidates/:jobId', matchCandidatesForJob);
router.post('/send-match', sendMatch);
router.put('/users/:id/toggle', toggleUserStatus);

module.exports = router;
