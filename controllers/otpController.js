import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';
import { sendOTPEmail, sendWelcomeEmail } from '../services/resendService.js';
import { generateToken } from '../config/jwt.js';

/**
 * Generate a random 6-digit OTP
 */
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Request OTP - Send verification email with OTP
 * POST /api/auth/request-otp
 */
export const requestOTP = async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone } = req.body;

        // Check if user already exists in users table
        const { data: existingUser } = await supabase
            .from('users')
            .select('email')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'An account with this email already exists. Please login instead.'
            });
        }

        // Generate OTP and hash it
        const otp = generateOTP();
        const otpHash = await bcrypt.hash(otp, 10);

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Calculate expiry time (5 minutes from now)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Delete any existing pending user with this email
        await supabase
            .from('pending_users')
            .delete()
            .eq('email', email);

        // Store pending user with hashed OTP
        const { error: insertError } = await supabase
            .from('pending_users')
            .insert([{
                email,
                first_name: firstName,
                last_name: lastName,
                phone: phone || null,
                password_hash: passwordHash,
                otp_hash: otpHash,
                otp_expires_at: expiresAt.toISOString(),
                attempts: 0
            }]);

        if (insertError) {
            console.error('Database error:', insertError);
            return res.status(500).json({
                success: false,
                message: 'Failed to process your request. Please try again.'
            });
        }

        // Send OTP email via Resend
        const emailResult = await sendOTPEmail(email, firstName, otp);

        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send verification email. Please try again.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Verification code sent to your email. Please check your inbox.',
            data: {
                email,
                expiresIn: 300 // 5 minutes in seconds
            }
        });

    } catch (error) {
        console.error('Request OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
};

/**
 * Verify OTP and create user account
 * POST /api/auth/verify-otp
 */
export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        // Find pending user
        const { data: pendingUser, error: fetchError } = await supabase
            .from('pending_users')
            .select('*')
            .eq('email', email)
            .single();

        if (fetchError || !pendingUser) {
            return res.status(400).json({
                success: false,
                message: 'No pending verification found for this email. Please request a new OTP.'
            });
        }

        // Check if OTP has expired
        const now = new Date();
        const expiresAt = new Date(pendingUser.otp_expires_at);

        console.log('OTP Verification - Timestamp Check:', {
            now: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            nowTimestamp: now.getTime(),
            expiresTimestamp: expiresAt.getTime(),
            difference: (expiresAt.getTime() - now.getTime()) / 1000 + ' seconds',
            isExpired: now > expiresAt
        });

        if (now > expiresAt) {
            return res.status(400).json({
                success: false,
                message: 'Verification code has expired. Please request a new one.',
                expired: true
            });
        }

        // Check attempt limit (max 5 attempts)
        if (pendingUser.attempts >= 5) {
            return res.status(429).json({
                success: false,
                message: 'Too many failed attempts. Please request a new verification code.'
            });
        }

        // Verify OTP
        const isValidOTP = await bcrypt.compare(otp, pendingUser.otp_hash);

        if (!isValidOTP) {
            // Increment attempts
            await supabase
                .from('pending_users')
                .update({ attempts: pendingUser.attempts + 1 })
                .eq('email', email);

            return res.status(400).json({
                success: false,
                message: `Invalid verification code. ${4 - pendingUser.attempts} attempts remaining.`
            });
        }

        // OTP is valid - Create user account
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{
                email: pendingUser.email,
                password_hash: pendingUser.password_hash,
                first_name: pendingUser.first_name,
                last_name: pendingUser.last_name,
                phone: pendingUser.phone,
                role: 'student',
                is_active: true
            }])
            .select('user_id, email, first_name, last_name, role')
            .single();

        if (insertError) {
            console.error('User creation error:', insertError);
            return res.status(500).json({
                success: false,
                message: 'Failed to create account. Please try again.'
            });
        }

        // Create student profile
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const studentId = `STU${timestamp}${randomNum}`;

        await supabase
            .from('student_profiles')
            .insert([{
                user_id: newUser.user_id,
                student_id: studentId,
                preferences: {}
            }]);

        // Delete pending user
        await supabase
            .from('pending_users')
            .delete()
            .eq('email', email);

        // Send welcome email (non-blocking)
        sendWelcomeEmail(email, pendingUser.first_name).catch(err =>
            console.error('Welcome email failed:', err)
        );

        // Generate JWT token
        const token = generateToken(newUser.user_id, newUser.email, newUser.role, 0);

        res.status(201).json({
            success: true,
            message: '✅ Email verified! Account created successfully.',
            data: {
                user: {
                    userId: newUser.user_id,
                    email: newUser.email,
                    firstName: newUser.first_name,
                    lastName: newUser.last_name,
                    role: newUser.role
                },
                token
            }
        });

    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during verification. Please try again.'
        });
    }
};

/**
 * Resend OTP email
 * POST /api/auth/resend-otp
 */
export const resendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Find pending user
        const { data: pendingUser, error: fetchError } = await supabase
            .from('pending_users')
            .select('*')
            .eq('email', email)
            .single();

        if (fetchError || !pendingUser) {
            return res.status(400).json({
                success: false,
                message: 'No pending verification found. Please start the signup process again.'
            });
        }

        // Rate limiting: Check if last OTP was sent less than 60 seconds ago
        const lastCreated = new Date(pendingUser.created_at);
        const now = new Date();
        const secondsSinceLastOTP = (now - lastCreated) / 1000;

        if (secondsSinceLastOTP < 60) {
            return res.status(429).json({
                success: false,
                message: `Please wait ${Math.ceil(60 - secondsSinceLastOTP)} seconds before requesting another code.`,
                retryAfter: Math.ceil(60 - secondsSinceLastOTP)
            });
        }

        // Generate new OTP
        const otp = generateOTP();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // Update pending user with new OTP
        const { error: updateError } = await supabase
            .from('pending_users')
            .update({
                otp_hash: otpHash,
                otp_expires_at: expiresAt.toISOString(),
                attempts: 0,
                created_at: now.toISOString()
            })
            .eq('email', email);

        if (updateError) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate new code. Please try again.'
            });
        }

        // Send new OTP email
        const emailResult = await sendOTPEmail(email, pendingUser.first_name, otp);

        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send verification email. Please try again.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'New verification code sent to your email.',
            data: {
                email,
                expiresIn: 300
            }
        });

    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
};
