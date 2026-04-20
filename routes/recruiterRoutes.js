const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { updateProfile, getDashboard, respondToMatch } = require('../controllers/recruiterController');

const router = express.Router();
router.use(protect, authorize('recruiter'));

router.get('/dashboard', getDashboard);
router.put('/profile', updateProfile);
router.put('/matches/:matchId/respond', respondToMatch);

module.exports = router;
