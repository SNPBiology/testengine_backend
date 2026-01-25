import express from 'express';
import { signup, login, getProfile, logout } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validateSignup, validateLogin, handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

// Public routes
router.post('/signup', validateSignup, handleValidationErrors, signup);
router.post('/login', validateLogin, handleValidationErrors, login);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.post('/logout', authenticate, logout);

export default router;


