import { supabase } from '../config/supabase.js';

/**
 * Get all questions for a test
 */
export const getTestQuestions = async (req, res) => {
  try {
    const { testId } = req.params;

    // Get test questions with their options
    const { data: testQuestions, error: testQuestionsError } = await supabase
      .from('test_questions')
      .select('question_id, question_order, marks_allocated, negative_marks_allocated')
      .eq('test_id', testId)
      .order('question_order');

    if (testQuestionsError) throw testQuestionsError;

    if (!testQuestions || testQuestions.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Get question details
    const questionIds = testQuestions.map(tq => tq.question_id);

    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .in('question_id', questionIds);

    if (questionsError) throw questionsError;

    // Get options for all questions
    const { data: options, error: optionsError } = await supabase
      .from('question_options')
      .select('*')
      .in('question_id', questionIds)
      .order('option_order');

    if (optionsError) throw optionsError;

    // Combine data
    const questionsWithOptions = testQuestions.map(tq => {
      const question = questions.find(q => q.question_id === tq.question_id);
      const questionOptions = options.filter(o => o.question_id === tq.question_id);

      return {
        questionId: question.question_id,
        questionText: question.question_text,
        questionType: question.question_type,
        questionCategory: question.question_category,
        difficultyLevel: question.difficulty_level,
        marks: tq.marks_allocated,
        negativeMarks: tq.negative_marks_allocated,
        explanation: question.explanation,
        metadata: question.metadata, // Include metadata for chapter labels
        order: tq.question_order,
        options: questionOptions.map(opt => ({
          optionId: opt.option_id,
          text: opt.option_text,
          isCorrect: opt.is_correct,
          order: opt.option_order
        }))
      };
    });

    res.json({
      success: true,
      data: questionsWithOptions
    });

  } catch (error) {
    console.error('Error fetching test questions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch questions',
      error: error.message
    });
  }
};

/**
 * Add a question to a test
 */
export const addQuestion = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { testId } = req.params;
    const {
      questionText,
      questionType,
      questionCategory,
      difficultyLevel,
      marks,
      negativeMarks,
      explanation,
      chapterLabel,
      options
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

    // Prepare metadata with chapter label
    const metadata = {};
    if (chapterLabel && chapterLabel.trim()) {
      metadata.chapter = chapterLabel.trim();
    }

    // Create question
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .insert([{
        subject_id: null,
        created_by: userId,
        question_text: questionText,
        question_type: questionType,
        question_category: questionCategory || null,
        difficulty_level: difficultyLevel,
        marks: marks,
        negative_marks: negativeMarks || 0,
        explanation: explanation || null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
        is_active: true
      }])
      .select('question_id')
      .single();

    if (questionError) throw questionError;

    const questionId = question.question_id;

    // Add options if provided
    if (options && options.length > 0) {
      const optionsData = options
        .filter(opt => opt.text && opt.text.trim())
        .map((opt, index) => ({
          question_id: questionId,
          option_text: opt.text,
          is_correct: opt.isCorrect || false,
          option_order: index + 1
        }));

      if (optionsData.length > 0) {
        const { error: optionsError } = await supabase
          .from('question_options')
          .insert(optionsData);

        if (optionsError) throw optionsError;
      }
    }

    // Get current max order for test questions
    const { data: maxOrderData, error: maxOrderError } = await supabase
      .from('test_questions')
      .select('question_order')
      .eq('test_id', testId)
      .order('question_order', { ascending: false })
      .limit(1);

    if (maxOrderError) throw maxOrderError;

    const nextOrder = maxOrderData && maxOrderData.length > 0
      ? maxOrderData[0].question_order + 1
      : 1;

    // Link question to test
    const { error: testQuestionError } = await supabase
      .from('test_questions')
      .insert([{
        test_id: testId,
        question_id: questionId,
        question_order: nextOrder,
        marks_allocated: marks,
        negative_marks_allocated: negativeMarks || 0
      }]);

    if (testQuestionError) throw testQuestionError;

    // Update test total_questions count
    const { data: questionCount, error: countError } = await supabase
      .from('test_questions')
      .select('question_id', { count: 'exact' })
      .eq('test_id', testId);

    if (!countError && questionCount) {
      await supabase
        .from('tests')
        .update({
          total_questions: questionCount.length,
          updated_at: new Date().toISOString()
        })
        .eq('test_id', testId);
    }

    res.status(201).json({
      success: true,
      message: 'Question added successfully',
      data: {
        questionId: questionId
      }
    });

  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add question',
      error: error.message
    });
  }
};

/**
 * Update a question
 */
export const updateQuestion = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { testId, questionId } = req.params;
    const {
      questionText,
      questionType,
      questionCategory,
      difficultyLevel,
      marks,
      negativeMarks,
      explanation,
      chapterLabel,
      options
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

    // Prepare metadata with chapter label
    const metadata = {};
    if (chapterLabel && chapterLabel.trim()) {
      metadata.chapter = chapterLabel.trim();
    }

    // Update question
    const { error: questionError } = await supabase
      .from('questions')
      .update({
        question_text: questionText,
        question_type: questionType,
        question_category: questionCategory || null,
        difficulty_level: difficultyLevel,
        marks: marks,
        negative_marks: negativeMarks || 0,
        explanation: explanation || null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
        updated_at: new Date().toISOString()
      })
      .eq('question_id', questionId);

    if (questionError) throw questionError;

    // Update test_questions marks
    const { error: testQuestionError } = await supabase
      .from('test_questions')
      .update({
        marks_allocated: marks,
        negative_marks_allocated: negativeMarks || 0
      })
      .eq('test_id', testId)
      .eq('question_id', questionId);

    if (testQuestionError) throw testQuestionError;

    // Update options if provided
    if (options && options.length > 0) {
      // Delete existing options
      await supabase
        .from('question_options')
        .delete()
        .eq('question_id', questionId);

      // Insert new options
      const optionsData = options
        .filter(opt => opt.text && opt.text.trim())
        .map((opt, index) => ({
          question_id: questionId,
          option_text: opt.text,
          is_correct: opt.isCorrect || false,
          option_order: index + 1
        }));

      if (optionsData.length > 0) {
        const { error: optionsError } = await supabase
          .from('question_options')
          .insert(optionsData);

        if (optionsError) throw optionsError;
      }
    }

    res.json({
      success: true,
      message: 'Question updated successfully'
    });

  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update question',
      error: error.message
    });
  }
};

/**
 * Delete a question from a test
 */
export const deleteQuestion = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { testId, questionId } = req.params;

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

    // Remove question from test
    const { error: testQuestionError } = await supabase
      .from('test_questions')
      .delete()
      .eq('test_id', testId)
      .eq('question_id', questionId);

    if (testQuestionError) throw testQuestionError;

    // Update test total_questions count
    const { data: questionCount, error: countError } = await supabase
      .from('test_questions')
      .select('question_id', { count: 'exact' })
      .eq('test_id', testId);

    if (!countError && questionCount) {
      await supabase
        .from('tests')
        .update({
          total_questions: questionCount.length,
          updated_at: new Date().toISOString()
        })
        .eq('test_id', testId);
    }

    // Note: We don't delete the question from the questions table
    // as it might be used in other tests

    res.json({
      success: true,
      message: 'Question removed from test successfully'
    });

  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete question',
      error: error.message
    });
  }
};

/**
 * Upload image for a question
 */
export const uploadQuestionImage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { questionId } = req.params;

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

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const file = req.file;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPG, PNG, GIF, and WebP are allowed.'
      });
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const ext = file.originalname.split('.').pop();
    const fileName = `question_${questionId}_${timestamp}.${ext}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('question-images')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('question-images')
      .getPublicUrl(fileName);

    // Save metadata to database
    const { data: mediaData, error: mediaError } = await supabase
      .from('question_media')
      .insert([{
        question_id: questionId,
        file_path: fileName,
        media_type: 'image',
        file_name: file.originalname,
        file_size: file.size
      }])
      .select('media_id')
      .single();

    if (mediaError) throw mediaError;

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        mediaId: mediaData.media_id,
        imageUrl: publicUrl,
        fileName: fileName
      }
    });

  } catch (error) {
    console.error('Error uploading question image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
};

/**
 * Get all media for a question
 */
export const getQuestionMedia = async (req, res) => {
  try {
    const { questionId } = req.params;

    // Get media records from database
    const { data: mediaRecords, error: mediaError } = await supabase
      .from('question_media')
      .select('*')
      .eq('question_id', questionId)
      .eq('media_type', 'image')
      .order('uploaded_at', { ascending: false });

    if (mediaError) throw mediaError;

    // Generate public URLs for each media item
    const mediaWithUrls = mediaRecords.map(media => {
      const { data: { publicUrl } } = supabase.storage
        .from('question-images')
        .getPublicUrl(media.file_path);

      return {
        mediaId: media.media_id,
        fileName: media.file_name,
        imageUrl: publicUrl,
        fileSize: media.file_size,
        uploadedAt: media.uploaded_at
      };
    });

    res.json({
      success: true,
      data: mediaWithUrls
    });

  } catch (error) {
    console.error('Error fetching question media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch media',
      error: error.message
    });
  }
};

/**
 * Delete question media
 */
export const deleteQuestionMedia = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { questionId, mediaId } = req.params;

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

    // Get media record to find file path
    const { data: mediaRecord, error: findError } = await supabase
      .from('question_media')
      .select('file_path')
      .eq('media_id', mediaId)
      .eq('question_id', questionId)
      .single();

    if (findError || !mediaRecord) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('question-images')
      .remove([mediaRecord.file_path]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue with database deletion even if storage fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('question_media')
      .delete()
      .eq('media_id', mediaId);

    if (dbError) throw dbError;

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting question media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete media',
      error: error.message
    });
  }
};


