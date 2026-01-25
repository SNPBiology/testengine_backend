import { supabase } from '../config/supabase.js';

// Get overall performance statistics
export const getOverallPerformance = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { timeRange = 'all' } = req.query; // week, month, all

    // Calculate date range
    let startDate = null;
    if (timeRange === 'week') {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeRange === 'month') {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
    }

    // Build query for test attempts
    let query = supabase
      .from('test_attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('attempt_status', 'completed');

    if (startDate) {
      query = query.gte('submit_time', startDate.toISOString());
    }

    const { data: attempts, error } = await query.order('submit_time', { ascending: false });

    if (error) {
      console.error('Error fetching attempts:', error);
      throw error;
    }

    // Calculate statistics
    const testsCompleted = attempts?.length || 0;
    
    const totalMarks = attempts?.reduce((sum, a) => sum + parseFloat(a.total_marks_obtained || 0), 0) || 0;
    const totalPossible = attempts?.reduce((sum, a) => {
      // Assuming each test has total_marks field, or calculate from questions
      return sum + 720; // Default NEET marks, should be dynamic
    }, 0) || 1;
    
    const overallScore = testsCompleted > 0 ? (totalMarks / testsCompleted).toFixed(2) : 0;
    const overallPercentage = testsCompleted > 0 
      ? ((totalMarks / totalPossible) * 100).toFixed(2) 
      : 0;

    const totalCorrect = attempts?.reduce((sum, a) => sum + (a.correct_answers || 0), 0) || 0;
    const totalQuestions = attempts?.reduce((sum, a) => 
      sum + (a.correct_answers || 0) + (a.incorrect_answers || 0) + (a.unanswered || 0), 0) || 0;
    
    const accuracy = totalQuestions > 0 
      ? ((totalCorrect / totalQuestions) * 100).toFixed(1) 
      : 0;

    // Calculate average time per question
    const totalTime = attempts?.reduce((sum, a) => {
      if (a.start_time && a.end_time) {
        return sum + (new Date(a.end_time) - new Date(a.start_time));
      }
      return sum;
    }, 0) || 0;

    const avgTimePerQuestion = totalQuestions > 0 && totalTime > 0
      ? ((totalTime / totalQuestions) / 60000).toFixed(1) // Convert to minutes
      : 0;

    // Get rank (simplified - based on best score)
    const bestScore = attempts?.length > 0 
      ? Math.max(...attempts.map(a => parseFloat(a.percentage || 0)))
      : 0;

    const { count: betterScores } = await supabase
      .from('test_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('attempt_status', 'completed')
      .gt('percentage', bestScore);

    const rank = (betterScores || 0) + 1;

    // Calculate percentile
    const { count: totalStudents } = await supabase
      .from('test_attempts')
      .select('user_id', { count: 'exact', head: true })
      .eq('attempt_status', 'completed');

    const percentile = totalStudents > 0 
      ? (((totalStudents - rank) / totalStudents) * 100).toFixed(0)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        score: parseFloat(overallScore),
        total: 720,
        percentage: parseFloat(overallPercentage),
        percentile: parseInt(percentile),
        rank,
        totalStudents: totalStudents || 0,
        accuracy: parseFloat(accuracy),
        avgTimePerQuestion: parseFloat(avgTimePerQuestion),
        testsCompleted
      }
    });
  } catch (error) {
    console.error('Get overall performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching performance data'
    });
  }
};

// Get subject-wise performance
export const getSubjectPerformance = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get all subjects
    const { data: subjects, error: subjectsError } = await supabase
      .from('subjects')
      .select('subject_id, name, subject_code')
      .eq('is_active', true);

    if (subjectsError) throw subjectsError;

    // Get performance analytics for each subject
    const { data: analytics } = await supabase
      .from('performance_analytics')
      .select('*')
      .eq('user_id', userId);

    // Create analytics map
    const analyticsMap = new Map();
    analytics?.forEach(a => {
      analyticsMap.set(a.subject_id, a);
    });

    // Format subject performance
    const subjectPerformance = await Promise.all(subjects?.map(async (subject) => {
      const subjectAnalytics = analyticsMap.get(subject.subject_id);
      
      // Get recent tests for this subject
      const { data: recentTests } = await supabase
        .from('test_attempts')
        .select(`
          total_marks_obtained,
          percentage,
          submit_time,
          tests!inner(subject_id, total_marks)
        `)
        .eq('user_id', userId)
        .eq('attempt_status', 'completed')
        .eq('tests.subject_id', subject.subject_id)
        .order('submit_time', { ascending: false })
        .limit(5);

      // Calculate trend (comparing last 2 tests)
      let trend = 'stable';
      if (recentTests && recentTests.length >= 2) {
        const latest = parseFloat(recentTests[0].percentage);
        const previous = parseFloat(recentTests[1].percentage);
        if (latest > previous + 5) trend = 'up';
        else if (latest < previous - 5) trend = 'down';
      }

      return {
        name: subject.name,
        subjectCode: subject.subject_code,
        score: subjectAnalytics?.average_score || 0,
        total: 180, // Standard subject marks
        progress: subjectAnalytics?.average_score || 0,
        accuracy: subjectAnalytics ? 
          ((subjectAnalytics.total_correct_answers / 
            (subjectAnalytics.total_correct_answers + subjectAnalytics.total_incorrect_answers)) * 100).toFixed(1) 
          : 0,
        trend,
        testsAttempted: subjectAnalytics?.total_tests_attempted || 0,
        correctAnswers: subjectAnalytics?.total_correct_answers || 0,
        incorrectAnswers: subjectAnalytics?.total_incorrect_answers || 0
      };
    }) || []);

    res.status(200).json({
      success: true,
      data: subjectPerformance
    });
  } catch (error) {
    console.error('Get subject performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subject performance'
    });
  }
};

// Get progress over time
export const getProgressOverTime = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { timeRange = 'month' } = req.query;

    // Calculate date range
    let startDate = new Date();
    if (timeRange === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeRange === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else {
      startDate.setMonth(startDate.getMonth() - 6); // 6 months for 'all'
    }

    const { data: attempts, error } = await supabase
      .from('test_attempts')
      .select('total_marks_obtained, percentage, submit_time')
      .eq('user_id', userId)
      .eq('attempt_status', 'completed')
      .gte('submit_time', startDate.toISOString())
      .order('submit_time', { ascending: true });

    if (error) throw error;

    // Group by month/week
    const progressData = [];
    const groupedData = new Map();

    attempts?.forEach(attempt => {
      const date = new Date(attempt.submit_time);
      const key = timeRange === 'week' 
        ? `${date.getMonth() + 1}/${date.getDate()}`
        : date.toLocaleDateString('en-US', { month: 'short' });

      if (!groupedData.has(key)) {
        groupedData.set(key, []);
      }
      groupedData.get(key).push(attempt);
    });

    // Calculate average for each period
    groupedData.forEach((attempts, period) => {
      const avgScore = attempts.reduce((sum, a) => sum + parseFloat(a.total_marks_obtained), 0) / attempts.length;
      const avgPercentage = attempts.reduce((sum, a) => sum + parseFloat(a.percentage), 0) / attempts.length;

      progressData.push({
        period,
        score: parseFloat(avgScore.toFixed(1)),
        percentage: parseFloat(avgPercentage.toFixed(1)),
        tests: attempts.length
      });
    });

    res.status(200).json({
      success: true,
      data: progressData
    });
  } catch (error) {
    console.error('Get progress over time error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching progress data'
    });
  }
};

// Get recent test attempts with details
export const getRecentTests = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 10 } = req.query;

    const { data: attempts, error } = await supabase
      .from('test_attempts')
      .select(`
        attempt_id,
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
      .eq('user_id', userId)
      .eq('attempt_status', 'completed')
      .order('submit_time', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    const recentTests = attempts?.map(attempt => ({
      id: attempt.attempt_id,
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

// Get comparison data (user vs others)
export const getComparisonData = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's best score
    const { data: userAttempts } = await supabase
      .from('test_attempts')
      .select('total_marks_obtained, percentage')
      .eq('user_id', userId)
      .eq('attempt_status', 'completed')
      .order('percentage', { ascending: false })
      .limit(1);

    const userBestScore = userAttempts?.[0]?.total_marks_obtained || 0;
    const userPercentage = userAttempts?.[0]?.percentage || 0;

    // Get topper's score
    const { data: topperAttempt } = await supabase
      .from('test_attempts')
      .select('total_marks_obtained')
      .eq('attempt_status', 'completed')
      .order('total_marks_obtained', { ascending: false })
      .limit(1);

    const topperScore = topperAttempt?.[0]?.total_marks_obtained || 0;

    // Get average score
    const { data: allAttempts } = await supabase
      .from('test_attempts')
      .select('total_marks_obtained')
      .eq('attempt_status', 'completed');

    const averageScore = allAttempts && allAttempts.length > 0
      ? (allAttempts.reduce((sum, a) => sum + parseFloat(a.total_marks_obtained), 0) / allAttempts.length).toFixed(1)
      : 0;

    // Calculate percentile
    const { count: betterScores } = await supabase
      .from('test_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('attempt_status', 'completed')
      .gt('percentage', userPercentage);

    const { count: totalAttempts } = await supabase
      .from('test_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('attempt_status', 'completed');

    const percentile = totalAttempts > 0
      ? (((totalAttempts - betterScores) / totalAttempts) * 100).toFixed(0)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        yourScore: parseFloat(userBestScore),
        topperScore: parseFloat(topperScore),
        averageScore: parseFloat(averageScore),
        percentile: parseInt(percentile)
      }
    });
  } catch (error) {
    console.error('Get comparison data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching comparison data'
    });
  }
};

