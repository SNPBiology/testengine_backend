import { supabase } from '../config/supabase.js';
import { razorpayService } from '../services/razorpayService.js';

// Get user's current subscription
export const getCurrentSubscription = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get active subscription with plan details
        const { data, error } = await supabase
            .rpc('get_user_active_subscription', { p_user_id: userId });

        if (error) {
            console.error('Error fetching subscription:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch subscription'
            });
        }

        // If no active subscription, return free plan
        if (!data || data.length === 0) {
            const { data: freePlan } = await supabase
                .from('payment_plans')
                .select('*')
                .eq('plan_name', 'Free')
                .single();

            return res.status(200).json({
                success: true,
                data: {
                    plan_name: 'Free',
                    features: freePlan?.features || {},
                    status: 'active',
                    is_free: true
                }
            });
        }

        res.status(200).json({
            success: true,
            data: {
                ...data[0],
                is_free: data[0].plan_name === 'Free'
            }
        });
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching subscription'
        });
    }
};

// Get user's test limits and usage
export const getTestLimits = async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data, error } = await supabase
            .rpc('get_user_test_limits', { p_user_id: userId });

        if (error) {
            console.error('Error fetching test limits:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch test limits'
            });
        }

        // Format the response
        const limits = {
            chapter: data.find(d => d.test_type === 'chapter') || { limit_value: 0, current_usage: 0, remaining: 0 },
            subject: data.find(d => d.test_type === 'subject') || { limit_value: 0, current_usage: 0, remaining: 0 },
            mock: data.find(d => d.test_type === 'mock') || { limit_value: 0, current_usage: 0, remaining: 0 }
        };

        res.status(200).json({
            success: true,
            data: limits
        });
    } catch (error) {
        console.error('Get test limits error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching test limits'
        });
    }
};

// Check if user can access a specific feature
export const checkFeatureAccess = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { featureName } = req.params;

        const { data, error } = await supabase
            .rpc('check_user_feature_access', {
                p_user_id: userId,
                p_feature_name: featureName
            });

        if (error) {
            console.error('Error checking feature access:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to check feature access'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                hasAccess: data,
                feature: featureName
            }
        });
    } catch (error) {
        console.error('Check feature access error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while checking feature access'
        });
    }
};

// Get all available plans
export const getAllPlans = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('payment_plans')
            .select('*')
            .eq('is_active', true)
            .order('price', { ascending: true });

        if (error) {
            console.error('Error fetching plans:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch plans'
            });
        }

        // Format plans for frontend with new annual structure
        const formattedPlans = data.map(plan => {
            const features = plan.features || {};

            return {
                id: plan.plan_id,
                name: plan.plan_name,
                price: plan.price,
                originalPrice: features.original_price || null,
                discountPercent: features.discount_percent || 0,
                badge: features.badge || null,
                validityDays: plan.validity_days,
                period: plan.validity_days >= 365 ? 'year' : (plan.validity_days > 50 ? 'month' : 'Forever'),
                description: plan.description,
                popular: features.popular || false,
                recommended: features.recommended || false,

                // Test limits
                testLimits: {
                    mockTests: features.full_size_tests?.count || 0,
                    mockAttempts: features.full_size_tests?.attempts || 'limited',
                    chapterAttempts: features.chapter_tests?.attempts || 0,
                    subjects: features.full_size_tests?.subjects || []
                },

                // Feature flags
                features: {
                    doubtSupport: features.doubt_support || false,
                    analytics: features.analytics || 'basic',
                    leaderboard: features.leaderboard || false,
                    prioritySupport: features.priority_support || false
                },

                // UI display
                featuresList: features.features_list || [],
                limitations: features.limitations || [],

                // Raw features for detailed access
                rawFeatures: features
            };
        });

        res.status(200).json({
            success: true,
            data: formattedPlans
        });
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching plans'
        });
    }
};

// Initiate subscription upgrade (fake payment)
export const initiateUpgrade = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { planId, billingCycle } = req.body;

        // Get plan details
        const { data: plan, error: planError } = await supabase
            .from('payment_plans')
            .select('*')
            .eq('plan_id', planId)
            .single();

        if (planError || !plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        // For fake payment, we'll just return a mock payment URL
        const mockPaymentId = `MOCK_${Date.now()}_${userId}`;

        res.status(200).json({
            success: true,
            data: {
                paymentId: mockPaymentId,
                planName: plan.plan_name,
                amount: plan.price,
                billingCycle: billingCycle,
                // This would normally be a real payment gateway URL
                paymentUrl: `/api/subscription/complete-payment?paymentId=${mockPaymentId}&planId=${planId}`
            }
        });
    } catch (error) {
        console.error('Initiate upgrade error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while initiating upgrade'
        });
    }
};

// Complete payment (fake payment completion)
export const completePayment = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { paymentId, planId } = req.query;

        // Get plan details
        const { data: plan, error: planError } = await supabase
            .from('payment_plans')
            .select('*')
            .eq('plan_id', planId)
            .single();

        if (planError || !plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        // Create fake transaction
        const { data: transaction, error: transactionError } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                plan_id: planId,
                transaction_reference: paymentId,
                amount: plan.price,
                payment_method: 'card', // Using 'card' as fake payment method
                transaction_status: 'success'
            })
            .select()
            .single();

        if (transactionError) {
            console.error('Error creating transaction:', transactionError);
            return res.status(500).json({
                success: false,
                message: 'Failed to create transaction'
            });
        }

        // Cancel any existing active subscriptions
        await supabase
            .from('user_subscriptions')
            .update({ status: 'cancelled' })
            .eq('user_id', userId)
            .eq('status', 'active');

        // Create new subscription
        const startDate = new Date();
        let endDate;

        if (plan.validity_days === 0) {
            // Free plan - use far future date
            endDate = new Date('2099-12-31');
        } else {
            // Paid plan - calculate actual end date
            endDate = new Date();
            endDate.setDate(endDate.getDate() + plan.validity_days);
        }

        const { data: subscription, error: subscriptionError } = await supabase
            .from('user_subscriptions')
            .insert({
                user_id: userId,
                plan_id: planId,
                transaction_id: transaction.transaction_id,
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                status: 'active',
                auto_renewal: false
            })
            .select()
            .single();

        if (subscriptionError) {
            console.error('Error creating subscription:', subscriptionError);
            return res.status(500).json({
                success: false,
                message: 'Failed to create subscription'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Payment successful! Your subscription has been activated.',
            data: {
                subscription,
                plan: plan.plan_name
            }
        });
    } catch (error) {
        console.error('Complete payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while completing payment'
        });
    }
};

// Cancel subscription
export const cancelSubscription = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get current active subscription
        const { data: currentSub } = await supabase
            .rpc('get_user_active_subscription', { p_user_id: userId });

        if (!currentSub || currentSub.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No active subscription found'
            });
        }

        // Don't allow canceling free plan
        if (currentSub[0].plan_name === 'Free') {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel free plan'
            });
        }

        // Update subscription status
        const { error } = await supabase
            .from('user_subscriptions')
            .update({
                status: 'cancelled',
                auto_renewal: false
            })
            .eq('subscription_id', currentSub[0].subscription_id);

        if (error) {
            console.error('Error cancelling subscription:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to cancel subscription'
            });
        }

        // Assign free plan
        const { data: freePlan } = await supabase
            .from('payment_plans')
            .select('plan_id')
            .eq('plan_name', 'Free')
            .single();

        if (freePlan) {
            await supabase
                .from('user_subscriptions')
                .insert({
                    user_id: userId,
                    plan_id: freePlan.plan_id,
                    start_date: new Date().toISOString(),
                    end_date: new Date('2099-12-31').toISOString(),
                    status: 'active',
                    auto_renewal: false
                });
        }

        res.status(200).json({
            success: true,
            message: 'Subscription cancelled successfully. You have been moved to the Free plan.'
        });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while cancelling subscription'
        });
    }
};

// Check if user can access a specific test (subject-based access control)
export const checkTestAccess = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { testId } = req.params;

        // Get test details including subject
        const { data: test, error: testError } = await supabase
            .from('tests')
            .select('test_id, subject_id, subjects:subject_id(name)')
            .eq('test_id', testId)
            .single();

        if (testError || !test) {
            return res.status(404).json({
                success: false,
                message: 'Test not found'
            });
        }

        // Get user's current subscription
        const { data: subscription, error: subError } = await supabase
            .from('user_subscriptions')
            .select('*, plan:plan_id(plan_name, features)')
            .eq('user_id', userId)
            .eq('status', 'active')
            .gte('end_date', new Date().toISOString())
            .order('end_date', { ascending: false })
            .limit(1)
            .single();

        // Free users or no subscription - limited access
        if (subError || !subscription) {
            return res.status(200).json({
                success: true,
                hasAccess: true, // Free plan has basic access
                limitation: 'free_plan',
                message: 'Limited access with Free plan'
            });
        }

        const planName = subscription.plan.plan_name;
        const planFeatures = subscription.plan.features || {};
        const allowedSubjects = planFeatures.full_size_tests?.subjects || [];
        const testSubject = test.subjects?.name;

        // Check subject-based access
        // Premium Annual: Biology only
        if (planName === 'Premium Annual') {
            if (testSubject && !allowedSubjects.includes(testSubject)) {
                return res.status(403).json({
                    success: false,
                    hasAccess: false,
                    upgradeRequired: true,
                    currentPlan: 'Premium Annual',
                    requiredPlan: 'Elite Annual',
                    message: `This ${testSubject} test requires Elite plan. Premium plan includes Biology tests only.`,
                    restrictedSubject: testSubject,
                    allowedSubjects: allowedSubjects
                });
            }
        }

        // Elite Annual: All subjects allowed
        // No restrictions for Elite users

        // Check attempt limits
        const { data: attemptCount } = await supabase
            .from('test_attempts')
            .select('attempt_id', { count: 'exact' })
            .eq('user_id', userId)
            .eq('test_id', testId);

        const maxAttempts = planFeatures.full_size_tests?.attempts || 0;
        const currentAttempts = attemptCount?.length || 0;

        if (typeof maxAttempts === 'number' && currentAttempts >= maxAttempts) {
            return res.status(403).json({
                success: false,
                hasAccess: false,
                limitReached: true,
                message: `You have reached the maximum ${maxAttempts} attempts for this test.`,
                currentAttempts,
                maxAttempts
            });
        }

        // User has access
        res.status(200).json({
            success: true,
            hasAccess: true,
            testSubject,
            currentAttempts,
            maxAttempts,
            plan: planName
        });

    } catch (error) {
        console.error('Check test access error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while checking test access'
        });
    }
};

// ==================== RAZORPAY PAYMENT ENDPOINTS ====================

/**
 * Create Razorpay order
 * Route: POST /api/subscription/create-razorpay-order
 */
export const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { planId } = req.body;

        if (!planId) {
            return res.status(400).json({
                success: false,
                message: 'Plan ID is required'
            });
        }

        // Get plan details
        const { data: plan, error: planError } = await supabase
            .from('payment_plans')
            .select('*')
            .eq('plan_id', planId)
            .single();

        if (planError || !plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        // Don't create order for free plan
        if (plan.price === 0) {
            return res.status(400).json({
                success: false,
                message: 'Free plan does not require payment'
            });
        }

        // Check for downgrade - Get user's current active subscription
        const { data: currentSubscription } = await supabase
            .from('user_subscriptions')
            .select('plan_id, payment_plans(plan_name, price)')
            .eq('user_id', userId)
            .eq('status', 'active')
            .gte('end_date', new Date().toISOString())
            .order('end_date', { ascending: false })
            .limit(1)
            .single();

        // Define plan hierarchy (higher number = higher tier)
        const planTiers = {
            'Free': 0,
            'Premium Annual': 1,
            'Elite Annual': 2
        };

        // Prevent downgrade
        if (currentSubscription && currentSubscription.payment_plans) {
            const currentPlanName = currentSubscription.payment_plans.plan_name;
            const requestedPlanName = plan.plan_name;

            const currentTier = planTiers[currentPlanName] || 0;
            const requestedTier = planTiers[requestedPlanName] || 0;

            if (requestedTier < currentTier) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot downgrade from ${currentPlanName} to ${requestedPlanName}. You can only upgrade to higher plans.`,
                    currentPlan: currentPlanName,
                    requestedPlan: requestedPlanName
                });
            }

            if (requestedTier === currentTier) {
                return res.status(400).json({
                    success: false,
                    message: `You already have an active ${currentPlanName} subscription.`,
                    currentPlan: currentPlanName
                });
            }
        }

        // Create Razorpay order
        const orderResult = await razorpayService.createOrder(
            plan.price,
            plan.plan_name,
            userId,
            { plan_id: planId }
        );

        if (!orderResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create payment order'
            });
        }

        const order = orderResult.data;

        // Create pending transaction in database
        const { data: transaction, error: txError } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                plan_id: planId,
                transaction_reference: order.id,
                razorpay_order_id: order.id,
                amount: plan.price,
                payment_method: 'card', // Will be updated after payment
                transaction_status: 'pending',
                payment_gateway_response: JSON.stringify(order)
            })
            .select()
            .single();

        if (txError) {
            console.error('Error creating transaction:', txError);
            return res.status(500).json({
                success: false,
                message: 'Failed to create transaction record'
            });
        }

        // Return order details for frontend
        res.status(200).json({
            success: true,
            data: {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: process.env.RAZORPAY_KEY_ID,
                planName: plan.plan_name,
                description: `${plan.plan_name} - Annual Subscription`,
                transactionId: transaction.transaction_id
            }
        });

    } catch (error) {
        console.error('Create Razorpay order error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating order'
        });
    }
};

/**
 * Verify Razorpay payment and activate subscription
 * Route: POST /api/subscription/verify-razorpay-payment
 */
export const verifyRazorpayPayment = async (req, res) => {
    try {
        const userId = req.user.userId;
        const {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            planId
        } = req.body;

        // Validate required fields
        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !planId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required payment details'
            });
        }

        // Verify payment signature
        const isValid = razorpayService.verifyPaymentSignature(
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature
        );

        if (!isValid) {
            // Mark transaction as failed
            await supabase
                .from('transactions')
                .update({
                    transaction_status: 'failed',
                    payment_gateway_response: JSON.stringify({
                        error: 'Invalid signature',
                        razorpay_order_id: razorpayOrderId,
                        razorpay_payment_id: razorpayPaymentId
                    })
                })
                .eq('razorpay_order_id', razorpayOrderId);

            return res.status(400).json({
                success: false,
                message: 'Payment verification failed. Invalid signature.'
            });
        }

        // Check if payment already processed (idempotency)
        const { data: existingTx } = await supabase
            .from('transactions')
            .select('*')
            .eq('razorpay_payment_id', razorpayPaymentId)
            .eq('transaction_status', 'success')
            .single();

        if (existingTx) {
            return res.status(200).json({
                success: true,
                message: 'Payment already processed',
                data: { alreadyProcessed: true }
            });
        }

        // Get payment details from Razorpay
        const paymentResult = await razorpayService.getPaymentDetails(razorpayPaymentId);

        if (!paymentResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch payment details'
            });
        }

        const payment = paymentResult.data;

        // Update transaction to success
        const { data: transaction, error: txError } = await supabase
            .from('transactions')
            .update({
                transaction_status: 'success',
                razorpay_payment_id: razorpayPaymentId,
                razorpay_signature: razorpaySignature,
                payment_method: payment.method || 'card',
                payment_gateway_response: JSON.stringify(payment),
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_order_id', razorpayOrderId)
            .eq('user_id', userId)
            .select()
            .single();

        if (txError || !transaction) {
            console.error('Error updating transaction:', txError);
            return res.status(500).json({
                success: false,
                message: 'Failed to update transaction'
            });
        }

        // Get plan details
        const { data: plan } = await supabase
            .from('payment_plans')
            .select('*')
            .eq('plan_id', planId)
            .single();

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        // Calculate subscription dates
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.validity_days);

        // Cancel any existing active subscriptions
        await supabase
            .from('user_subscriptions')
            .update({
                status: 'cancelled',
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('status', 'active');

        // Create new subscription
        const { data: subscription, error: subError } = await supabase
            .from('user_subscriptions')
            .insert({
                user_id: userId,
                plan_id: planId,
                transaction_id: transaction.transaction_id,
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                status: 'active',
                auto_renewal: false
            })
            .select()
            .single();

        if (subError) {
            console.error('Error creating subscription:', subError);
            return res.status(500).json({
                success: false,
                message: 'Payment successful but subscription creation failed'
            });
        }

        res.status(200).json({
            success: true,
            message: `Successfully subscribed to ${plan.plan_name}!`,
            data: {
                subscription,
                plan: plan.plan_name,
                validUntil: endDate.toISOString(),
                paymentId: razorpayPaymentId
            }
        });

    } catch (error) {
        console.error('Verify Razorpay payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while verifying payment'
        });
    }
};

export default {
    getCurrentSubscription,
    getTestLimits,
    checkFeatureAccess,
    getAllPlans,
    initiateUpgrade,
    completePayment,
    cancelSubscription,
    checkTestAccess,
    createRazorpayOrder,
    verifyRazorpayPayment
};
