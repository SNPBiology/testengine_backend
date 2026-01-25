-- Migration: Replace all pricing plans with new annual structure
-- Drops old plans and inserts Premium Annual (₹2,500) and Elite Annual (₹4,500)

-- Step 1: Delete all existing plans (clean slate)
DELETE FROM payment_plans;

-- Step 2: Reset the sequence (optional, for clean IDs starting from 1)
ALTER SEQUENCE payment_plans_plan_id_seq RESTART WITH 1;

-- Step 3: Insert Free Plan
INSERT INTO payment_plans (
  plan_name,
  description,
  price,
  validity_days,
  plan_type,
  features,
  is_active,
  created_at,
  updated_at
) VALUES (
  'Free',
  'Basic access to get started with test preparation',
  0.00,
  999999, -- Lifetime
  'subscription', -- Changed from 'free' to match constraint
  '{
    "full_size_tests": {
      "count": 3,
      "subjects": ["Physics", "Chemistry", "Biology"],
      "attempts": "limited"
    },
    "chapter_tests": {
      "available": true,
      "subjects": ["Physics", "Chemistry", "Biology"],
      "attempts": 10
    },
    "doubt_support": false,
    "analytics": "basic",
    "leaderboard": false,
    "priority_support": false,
    "features_list": [
      "3 Mock Tests",
      "10 Chapter Tests",
      "Basic Analytics",
      "Email Support"
    ],
    "limitations": [
      "Limited Test Attempts",
      "No Doubt Support",
      "No Leaderboard"
    ]
  }'::jsonb,
  true,
  NOW(),
  NOW()
);

-- Step 4: Insert Premium Annual Plan
INSERT INTO payment_plans (
  plan_name,
  description,
  price,
  validity_days,
  plan_type,
  features,
  is_active,
  created_at,
  updated_at
) VALUES (
  'Premium Annual',
  'Biology-focused NEET preparation with 19 full-size tests and chapter-wise practice',
  2500.00,
  365,
  'subscription',
  '{
    "original_price": 4500,
    "discount_percent": 44,
    "badge": "44% OFF",
    "popular": true,
    "full_size_tests": {
      "count": 19,
      "subjects": ["Biology"],
      "attempts": 90,
      "description": "Biology NEET mock tests"
    },
    "chapter_tests": {
      "available": true,
      "subjects": ["Biology"],
      "attempts": 100,
      "description": "Chapter-wise practice tests"
    },
    "doubt_support": false,
    "analytics": "advanced",
    "leaderboard": true,
    "priority_support": false,
    "features_list": [
      "19 Full-Size Tests (Biology)",
      "90 Mock Test Attempts",
      "Chapter-Wise Tests (Biology)",
      "100 Chapter Test Attempts",
      "Advanced Analytics",
      "Leaderboard Access",
      "Detailed Solutions",
      "Progress Tracking"
    ],
    "limitations": [
      "Biology Only",
      "No Doubt Support"
    ]
  }'::jsonb,
  true,
  NOW(),
  NOW()
);

-- Step 5: Insert Elite Annual Plan
INSERT INTO payment_plans (
  plan_name,
  description,
  price,
  validity_days,
  plan_type,
  features,
  is_active,
  created_at,
  updated_at
) VALUES (
  'Elite Annual',
  'Complete NEET preparation with Physics, Chemistry, and Biology tests plus doubt clearing',
  4500.00,
  365,
  'subscription',
  '{
    "original_price": 6500,
    "discount_percent": 31,
    "badge": "31% OFF",
    "recommended": true,
    "full_size_tests": {
      "count": 10,
      "subjects": ["Physics", "Chemistry", "Biology"],
      "attempts": 150,
      "description": "Complete NEET mock tests (PCB)"
    },
    "chapter_tests": {
      "available": true,
      "subjects": ["Physics", "Chemistry", "Biology"],
      "attempts": 150,
      "description": "All subjects chapter-wise tests"
    },
    "doubt_support": {
      "available": true,
      "subjects": ["Biology"],
      "response_time": "24-48 hours",
      "description": "Expert Biology doubt clearing"
    },
    "analytics": "advanced",
    "leaderboard": true,
    "priority_support": true,
    "features_list": [
      "10 Full NEET Tests (PCB)",
      "150 Mock Test Attempts",
      "Chapter Tests (All Subjects)",
      "150 Chapter Test Attempts",
      "Biology Doubt Clearing",
      "Advanced Analytics",
      "Priority Support",
      "Leaderboard Access",
      "All Subjects (Physics, Chemistry, Biology)"
    ],
    "limitations": []
  }'::jsonb,
  true,
  NOW(),
  NOW()
);

-- Step 6: Verify the migration
SELECT 
  plan_id,
  plan_name,
  price,
  validity_days,
  plan_type,
  is_active,
  features->>'original_price' as original_price,
  features->>'badge' as discount_badge,
  features->'full_size_tests'->>'count' as test_count,
  features->'full_size_tests'->'subjects' as subjects
FROM payment_plans
ORDER BY price ASC;
