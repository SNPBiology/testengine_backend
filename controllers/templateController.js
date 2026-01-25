import { supabase } from '../config/supabase.js';
import { PREDEFINED_TEMPLATES, validateTemplate } from '../data/neetTemplates.js';

// Get all templates (predefined + user's custom)
export const getAllTemplates = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Fetch all templates: predefined (for everyone) + user's custom templates
        const { data: templates, error } = await supabase
            .from('question_templates')
            .select('*')
            .eq('is_active', true)
            .or(`is_predefined.eq.true,created_by.eq.${userId}`)
            .order('is_predefined', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching templates:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch templates',
                error: error.message
            });
        }

        return res.status(200).json({
            success: true,
            data: templates,
            count: templates.length
        });
    } catch (error) {
        console.error('Error in getAllTemplates:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get single template by ID
export const getTemplateById = async (req, res) => {
    try {
        const { templateId } = req.params;
        const userId = req.user.userId;

        const { data: template, error } = await supabase
            .from('question_templates')
            .select('*')
            .eq('template_id', templateId)
            .eq('is_active', true)
            .single();

        if (error) {
            console.error('Error fetching template:', error);
            return res.status(404).json({
                success: false,
                message: 'Template not found'
            });
        }

        // Check if user has access (predefined or own template)
        if (!template.is_predefined && template.created_by !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Calculate distribution statistics
        const class11Chapters = Object.keys(template.class_11_distribution || {}).length;
        const class12Chapters = Object.keys(template.class_12_distribution || {}).length;
        const totalChapters = class11Chapters + class12Chapters;

        return res.status(200).json({
            success: true,
            data: {
                ...template,
                statistics: {
                    totalChapters,
                    class11Chapters,
                    class12Chapters
                }
            }
        });
    } catch (error) {
        console.error('Error in getTemplateById:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Create new custom template
export const createTemplate = async (req, res) => {
    try {
        const userId = req.user.userId;
        const {
            templateName,
            description,
            class11Distribution,
            class12Distribution,
            subjectDistributions, // NEW: Multi-subject format
            totalQuestions
        } = req.body;

        // Validation
        if (!templateName || templateName.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Template name must be at least 3 characters long'
            });
        }

        if (!totalQuestions || totalQuestions <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Total questions must be greater than 0'
            });
        }

        console.log('=== BACKEND RECEIVED ===');
        console.log('subjectDistributions:', JSON.stringify(subjectDistributions, null, 2));
        console.log('class11Distribution:', class11Distribution);
        console.log('totalQuestions:', totalQuestions);

        // Determine template type and validate
        const isMultiSubject = subjectDistributions && Object.keys(subjectDistributions).length > 0;

        if (isMultiSubject) {
            // Validate multi-subject template
            let calculatedTotal = 0;
            Object.values(subjectDistributions).forEach(chapters => {
                Object.values(chapters).forEach(dist => {
                    calculatedTotal += parseInt(dist.target) || 0;
                });
            });

            if (calculatedTotal !== totalQuestions) {
                return res.status(400).json({
                    success: false,
                    message: `Total questions mismatch. Expected: ${totalQuestions}, Calculated: ${calculatedTotal}`
                });
            }
        } else {
            // Validate Biology-only template
            const validation = validateTemplate({
                class_11_distribution: class11Distribution || {},
                class_12_distribution: class12Distribution || {},
                total_questions: totalQuestions
            });

            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: `Total questions mismatch. Expected: ${totalQuestions}, Calculated: ${validation.calculatedTotal}`
                });
            }
        }

        // Insert template with appropriate format
        const templateData = {
            template_name: templateName,
            description: description || null,
            total_questions: totalQuestions,
            is_predefined: false,
            created_by: userId
        };

        if (isMultiSubject) {
            // Multi-subject template
            templateData.subject_distributions = subjectDistributions;
            templateData.class_11_distribution = {};
            templateData.class_12_distribution = {};
        } else {
            // Biology-only template
            templateData.class_11_distribution = class11Distribution || {};
            templateData.class_12_distribution = class12Distribution || {};
            templateData.subject_distributions = {};
        }

        const { data: newTemplate, error } = await supabase
            .from('question_templates')
            .insert([templateData])
            .select()
            .single();

        if (error) {
            console.error('Error creating template:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create template',
                error: error.message
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Template created successfully',
            data: newTemplate
        });
    } catch (error) {
        console.error('Error in createTemplate:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Update existing custom template
export const updateTemplate = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { templateId } = req.params;
        const {
            templateName,
            description,
            class11Distribution,
            class12Distribution,
            subjectDistributions, // NEW: Multi-subject format
            totalQuestions
        } = req.body;

        // Check if template exists and user owns it
        const { data: existingTemplate, error: fetchError } = await supabase
            .from('question_templates')
            .select('*')
            .eq('template_id', templateId)
            .single();

        if (fetchError || !existingTemplate) {
            return res.status(404).json({
                success: false,
                message: 'Template not found'
            });
        }

        // Can't update predefined templates
        if (existingTemplate.is_predefined) {
            return res.status(403).json({
                success: false,
                message: 'Cannot update predefined templates'
            });
        }

        // Check ownership
        if (existingTemplate.created_by !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        console.log('=== BACKEND UPDATE RECEIVED ===');
        console.log('subjectDistributions:', JSON.stringify(subjectDistributions, null, 2));
        console.log('totalQuestions:', totalQuestions);

        // Determine template type and validate
        const isMultiSubject = subjectDistributions && Object.keys(subjectDistributions).length > 0;

        if (totalQuestions) {
            if (isMultiSubject) {
                // Validate multi-subject template
                let calculatedTotal = 0;
                Object.values(subjectDistributions).forEach(chapters => {
                    Object.values(chapters).forEach(dist => {
                        calculatedTotal += parseInt(dist.target) || 0;
                    });
                });

                if (calculatedTotal !== totalQuestions) {
                    return res.status(400).json({
                        success: false,
                        message: `Total questions mismatch. Expected: ${totalQuestions}, Calculated: ${calculatedTotal}`
                    });
                }
            } else {
                // Validate Biology-only template
                const validation = validateTemplate({
                    class_11_distribution: class11Distribution || existingTemplate.class_11_distribution,
                    class_12_distribution: class12Distribution || existingTemplate.class_12_distribution,
                    total_questions: totalQuestions
                });

                if (!validation.isValid) {
                    return res.status(400).json({
                        success: false,
                        message: `Total questions mismatch. Expected: ${totalQuestions}, Calculated: ${validation.calculatedTotal}`
                    });
                }
            }
        }

        // Prepare update data
        const updateData = {
            template_name: templateName || existingTemplate.template_name,
            description: description !== undefined ? description : existingTemplate.description,
            total_questions: totalQuestions || existingTemplate.total_questions,
            updated_at: new Date().toISOString()
        };

        if (isMultiSubject) {
            // Multi-subject template
            updateData.subject_distributions = subjectDistributions;
            updateData.class_11_distribution = {};
            updateData.class_12_distribution = {};
        } else {
            // Biology-only template
            updateData.class_11_distribution = class11Distribution || existingTemplate.class_11_distribution;
            updateData.class_12_distribution = class12Distribution || existingTemplate.class_12_distribution;
            updateData.subject_distributions = {};
        }

        // Update template
        const { data: updatedTemplate, error: updateError } = await supabase
            .from('question_templates')
            .update(updateData)
            .eq('template_id', templateId)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating template:', updateError);
            return res.status(500).json({
                success: false,
                message: 'Failed to update template',
                error: updateError.message
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Template updated successfully',
            data: updatedTemplate
        });
    } catch (error) {
        console.error('Error in updateTemplate:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Delete template (soft delete)
export const deleteTemplate = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { templateId } = req.params;

        // Check if template exists and user owns it
        const { data: existingTemplate, error: fetchError } = await supabase
            .from('question_templates')
            .select('*')
            .eq('template_id', templateId)
            .single();

        if (fetchError || !existingTemplate) {
            return res.status(404).json({
                success: false,
                message: 'Template not found'
            });
        }

        // Can't delete predefined templates
        if (existingTemplate.is_predefined) {
            return res.status(403).json({
                success: false,
                message: 'Cannot delete predefined templates'
            });
        }

        // Check ownership
        if (existingTemplate.created_by !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Soft delete
        const { error: deleteError } = await supabase
            .from('question_templates')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('template_id', templateId);

        if (deleteError) {
            console.error('Error deleting template:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete template',
                error: deleteError.message
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Template deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteTemplate:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Clone template
export const cloneTemplate = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { templateId } = req.params;
        const { newName } = req.body;

        // Fetch source template
        const { data: sourceTemplate, error: fetchError } = await supabase
            .from('question_templates')
            .select('*')
            .eq('template_id', templateId)
            .eq('is_active', true)
            .single();

        if (fetchError || !sourceTemplate) {
            return res.status(404).json({
                success: false,
                message: 'Template not found'
            });
        }

        // Create clone
        const { data: clonedTemplate, error: cloneError } = await supabase
            .from('question_templates')
            .insert([{
                template_name: newName || `${sourceTemplate.template_name} (Copy)`,
                description: sourceTemplate.description,
                class_11_distribution: sourceTemplate.class_11_distribution,
                class_12_distribution: sourceTemplate.class_12_distribution,
                total_questions: sourceTemplate.total_questions,
                is_predefined: false,
                created_by: userId
            }])
            .select()
            .single();

        if (cloneError) {
            console.error('Error cloning template:', cloneError);
            return res.status(500).json({
                success: false,
                message: 'Failed to clone template',
                error: cloneError.message
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Template cloned successfully',
            data: clonedTemplate
        });
    } catch (error) {
        console.error('Error in cloneTemplate:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Seed predefined templates (run once on setup)
export const seedPredefinedTemplates = async (req, res) => {
    try {
        // Check if predefined templates already exist
        const { data: existing, error: checkError } = await supabase
            .from('question_templates')
            .select('template_name')
            .eq('is_predefined', true);

        if (checkError) {
            return res.status(500).json({
                success: false,
                message: 'Error checking existing templates',
                error: checkError.message
            });
        }

        const existingNames = new Set(existing.map(t => t.template_name));
        const templatesToInsert = PREDEFINED_TEMPLATES.filter(
            t => !existingNames.has(t.template_name)
        );

        if (templatesToInsert.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'All predefined templates already exist',
                count: 0
            });
        }

        // Insert new predefined templates
        const { data: insertedTemplates, error: insertError } = await supabase
            .from('question_templates')
            .insert(templatesToInsert)
            .select();

        if (insertError) {
            console.error('Error seeding templates:', insertError);
            return res.status(500).json({
                success: false,
                message: 'Failed to seed templates',
                error: insertError.message
            });
        }

        return res.status(201).json({
            success: true,
            message: `Successfully seeded ${insertedTemplates.length} predefined templates`,
            data: insertedTemplates
        });
    } catch (error) {
        console.error('Error in seedPredefinedTemplates:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};
