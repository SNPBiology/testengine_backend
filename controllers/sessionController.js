// server/controllers/sessionController.js
import { supabase } from '../config/supabase.js';
import crypto from 'crypto';

// helper to generate random session token
const genToken = () => crypto.randomBytes(24).toString('hex');

/**
 * POST /api/sessions
 * Body: { testId }
 * Creates a test_attempt (in_progress) + test_session, returns sessionToken and questions
 */
export const createSession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { testId } = req.body;
    if (!testId)
      return res
        .status(400)
        .json({ success: false, message: 'testId required' });

    // Check test availability & access (reuse tests table)
    const { data: test, error: tErr } = await supabase
      .from('tests')
      .select('*')
      .eq('test_id', testId)
      .eq('is_published', true)
      .single();

    if (tErr || !test) {
      console.error('createSession: test lookup error:', tErr);
      return res
        .status(404)
        .json({ success: false, message: 'Test not found' });
    }

    const now = new Date();
    if (test.start_time && new Date(test.start_time) > now) {
      return res
        .status(403)
        .json({ success: false, message: 'Test not started' });
    }
    if (test.end_time && new Date(test.end_time) < now) {
      return res
        .status(403)
        .json({ success: false, message: 'Test expired' });
    }

    // payment/transactions if test.is_free === false
    if (!test.is_free) {
      const { data: tx } = await supabase
        .from('transactions')
        .select('transaction_id')
        .eq('user_id', userId)
        .eq('test_id', testId)
        .eq('transaction_status', 'success')
        .single();
      if (!tx)
        return res
          .status(402)
          .json({ success: false, message: 'Payment required' });
    }

    // Check subscription limits
    const { data: limitsData, error: limitsError } = await supabase
      .rpc('get_user_test_limits', { p_user_id: userId });

    if (!limitsError && limitsData && limitsData.length > 0) {
      // Determine test category
      let testCategory = 'mock'; // default

      if (test.test_type === 'practice') {
        // For practice tests, check metadata for test_category
        const metadataCategory = test.metadata?.test_category;
        if (metadataCategory === 'chapter') {
          testCategory = 'chapter';
        } else if (metadataCategory === 'subject') {
          testCategory = 'subject';
        }
      } else if (test.test_type === 'mock') {
        testCategory = 'mock';
      }

      // Find the limit for this test category
      const limit = limitsData.find(l => l.test_type === testCategory);

      if (limit && limit.remaining !== undefined) {
        // -1 means unlimited
        if (limit.remaining === 0 && limit.limit_value !== -1) {
          return res.status(403).json({
            success: false,
            message: `You have reached your limit for ${testCategory} tests. Upgrade your plan to continue.`,
            limitReached: true,
            testType: testCategory,
            limit: limit.limit_value,
            used: limit.current_usage
          });
        }
      }
    }

    // Clean up any existing in_progress attempts for this user/test
    // This prevents duplicate rows when React StrictMode causes rapid concurrent calls
    await supabase
      .from('test_attempts')
      .delete()
      .eq('user_id', userId)
      .eq('test_id', testId)
      .eq('attempt_status', 'in_progress');

    // Create a test_attempt (in_progress)
    const { data: attempt, error: attErr } = await supabase
      .from('test_attempts')
      .insert([
        {
          user_id: userId,
          test_id: testId,
          start_time: new Date().toISOString(),
          attempt_status: 'in_progress',
          session_id: null,
        },
      ])
      .select()
      .single();

    if (attErr || !attempt) {
      console.error('Attempt create error', attErr);
      return res
        .status(500)
        .json({ success: false, message: 'Failed to create attempt' });
    }

    // Create session token and test_sessions row
    const sessionToken = genToken();
    const sessionPayload = {
      attempt_id: attempt.attempt_id,
      session_token: sessionToken,
      session_start: new Date().toISOString(),
      proctoring_events: {},
      security_violations: {},
      is_fullscreen: false,
    };

    const { data: sessionRow, error: sessErr } = await supabase
      .from('test_sessions')
      .insert([sessionPayload])
      .select()
      .single();

    if (sessErr || !sessionRow) {
      console.error('Session create error', sessErr);
      return res
        .status(500)
        .json({ success: false, message: 'Failed to create session' });
    }

    // Update attempt row with session_id reference
    await supabase
      .from('test_attempts')
      .update({ session_id: sessionRow.test_session_id })
      .eq('attempt_id', attempt.attempt_id);

    // SAFE question fetching

    // 1) Try nested select (test_questions -> questions)
    const qRes = await supabase
      .from('test_questions')
      .select(
        `
        test_question_id,
        question_id,
        question_order,
        marks_allocated,
        negative_marks_allocated,
        questions (
          question_id,
          question_text,
          question_type,
          marks,
          negative_marks,
          metadata
        )
      `
      )
      .eq('test_questions.test_id', testId)
      .order('question_order', {
        foreignTable: 'test_questions',
        ascending: true,
      });

    let { data: questionsData, error: qdErr } = qRes;

    console.log('createSession: initial test_questions fetch:', {
      error: qdErr ? (qdErr.message || qdErr) : null,
      dataLength: Array.isArray(questionsData)
        ? questionsData.length
        : typeof questionsData,
    });

    // Fallback if nested fails
    if (qdErr || !Array.isArray(questionsData) || questionsData.length === 0) {
      try {
        console.log(
          'createSession: attempting fallback query for test_questions -> questions'
        );

        const fallbackTq = await supabase
          .from('test_questions')
          .select(
            'test_question_id, question_id, question_order, marks_allocated, negative_marks_allocated'
          )
          .eq('test_id', testId)
          .order('question_order', { ascending: true });

        if (fallbackTq.error) {
          console.error(
            'createSession: fallback test_questions error',
            fallbackTq.error
          );
          questionsData = [];
        } else {
          const tqRows = fallbackTq.data || [];
          const qIds = tqRows.map((t) => t.question_id).filter(Boolean);

          let questionsRows = [];
          if (qIds.length > 0) {
            const qRowsRes = await supabase
              .from('questions')
              .select(
                'question_id, question_text, question_type, marks, negative_marks, metadata'
              )
              .in('question_id', qIds);
            if (qRowsRes.error) {
              console.error(
                'createSession: fallback questions fetch error',
                qRowsRes.error
              );
            } else {
              questionsRows = qRowsRes.data || [];
            }
          }

          questionsData = tqRows.map((tq) => {
            const matched =
              questionsRows.find(
                (q) => Number(q.question_id) === Number(tq.question_id)
              ) || null;
            return {
              test_question_id: tq.test_question_id,
              question_id: tq.question_id,
              question_order: tq.question_order,
              marks_allocated: tq.marks_allocated,
              negative_marks_allocated: tq.negative_marks_allocated,
              questions: matched
                ? {
                  question_id: matched.question_id,
                  question_text: matched.question_text,
                  question_type: matched.question_type,
                  marks: matched.marks,
                  negative_marks: matched.negative_marks,
                  metadata: matched.metadata,
                }
                : null,
            };
          });
        }
      } catch (fbErr) {
        console.error('createSession: fallback path threw error', fbErr);
        questionsData = questionsData || [];
      }
    }

    // 2) Fetch options for the questions we found
    const qIds = (questionsData || []).map((q) => q.question_id).filter(Boolean);
    console.log('createSession: extracted question IDs count =', qIds.length);

    let optionsData = [];
    if (qIds.length > 0) {
      const optRes = await supabase
        .from('question_options')
        .select(
          'option_id, question_id, option_text, option_order, is_correct'
        )
        .in('question_id', qIds)
        .order('option_order', { ascending: true });

      optionsData = optRes.data || [];
      if (optRes.error) {
        console.error('createSession: error fetching options', optRes.error);
      }
      console.log(
        'createSession: fetched options count =',
        Array.isArray(optionsData) ? optionsData.length : typeof optionsData
      );

      // Validate that all questions have options
      const questionsWithoutOptions = qIds.filter(qid => {
        const opts = (optionsData || []).filter(o => o.question_id === qid);
        return opts.length === 0;
      });
      if (questionsWithoutOptions.length > 0) {
        console.warn('⚠️ Questions without options:', questionsWithoutOptions);
      }
    } else {
      console.log(
        'createSession: no question IDs found; skipping options fetch'
      );
    }

    // Build options map
    const optionsMap = new Map();
    (optionsData || []).forEach((o) => {
      if (!optionsMap.has(o.question_id)) optionsMap.set(o.question_id, []);
      optionsMap.get(o.question_id).push({
        optionId: o.option_id,
        text: o.option_text,
      });
    });

    // 3) Fetch question media from question_media table
    let mediaData = [];
    if (qIds.length > 0) {
      const mediaRes = await supabase
        .from('question_media')
        .select('media_id, question_id, file_path, media_type, file_name')
        .in('question_id', qIds);

      mediaData = mediaRes.data || [];
      if (mediaRes.error) {
        console.error('createSession: error fetching media', mediaRes.error);
      }
      console.log(
        'createSession: fetched media count =',
        Array.isArray(mediaData) ? mediaData.length : typeof mediaData
      );
    }

    // Build media map with public URLs
    const mediaMap = new Map();
    for (const m of mediaData) {
      if (!m.file_path) continue;

      // Generate public URL from Supabase storage
      const { data: urlData } = supabase
        .storage
        .from('question-images')
        .getPublicUrl(m.file_path);

      if (urlData?.publicUrl) {
        if (!mediaMap.has(m.question_id)) {
          mediaMap.set(m.question_id, []);
        }
        mediaMap.get(m.question_id).push({
          mediaId: m.media_id,
          url: urlData.publicUrl,
          type: m.media_type,
          fileName: m.file_name,
        });
      }
    }

    console.log('createSession: mediaMap size =', mediaMap.size);
    if (mediaMap.size > 0) {
      console.log('createSession: Questions WITH media:', Array.from(mediaMap.keys()));
      const firstMediaEntry = Array.from(mediaMap.entries())[0];
      console.log('createSession: First media entry:', {
        questionId: firstMediaEntry[0],
        mediaArray: firstMediaEntry[1]
      });
    }

    // Build final payload
    const questionsPayload = (questionsData || []).map((q) => {
      const questionMedia = mediaMap.get(q.question_id) || [];
      console.log(`📸 Q${q.question_id} media lookup:`, {
        hasMedia: questionMedia.length > 0,
        count: questionMedia.length
      });
      return {
        testQuestionId: q.test_question_id,
        questionId: q.question_id,
        order: q.question_order,
        text: q.questions?.question_text || '',
        type: q.questions?.question_type || 'mcq',
        marks: q.marks_allocated || q.questions?.marks || 0,
        negative: q.negative_marks_allocated || q.questions?.negative_marks || 0,
        metadata: q.questions?.metadata || {},
        options: optionsMap.get(q.question_id) || [],
        media: questionMedia,
      };
    });

    console.log('createSession: questionsPayload length =', questionsPayload.length);
    if (questionsPayload.length > 0) {
      console.log('createSession: sample question payload (first):', {
        testQuestionId: questionsPayload[0].testQuestionId,
        questionId: questionsPayload[0].questionId,
        optionsCount: questionsPayload[0].options.length,
        mediaCount: questionsPayload[0].media?.length || 0,
        mediaSample: questionsPayload[0].media?.[0],
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        sessionToken,
        attemptId: attempt.attempt_id,
        test: {
          testId: test.test_id,
          name: test.test_name,
          durationMinutes: test.duration_minutes,
          totalQuestions: test.total_questions,
          totalMarks: test.total_marks,
        },
        questions: questionsPayload,
      },
    });
  } catch (error) {
    console.error('createSession error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Server error creating session' });
  }
};

/**
 * PATCH /api/sessions/:sessionToken/answers
 * Body: { answers: [{ questionId, selectedOptionId, answerText, timeSpentSeconds }], lastSeenIndex? }
 * Upserts answers (attempt_answers). Requires the session -> attempt mapping.
 */
export const autosaveAnswers = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionToken } = req.params;
    const { answers } = req.body;
    if (!Array.isArray(answers))
      return res
        .status(400)
        .json({ success: false, message: 'answers array required' });

    // Find session & attempt
    const { data: session } = await supabase
      .from('test_sessions')
      .select('test_session_id, attempt_id')
      .eq('session_token', sessionToken)
      .single();

    if (!session)
      return res
        .status(404)
        .json({ success: false, message: 'Session not found' });

    // Ensure attempt belongs to user
    const { data: attempt } = await supabase
      .from('test_attempts')
      .select('attempt_id, user_id')
      .eq('attempt_id', session.attempt_id)
      .single();

    if (!attempt || attempt.user_id !== userId)
      return res
        .status(403)
        .json({ success: false, message: 'Not allowed' });

    // For each answer: insert or update attempt_answers (match on attempt_id & question_id)
    for (const a of answers) {
      const insertPayload = {
        attempt_id: attempt.attempt_id,
        question_id: a.questionId,
        selected_option_id: a.selectedOptionId ?? null,
        answer_text: a.answerText ?? null,
        time_spent_seconds: a.timeSpentSeconds || 0,
        answered_at: new Date().toISOString(),
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('Autosaving answer:', {
          questionId: a.questionId,
          selectedOptionId: a.selectedOptionId,
          selectedOptionIdType: typeof a.selectedOptionId
        });
      }

      const { data: existing } = await supabase
        .from('attempt_answers')
        .select('answer_id')
        .eq('attempt_id', attempt.attempt_id)
        .eq('question_id', a.questionId)
        .single();

      if (existing) {
        await supabase
          .from('attempt_answers')
          .update(insertPayload)
          .eq('answer_id', existing.answer_id);
      } else {
        await supabase.from('attempt_answers').insert([insertPayload]);
      }
    }

    // Update last activity timestamp on test_attempts
    await supabase
      .from('test_attempts')
      .update({ end_time: new Date().toISOString() })
      .eq('attempt_id', attempt.attempt_id);

    return res.status(200).json({ success: true, message: 'Answers saved' });
  } catch (error) {
    console.error('autosaveAnswers error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Server error autosaving answers' });
  }
};

/**
 * POST /api/sessions/:sessionToken/submit
 * Finalize attempt: grade, update totals, mark attempt_status completed
 */
export const submitSession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionToken } = req.params;

    // Locate session and attempt
    const { data: session } = await supabase
      .from('test_sessions')
      .select('test_session_id, attempt_id')
      .eq('session_token', sessionToken)
      .single();

    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: 'Session not found' });
    }

    const { data: attempt } = await supabase
      .from('test_attempts')
      .select('*')
      .eq('attempt_id', session.attempt_id)
      .single();

    if (!attempt || attempt.user_id !== userId) {
      return res
        .status(403)
        .json({ success: false, message: 'Not allowed' });
    }

    // Clean up any duplicate in_progress attempts for this user/test
    // This handles orphaned rows from React StrictMode race conditions
    await supabase
      .from('test_attempts')
      .delete()
      .eq('user_id', userId)
      .eq('test_id', attempt.test_id)
      .eq('attempt_status', 'in_progress')
      .neq('attempt_id', attempt.attempt_id);


    // Fetch answers (may be empty if autosave failed)
    const { data: answers = [] } = await supabase
      .from('attempt_answers')
      .select(
        'answer_id, question_id, selected_option_id, answer_text, time_spent_seconds'
      )
      .eq('attempt_id', attempt.attempt_id);

    // Fetch test_questions for marks & full question set
    const { data: tQuestions = [] } = await supabase
      .from('test_questions')
      .select('question_id, marks_allocated, negative_marks_allocated')
      .eq('test_id', attempt.test_id);

    const marksMap = new Map();
    const allQuestionIds = [];
    for (const tq of tQuestions) {
      marksMap.set(tq.question_id, {
        marks: Number(tq.marks_allocated || 0),
        negative: Number(tq.negative_marks_allocated || 0),
      });
      allQuestionIds.push(tq.question_id);
    }

    // If there are no answers at all, treat every question as unattempted
    if (!answers.length) {
      let totalPossible = 0;
      for (const qid of allQuestionIds) {
        const m = marksMap.get(qid);
        if (m) totalPossible += m.marks;
      }

      const unansweredCount = allQuestionIds.length;
      await supabase
        .from('test_attempts')
        .update({
          end_time: new Date().toISOString(),
          submit_time: new Date().toISOString(),
          attempt_status: 'completed',
          total_marks_obtained: 0,
          percentage: 0,
          correct_answers: 0,
          incorrect_answers: 0,
          unanswered: unansweredCount,
          proctoring_data: attempt.proctoring_data || {},
        })
        .eq('attempt_id', attempt.attempt_id);

      await supabase.from('leaderboards').insert([
        {
          test_id: attempt.test_id,
          user_id: attempt.user_id,
          rank_position: null,
          score: 0,
          completion_time_seconds:
            attempt.end_time && attempt.start_time
              ? Math.floor(
                (new Date(attempt.end_time) - new Date(attempt.start_time)) /
                1000
              )
              : null,
          attempt_date: new Date().toISOString(),
        },
      ]);

      return res.status(200).json({
        success: true,
        data: {
          attemptId: attempt.attempt_id,
          score: 0,
          percentage: 0,
          correct: 0,
          incorrect: 0,
          unanswered: unansweredCount,
          totalPossible,
        },
      });
    }

    // Fetch correct options only for answered questions (MCQs / T/F)
    const answeredQIds = answers.map((a) => a.question_id);
    const { data: correctOptions = [] } = await supabase
      .from('question_options')
      .select('option_id, question_id, is_correct')
      .in('question_id', answeredQIds);

    const correctMap = new Map();
    for (const o of correctOptions) {
      if (o.is_correct) correctMap.set(o.question_id, o.option_id);
    }

    // Grade
    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;
    let totalObtained = 0;
    let totalPossible = 0;
    const perQuestionResults = [];

    for (const qid of allQuestionIds) {
      const marksInfo = marksMap.get(qid) || { marks: 0, negative: 0 };
      totalPossible += marksInfo.marks;

      const ans = answers.find((a) => a.question_id === qid);

      // No answer stored or selected_option_id null => unattempted
      if (!ans || ans.selected_option_id == null) {
        unattempted++;
        perQuestionResults.push({
          questionId: qid,
          marksObtained: 0,
          isCorrect: false,
        });
        continue;
      }

      const sel = ans.selected_option_id;
      const correctOptionId = correctMap.get(qid);

      // If no correct option (numerical / subjective), treat as unattempted for now
      if (!correctOptionId) {
        unattempted++;
        perQuestionResults.push({
          questionId: qid,
          marksObtained: 0,
          isCorrect: false,
        });
        continue;
      }

      const isCorrect = Number(correctOptionId) === Number(sel);
      if (isCorrect) {
        correct++;
        totalObtained += marksInfo.marks;
        perQuestionResults.push({
          questionId: qid,
          marksObtained: marksInfo.marks,
          isCorrect: true,
        });
      } else {
        incorrect++;
        const neg = marksInfo.negative || 0;
        totalObtained -= neg;
        perQuestionResults.push({
          questionId: qid,
          marksObtained: -neg,
          isCorrect: false,
        });
      }
    }

    if (totalObtained < 0) totalObtained = 0;
    const percentage =
      totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;

    const { error: updErr } = await supabase
      .from('test_attempts')
      .update({
        end_time: new Date().toISOString(),
        submit_time: new Date().toISOString(),
        attempt_status: 'completed',
        total_marks_obtained: totalObtained,
        percentage,
        correct_answers: correct,
        incorrect_answers: incorrect,
        unanswered: unattempted,
        proctoring_data: attempt.proctoring_data || {},
      })
      .eq('attempt_id', attempt.attempt_id);

    await supabase
      .from('test_sessions')
      .update({ session_end: new Date().toISOString() })
      .eq('attempt_id', attempt.attempt_id);

    if (updErr) {
      console.error('Error updating attempt', updErr);
    }

    // Save per-question marks into attempt_answers
    for (const pq of perQuestionResults) {
      await supabase
        .from('attempt_answers')
        .update({
          marks_obtained: pq.marksObtained,
          is_correct: pq.isCorrect,
        })
        .eq('attempt_id', attempt.attempt_id)
        .eq('question_id', pq.questionId);
    }

    await supabase.from('leaderboards').insert([
      {
        test_id: attempt.test_id,
        user_id: attempt.user_id,
        rank_position: null,
        score: totalObtained,
        completion_time_seconds:
          attempt.end_time && attempt.start_time
            ? Math.floor(
              (new Date(attempt.end_time) - new Date(attempt.start_time)) /
              1000
            )
            : null,
        attempt_date: new Date().toISOString(),
      },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        attemptId: attempt.attempt_id,
        score: totalObtained,
        percentage: Number(percentage.toFixed(2)),
        correct,
        incorrect,
        unanswered: unattempted,
        totalPossible,
      },
    });
  } catch (error) {
    console.error('submitSession error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Server error submitting session' });
  }
};

/**
 * POST /api/sessions/:sessionToken/events
 * Body: { type, metadata }
 * Logs proctoring events into proctoring_events table and updates session counts.
 */
export const postSessionEvent = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionToken } = req.params;
    const { type, metadata = {} } = req.body;

    // Validate type
    const validTypes = [
      'tab_switch',
      'fullscreen_exit',
      'screenshot',
      'face_detection',
      'multiple_faces',
      'heartbeat',
    ];
    if (!validTypes.includes(type))
      return res
        .status(400)
        .json({ success: false, message: 'Invalid event type' });

    // Find session id & attempt id
    const { data: session } = await supabase
      .from('test_sessions')
      .select(
        'test_session_id, attempt_id, tab_switches, screenshot_count, violation_count'
      )
      .eq('session_token', sessionToken)
      .single();

    if (!session)
      return res
        .status(404)
        .json({ success: false, message: 'Session not found' });

    // Insert proctoring event
    await supabase.from('proctoring_events').insert([
      {
        test_session_id: session.test_session_id,
        event_type: type,
        event_details: metadata,
        severity: metadata.severity || 'low',
      },
    ]);

    // Update counters on test_sessions for quick lookups
    const updates = {};
    if (type === 'tab_switch')
      updates.tab_switches = (session.tab_switches || 0) + 1;
    if (type === 'screenshot')
      updates.screenshot_count = (session.screenshot_count || 0) + 1;
    if (['multiple_faces', 'face_detection'].includes(type))
      updates.violation_count = (session.violation_count || 0) + 1;

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('test_sessions')
        .update(updates)
        .eq('test_session_id', session.test_session_id);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('postSessionEvent error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Server error logging event' });
  }
};

/**
 * GET /api/sessions/:sessionToken
 * Returns basic session & attempt status (time left can be computed by client using test.durationMinutes + start_time)
 */
export const getSessionStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionToken } = req.params;

    const { data: session } = await supabase
      .from('test_sessions')
      .select(
        `
        test_session_id,
        attempt_id,
        session_start,
        session_end,
        tab_switches,
        screenshot_count,
        violation_count
      `
      )
      .eq('session_token', sessionToken)
      .single();

    if (!session)
      return res
        .status(404)
        .json({ success: false, message: 'Session not found' });

    const { data: attempt } = await supabase
      .from('test_attempts')
      .select('attempt_id, test_id, start_time, end_time, attempt_status')
      .eq('attempt_id', session.attempt_id)
      .single();

    if (!attempt)
      return res
        .status(404)
        .json({ success: false, message: 'Attempt not found' });

    // Basic payload
    return res.status(200).json({
      success: true,
      data: {
        session: {
          id: session.test_session_id,
          sessionStart: session.session_start,
          tabSwitches: session.tab_switches || 0,
          screenshotCount: session.screenshot_count || 0,
          violationCount: session.violation_count || 0,
        },
        attempt: {
          attemptId: attempt.attempt_id,
          testId: attempt.test_id,
          startTime: attempt.start_time,
          status: attempt.attempt_status,
        },
      },
    });
  } catch (error) {
    console.error('getSessionStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching session status',
    });
  }
};
