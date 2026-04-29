const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { uploadResume, updateProfile, getDashboard, respondToMatch } = require('../controllers/seekerController');

const router = express.Router();
router.use(protect, authorize('seeker'));

router.get('/dashboard', getDashboard);
router.put('/profile', updateProfile);
router.post('/resume', uploadResume);
router.put('/matches/:matchId/respond', respondToMatch);

module.exports = router;
