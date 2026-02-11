import { supabase } from '../config/supabase.js';
import { getUserAccessiblePlanIds } from '../middleware/planAccess.js';

// Get dashboard overview data
export const getDashboardOverview = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch user's test attempts
    const { data: testAttempts, error: attemptsError } = await supabase
      .from('test_attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('attempt_status', 'completed')
      .order('submit_time', { ascending: false });

    if (attemptsError) {
      console.error('Error fetching test attempts:', attemptsError);
    }

    // Calculate performance metrics
    const testsTaken = testAttempts?.length || 0;
    const averageScore = testsTaken > 0
      ? (testAttempts.reduce((sum, test) => sum + parseFloat(test.percentage || 0), 0) / testsTaken).toFixed(2)
      : 0;

    const totalCorrect = testAttempts?.reduce((sum, test) => sum + (test.correct_answers || 0), 0) || 0;
    const totalQuestions = testAttempts?.reduce((sum, test) =>
      sum + (test.correct_answers || 0) + (test.incorrect_answers || 0) + (test.unanswered || 0), 0) || 0;

    const accuracy = totalQuestions > 0
      ? ((totalCorrect / totalQuestions) * 100).toFixed(1)
      : 0;

    // Calculate average time per question (if we have time data)
    const totalTimeSpent = testAttempts?.reduce((sum, test) => {
      if (test.start_time && test.end_time) {
        const duration = new Date(test.end_time) - new Date(test.start_time);
        return sum + duration;
      }
      return sum;
    }, 0) || 0;

    const avgTimePerQuestion = totalQuestions > 0 && totalTimeSpent > 0
      ? ((totalTimeSpent / totalQuestions) / 60000).toFixed(1) // Convert to minutes
      : 0;

    res.status(200).json({
      success: true,
      data: {
        overallScore: parseFloat(averageScore),
        testsTaken,
        avgTimePerQuestion: `${avgTimePerQuestion} min`,
        accuracy: `${accuracy}%`
      }
    });
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard overview'
    });
  }
};

// Get upcoming tests
export const getUpcomingTests = async (req, res) => {
  try {
    const userId = req.user.userId;
    const currentTime = new Date().toISOString();

    // Get user's accessible plan IDs
    const { accessiblePlanIds } = await getUserAccessiblePlanIds(userId);

    // Fetch published tests that haven't ended yet
    const { data: tests, error } = await supabase
      .from('tests')
      .select(`
        test_id,
        test_name,
        description,
        duration_minutes,
        total_questions,
        total_marks,
        start_time,
        end_time,
        test_type,
        is_free,
        price,
        subjects (
          name,
          subject_code
        )
      `)
      .eq('is_published', true)
      .in('required_plan_id', accessiblePlanIds) // Filter by user's accessible plans
      .or(`end_time.is.null,end_time.gt.${currentTime}`)
      .order('start_time', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Error fetching upcoming tests:', error);
      throw error;
    }

    // Check which tests the user has already attempted
    const { data: userAttempts } = await supabase
      .from('test_attempts')
      .select('test_id')
      .eq('user_id', userId);

    const attemptedTestIds = new Set(userAttempts?.map(a => a.test_id) || []);

    // Filter out already attempted tests and format the data
    const upcomingTests = tests
      ?.filter(test => !attemptedTestIds.has(test.test_id))
      .map(test => ({
        id: test.test_id,
        title: test.test_name,
        description: test.description,
        date: test.start_time ? new Date(test.start_time).toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }) : 'Available Now',
        duration: `${test.duration_minutes} mins`,
        totalQuestions: test.total_questions,
        totalMarks: test.total_marks,
        testType: test.test_type,
        isFree: test.is_free,
        price: test.price,
        subject: test.subjects?.name || 'General'
      })) || [];

    res.status(200).json({
      success: true,
      data: upcomingTests
    });
  } catch (error) {
    console.error('Get upcoming tests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching upcoming tests'
    });
  }
};

// Get recent test attempts
export const getRecentTests = async (req, res) => {
  try {
    const userId = req.user.userId;

    const { data: attempts, error } = await supabase
      .from('test_attempts')
      .select(`
        attempt_id,
        test_id,
        submit_time,
        total_marks_obtained,
        percentage,
        correct_answers,
        incorrect_answers,
        unanswered,
        tests (
          test_name,
          total_marks,
          total_questions
        )
      `)
      .eq('user_id', userId)
      .eq('attempt_status', 'completed')
      .order('submit_time', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching recent tests:', error);
      throw error;
    }

    const recentTests = attempts?.map(attempt => ({
      id: attempt.attempt_id,
      testId: attempt.test_id,
      title: attempt.tests?.test_name || 'Test',
      date: new Date(attempt.submit_time).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }),
      score: parseFloat(attempt.total_marks_obtained || 0).toFixed(1),
      total: attempt.tests?.total_marks || 0,
      percentage: parseFloat(attempt.percentage || 0).toFixed(1),
      accuracy: attempt.tests?.total_questions > 0
        ? ((attempt.correct_answers / attempt.tests.total_questions) * 100).toFixed(1)
        : 0,
      correctAnswers: attempt.correct_answers || 0,
      incorrectAnswers: attempt.incorrect_answers || 0,
      unanswered: attempt.unanswered || 0
    })) || [];

    res.status(200).json({
      success: true,
      data: recentTests
    });
  } catch (error) {
    console.error('Get recent tests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching recent tests'
    });
  }
};

// Get subject-wise progress
export const getSubjectProgress = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch all subjects
    const { data: subjects, error: subjectsError } = await supabase
      .from('subjects')
      .select('subject_id, name, subject_code')
      .eq('is_active', true);

    if (subjectsError) {
      console.error('Error fetching subjects:', subjectsError);
      throw subjectsError;
    }

    // Fetch performance analytics for each subject
    const { data: analytics, error: analyticsError } = await supabase
      .from('performance_analytics')
      .select('*')
      .eq('user_id', userId);

    if (analyticsError) {
      console.error('Error fetching analytics:', analyticsError);
    }

    // Create a map of subject analytics
    const analyticsMap = new Map();
    analytics?.forEach(a => {
      analyticsMap.set(a.subject_id, a);
    });

    // Combine subject data with analytics
    const subjectProgress = subjects?.map(subject => {
      const subjectAnalytics = analyticsMap.get(subject.subject_id);

      return {
        name: subject.name,
        subjectCode: subject.subject_code,
        progress: subjectAnalytics?.average_score || 0,
        tests: subjectAnalytics?.total_tests_attempted || 0,
        correctAnswers: subjectAnalytics?.total_correct_answers || 0,
        incorrectAnswers: subjectAnalytics?.total_incorrect_answers || 0,
        averageScore: subjectAnalytics?.average_score || 0
      };
    }) || [];

    res.status(200).json({
      success: true,
      data: subjectProgress
    });
  } catch (error) {
    console.error('Get subject progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subject progress'
    });
  }
};

// Get user's rank and leaderboard position
export const getUserRank = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's best scores
    const { data: userAttempts } = await supabase
      .from('test_attempts')
      .select('percentage, total_marks_obtained')
      .eq('user_id', userId)
      .eq('attempt_status', 'completed')
      .order('percentage', { ascending: false })
      .limit(1);

    const userBestScore = userAttempts?.[0]?.percentage || 0;

    // Get count of users with better scores
    const { count: betterScoresCount } = await supabase
      .from('test_attempts')
      .select('user_id', { count: 'exact', head: true })
      .eq('attempt_status', 'completed')
      .gt('percentage', userBestScore);

    const rank = (betterScoresCount || 0) + 1;

    res.status(200).json({
      success: true,
      data: {
        rank,
        bestScore: parseFloat(userBestScore).toFixed(1)
      }
    });
  } catch (error) {
    console.error('Get user rank error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user rank'
    });
  }
};


