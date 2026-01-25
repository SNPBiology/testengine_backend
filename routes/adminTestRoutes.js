import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
  createTest,
  getTestById,
  updateTest,
  deleteTest,
  toggleTestStatus,
  getSubjects
} from '../controllers/adminTestController.js';
import {
  getTestQuestions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  uploadQuestionImage,
  getQuestionMedia,
  deleteQuestionMedia
} from '../controllers/questionController.js';
import { generateQuestionsFromTemplate } from '../controllers/templateActionController.js';

const router = express.Router();

// All test management routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/test/create
 * @desc    Create a new test
 * @access  Private (Admin only)
 */
router.post('/create', createTest);

/**
 * @route   GET /api/test/subjects/all
 * @desc    Get all subjects
 * @access  Private
 */
router.get('/subjects/all', getSubjects);

/**
 * @route   GET /api/test/:testId
 * @desc    Get test by ID
 * @access  Private
 */
router.get('/:testId', getTestById);

/**
 * @route   PUT /api/test/:testId
 * @desc    Update test
 * @access  Private (Admin only)
 */
router.put('/:testId', updateTest);

/**
 * @route   DELETE /api/test/:testId
 * @desc    Delete test
 * @access  Private (Admin only)
 */
router.delete('/:testId', deleteTest);

/**
 * @route   PUT /api/test/:testId/toggle-status
 * @desc    Toggle test publish status
 * @access  Private (Admin only)
 */
router.put('/:testId/toggle-status', toggleTestStatus);

/**
 * @route   POST /api/test/:testId/generate-from-template
 * @desc    Generate question placeholders from template
 * @access  Private (Admin only)
 */
router.post('/:testId/generate-from-template', generateQuestionsFromTemplate);

/**
 * @route   GET /api/test/:testId/questions
 * @desc    Get all questions for a test
 * @access  Private
 */
router.get('/:testId/questions', getTestQuestions);

/**
 * @route   POST /api/test/:testId/questions
 * @desc    Add a question to a test
 * @access  Private (Admin only)
 */
router.post('/:testId/questions', addQuestion);

/**
 * @route   PUT /api/test/:testId/questions/:questionId
 * @desc    Update a question
 * @access  Private (Admin only)
 */
router.put('/:testId/questions/:questionId', updateQuestion);

/**
 * @route   DELETE /api/test/:testId/questions/:questionId
 * @desc    Delete a question from a test
 * @access  Private (Admin only)
 */
router.delete('/:testId/questions/:questionId', deleteQuestion);

/**
 * @route   POST /api/test/:testId/questions/:questionId/upload-image
 * @desc    Upload an image for a question
 * @access  Private (Admin only)
 */
router.post('/:testId/questions/:questionId/upload-image', upload.single('image'), uploadQuestionImage);

/**
 * @route   GET /api/test/:testId/questions/:questionId/media
 * @desc    Get all media for a question
 * @access  Private
 */
router.get('/:testId/questions/:questionId/media', getQuestionMedia);

/**
 * @route   DELETE /api/test/:testId/questions/:questionId/media/:mediaId
 * @desc    Delete a question image
 * @access  Private (Admin only)
 */
router.delete('/:testId/questions/:questionId/media/:mediaId', deleteQuestionMedia);

export default router;

