import { supabase } from '../config/supabase.js';

/**
 * Middleware to check if user has required plan
 * @param {Array<string>} requiredPlans - Array of plan names that have access
 */
export const requirePlan = (...requiredPlans) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.userId;

            // Get user's active subscription
            const { data, error } = await supabase
                .rpc('get_user_active_subscription', { p_user_id: userId });

            if (error) {
                console.error('Error checking plan access:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to verify subscription'
                });
            }

            let userPlan = 'Free'; // Default to free plan

            if (data && data.length > 0) {
                userPlan = data[0].plan_name;
            }

            // Check if user's plan is in the required plans
            const hasAccess = requiredPlans.some(plan =>
                userPlan.toLowerCase().includes(plan.toLowerCase())
            );

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: `This feature requires ${requiredPlans.join(' or ')} plan`,
                    currentPlan: userPlan,
                    requiredPlans: requiredPlans,
                    upgradeRequired: true
                });
            }

            // Attach plan info to request
            req.userPlan = userPlan;
            next();
        } catch (error) {
            console.error('Plan access middleware error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error while checking plan access'
            });
        }
    };
};

/**
 * Middleware to check if user has access to a specific feature
 * @param {string} featureName - Name of the feature to check
 */
export const requireFeature = (featureName) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.userId;

            const { data: hasAccess, error } = await supabase
                .rpc('check_user_feature_access', {
                    p_user_id: userId,
                    p_feature_name: featureName
                });

            if (error) {
                console.error('Error checking feature access:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to verify feature access'
                });
            }

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: `This feature is not available in your current plan`,
                    feature: featureName,
                    upgradeRequired: true
                });
            }

            next();
        } catch (error) {
            console.error('Feature access middleware error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error while checking feature access'
            });
        }
    };
};

/**
 * Middleware to check test limits before allowing test attempt
 * @param {string} testType - Type of test: 'chapter', 'subject', or 'mock'
 */
export const checkTestLimit = (testType) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.userId;

            // Get user's test limits
            const { data, error } = await supabase
                .rpc('get_user_test_limits', { p_user_id: userId });

            if (error) {
                console.error('Error checking test limits:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to verify test limits'
                });
            }

            // Find the limit for the specific test type
            const limitInfo = data.find(d => d.test_type === testType);

            if (!limitInfo) {
                // If no limit info found, deny access
                return res.status(403).json({
                    success: false,
                    message: 'Unable to verify test access',
                    upgradeRequired: true
                });
            }

            // Check if user has reached the limit
            // -1 means unlimited
            if (limitInfo.limit_value !== -1 && limitInfo.remaining <= 0) {
                return res.status(403).json({
                    success: false,
                    message: `You have reached your ${testType} test limit`,
                    testType: testType,
                    limit: limitInfo.limit_value,
                    used: limitInfo.current_usage,
                    remaining: 0,
                    upgradeRequired: true
                });
            }

            // Attach limit info to request
            req.testLimitInfo = limitInfo;
            next();
        } catch (error) {
            console.error('Test limit middleware error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error while checking test limits'
            });
        }
    };
};

/**
 * Get user's accessible plan IDs based on their subscription tier
 * Free (1) can access: [1]
 * Premium (2) can access: [1, 2]
 * Elite (3) can access: [1, 2, 3]
 * @param {number} userId 
 * @returns {Promise<{planId: number, accessiblePlanIds: number[]}>}
 */
export const getUserAccessiblePlanIds = async (userId) => {
    try {
        const { data, error } = await supabase
            .rpc('get_user_active_subscription', { p_user_id: userId });

        if (error) {
            console.error('Error getting user subscription:', error);
            // Default to Free plan on error
            return { planId: 1, accessiblePlanIds: [1] };
        }

        let userPlanId = 1; // Default to Free plan

        if (data && data.length > 0) {
            userPlanId = data[0].plan_id;
        }

        // Generate array of accessible plan IDs
        // User can access their plan and all lower tiers
        const accessiblePlanIds = [];
        for (let i = 1; i <= userPlanId; i++) {
            accessiblePlanIds.push(i);
        }

        return { planId: userPlanId, accessiblePlanIds };
    } catch (error) {
        console.error('Error in getUserAccessiblePlanIds:', error);
        // Default to Free plan on error
        return { planId: 1, accessiblePlanIds: [1] };
    }
};

/**
 * Helper function to get user's plan features
 * Can be used in controllers without middleware
 */
export const getUserPlanFeatures = async (userId) => {
    try {
        const { data, error } = await supabase
            .rpc('get_user_active_subscription', { p_user_id: userId });

        if (error) {
            throw error;
        }

        if (data && data.length > 0) {
            return data[0].features;
        }

        // Return free plan features
        const { data: freePlan } = await supabase
            .from('payment_plans')
            .select('features')
            .eq('plan_name', 'Free')
            .single();

        return freePlan?.features || {};
    } catch (error) {
        console.error('Error getting user plan features:', error);
        return {};
    }
};

export default {
    requirePlan,
    requireFeature,
    checkTestLimit,
    getUserPlanFeatures,
    getUserAccessiblePlanIds
};
