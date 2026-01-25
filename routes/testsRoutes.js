import express from 'express';
import {
  getAllTests,
  getTestCategories,
  getTestById,
  getSubjects,
  checkTestAccess,
  getAttemptResult
} from '../controllers/testsController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected - require authentication
router.use(authenticate);

// Get all tests with filters
router.get('/', getAllTests);

// Get test categories with counts
router.get('/categories', getTestCategories);

// Get all subjects for filtering
router.get('/subjects', getSubjects);

// Get test attempt result for review
router.get('/attempt/:attemptId', getAttemptResult);

// Get single test details
router.get('/:testId', getTestById);

// Check if user can access a test
router.get('/:testId/access', checkTestAccess);

export default router;

