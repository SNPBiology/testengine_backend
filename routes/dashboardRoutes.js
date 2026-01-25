import express from 'express';
import {
  getDashboardOverview,
  getUpcomingTests,
  getRecentTests,
  getSubjectProgress,
  getUserRank
} from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected - require authentication
router.use(authenticate);

// Get dashboard overview (performance metrics)
router.get('/overview', getDashboardOverview);

// Get upcoming tests
router.get('/upcoming-tests', getUpcomingTests);

// Get recent test attempts
router.get('/recent-tests', getRecentTests);

// Get subject-wise progress
router.get('/subject-progress', getSubjectProgress);

// Get user rank
router.get('/rank', getUserRank);

export default router;


