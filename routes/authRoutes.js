import express from 'express';
import { signup, login, getProfile, logout } from '../controllers/authController.js';
import { requestOTP, verifyOTP, resendOTP } from '../controllers/otpController.js';
import { authenticate } from '../middleware/auth.js';
import { validateSignup, validateLogin, validateOTP, validateResendOTP, handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

// OTP-based signup routes (NEW)
router.post('/request-otp', validateSignup, handleValidationErrors, requestOTP);
router.post('/verify-otp', validateOTP, handleValidationErrors, verifyOTP);
router.post('/resend-otp', validateResendOTP, handleValidationErrors, resendOTP);

// Legacy signup route (keep for backward compatibility, can be removed later)
router.post('/signup', validateSignup, handleValidationErrors, signup);

// Login route
router.post('/login', validateLogin, handleValidationErrors, login);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.post('/logout', authenticate, logout);

export default router;


