import express from 'express';
import {
  getOverallPerformance,
  getSubjectPerformance,
  getProgressOverTime,
  getRecentTests,
  getComparisonData
} from '../controllers/performanceController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected - require authentication
router.use(authenticate);

// Get overall performance statistics
router.get('/overall', getOverallPerformance);

// Get subject-wise performance
router.get('/subjects', getSubjectPerformance);

// Get progress over time
router.get('/progress', getProgressOverTime);

// Get recent test attempts
router.get('/recent-tests', getRecentTests);

// Get comparison data
router.get('/comparison', getComparisonData);

export default router;

