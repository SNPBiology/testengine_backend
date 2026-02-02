import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send OTP verification email to user
 * @param {string} email - Recipient email address
 * @param {string} firstName - User's first name
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise} Resend API response
 */
export const sendOTPEmail = async (email, firstName, otp) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification - SNP Exam Prep</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SNP Exam Prep</h1>
          <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">NEET Preparation Platform</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
          <h2 style="color: #1a202c; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Welcome, ${firstName}! 🎓</h2>
          
          <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Thank you for signing up! To complete your registration, please verify your email address using the code below:
          </p>
          
          <!-- OTP Box -->
          <div style="background-color: #f7fafc; border: 2px dashed #cbd5e0; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
            <p style="color: #718096; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Verification Code</p>
            <div style="font-size: 42px; font-weight: 700; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">
              ${otp}
            </div>
          </div>
          
          <div style="background-color: #fff5f5; border-left: 4px solid #fc8181; padding: 15px 20px; margin: 25px 0; border-radius: 4px;">
            <p style="color: #742a2a; font-size: 14px; margin: 0; line-height: 1.5;">
              <strong>⏰ Important:</strong> This code will expire in <strong>5 minutes</strong>.
            </p>
          </div>
          
          <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
            If you didn't create an account with SNP Exam Prep, you can safely ignore this email.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f7fafc; padding: 25px 30px; border-top: 1px solid #e2e8f0;">
          <p style="color: #a0aec0; font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
            © 2026 SNP Exam Prep. All rights reserved.<br>
            Need help? Contact us at support@snpexamprep.com
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

    try {
        const response = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: email,
            subject: '🔐 Verify Your Email - SNP Exam Prep',
            html
        });

        return {
            success: true,
            data: response
        };
    } catch (error) {
        console.error('Resend email error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send welcome email after successful verification  
 * @param {string} email - User email
 * @param {string} firstName - User's first name
 */
export const sendWelcomeEmail = async (email, firstName) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px;">
        <h2 style="color: #667eea;">Welcome to SNP Exam Prep, ${firstName}! 🎉</h2>
        <p>Your account has been successfully verified and activated.</p>
        <p>You can now access all features and start your NEET preparation journey!</p>
        <a href="${process.env.CLIENT_URL}/login" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">
          Start Learning
        </a>
      </div>
    </body>
    </html>
  `;

    try {
        await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: email,
            subject: '🎉 Welcome to SNP Exam Prep!',
            html
        });
    } catch (error) {
        console.error('Welcome email error:', error);
        // Don't throw error - welcome email is not critical
    }
};
