import { supabase } from '../config/supabase.js';

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
        is_free,
        price,
        start_time,
        end_time,
        created_at,
        subjects (
          subject_id,
          name,
          subject_code
        )
      `)
      .eq('is_published', true);

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

    if (isFree !== undefined && isFree !== 'undefined') {
      query = query.eq('is_free', isFree === 'true');
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
      .select('test_id, total_marks_obtained, percentage')
      .eq('user_id', userId)
      .in('test_id', testIds)
      .eq('attempt_status', 'completed');

    // Create a map of user's best scores
    const userScoresMap = new Map();
    userAttempts?.forEach(attempt => {
      const existing = userScoresMap.get(attempt.test_id);
      if (!existing || attempt.percentage > existing.percentage) {
        userScoresMap.set(attempt.test_id, {
          score: attempt.total_marks_obtained,
          percentage: attempt.percentage
        });
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
        isFree: test.is_free,
        price: test.price,
        subject: test.subjects ? {
          id: test.subjects.subject_id,
          name: test.subjects.name,
          code: test.subjects.subject_code
        } : null,
        startTime: test.start_time,
        endTime: test.end_time,
        attempts: attemptsCountMap.get(test.test_id) || 0,
        userBestScore: userScoresMap.get(test.test_id) || null,
        hasAttempted: userScoresMap.has(test.test_id),
        // Subscription limits
        remainingAttempts: limits.remaining,
        totalAttempts: limits.total,
        usedAttempts: limits.used,
        hasAttemptsLeft: hasAttemptsLeft,
        isUnlimited: limits.remaining === -1
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
        start_time,
        end_time,
        proctoring_settings,
        subjects (
          subject_id,
          name,
          subject_code
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
        isFree: test.is_free,
        price: test.price,
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

    // Get test details
    const { data: test, error } = await supabase
      .from('tests')
      .select('is_free, price, start_time, end_time')
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

    // Check if test is free or user has paid
    if (!test.is_free) {
      // Check if user has a valid transaction for this test
      const { data: transaction } = await supabase
        .from('transactions')
        .select('transaction_id')
        .eq('user_id', userId)
        .eq('test_id', testId)
        .eq('transaction_status', 'success')
        .single();

      if (!transaction) {
        canAccess.hasAccess = false;
        canAccess.reason = 'payment_required';
        canAccess.price = test.price;
      }
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

// Get test attempt result for review
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

    // Format the response
    const result = {
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
      totalQuestions: attempt.tests?.total_questions || 0
    };

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get attempt result error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attempt result'
    });
  }
};
