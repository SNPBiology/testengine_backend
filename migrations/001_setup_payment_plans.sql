-- Migration: Setup Payment Plans with Features
-- This creates the initial Free, Premium, and Elite plans with configurable limits

-- First, ensure the payment_plans table has all necessary fields
-- The existing table should already have: plan_id, plan_name, description, price, validity_days, plan_type, features, is_active

-- Insert default payment plans
INSERT INTO payment_plans (plan_name, description, price, validity_days, plan_type, features, is_active) VALUES
(
  'Free',
  'Get started with basic features',
  0,
  0, -- Permanent
  'subscription',
  '{
    "chapter_tests_limit": 10,
    "subject_tests_limit": 5,
    "mock_tests_limit": 1,
    "advanced_analytics": false,
    "detailed_solutions": false,
    "all_india_ranking": false,
    "doubt_support": false,
    "personalized_study_plan": false,
    "proctoring": false
  }'::jsonb,
  true
),
(
  'Premium',
  'Most popular for serious aspirants',
  999,
  30, -- Monthly
  'subscription',
  '{
    "chapter_tests_limit": -1,
    "subject_tests_limit": -1,
    "mock_tests_limit": 20,
    "advanced_analytics": true,
    "detailed_solutions": true,
    "all_india_ranking": true,
    "doubt_support": true,
    "personalized_study_plan": true,
    "proctoring": true,
    "priority_support": true
  }'::jsonb,
  true
),
(
  'Premium Annual',
  'Most popular for serious aspirants - Annual billing',
  9999,
  365, -- Annual
  'subscription',
  '{
    "chapter_tests_limit": -1,
    "subject_tests_limit": -1,
    "mock_tests_limit": 20,
    "advanced_analytics": true,
    "detailed_solutions": true,
    "all_india_ranking": true,
    "doubt_support": true,
    "personalized_study_plan": true,
    "proctoring": true,
    "priority_support": true
  }'::jsonb,
  true
),
(
  'Elite',
  'For top rankers with extra features',
  1499,
  30, -- Monthly
  'subscription',
  '{
    "chapter_tests_limit": -1,
    "subject_tests_limit": -1,
    "mock_tests_limit": 50,
    "advanced_analytics": true,
    "detailed_solutions": true,
    "all_india_ranking": true,
    "doubt_support": true,
    "personalized_study_plan": true,
    "proctoring": true,
    "one_on_one_mentoring": true,
    "custom_test_generator": true,
    "phone_support": true,
    "priority_support": true
  }'::jsonb,
  true
),
(
  'Elite Annual',
  'For top rankers with extra features - Annual billing',
  14999,
  365, -- Annual
  'subscription',
  '{
    "chapter_tests_limit": -1,
    "subject_tests_limit": -1,
    "mock_tests_limit": 50,
    "advanced_analytics": true,
    "detailed_solutions": true,
    "all_india_ranking": true,
    "doubt_support": true,
    "personalized_study_plan": true,
    "proctoring": true,
    "one_on_one_mentoring": true,
    "custom_test_generator": true,
    "phone_support": true,
    "priority_support": true
  }'::jsonb,
  true
)
ON CONFLICT DO NOTHING;

-- Create function to get user's current active subscription
CREATE OR REPLACE FUNCTION get_user_active_subscription(p_user_id INTEGER)
RETURNS TABLE (
  subscription_id INTEGER,
  plan_id INTEGER,
  plan_name VARCHAR,
  features JSONB,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.subscription_id,
    us.plan_id,
    pp.plan_name,
    pp.features,
    us.start_date,
    us.end_date,
    us.status
  FROM user_subscriptions us
  JOIN payment_plans pp ON us.plan_id = pp.plan_id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
    AND (us.end_date IS NULL OR us.end_date > NOW())
  ORDER BY us.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if user has access to a feature
CREATE OR REPLACE FUNCTION check_user_feature_access(p_user_id INTEGER, p_feature_name VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_access BOOLEAN;
  v_features JSONB;
BEGIN
  -- Get user's active subscription features
  SELECT features INTO v_features
  FROM get_user_active_subscription(p_user_id);
  
  -- If no subscription found, check for free plan
  IF v_features IS NULL THEN
    SELECT features INTO v_features
    FROM payment_plans
    WHERE plan_name = 'Free'
    LIMIT 1;
  END IF;
  
  -- Check if feature exists and is true
  v_has_access := COALESCE((v_features->>p_feature_name)::BOOLEAN, false);
  
  RETURN v_has_access;
END;
$$ LANGUAGE plpgsql;

-- Create function to get test usage limits and current usage
CREATE OR REPLACE FUNCTION get_user_test_limits(p_user_id INTEGER)
RETURNS TABLE (
  test_type VARCHAR,
  limit_value INTEGER,
  current_usage INTEGER,
  remaining INTEGER
) AS $$
DECLARE
  v_features JSONB;
  v_chapter_limit INTEGER;
  v_subject_limit INTEGER;
  v_mock_limit INTEGER;
BEGIN
  -- Get user's plan features
  SELECT features INTO v_features
  FROM get_user_active_subscription(p_user_id);
  
  -- If no subscription, use free plan
  IF v_features IS NULL THEN
    SELECT features INTO v_features
    FROM payment_plans
    WHERE plan_name = 'Free'
    LIMIT 1;
  END IF;
  
  -- Extract limits (-1 means unlimited)
  v_chapter_limit := (v_features->>'chapter_tests_limit')::INTEGER;
  v_subject_limit := (v_features->>'subject_tests_limit')::INTEGER;
  v_mock_limit := (v_features->>'mock_tests_limit')::INTEGER;
  
  -- Return chapter tests
  RETURN QUERY
  SELECT 
    'chapter'::VARCHAR,
    v_chapter_limit,
    COUNT(*)::INTEGER,
    CASE 
      WHEN v_chapter_limit = -1 THEN -1
      ELSE GREATEST(0, v_chapter_limit - COUNT(*)::INTEGER)
    END
  FROM test_attempts ta
  JOIN tests t ON ta.test_id = t.test_id
  WHERE ta.user_id = p_user_id
    AND t.test_type = 'practice'
    AND t.metadata->>'test_category' = 'chapter';
  
  -- Return subject tests
  RETURN QUERY
  SELECT 
    'subject'::VARCHAR,
    v_subject_limit,
    COUNT(*)::INTEGER,
    CASE 
      WHEN v_subject_limit = -1 THEN -1
      ELSE GREATEST(0, v_subject_limit - COUNT(*)::INTEGER)
    END
  FROM test_attempts ta
  JOIN tests t ON ta.test_id = t.test_id
  WHERE ta.user_id = p_user_id
    AND t.test_type = 'practice'
    AND t.metadata->>'test_category' = 'subject';
  
  -- Return mock tests
  RETURN QUERY
  SELECT 
    'mock'::VARCHAR,
    v_mock_limit,
    COUNT(*)::INTEGER,
    CASE 
      WHEN v_mock_limit = -1 THEN -1
      ELSE GREATEST(0, v_mock_limit - COUNT(*)::INTEGER)
    END
  FROM test_attempts ta
  JOIN tests t ON ta.test_id = t.test_id
  WHERE ta.user_id = p_user_id
    AND t.test_type = 'mock';
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically assign free plan to new users
CREATE OR REPLACE FUNCTION assign_free_plan_to_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_free_plan_id INTEGER;
BEGIN
  -- Get the Free plan ID
  SELECT plan_id INTO v_free_plan_id
  FROM payment_plans
  WHERE plan_name = 'Free'
  LIMIT 1;
  
  -- Create subscription for new user
  IF v_free_plan_id IS NOT NULL THEN
    INSERT INTO user_subscriptions (
      user_id,
      plan_id,
      start_date,
      end_date,
      status,
      auto_renewal
    ) VALUES (
      NEW.user_id,
      v_free_plan_id,
      NOW(),
      '2099-12-31'::TIMESTAMP, -- Far future date for free plan (never expires)
      'active',
      false
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_assign_free_plan ON users;
CREATE TRIGGER trigger_assign_free_plan
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION assign_free_plan_to_new_user();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON user_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_dates ON user_subscriptions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_test_attempts_user_test ON test_attempts(user_id, test_id);
CREATE INDEX IF NOT EXISTS idx_tests_type_metadata ON tests(test_type, metadata);

-- Add comment to features column for documentation
COMMENT ON COLUMN payment_plans.features IS 'JSON object containing plan features. Use -1 for unlimited limits. Example: {"chapter_tests_limit": -1, "mock_tests_limit": 20, "advanced_analytics": true}';
