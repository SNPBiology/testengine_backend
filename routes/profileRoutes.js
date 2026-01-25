import express from 'express';
import {
  getStudentProfile,
  updateUserInfo,
  updateStudentProfile,
  updateProfilePicture,
  changePassword,
  deleteAccount
} from '../controllers/profileController.js';
import { authenticate } from '../middleware/auth.js';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

// All routes are protected - require authentication
router.use(authenticate);

// Get student profile
router.get('/', getStudentProfile);

// Update user basic information
router.put(
  '/user-info',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('phone').optional().trim()
  ],
  handleValidationErrors,
  updateUserInfo
);

// Update student profile details
router.put(
  '/student-info',
  [
    body('dateOfBirth')
      .optional({ values: 'falsy' }) // Allow empty string, null, undefined
      .custom((value) => {
        // Allow empty values
        if (!value || value === '') return true;
        // Validate non-empty values as ISO8601 dates
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          throw new Error('Date must be in YYYY-MM-DD format');
        }
        return true;
      }),
    body('address').optional().trim(),
    body('preferences').optional().isObject().withMessage('Preferences must be an object')
  ],
  handleValidationErrors,
  updateStudentProfile
);

// Update profile picture
router.put(
  '/picture',
  [
    body('profilePicture').trim().notEmpty().withMessage('Profile picture URL is required')
  ],
  handleValidationErrors,
  updateProfilePicture
);

// Change password
router.put(
  '/change-password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long')
  ],
  handleValidationErrors,
  changePassword
);

// Delete account
router.delete(
  '/delete',
  [
    body('password').notEmpty().withMessage('Password is required')
  ],
  handleValidationErrors,
  deleteAccount
);

export default router;


