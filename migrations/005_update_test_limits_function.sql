-- Migration: Create/Update function to get user test limits from new plan structure
-- This reads the attempts from the plan features JSON

-- Drop ALL existing versions of the function
DROP FUNCTION IF EXISTS get_user_test_limits(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_user_test_limits(integer) CASCADE;
DROP FUNCTION IF EXISTS get_user_test_limits(text) CASCADE;
DROP FUNCTION IF EXISTS get_user_test_limits CASCADE;

-- Create updated function to calculate test limits from new plan structure
-- NOTE: user_id is INTEGER, not UUID
CREATE OR REPLACE FUNCTION get_user_test_limits(p_user_id integer)
RETURNS TABLE (
    test_type text,
    limit_value integer,
    current_usage integer,
    remaining integer
) AS $$
DECLARE
    v_plan_features jsonb;
    v_mock_attempts integer;
    v_chapter_attempts integer;
    v_mock_usage integer;
    v_chapter_usage integer;
BEGIN
    -- Get user's current active subscription plan features
    SELECT p.features INTO v_plan_features
    FROM user_subscriptions us
    JOIN payment_plans p ON us.plan_id = p.plan_id
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
      AND us.end_date >= NOW()
    ORDER BY us.end_date DESC
    LIMIT 1;

    -- If no active subscription, use Free plan
    IF v_plan_features IS NULL THEN
        SELECT features INTO v_plan_features
        FROM payment_plans
        WHERE plan_name = 'Free'
        LIMIT 1;
    END IF;

    -- Extract attempt limits from new plan structure
    -- Premium: mockAttempts: 90, chapterAttempts: 100
    -- Elite: mockAttempts: 150, chapterAttempts: 150
    v_mock_attempts := COALESCE(
        (v_plan_features->'full_size_tests'->>'attempts')::integer,
        3  -- Free plan default
    );
    
    v_chapter_attempts := COALESCE(
        (v_plan_features->'chapter_tests'->>'attempts')::integer,
        10  -- Free plan default
    );

    -- Count current usage from test_attempts table
    SELECT COUNT(*) INTO v_mock_usage
    FROM test_attempts ta
    JOIN tests t ON ta.test_id = t.test_id
    WHERE ta.user_id = p_user_id
      AND t.test_type IN ('mock', 'assessment');

    SELECT COUNT(*) INTO v_chapter_usage
    FROM test_attempts ta
    JOIN tests t ON ta.test_id = t.test_id
    WHERE ta.user_id = p_user_id
      AND t.test_type = 'practice';

    -- Return mock test limits
    RETURN QUERY SELECT
        'mock'::text,
        v_mock_attempts,
        COALESCE(v_mock_usage, 0),
        GREATEST(v_mock_attempts - COALESCE(v_mock_usage, 0), 0);

    -- Return chapter/practice test limits
    RETURN QUERY SELECT
        'chapter'::text,
        v_chapter_attempts,
        COALESCE(v_chapter_usage, 0),
        GREATEST(v_chapter_attempts - COALESCE(v_chapter_usage, 0), 0);

    -- Return subject test limits (using chapter attempts for now)
    RETURN QUERY SELECT
        'subject'::text,
        v_chapter_attempts,
        COALESCE(v_chapter_usage, 0),
        GREATEST(v_chapter_attempts - COALESCE(v_chapter_usage, 0), 0);

END;
$$ LANGUAGE plpgsql;

-- Verify function works (uncomment with actual user ID to test)
-- SELECT * FROM get_user_test_limits(13);
