import express from 'express';
import {
    getAllTemplates,
    getTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    cloneTemplate,
    seedPredefinedTemplates
} from '../controllers/templateController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Template routes
router.get('/templates', authenticate, getAllTemplates);
router.get('/templates/:templateId', authenticate, getTemplateById);
router.post('/templates', authenticate, createTemplate);
router.put('/templates/:templateId', authenticate, updateTemplate);
router.delete('/templates/:templateId', authenticate, deleteTemplate);
router.post('/templates/:templateId/clone', authenticate, cloneTemplate);

// Admin-only: Seed predefined templates
router.post('/templates/seed/predefined', authenticate, seedPredefinedTemplates);

export default router;
