import { supabase } from '../config/supabase.js';
import { razorpayService } from '../services/razorpayService.js';

/**
 * Webhook Controller - Handles Razorpay webhook events
 * Provides backup verification for payments
 */

/**
 * Handle Razorpay webhook events
 * Route: POST /api/webhooks/razorpay
 */
export const handleRazorpayWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const body = JSON.stringify(req.body);

        // Verify webhook signature
        const isValid = razorpayService.verifyWebhookSignature(body, signature);

        if (!isValid) {
            console.error('Invalid webhook signature');
            return res.status(400).json({
                success: false,
                message: 'Invalid signature'
            });
        }

        const event = req.body.event;
        const payload = req.body.payload;

        console.log(`Received webhook event: ${event}`);

        // Handle different webhook events
        switch (event) {
            case 'payment.captured':
                await handlePaymentCaptured(payload.payment.entity);
                break;

            case 'payment.failed':
                await handlePaymentFailed(payload.payment.entity);
                break;

            case 'order.paid':
                await handleOrderPaid(payload.order.entity, payload.payment.entity);
                break;

            case 'payment.authorized':
                console.log('Payment authorized:', payload.payment.entity.id);
                break;

            default:
                console.log(`Unhandled webhook event: ${event}`);
        }

        // Always respond with 200 to acknowledge receipt
        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Webhook processing error:', error);
        // Still return 200 to prevent Razorpay from retrying
        res.status(200).json({ success: false });
    }
};

/**
 * Handle payment.captured event
 */
async function handlePaymentCaptured(payment) {
    try {
        const paymentId = payment.id;
        const orderId = payment.order_id;
        const amount = payment.amount / 100; // Convert from paise to rupees

        console.log(`Payment captured: ${paymentId}, Order: ${orderId}, Amount: ₹${amount}`);

        // Check if payment already processed
        const { data: existingTransaction } = await supabase
            .from('transactions')
            .select('*')
            .eq('razorpay_payment_id', paymentId)
            .single();

        if (existingTransaction) {
            console.log('Payment already processed, skipping');
            return;
        }

        // Update transaction if it exists with order ID
        const { data: transaction, error: txError } = await supabase
            .from('transactions')
            .select('*')
            .eq('razorpay_order_id', orderId)
            .single();

        if (transaction && transaction.transaction_status !== 'success') {
            // Update transaction to success
            await supabase
                .from('transactions')
                .update({
                    transaction_status: 'success',
                    razorpay_payment_id: paymentId,
                    payment_gateway_response: JSON.stringify(payment),
                    updated_at: new Date().toISOString()
                })
                .eq('transaction_id', transaction.transaction_id);

            // Check if subscription already created
            const { data: existingSubscription } = await supabase
                .from('user_subscriptions')
                .select('*')
                .eq('transaction_id', transaction.transaction_id)
                .single();

            if (!existingSubscription) {
                // Create subscription
                const { data: plan } = await supabase
                    .from('payment_plans')
                    .select('*')
                    .eq('plan_id', transaction.plan_id)
                    .single();

                if (plan) {
                    const startDate = new Date();
                    const endDate = new Date();
                    endDate.setDate(endDate.getDate() + plan.validity_days);

                    // Cancel any existing active subscriptions
                    await supabase
                        .from('user_subscriptions')
                        .update({ status: 'cancelled' })
                        .eq('user_id', transaction.user_id)
                        .eq('status', 'active');

                    // Create new subscription
                    await supabase
                        .from('user_subscriptions')
                        .insert({
                            user_id: transaction.user_id,
                            plan_id: transaction.plan_id,
                            transaction_id: transaction.transaction_id,
                            start_date: startDate.toISOString(),
                            end_date: endDate.toISOString(),
                            status: 'active',
                            auto_renewal: false
                        });

                    console.log(`Subscription created for user ${transaction.user_id}`);
                }
            }
        }
    } catch (error) {
        console.error('Error handling payment.captured:', error);
    }
}

/**
 * Handle payment.failed event
 */
async function handlePaymentFailed(payment) {
    try {
        const paymentId = payment.id;
        const orderId = payment.order_id;
        const errorReason = payment.error_description || payment.error_reason;

        console.log(`Payment failed: ${paymentId}, Reason: ${errorReason}`);

        // Update transaction to failed
        await supabase
            .from('transactions')
            .update({
                transaction_status: 'failed',
                razorpay_payment_id: paymentId,
                payment_gateway_response: JSON.stringify({
                    ...payment,
                    error_description: errorReason
                }),
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_order_id', orderId);

        // TODO: Send notification to user about failed payment

    } catch (error) {
        console.error('Error handling payment.failed:', error);
    }
}

/**
 * Handle order.paid event
 */
async function handleOrderPaid(order, payment) {
    try {
        console.log(`Order paid: ${order.id}, Payment: ${payment.id}`);
        // This is usually redundant with payment.captured
        // But can be used for additional verification
    } catch (error) {
        console.error('Error handling order.paid:', error);
    }
}

export default {
    handleRazorpayWebhook
};
