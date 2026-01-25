import Razorpay from 'razorpay';
import crypto from 'crypto';

/**
 * Razorpay Service for handling payment operations
 * Handles order creation, payment verification, and webhook validation
 */
export class RazorpayService {
    constructor() {
        this.razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID || '',
            key_secret: process.env.RAZORPAY_KEY_SECRET || ''
        });
    }

    /**
     * Create a Razorpay order
     * @param {number} amount - Amount in rupees (will be converted to paise)
     * @param {string} planName - Name of the plan being purchased
     * @param {number} userId - User ID for receipt
     * @param {object} metadata - Additional metadata
     * @returns {Promise<object>} Razorpay order object
     */
    async createOrder(amount, planName, userId, metadata = {}) {
        try {
            const options = {
                amount: Math.round(amount * 100), // Convert to paise
                currency: 'INR',
                receipt: `rcpt_${userId}_${Date.now()}`,
                notes: {
                    plan_name: planName,
                    user_id: userId.toString(),
                    ...metadata
                }
            };

            const order = await this.razorpay.orders.create(options);
            return {
                success: true,
                data: order
            };
        } catch (error) {
            console.error('Razorpay create order error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verify payment signature
     * @param {string} orderId - Razorpay order ID
     * @param {string} paymentId - Razorpay payment ID
     * @param {string} signature - Razorpay signature
     * @returns {boolean} True if signature is valid
     */
    verifyPaymentSignature(orderId, paymentId, signature) {
        try {
            const text = `${orderId}|${paymentId}`;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
                .update(text)
                .digest('hex');

            return expectedSignature === signature;
        } catch (error) {
            console.error('Signature verification error:', error);
            return false;
        }
    }

    /**
     * Verify webhook signature
     * @param {string} body - Raw webhook body
     * @param {string} signature - X-Razorpay-Signature header
     * @returns {boolean} True if signature is valid
     */
    verifyWebhookSignature(body, signature) {
        try {
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
                .update(body)
                .digest('hex');

            return expectedSignature === signature;
        } catch (error) {
            console.error('Webhook signature verification error:', error);
            return false;
        }
    }

    /**
     * Fetch payment details
     * @param {string} paymentId - Razorpay payment ID
     * @returns {Promise<object>} Payment details
     */
    async getPaymentDetails(paymentId) {
        try {
            const payment = await this.razorpay.payments.fetch(paymentId);
            return {
                success: true,
                data: payment
            };
        } catch (error) {
            console.error('Fetch payment error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Capture payment (if needed)
     * @param {string} paymentId - Razorpay payment ID
     * @param {number} amount - Amount to capture in paise
     * @returns {Promise<object>} Capture response
     */
    async capturePayment(paymentId, amount) {
        try {
            const payment = await this.razorpay.payments.capture(paymentId, amount);
            return {
                success: true,
                data: payment
            };
        } catch (error) {
            console.error('Capture payment error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Refund payment (if needed for future)
     * @param {string} paymentId - Razorpay payment ID
     * @param {number} amount - Amount to refund in paise (optional, full refund if not provided)
     * @returns {Promise<object>} Refund response
     */
    async refundPayment(paymentId, amount = null) {
        try {
            const options = amount ? { amount } : {};
            const refund = await this.razorpay.payments.refund(paymentId, options);
            return {
                success: true,
                data: refund
            };
        } catch (error) {
            console.error('Refund payment error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export singleton instance
export const razorpayService = new RazorpayService();
