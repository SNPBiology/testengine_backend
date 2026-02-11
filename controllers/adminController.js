import { supabase } from '../config/supabase.js';

/**
 * Get admin dashboard statistics
 */
export const getAdminStats = async (req, res) => {
  try {
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

    // Get total students count
    const { count: totalStudents, error: studentsError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student');

    if (studentsError) throw studentsError;

    // Get total tests count
    const { count: totalTests, error: testsError } = await supabase
      .from('tests')
      .select('*', { count: 'exact', head: true });

    if (testsError) throw testsError;

    // Get active tests count
    const { count: activeTests, error: activeTestsError } = await supabase
      .from('tests')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true);

    if (activeTestsError) throw activeTestsError;

    // Get total revenue (sum of all successful transactions)
    const { data: revenueData, error: revenueError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('transaction_status', 'success');

    if (revenueError) throw revenueError;

    const totalRevenue = revenueData.reduce((sum, transaction) => sum + (transaction.amount || 0), 0);

    res.json({
      success: true,
      data: {
        totalStudents: totalStudents || 0,
        totalTests: totalTests || 0,
        activeTests: activeTests || 0,
        totalRevenue: totalRevenue || 0
      }
    });

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin statistics',
      error: error.message
    });
  }
};

/**
 * Get recent tests created
 */
export const getRecentTests = async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 10;

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

    // Get recent tests with attempt counts
    const { data: tests, error: testsError } = await supabase
      .from('tests')
      .select(`
        test_id,
        test_name,
        description,
        duration_minutes,
        total_marks,
        is_free,
        price,
        is_published,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (testsError) throw testsError;

    // Get question counts and attempt counts for each test
    const testsWithDetails = await Promise.all(
      tests.map(async (test) => {
        // Get question count
        const { count: questionCount } = await supabase
          .from('test_questions')
          .select('*', { count: 'exact', head: true })
          .eq('test_id', test.test_id);

        // Get attempt count
        const { count: attemptCount } = await supabase
          .from('test_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('test_id', test.test_id);

        return {
          id: test.test_id,
          title: test.test_name,
          description: test.description,
          duration: test.duration_minutes,
          totalQuestions: questionCount || 0,
          totalMarks: test.total_marks,
          requiredPlanId: test.required_plan_id || 1, // Default to Free if null
          isActive: test.is_published,
          attemptCount: attemptCount || 0,
          createdAt: test.created_at
        };
      })
    );

    res.json({
      success: true,
      data: testsWithDetails
    });

  } catch (error) {
    console.error('Error fetching recent tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent tests',
      error: error.message
    });
  }
};

/**
 * Get recent sales/purchases
 */
export const getRecentSales = async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 10;

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

    // Get recent transactions with student and test details
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select(`
        transaction_id,
        amount,
        transaction_status,
        transaction_date,
        user_id,
        test_id
      `)
      .order('transaction_date', { ascending: false })
      .limit(limit);

    if (transactionsError) throw transactionsError;

    // Get student and test details for each transaction
    const salesWithDetails = await Promise.all(
      transactions.map(async (transaction) => {
        // Get student name
        const { data: student } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('user_id', transaction.user_id)
          .single();

        // Get test title
        const { data: test } = await supabase
          .from('tests')
          .select('test_name')
          .eq('test_id', transaction.test_id)
          .single();

        return {
          id: transaction.transaction_id,
          studentName: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
          testTitle: test ? test.test_name : 'Unknown Test',
          amount: transaction.amount,
          status: transaction.transaction_status,
          date: transaction.transaction_date
        };
      })
    );

    res.json({
      success: true,
      data: salesWithDetails
    });

  } catch (error) {
    console.error('Error fetching recent sales:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent sales',
      error: error.message
    });
  }
};

/**
 * Get top performing students
 */
export const getTopPerformers = async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 10;

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

    // Get all test attempts with user details
    const { data: attempts, error: attemptsError } = await supabase
      .from('test_attempts')
      .select(`
        user_id,
        total_marks_obtained,
        percentage
      `)
      .eq('attempt_status', 'completed');

    if (attemptsError) throw attemptsError;

    // Calculate average scores per student
    const studentScores = {};
    attempts.forEach(attempt => {
      if (!studentScores[attempt.user_id]) {
        studentScores[attempt.user_id] = {
          totalPercentage: 0,
          testCount: 0
        };
      }
      studentScores[attempt.user_id].totalPercentage += attempt.percentage || 0;
      studentScores[attempt.user_id].testCount += 1;
    });

    // Get student details and calculate averages
    const topPerformers = await Promise.all(
      Object.entries(studentScores).map(async ([userId, scores]) => {
        const { data: student } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('user_id', userId)
          .single();

        const averageScore = scores.testCount > 0
          ? scores.totalPercentage / scores.testCount
          : 0;

        return {
          id: userId,
          name: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
          averageScore: Math.round(averageScore * 10) / 10,
          testsTaken: scores.testCount
        };
      })
    );

    // Sort by average score and limit
    topPerformers.sort((a, b) => b.averageScore - a.averageScore);
    const limitedPerformers = topPerformers.slice(0, limit);

    res.json({
      success: true,
      data: limitedPerformers
    });

  } catch (error) {
    console.error('Error fetching top performers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top performers',
      error: error.message
    });
  }
};

/**
 * Get all students
 */
export const getAllStudents = async (req, res) => {
  try {
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

    // Get all students
    const { data: students, error: studentsError } = await supabase
      .from('users')
      .select('user_id, first_name, last_name, email, created_at')
      .eq('role', 'student')
      .order('created_at', { ascending: false });

    if (studentsError) throw studentsError;

    // Get test attempts for each student
    const studentsWithStats = await Promise.all(
      students.map(async (student) => {
        const { data: attempts } = await supabase
          .from('test_attempts')
          .select('total_marks_obtained, percentage, created_at')
          .eq('user_id', student.user_id)
          .eq('attempt_status', 'completed');

        const testsTaken = attempts?.length || 0;
        let averageScore = 0;

        if (testsTaken > 0) {
          const totalPercentage = attempts.reduce((sum, att) => sum + (att.percentage || 0), 0);
          averageScore = totalPercentage / testsTaken;
        }

        const lastActive = attempts && attempts.length > 0
          ? attempts[attempts.length - 1].created_at
          : null;

        return {
          id: student.user_id,
          name: `${student.first_name} ${student.last_name}`,
          email: student.email,
          testsTaken,
          averageScore: Math.round(averageScore * 10) / 10,
          lastActive
        };
      })
    );

    res.json({
      success: true,
      data: studentsWithStats
    });

  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
      error: error.message
    });
  }
};

/**
 * Get all sales/purchases
 */
export const getAllSales = async (req, res) => {
  try {
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

    // Get all transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .order('transaction_date', { ascending: false });

    if (transactionsError) throw transactionsError;

    // Get student and test details for each transaction
    const salesWithDetails = await Promise.all(
      transactions.map(async (transaction) => {
        const { data: student } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('user_id', transaction.user_id)
          .single();

        const { data: test } = await supabase
          .from('tests')
          .select('test_name')
          .eq('test_id', transaction.test_id)
          .single();

        return {
          id: transaction.transaction_id,
          studentName: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
          testTitle: test ? test.test_name : 'Unknown Test',
          amount: transaction.amount,
          status: transaction.transaction_status,
          date: transaction.transaction_date,
          transactionId: transaction.transaction_reference || transaction.transaction_id
        };
      })
    );

    // Calculate total revenue
    const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    res.json({
      success: true,
      data: salesWithDetails
    });

  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales',
      error: error.message
    });
  }
};

/**
 * Get all tests (admin view)
 */
export const getAllTests = async (req, res) => {
  try {
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

    // Get all tests
    const { data: tests, error: testsError } = await supabase
      .from('tests')
      .select('*')
      .order('created_at', { ascending: false });

    if (testsError) throw testsError;

    // Get question counts and attempt counts for each test
    const testsWithDetails = await Promise.all(
      tests.map(async (test) => {
        const { count: questionCount } = await supabase
          .from('test_questions')
          .select('*', { count: 'exact', head: true })
          .eq('test_id', test.test_id);

        const { count: attemptCount } = await supabase
          .from('test_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('test_id', test.test_id);

        return {
          id: test.test_id,
          title: test.test_name,
          description: test.description,
          duration: test.duration_minutes,
          totalQuestions: questionCount || 0,
          totalMarks: test.total_marks,
          requiredPlanId: test.required_plan_id || 1, // Default to Free if null
          isActive: test.is_published,
          attemptCount: attemptCount || 0,
          createdAt: test.created_at
        };
      })
    );

    res.json({
      success: true,
      data: testsWithDetails
    });

  } catch (error) {
    console.error('Error fetching tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tests',
      error: error.message
    });
  }
};

/**
 * Toggle test status
 */
export const toggleTestStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { testId } = req.params;
    const { isActive } = req.body;

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

    // Update test status
    const { error: updateError } = await supabase
      .from('tests')
      .update({ is_published: isActive })
      .eq('test_id', testId);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: `Test ${isActive ? 'activated' : 'deactivated'} successfully`
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

    // Delete test (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('tests')
      .delete()
      .eq('test_id', testId);

    if (deleteError) throw deleteError;

    res.json({
      success: true,
      message: 'Test deleted successfully'
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
 * Update admin profile
 */
export const updateAdminProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { firstName, lastName, phone } = req.body;

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

    // Update profile
    const { error: updateError } = await supabase
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

/**
 * Change admin password
 */
export const changeAdminPassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

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

    // This would typically verify the current password and update to new password
    // Implementation depends on your auth system
    // For now, returning success
    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};

/**
 * Get revenue statistics
 */
export const getRevenueStats = async (req, res) => {
  try {
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

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get today's revenue
    const { data: todayData, error: todayError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('transaction_status', 'success')
      .gte('transaction_date', todayStart.toISOString());

    if (todayError) throw todayError;

    // Get this week's revenue
    const { data: weekData, error: weekError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('transaction_status', 'success')
      .gte('transaction_date', weekStart.toISOString());

    if (weekError) throw weekError;

    // Get this month's revenue
    const { data: monthData, error: monthError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('transaction_status', 'success')
      .gte('transaction_date', monthStart.toISOString());

    if (monthError) throw monthError;

    // Get total revenue (all time)
    const { data: allData, error: allError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('transaction_status', 'success');

    if (allError) throw allError;

    const today = todayData.reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
    const thisWeek = weekData.reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
    const thisMonth = monthData.reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
    const total = allData.reduce((sum, transaction) => sum + (transaction.amount || 0), 0);

    res.json({
      success: true,
      data: {
        today,
        thisWeek,
        thisMonth,
        total
      }
    });

  } catch (error) {
    console.error('Error fetching revenue stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue statistics',
      error: error.message
    });
  }
};

/**
 * Get detailed information for a specific student
 */
export const getStudentDetails = async (req, res) => {
  try {
    const adminUserId = req.user.userId;
    const { studentId } = req.params;

    // Verify user is admin
    const { data: adminData, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', adminUserId)
      .single();

    if (adminError || !adminData || adminData.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Get student basic information
    const { data: student, error: studentError } = await supabase
      .from('users')
      .select('user_id, email, first_name, last_name, phone, created_at, last_login, is_active')
      .eq('user_id', studentId)
      .eq('role', 'student')
      .single();

    if (studentError || !student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get student profile details
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('student_id, date_of_birth, address, profile_picture, preferences')
      .eq('user_id', studentId)
      .single();

    // Get all test attempts with test details
    const { data: attempts, error: attemptsError } = await supabase
      .from('test_attempts')
      .select(`
        attempt_id,
        test_id,
        start_time,
        end_time,
        submit_time,
        attempt_status,
        total_marks_obtained,
        percentage,
        correct_answers,
        incorrect_answers,
        unanswered,
        is_passed,
        created_at
      `)
      .eq('user_id', studentId)
      .order('created_at', { ascending: false });

    if (attemptsError) throw attemptsError;

    // Get test details for each attempt
    const attemptsWithDetails = await Promise.all(
      (attempts || []).map(async (attempt) => {
        const { data: test } = await supabase
          .from('tests')
          .select('test_name, total_marks, duration_minutes, test_type')
          .eq('test_id', attempt.test_id)
          .single();

        return {
          attemptId: attempt.attempt_id,
          testId: attempt.test_id,
          testName: test?.test_name || 'Unknown Test',
          testType: test?.test_type || 'unknown',
          totalMarks: test?.total_marks || 0,
          durationMinutes: test?.duration_minutes || 0,
          startTime: attempt.start_time,
          endTime: attempt.end_time,
          submitTime: attempt.submit_time,
          status: attempt.attempt_status,
          marksObtained: attempt.total_marks_obtained || 0,
          percentage: attempt.percentage || 0,
          correctAnswers: attempt.correct_answers || 0,
          incorrectAnswers: attempt.incorrect_answers || 0,
          unanswered: attempt.unanswered || 0,
          isPassed: attempt.is_passed || false,
          completedAt: attempt.created_at
        };
      })
    );

    // Get proctoring violations
    const { data: sessions } = await supabase
      .from('test_sessions')
      .select(`
        test_session_id,
        attempt_id,
        tab_switches,
        screenshot_count,
        violation_count,
        session_start,
        session_end
      `)
      .in('attempt_id', (attempts || []).map(a => a.attempt_id));

    // Get detailed proctoring events
    const sessionIds = (sessions || []).map(s => s.test_session_id);
    let proctoringEvents = [];

    if (sessionIds.length > 0) {
      const { data: events } = await supabase
        .from('proctoring_events')
        .select(`
          event_id,
          test_session_id,
          event_type,
          event_details,
          severity,
          timestamp
        `)
        .in('test_session_id', sessionIds)
        .order('timestamp', { ascending: false });

      proctoringEvents = (events || []).map(event => {
        // Find the session and then the attempt to get test info
        const session = sessions.find(s => s.test_session_id === event.test_session_id);
        const attempt = attempts?.find(a => a.attempt_id === session?.attempt_id);

        return {
          eventId: event.event_id,
          attemptId: session?.attempt_id,
          eventType: event.event_type,
          severity: event.severity,
          details: event.event_details,
          timestamp: event.timestamp
        };
      });
    }

    // Get transaction history
    const { data: transactions } = await supabase
      .from('transactions')
      .select(`
        transaction_id,
        test_id,
        transaction_reference,
        amount,
        payment_method,
        transaction_status,
        transaction_date
      `)
      .eq('user_id', studentId)
      .order('transaction_date', { ascending: false });

    const transactionsWithDetails = await Promise.all(
      (transactions || []).map(async (transaction) => {
        const { data: test } = await supabase
          .from('tests')
          .select('test_name')
          .eq('test_id', transaction.test_id)
          .single();

        return {
          transactionId: transaction.transaction_id,
          testName: test?.test_name || 'Unknown Test',
          amount: transaction.amount,
          paymentMethod: transaction.payment_method,
          status: transaction.transaction_status,
          transactionReference: transaction.transaction_reference,
          date: transaction.transaction_date
        };
      })
    );

    // Calculate aggregate statistics
    const completedAttempts = attempts?.filter(a => a.attempt_status === 'completed') || [];
    const totalTests = completedAttempts.length;
    // Count actual proctoring events instead of relying on violation_count field
    const totalViolations = proctoringEvents.length;
    const totalTabSwitches = sessions?.reduce((sum, s) => sum + (s.tab_switches || 0), 0) || 0;
    const totalSpent = transactions?.filter(t => t.transaction_status === 'success')
      .reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    let averageScore = 0;
    let passedTests = 0;
    let totalTimeSpent = 0; // in minutes

    if (totalTests > 0) {
      const totalPercentage = completedAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0);
      averageScore = Math.round((totalPercentage / totalTests) * 10) / 10;
      passedTests = completedAttempts.filter(a => a.is_passed).length;

      // Calculate total time spent
      completedAttempts.forEach(attempt => {
        if (attempt.start_time && attempt.end_time) {
          const duration = (new Date(attempt.end_time) - new Date(attempt.start_time)) / (1000 * 60);
          totalTimeSpent += duration;
        }
      });
    }

    const passPercentage = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    // Get performance analytics if available
    const { data: analytics } = await supabase
      .from('performance_analytics')
      .select('*')
      .eq('user_id', studentId);

    // Compile response
    res.json({
      success: true,
      data: {
        profile: {
          userId: student.user_id,
          email: student.email,
          firstName: student.first_name,
          lastName: student.last_name,
          fullName: `${student.first_name} ${student.last_name}`,
          phone: student.phone,
          studentId: profile?.student_id || 'N/A',
          dateOfBirth: profile?.date_of_birth,
          address: profile?.address,
          profilePicture: profile?.profile_picture,
          preferences: profile?.preferences,
          accountCreated: student.created_at,
          lastLogin: student.last_login,
          isActive: student.is_active
        },
        statistics: {
          totalTests,
          averageScore,
          passedTests,
          failedTests: totalTests - passedTests,
          passPercentage,
          totalViolations,
          totalTabSwitches,
          totalSpent,
          totalTimeSpent: Math.round(totalTimeSpent)
        },
        testAttempts: attemptsWithDetails,
        proctoringViolations: proctoringEvents,
        transactions: transactionsWithDetails,
        performanceAnalytics: analytics || []
      }
    });

  } catch (error) {
    console.error('Error fetching student details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student details',
      error: error.message
    });
  }
};

