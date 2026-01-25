// server/routes/sessionRoutes.js
import express from 'express';
import {
  createSession,
  autosaveAnswers,
  submitSession,
  postSessionEvent,
  getSessionStatus
} from '../controllers/sessionController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All endpoints require authentication
router.use(authenticate);

// Create a new session / start attempt
router.post('/', createSession);

// Autosave answers
router.patch('/:sessionToken/answers', autosaveAnswers);

// Submit attempt
router.post('/:sessionToken/submit', submitSession);

// Log proctoring / heartbeat events
router.post('/:sessionToken/events', postSessionEvent);

// Get session status
router.get('/:sessionToken', getSessionStatus);

export default router;
