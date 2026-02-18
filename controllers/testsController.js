import { supabase } from '../config/supabase.js';
import { getUserAccessiblePlanIds } from '../middleware/planAccess.js';

// Get all available tests with filters
export const getAllTests = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      search,
      subject,
      testType,
      difficulty,
      isFree,
      limit = 50,
      offset = 0
    } = req.query;

    // Get user's accessible plan IDs
    const { planId: userPlanId, accessiblePlanIds } = await getUserAccessiblePlanIds(userId);

    // Build query
    let query = supabase
      .from('tests')
      .select(`
        test_id,
        test_name,
        description,
        duration_minutes,
        total_questions,
        total_marks,
        test_type,
        required_plan_id,
        start_time,
        end_time,
        created_at,
        subjects (
          subject_id,
          name,
          subject_code
        ),
        payment_plans:required_plan_id (
          plan_id,
          plan_name,
          price
        )
      `)
      .eq('is_published', true)
      .in('required_plan_id', accessiblePlanIds); // Only show tests user can access

    // Apply filters (check for valid values, not "undefined" strings)
    if (search && search !== 'undefined' && search.trim() !== '') {
      // Use ilike for case-insensitive search with wildcards for partial matching
      // Escape special characters and add wildcards around the search term
      const searchTerm = search.trim().replace(/[%_]/g, '\\$&');

      // Search in both test_name and description with OR condition
      query = query.or(`test_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    if (subject && subject !== 'all' && subject !== 'undefined' && !isNaN(parseInt(subject))) {
      query = query.eq('subject_id', parseInt(subject));
    }

    if (testType && testType !== 'all' && testType !== 'undefined') {
      query = query.eq('test_type', testType);
    }



    // Order by created date (newest first)
    query = query
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: tests, error, count } = await query;

    if (error) {
      console.error('Error fetching tests:', error);
      throw error;
    }

    // Get user's attempts for these tests
    const testIds = tests?.map(t => t.test_id) || [];
    const { data: userAttempts } = await supabase
      .from('test_attempts')
      .select('attempt_id, test_id, total_marks_obtained, percentage, submit_time')
      .eq('user_id', userId)
      .in('test_id', testIds)
      .eq('attempt_status', 'completed')
      .order('submit_time', { ascending: false });

    // Create a map of user's best scores (and latest attempt for review link)
    const userScoresMap = new Map();
    const latestAttemptMap = new Map(); // test_id -> most recent attempt_id
    userAttempts?.forEach(attempt => {
      // Track best score
      const existing = userScoresMap.get(attempt.test_id);
      if (!existing || attempt.percentage > existing.percentage) {
        userScoresMap.set(attempt.test_id, {
          score: attempt.total_marks_obtained,
          percentage: attempt.percentage
        });
      }
      // Track latest attempt (already ordered desc by submit_time)
      if (!latestAttemptMap.has(attempt.test_id)) {
        latestAttemptMap.set(attempt.test_id, attempt.attempt_id);
      }
    });

    // Get total attempts count for each test
    const { data: allAttempts } = await supabase
      .from('test_attempts')
      .select('test_id')
      .in('test_id', testIds)
      .eq('attempt_status', 'completed');

    const attemptsCountMap = new Map();
    allAttempts?.forEach(attempt => {
      attemptsCountMap.set(
        attempt.test_id,
        (attemptsCountMap.get(attempt.test_id) || 0) + 1
      );
    });

    // Get user's test limits from subscription
    const { data: limitsData } = await supabase
      .rpc('get_user_test_limits', { p_user_id: userId });

    // Create a map of limits by test type
    const limitsMap = new Map();
    if (limitsData && limitsData.length > 0) {
      limitsData.forEach(limit => {
        limitsMap.set(limit.test_type, {
          total: limit.limit_value,
          used: limit.current_usage,
          remaining: limit.remaining
        });
      });
    }

    // Format the response
    const formattedTests = tests?.map(test => {
      // Determine test category for limits
      let testCategory = 'mock';
      if (test.test_type === 'practice') {
        const metadataCategory = test.metadata?.test_category;
        if (metadataCategory === 'chapter') {
          testCategory = 'chapter';
        } else if (metadataCategory === 'subject') {
          testCategory = 'subject';
        }
      } else if (test.test_type === 'mock') {
        testCategory = 'mock';
      }

      // Get limits for this test category
      const limits = limitsMap.get(testCategory) || { total: 0, used: 0, remaining: 0 };
      const hasAttemptsLeft = limits.remaining === -1 || limits.remaining > 0;

      return {
        id: test.test_id,
        title: test.test_name,
        description: test.description,
        questions: test.total_questions,
        time: test.duration_minutes,
        totalMarks: test.total_marks,
        testType: test.test_type,
        testCategory: testCategory,
        requiredPlanId: test.required_plan_id,
        planDetails: test.payment_plans ? {
          planId: test.payment_plans.plan_id,
          planName: test.payment_plans.plan_name,
          price: test.payment_plans.price
        } : null,
        subject: test.subjects ? {
          id: test.subjects.subject_id,
          name: test.subjects.name,
          code: test.subjects.subject_code
        } : null,
        startTime: test.start_time,
        endTime: test.end_time,
        attempts: attemptsCountMap.get(test.test_id) || 0,
        userBestScore: userScoresMap.get(test.test_id) || null,
        latestAttemptId: latestAttemptMap.get(test.test_id) || null,
        hasAttempted: userScoresMap.has(test.test_id),
        // Subscription limits
        remainingAttempts: limits.remaining,
        totalAttempts: limits.total,
        usedAttempts: limits.used,
        hasAttemptsLeft: hasAttemptsLeft,
        isUnlimited: limits.remaining === -1,
        // Access info
        userPlanId: userPlanId,
        hasAccess: true // User can only see tests they have access to
      };
    }) || [];

    res.status(200).json({
      success: true,
      data: formattedTests,
      pagination: {
        total: count || formattedTests.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get all tests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tests'
    });
  }
};

// Get test categories with counts
export const getTestCategories = async (req, res) => {
  try {
    // Get counts for each test type
    const { data: tests, error } = await supabase
      .from('tests')
      .select('test_type')
      .eq('is_published', true);

    if (error) {
      console.error('Error fetching test categories:', error);
      throw error;
    }

    // Count by test type
    const categoryCounts = tests?.reduce((acc, test) => {
      acc[test.test_type] = (acc[test.test_type] || 0) + 1;
      return acc;
    }, {});

    const categories = [
      { id: 'practice', name: 'Practice Tests', count: categoryCounts?.practice || 0 },
      { id: 'mock', name: 'Mock Tests', count: categoryCounts?.mock || 0 },
      { id: 'assessment', name: 'Assessment Tests', count: categoryCounts?.assessment || 0 }
    ];

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get test categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching test categories'
    });
  }
};

// Get single test details
export const getTestById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { testId } = req.params;

    // Get user's accessible plan IDs
    const { accessiblePlanIds } = await getUserAccessiblePlanIds(userId);

    const { data: test, error } = await supabase
      .from('tests')
      .select(`
        test_id,
        test_name,
        description,
        duration_minutes,
        total_questions,
        total_marks,
        test_type,
        negative_marking,
        passing_marks,
        is_free,
        price,
        required_plan_id,
        start_time,
        end_time,
        proctoring_settings,
        subjects (
          subject_id,
          name,
          subject_code
        ),
        payment_plans:required_plan_id (
          plan_id,
          plan_name,
          price
        )
      `)
      .eq('test_id', testId)
      .eq('is_published', true)
      .single();

    if (error || !test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Check if user has access to this test based on plan
    if (!accessiblePlanIds.includes(test.required_plan_id)) {
      return res.status(403).json({
        success: false,
        message: 'You need a higher subscription plan to access this test',
        requiredPlan: test.payment_plans?.plan_name,
        upgradeRequired: true
      });
    }

    // Get user's previous attempts
    const { data: userAttempts } = await supabase
      .from('test_attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('test_id', testId)
      .eq('attempt_status', 'completed')
      .order('submit_time', { ascending: false });

    // Get total attempts count
    const { count: totalAttempts } = await supabase
      .from('test_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('test_id', testId)
      .eq('attempt_status', 'completed');

    // Get average score
    const { data: allAttempts } = await supabase
      .from('test_attempts')
      .select('percentage')
      .eq('test_id', testId)
      .eq('attempt_status', 'completed');

    const averageScore = allAttempts && allAttempts.length > 0
      ? (allAttempts.reduce((sum, a) => sum + parseFloat(a.percentage), 0) / allAttempts.length).toFixed(2)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        id: test.test_id,
        title: test.test_name,
        description: test.description,
        questions: test.total_questions,
        duration: test.duration_minutes,
        totalMarks: test.total_marks,
        testType: test.test_type,
        negativeMarking: test.negative_marking,
        passingMarks: test.passing_marks,
        requiredPlanId: test.required_plan_id,
        planDetails: test.payment_plans ? {
          planId: test.payment_plans.plan_id,
          planName: test.payment_plans.plan_name,
          price: test.payment_plans.price
        } : null,
        startTime: test.start_time,
        endTime: test.end_time,
        proctoringSettings: test.proctoring_settings,
        subject: test.subjects ? {
          id: test.subjects.subject_id,
          name: test.subjects.name,
          code: test.subjects.subject_code
        } : null,
        statistics: {
          totalAttempts: totalAttempts || 0,
          averageScore: parseFloat(averageScore),
          userAttempts: userAttempts?.length || 0,
          userBestScore: userAttempts?.[0]?.percentage || null
        },
        userPreviousAttempts: userAttempts?.map(attempt => ({
          attemptId: attempt.attempt_id,
          score: attempt.total_marks_obtained,
          percentage: attempt.percentage,
          submitTime: attempt.submit_time
        })) || []
      }
    });
  } catch (error) {
    console.error('Get test by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching test details'
    });
  }
};

// Get all subjects for filtering
export const getSubjects = async (req, res) => {
  try {
    const { data: subjects, error } = await supabase
      .from('subjects')
      .select('subject_id, name, subject_code')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching subjects:', error);
      throw error;
    }

    res.status(200).json({
      success: true,
      data: subjects || []
    });
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subjects'
    });
  }
};

// Check if user can start a test (payment, access, etc.)
export const checkTestAccess = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { testId } = req.params;

    // Get user's accessible plan IDs
    const { accessiblePlanIds } = await getUserAccessiblePlanIds(userId);

    // Get test details
    const { data: test, error } = await supabase
      .from('tests')
      .select('required_plan_id, start_time, end_time, payment_plans:required_plan_id (plan_name)')
      .eq('test_id', testId)
      .eq('is_published', true)
      .single();

    if (error || !test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    const currentTime = new Date();
    const canAccess = {
      hasAccess: true,
      reason: null
    };

    // Check if user's plan allows access
    if (!accessiblePlanIds.includes(test.required_plan_id)) {
      canAccess.hasAccess = false;
      canAccess.reason = 'plan_upgrade_required';
      canAccess.requiredPlan = test.payment_plans?.plan_name;
    }



    // Check if test has started
    if (test.start_time && new Date(test.start_time) > currentTime) {
      canAccess.hasAccess = false;
      canAccess.reason = 'not_started';
      canAccess.startTime = test.start_time;
    }

    // Check if test has ended
    if (test.end_time && new Date(test.end_time) < currentTime) {
      canAccess.hasAccess = false;
      canAccess.reason = 'expired';
      canAccess.endTime = test.end_time;
    }

    res.status(200).json({
      success: true,
      data: canAccess
    });
  } catch (error) {
    console.error('Check test access error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking test access'
    });
  }
};

// Get test attempt result for review (with full answer key)
export const getAttemptResult = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { attemptId } = req.params;

    // Fetch attempt with test details
    const { data: attempt, error } = await supabase
      .from('test_attempts')
      .select(`
        attempt_id,
        test_id,
        total_marks_obtained,
        percentage,
        correct_answers,
        incorrect_answers,
        unanswered,
        submit_time,
        tests (
          test_name,
          total_marks,
          total_questions
        )
      `)
      .eq('attempt_id', attemptId)
      .eq('user_id', userId)
      .single();

    if (error || !attempt) {
      return res.status(404).json({
        success: false,
        message: 'Test attempt not found'
      });
    }

    // ── Fetch per-question answer key ──────────────────────────────────────

    // 1. Get user's answers for this attempt
    const { data: userAnswers = [] } = await supabase
      .from('attempt_answers')
      .select('question_id, selected_option_id, is_correct, marks_obtained')
      .eq('attempt_id', attemptId);

    // 2. Get all test_questions for this test (ordered)
    const { data: testQuestions = [] } = await supabase
      .from('test_questions')
      .select('question_id, question_order, marks_allocated, negative_marks_allocated')
      .eq('test_id', attempt.test_id)
      .order('question_order', { ascending: true });

    const questionIds = testQuestions.map(tq => tq.question_id);

    if (questionIds.length === 0) {
      // No questions — return summary only
      return res.status(200).json({
        success: true,
        data: {
          attemptId: attempt.attempt_id,
          testId: attempt.test_id,
          testName: attempt.tests?.test_name || 'Test',
          score: parseFloat(attempt.total_marks_obtained || 0).toFixed(1),
          totalPossible: attempt.tests?.total_marks || 0,
          percentage: parseFloat(attempt.percentage || 0).toFixed(2),
          correct: attempt.correct_answers || 0,
          incorrect: attempt.incorrect_answers || 0,
          unanswered: attempt.unanswered || 0,
          submitTime: attempt.submit_time,
          totalQuestions: attempt.tests?.total_questions || 0,
          questions: []
        }
      });
    }

    // 3. Get question details (text, explanation, category, difficulty)
    const { data: questions = [] } = await supabase
      .from('questions')
      .select('question_id, question_text, question_type, question_category, difficulty_level, explanation, metadata')
      .in('question_id', questionIds);

    // 4. Get all options for these questions
    const { data: allOptions = [] } = await supabase
      .from('question_options')
      .select('option_id, question_id, option_text, is_correct, option_order')
      .in('question_id', questionIds)
      .order('option_order', { ascending: true });

    // 5. Get question media (images)
    const { data: allMedia = [] } = await supabase
      .from('question_media')
      .select('media_id, question_id, file_path, media_type, file_name')
      .in('question_id', questionIds);

    // Build media URLs
    const mediaMap = new Map();
    for (const m of allMedia) {
      if (!m.file_path) continue;
      const { data: urlData } = supabase.storage
        .from('question-images')
        .getPublicUrl(m.file_path);
      if (urlData?.publicUrl) {
        if (!mediaMap.has(m.question_id)) mediaMap.set(m.question_id, []);
        mediaMap.get(m.question_id).push({
          mediaId: m.media_id,
          url: urlData.publicUrl,
          type: m.media_type,
          fileName: m.file_name
        });
      }
    }

    // Build lookup maps
    const questionsMap = new Map(questions.map(q => [q.question_id, q]));
    const optionsMap = new Map();
    for (const opt of allOptions) {
      if (!optionsMap.has(opt.question_id)) optionsMap.set(opt.question_id, []);
      optionsMap.get(opt.question_id).push(opt);
    }
    const userAnswersMap = new Map(userAnswers.map(a => [a.question_id, a]));

    // 6. Build per-question answer key
    const questionsWithAnswerKey = testQuestions.map((tq, idx) => {
      const q = questionsMap.get(tq.question_id);
      const options = optionsMap.get(tq.question_id) || [];
      const userAnswer = userAnswersMap.get(tq.question_id);
      const media = mediaMap.get(tq.question_id) || [];

      const correctOption = options.find(o => o.is_correct);
      const selectedOption = userAnswer?.selected_option_id
        ? options.find(o => o.option_id === userAnswer.selected_option_id)
        : null;

      // Determine status
      let status = 'unattempted';
      if (userAnswer?.selected_option_id != null) {
        status = userAnswer.is_correct ? 'correct' : 'incorrect';
      }

      return {
        questionNumber: idx + 1,
        questionId: tq.question_id,
        questionText: q?.question_text || '',
        questionType: q?.question_type || 'mcq',
        questionCategory: q?.question_category || '',
        difficultyLevel: q?.difficulty_level || '',
        explanation: q?.explanation || null,
        metadata: q?.metadata || {},
        marksAllocated: tq.marks_allocated,
        negativeMarks: tq.negative_marks_allocated,
        marksObtained: userAnswer?.marks_obtained ?? 0,
        status, // 'correct' | 'incorrect' | 'unattempted'
        options: options.map(opt => ({
          optionId: opt.option_id,
          text: opt.option_text,
          isCorrect: opt.is_correct,
          isSelected: opt.option_id === userAnswer?.selected_option_id
        })),
        correctOptionId: correctOption?.option_id ?? null,
        selectedOptionId: userAnswer?.selected_option_id ?? null,
        media
      };
    });

    res.status(200).json({
      success: true,
      data: {
        attemptId: attempt.attempt_id,
        testId: attempt.test_id,
        testName: attempt.tests?.test_name || 'Test',
        score: parseFloat(attempt.total_marks_obtained || 0).toFixed(1),
        totalPossible: attempt.tests?.total_marks || 0,
        percentage: parseFloat(attempt.percentage || 0).toFixed(2),
        correct: attempt.correct_answers || 0,
        incorrect: attempt.incorrect_answers || 0,
        unanswered: attempt.unanswered || 0,
        submitTime: attempt.submit_time,
        totalQuestions: attempt.tests?.total_questions || 0,
        questions: questionsWithAnswerKey
      }
    });
  } catch (error) {
    console.error('Get attempt result error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attempt result'
    });
  }
};
