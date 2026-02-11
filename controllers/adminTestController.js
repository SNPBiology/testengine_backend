import { supabase } from '../config/supabase.js';

/**
 * Create a new test
 */
export const createTest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      testName,
      description,
      subjectIds,
      durationMinutes,
      totalMarks,
      passingMarks,
      requiredPlanId,
      testType,
      negativeMarking,
      startTime,
      endTime,
      isPublished,
      templateData
    } = req.body;

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

    // Validate required_plan_id
    const validPlanIds = [1, 2, 3]; // Free, Premium Annual, Elite Annual
    if (!validPlanIds.includes(requiredPlanId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan ID. Must be 1 (Free), 2 (Premium Annual), or 3 (Elite Annual).'
      });
    }

    // Prepare metadata if template is provided
    const metadata = templateData ? {
      templateId: templateData.templateId,
      templateName: templateData.templateName,
      class11Distribution: templateData.class11Distribution,
      class12Distribution: templateData.class12Distribution,
      subjectDistributions: templateData.subjectDistributions, // NEW: Multi-subject support
      totalQuestions: templateData.totalQuestions
    } : null;

    // Create test
    const { data: test, error: testError } = await supabase
      .from('tests')
      .insert([{
        created_by: userId,
        subject_ids: subjectIds && subjectIds.length > 0 ? subjectIds : null,
        test_name: testName,
        description: description || null,
        required_plan_id: requiredPlanId,
        duration_minutes: durationMinutes,
        total_questions: 0, // Will be updated when questions are added
        total_marks: totalMarks,
        negative_marking: negativeMarking,
        passing_marks: passingMarks || null,
        start_time: startTime || null,
        end_time: endTime || null,
        test_type: testType,
        is_published: isPublished,
        metadata: metadata
      }])
      .select('test_id')
      .single();

    if (testError) {
      console.error('Error creating test:', testError);

      // Handle specific error cases
      if (testError.code === '23505') {
        // Unique constraint violation - sequence issue
        throw new Error('Database sequence error. Please contact administrator to reset the test_id sequence.');
      }

      throw testError;
    }

    res.status(201).json({
      success: true,
      message: 'Test created successfully',
      data: {
        testId: test.test_id
      }
    });

  } catch (error) {
    console.error('Error creating test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test',
      error: error.message
    });
  }
};

/**
 * Get test by ID
 */
export const getTestById = async (req, res) => {
  try {
    const { testId } = req.params;

    const { data: test, error } = await supabase
      .from('tests')
      .select(`
        *,
        payment_plans:required_plan_id (
          plan_id,
          plan_name,
          price,
          description
        )
      `)
      .eq('test_id', testId)
      .single();

    if (error) throw error;

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    res.json({
      success: true,
      data: {
        testId: test.test_id,
        testName: test.test_name,
        description: test.description,
        subjectId: test.subject_id,
        durationMinutes: test.duration_minutes,
        totalQuestions: test.total_questions,
        totalMarks: test.total_marks,
        passingMarks: test.passing_marks,
        requiredPlanId: test.required_plan_id,
        planDetails: test.payment_plans,
        testType: test.test_type,
        negativeMarking: test.negative_marking,
        startTime: test.start_time,
        endTime: test.end_time,
        isPublished: test.is_published,
        createdAt: test.created_at,
        updatedAt: test.updated_at,
        metadata: test.metadata
      }
    });

  } catch (error) {
    console.error('Error fetching test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test',
      error: error.message
    });
  }
};

/**
 * Update test
 */
export const updateTest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { testId } = req.params;
    const updateData = req.body;

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

    // Map frontend field names to database column names
    const dbUpdateData = {};
    if (updateData.testName !== undefined) dbUpdateData.test_name = updateData.testName;
    if (updateData.description !== undefined) dbUpdateData.description = updateData.description;
    if (updateData.subjectId !== undefined) {
      dbUpdateData.subject_id = updateData.subjectId === '' ? null : updateData.subjectId;
    }
    if (updateData.durationMinutes !== undefined) {
      dbUpdateData.duration_minutes = updateData.durationMinutes === '' ? null : updateData.durationMinutes;
    }
    if (updateData.totalMarks !== undefined) {
      dbUpdateData.total_marks = updateData.totalMarks === '' ? null : updateData.totalMarks;
    }
    if (updateData.passingMarks !== undefined) {
      dbUpdateData.passing_marks = updateData.passingMarks === '' ? null : updateData.passingMarks;
    }
    if (updateData.requiredPlanId !== undefined) {
      // Validate plan ID
      const validPlanIds = [1, 2, 3];
      if (!validPlanIds.includes(updateData.requiredPlanId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid plan ID. Must be 1 (Free), 2 (Premium Annual), or 3 (Elite Annual).'
        });
      }
      dbUpdateData.required_plan_id = updateData.requiredPlanId;
    }

    console.log('=== UPDATE DATA RECEIVED ===');
    console.log('Raw updateData:', JSON.stringify(updateData, null, 2));
    console.log('Prepared dbUpdateData:', JSON.stringify(dbUpdateData, null, 2));
    if (updateData.testType !== undefined) dbUpdateData.test_type = updateData.testType;
    if (updateData.negativeMarking !== undefined) dbUpdateData.negative_marking = updateData.negativeMarking;
    if (updateData.startTime !== undefined) dbUpdateData.start_time = updateData.startTime || null;
    if (updateData.endTime !== undefined) dbUpdateData.end_time = updateData.endTime || null;
    if (updateData.isPublished !== undefined) dbUpdateData.is_published = updateData.isPublished;

    dbUpdateData.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('tests')
      .update(dbUpdateData)
      .eq('test_id', testId);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Test updated successfully'
    });

  } catch (error) {
    console.error('Error updating test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update test',
      error: error.message
    });
  }
};

/**
 * Delete test
 */
export const deleteTest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { testId } = req.params;

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

    // Get all question IDs associated with this test
    const { data: testQuestions } = await supabase
      .from('test_questions')
      .select('question_id')
      .eq('test_id', testId);

    const questionIds = testQuestions?.map(tq => tq.question_id) || [];

    // Delete in proper order to respect foreign key constraints:

    // 1. Delete question media (images, etc.)
    if (questionIds.length > 0) {
      await supabase
        .from('question_media')
        .delete()
        .in('question_id', questionIds);
    }

    // 2. Delete question options
    if (questionIds.length > 0) {
      await supabase
        .from('question_options')
        .delete()
        .in('question_id', questionIds);
    }

    // 3. Delete test_questions junction table entries
    await supabase
      .from('test_questions')
      .delete()
      .eq('test_id', testId);

    // 4. Delete the actual questions
    if (questionIds.length > 0) {
      await supabase
        .from('questions')
        .delete()
        .in('question_id', questionIds);
    }

    // 5. Finally delete the test itself
    const { error: deleteError } = await supabase
      .from('tests')
      .delete()
      .eq('test_id', testId);

    if (deleteError) throw deleteError;

    res.json({
      success: true,
      message: 'Test deleted successfully (including all questions and media)'
    });

  } catch (error) {
    console.error('Error deleting test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete test',
      error: error.message
    });
  }
};

/**
 * Toggle test publish status
 */
export const toggleTestStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { testId } = req.params;
    const { isPublished } = req.body;

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

    const { error: updateError } = await supabase
      .from('tests')
      .update({
        is_published: isPublished,
        updated_at: new Date().toISOString()
      })
      .eq('test_id', testId);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: `Test ${isPublished ? 'published' : 'unpublished'} successfully`
    });

  } catch (error) {
    console.error('Error toggling test status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update test status',
      error: error.message
    });
  }
};

/**
 * Get subjects
 */
export const getSubjects = async (req, res) => {
  try {
    const { data: subjects, error } = await supabase
      .from('subjects')
      .select('subject_id, name, description, subject_code')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    res.json({
      success: true,
      data: subjects.map(s => ({
        id: s.subject_id,
        name: s.name,
        description: s.description,
        code: s.subject_code
      }))
    });

  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subjects',
      error: error.message
    });
  }
};

