const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required')
      .matches(/^[6-9]\d{9}$/).withMessage('Phone must be 10 digits and start with 6-9')
      .custom((value) => {
        if (/(.)\1\1/.test(value)) {
          throw new Error('Phone cannot contain three repeated digits');
        }
        return true;
      }),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['seeker', 'recruiter']).withMessage('Role must be seeker or recruiter'),
    body('email').optional().isEmail().withMessage('Valid email is required').normalizeEmail(),
  ],
  validate,
  register
);

router.post(
  '/login',
  [
    body('password').notEmpty().withMessage('Password is required'),
    body().custom((value, { req }) => {
      if (!req.body.email && !req.body.phone) {
        throw new Error('Phone number or email is required');
      }
      if (req.body.phone) {
        if (!/^[6-9]\d{9}$/.test(req.body.phone)) {
          throw new Error('Phone must be 10 digits and start with 6-9');
        }
        if (/(.)\1\1/.test(req.body.phone)) {
          throw new Error('Phone cannot contain three repeated digits');
        }
      }
      return true;
    }),
    body('email').optional().isEmail().withMessage('Valid email required').normalizeEmail(),
  ],
  validate,
  login
);

router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);

module.exports = router;
