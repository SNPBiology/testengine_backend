import { supabase } from '../config/supabase.js';

/**
 * Generate question placeholders from template
 * Supports both:
 * - Biology-only templates (class11Distribution/class12Distribution)
 * - Multi-subject templates (subjectDistributions)
 */
export const generateQuestionsFromTemplate = async (req, res) => {
    try {
        const { testId } = req.params;
        const userId = req.user.userId;

        // Verify user is admin
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('user_id', userId)
            .single();

        if (userError || !userData || userData.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }

        // Get test with metadata and subject_ids
        const { data: test, error: testError } = await supabase
            .from('tests')
            .select('metadata, test_id, subject_id, subject_ids')
            .eq('test_id', testId)
            .single();

        if (testError) throw testError;

        if (!test || !test.metadata) {
            return res.status(400).json({
                success: false,
                message: 'No template data found for this test'
            });
        }

        const metadata = test.metadata;
        const questionsToCreate = [];
        let questionOrder = 1;

        // Check if this is a multi-subject template or Biology-only template
        const hasSubjectDistributions = metadata.subjectDistributions &&
            Object.keys(metadata.subjectDistributions).length > 0;

        if (hasSubjectDistributions) {
            // NEW: Multi-subject template
            // Format: { "Physics": { "Mechanics": {min, max, target}, ... }, "Chemistry": {...} }

            // Get subject name to ID mapping
            const { data: subjects } = await supabase
                .from('subjects')
                .select('subject_id, name');

            const subjectMap = {};
            subjects.forEach(s => {
                subjectMap[s.name] = s.subject_id;
            });

            for (const [subjectName, chapters] of Object.entries(metadata.subjectDistributions)) {
                const subjectId = subjectMap[subjectName];

                for (const [chapter, distribution] of Object.entries(chapters)) {
                    const targetCount = distribution.target || 0;

                    for (let i = 0; i < targetCount; i++) {
                        questionsToCreate.push({
                            subject_id: subjectId,
                            created_by: userId,
                            question_text: `Question ${questionOrder} - Fill in your question text here`,
                            question_type: 'mcq',
                            difficulty_level: 'medium',
                            marks: 4,
                            negative_marks: 1,
                            explanation: 'Add detailed explanation here',
                            metadata: {
                                chapter: chapter,
                                subject: subjectName,
                                questionNumber: questionOrder,
                                templateGenerated: true,
                                minQuestions: distribution.min,
                                targetQuestions: distribution.target,
                                maxQuestions: distribution.max
                            }
                        });
                        questionOrder++;
                    }
                }
            }
        } else {
            // OLD: Biology-only template (Class XI/XII distributions)
            if (!metadata.class11Distribution) {
                return res.status(400).json({
                    success: false,
                    message: 'No template data found for this test'
                });
            }

            // Generate questions from Class XI distribution
            const class11Dist = metadata.class11Distribution || {};
            for (const [chapter, distribution] of Object.entries(class11Dist)) {
                const targetCount = distribution.target || 0;
                for (let i = 0; i < targetCount; i++) {
                    questionsToCreate.push({
                        subject_id: test.subject_id,
                        created_by: userId,
                        question_text: `Question ${questionOrder} - Fill in your question text here`,
                        question_type: 'mcq',
                        difficulty_level: 'medium',
                        marks: 4,
                        negative_marks: 1,
                        explanation: 'Add detailed explanation here',
                        metadata: {
                            chapter: chapter,
                            classLevel: 'XI',
                            questionNumber: questionOrder,
                            templateGenerated: true,
                            minQuestions: distribution.min,
                            targetQuestions: distribution.target,
                            maxQuestions: distribution.max
                        }
                    });
                    questionOrder++;
                }
            }

            // Generate questions from Class XII distribution
            const class12Dist = metadata.class12Distribution || {};
            for (const [chapter, distribution] of Object.entries(class12Dist)) {
                const targetCount = distribution.target || 0;
                for (let i = 0; i < targetCount; i++) {
                    questionsToCreate.push({
                        subject_id: test.subject_id,
                        created_by: userId,
                        question_text: `Question ${questionOrder} - Fill in your question text here`,
                        question_type: 'mcq',
                        difficulty_level: 'medium',
                        marks: 4,
                        negative_marks: 1,
                        explanation: 'Add detailed explanation here',
                        metadata: {
                            chapter: chapter,
                            classLevel: 'XII',
                            questionNumber: questionOrder,
                            templateGenerated: true,
                            minQuestions: distribution.min,
                            targetQuestions: distribution.target,
                            maxQuestions: distribution.max
                        }
                    });
                    questionOrder++;
                }
            }
        }

        if (questionsToCreate.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No questions to generate from template'
            });
        }

        // Step 1: Insert questions into questions table
        const { data: insertedQuestions, error: insertError } = await supabase
            .from('questions')
            .insert(questionsToCreate)
            .select('question_id');

        if (insertError) throw insertError;

        // Step 2: Create options for each question
        const optionsToCreate = [];
        insertedQuestions.forEach(q => {
            optionsToCreate.push(
                { question_id: q.question_id, option_text: 'Option A', is_correct: false, option_order: 1 },
                { question_id: q.question_id, option_text: 'Option B', is_correct: false, option_order: 2 },
                { question_id: q.question_id, option_text: 'Option C', is_correct: false, option_order: 3 },
                { question_id: q.question_id, option_text: 'Option D', is_correct: true, option_order: 4 }
            );
        });

        await supabase.from('question_options').insert(optionsToCreate);

        // Step 3: Link questions to test via test_questions junction table
        const testQuestionsToCreate = insertedQuestions.map((q, idx) => ({
            test_id: testId,
            question_id: q.question_id,
            question_order: idx + 1,
            marks_allocated: 4,
            negative_marks_allocated: 1
        }));

        await supabase.from('test_questions').insert(testQuestionsToCreate);

        // Step 4: Update test's total_questions
        await supabase
            .from('tests')
            .update({ total_questions: questionsToCreate.length })
            .eq('test_id', testId);

        res.json({
            success: true,
            message: `Successfully generated ${questionsToCreate.length} question placeholders`,
            data: {
                questionsCreated: questionsToCreate.length,
                questionIds: insertedQuestions.map(q => q.question_id)
            }
        });

    } catch (error) {
        console.error('Error generating questions from template:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate questions from template',
            error: error.message
        });
    }
};
