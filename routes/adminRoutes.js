import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
    getAdminStats,
    getRecentTests,
    getRecentSales,
    getTopPerformers,
    getRevenueStats,
    getAllStudents,
    getStudentDetails,
    getAllSales,
    getAllTests,
    toggleTestStatus,
    deleteTest,
    updateAdminProfile,
    changeAdminPassword
} from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/admin/stats
 * @desc    Get admin dashboard statistics
 * @access  Private (Admin only)
 */
router.get('/stats', getAdminStats);

/**
 * @route   GET /api/admin/recent-tests
 * @desc    Get recently created tests
 * @access  Private (Admin only)
 */
router.get('/recent-tests', getRecentTests);

/**
 * @route   GET /api/admin/recent-sales
 * @desc    Get recent sales/purchases
 * @access  Private (Admin only)
 */
router.get('/recent-sales', getRecentSales);

/**
 * @route   GET /api/admin/top-performers
 * @desc    Get top performing students
 * @access  Private (Admin only)
 */
router.get('/top-performers', getTopPerformers);

/**
 * @route   GET /api/admin/revenue-stats
 * @desc    Get revenue statistics (today, week, month)
 * @access  Private (Admin only)
 */
router.get('/revenue-stats', getRevenueStats);

/**
 * @route   GET /api/admin/students
 * @desc    Get all students with statistics
 * @access  Private (Admin only)
 */
router.get('/students', getAllStudents);

/**
 * @route   GET /api/admin/students/:studentId
 * @desc    Get detailed information for a specific student
 * @access  Private (Admin only)
 */
router.get('/students/:studentId', getStudentDetails);

/**
 * @route   GET /api/admin/sales
 * @desc    Get all sales/purchases
 * @access  Private (Admin only)
 */
router.get('/sales', getAllSales);

/**
 * @route   GET /api/admin/tests
 * @desc    Get all tests (admin view)
 * @access  Private (Admin only)
 */
router.get('/tests', getAllTests);

/**
 * @route   PUT /api/admin/tests/:testId/toggle
 * @desc    Toggle test active status
 * @access  Private (Admin only)
 */
router.put('/tests/:testId/toggle', toggleTestStatus);

/**
 * @route   DELETE /api/admin/tests/:testId
 * @desc    Delete a test
 * @access  Private (Admin only)
 */
router.delete('/tests/:testId', deleteTest);

/**
 * @route   PUT /api/admin/profile
 * @desc    Update admin profile
 * @access  Private (Admin only)
 */
router.put('/profile', updateAdminProfile);

/**
 * @route   PUT /api/admin/password
 * @desc    Change admin password
 * @access  Private (Admin only)
 */
router.put('/password', changeAdminPassword);

export default router;

