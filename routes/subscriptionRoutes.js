import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
    getCurrentSubscription,
    getTestLimits,
    checkFeatureAccess,
    getAllPlans,
    initiateUpgrade,
    completePayment,
    cancelSubscription,
    checkTestAccess,
    createRazorpayOrder,
    verifyRazorpayPayment
} from '../controllers/subscriptionController.js';

const router = express.Router();

// All subscription routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/subscription
 * @desc    Get current user's subscription
 * @access  Private
 */
router.get('/', getCurrentSubscription);

/**
 * @route   GET /api/subscription/limits
 * @desc    Get user's test limits and current usage
 * @access  Private
 */
router.get('/limits', getTestLimits);

/**
 * @route   GET /api/subscription/feature/:featureName
 * @desc    Check if user has access to a specific feature
 * @access  Private
 */
router.get('/feature/:featureName', checkFeatureAccess);

/**
 * @route   GET /api/subscription/plans
 * @desc    Get all available subscription plans
 * @access  Private
 */
router.get('/plans', getAllPlans);

/**
 * @route   GET /api/subscription/test-access/:testId
 * @desc    Check if user can access a specific test (subject-based)
 * @access  Private
 */
router.get('/test-access/:testId', checkTestAccess);

// ==================== RAZORPAY PAYMENT ROUTES ====================

/**
 * @route   POST /api/subscription/create-razorpay-order
 * @desc    Create Razorpay order for subscription payment
 * @access  Private
 */
router.post('/create-razorpay-order', createRazorpayOrder);

/**
 * @route   POST /api/subscription/verify-razorpay-payment
 * @desc    Verify Razorpay payment signature and activate subscription
 * @access  Private
 */
router.post('/verify-razorpay-payment', verifyRazorpayPayment);

// ==================== FAKE PAYMENT ROUTES (Legacy) ====================

/**
 * @route   POST /api/subscription/upgrade
 * @desc    Initiate subscription upgrade (fake payment - for testing)
 * @access  Private
 */
router.post('/upgrade', initiateUpgrade);

/**
 * @route   GET /api/subscription/complete-payment
 * @desc    Complete payment and activate subscription (fake payment - for testing)
 * @access  Private
 */
router.get('/complete-payment', completePayment);

/**
 * @route   PUT /api/subscription/cancel
 * @desc    Cancel current subscription
 * @access  Private
 */
router.put('/cancel', cancelSubscription);

export default router;
