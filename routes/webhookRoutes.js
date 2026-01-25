import express from 'express';
import { handleRazorpayWebhook } from '../controllers/webhookController.js';

const router = express.Router();

/**
 * Webhook Routes
 * These endpoints are called by external services (like Razorpay)
 * No authentication required, but signature verification is done
 */

/**
 * @route   POST /api/webhooks/razorpay
 * @desc    Handle Razorpay webhook events
 * @access  Public (signature verified)
 */
router.post('/razorpay', express.json(), handleRazorpayWebhook);

export default router;
