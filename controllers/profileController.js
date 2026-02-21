import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';

// Get student profile with all details
export const getStudentProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch user data with student profile
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        user_id,
        email,
        first_name,
        last_name,
        phone,
        role,
        created_at,
        last_login,
        student_profiles (
          profile_id,
          student_id,
          date_of_birth,
          address,
          profile_picture,
          preferences
        )
      `)
      .eq('user_id', userId)
      .single();

    if (error || !user) {
      console.error('Error fetching user:', error);
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    // Debug logging
    console.log('Fetched user data:', JSON.stringify(user, null, 2));
    console.log('Student profiles array:', user.student_profiles);

    // Handle student_profiles - it might be an object or array depending on Supabase response
    let studentProfile = null;
    if (user.student_profiles) {
      if (Array.isArray(user.student_profiles)) {
        studentProfile = user.student_profiles[0] || null;
      } else {
        studentProfile = user.student_profiles;
      }
    }

    console.log('Processed student profile:', studentProfile);

    // Fetch performance analytics
    const { data: analytics } = await supabase
      .from('performance_analytics')
      .select('*')
      .eq('user_id', userId);

    // Fetch test attempts count
    const { count: testAttempts } = await supabase
      .from('test_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('attempt_status', 'completed');

    // Calculate average score
    const { data: completedTests } = await supabase
      .from('test_attempts')
      .select('percentage')
      .eq('user_id', userId)
      .eq('attempt_status', 'completed');

    const averageScore = completedTests && completedTests.length > 0
      ? (completedTests.reduce((sum, test) => sum + parseFloat(test.percentage), 0) / completedTests.length).toFixed(2)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        userId: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        profile: studentProfile,
        stats: {
          testAttempted: testAttempts || 0,
          averageScore: parseFloat(averageScore),
          analytics: analytics || []
        }
      }
    });
  } catch (error) {
    console.error('Get student profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    });
  }
};

// Update user basic information
export const updateUserInfo = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { firstName, lastName, phone } = req.body;

    // Update user table
    const { data: updatedUser, error: userError } = await supabase
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select('user_id, email, first_name, last_name, phone, role')
      .single();

    if (userError) {
      console.error('Update user error:', userError);
      return res.status(500).json({
        success: false,
        message: 'Failed to update user information'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        userId: updatedUser.user_id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        phone: updatedUser.phone,
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error('Update user info error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile'
    });
  }
};

// Update student profile details
export const updateStudentProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { dateOfBirth, address, preferences } = req.body;

    console.log('Update student profile request:', {
      userId,
      dateOfBirth,
      address,
      preferences
    });

    // Check if student profile exists
    const { data: existingProfile } = await supabase
      .from('student_profiles')
      .select('profile_id, student_id')
      .eq('user_id', userId)
      .single();

    console.log('Existing profile:', existingProfile);

    let result;

    if (existingProfile) {
      // Update existing profile
      const updateData = {
        updated_at: new Date().toISOString()
      };

      // Always update these fields if provided (even if null/empty to allow clearing)
      if (dateOfBirth !== undefined) {
        updateData.date_of_birth = dateOfBirth || null;
      }
      if (address !== undefined) {
        updateData.address = address || null;
      }
      if (preferences !== undefined) {
        updateData.preferences = preferences || {};
      }

      console.log('Update data to be saved:', updateData);

      const { data, error } = await supabase
        .from('student_profiles')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Update profile error:', error);
        throw error;
      }

      console.log('Updated profile result:', data);
      result = data;
    } else {
      // Create new profile if doesn't exist with unique student ID
      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const studentId = `STU${timestamp}${randomNum}`;

      const { data, error } = await supabase
        .from('student_profiles')
        .insert([{
          user_id: userId,
          student_id: studentId,
          date_of_birth: dateOfBirth || null,
          address: address || null,
          preferences: preferences || {}
        }])
        .select()
        .single();

      if (error) {
        console.error('Insert profile error:', error);
        throw error;
      }
      result = data;
    }

    res.status(200).json({
      success: true,
      message: 'Student profile updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Update student profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating student profile'
    });
  }
};

// Update profile picture
export const updateProfilePicture = async (req, res) => {
  try {
    const userId = req.user.userId;
    // Allow empty string to clear the avatar (revert to initials) — store NULL
    const profilePicture = req.body.profilePicture ?? null;
    const valueToStore = (profilePicture === '' || profilePicture === null) ? null : profilePicture;

    // Update student profile with new picture (or null to clear)
    const { data, error } = await supabase
      .from('student_profiles')
      .update({
        profile_picture: valueToStore,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Update profile picture error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update profile picture'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      data: {
        profilePicture: data.profile_picture
      }
    });
  } catch (error) {
    console.error('Update profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile picture'
    });
  }
};

// Change password
export const changePassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Get current user password and token version
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password_hash, token_version')
      .eq('user_id', userId)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Update password AND increment token_version to invalidate all existing tokens
    const newTokenVersion = (user.token_version || 0) + 1;

    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newPasswordHash,
        token_version: newTokenVersion,  // Invalidate all existing tokens
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Update password error:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to update password'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please login again with your new password.'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while changing password'
    });
  }
};

// Delete account (soft delete)
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to delete account'
      });
    }

    // Verify password
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('user_id', userId)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password'
      });
    }

    // Soft delete - deactivate account
    const { error: updateError } = await supabase
      .from('users')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Delete account error:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete account'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting account'
    });
  }
};
// Get list of available avatars from Supabase Storage bucket
export const getAvatarList = async (req, res) => {
  try {
    const BUCKET_NAME = 'avatars';

    const { data: files, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) {
      console.error('Error listing avatars:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch avatar list'
      });
    }

    // Filter out placeholder/folder files and build public URLs
    const supabaseUrl = process.env.SUPABASE_URL;
    const avatars = (files || [])
      .filter(f => f.name && !f.name.startsWith('.') && f.metadata)
      .map(f => ({
        filename: f.name,
        url: `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${f.name}`
      }));

    res.status(200).json({
      success: true,
      data: avatars
    });
  } catch (error) {
    console.error('Get avatar list error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching avatars'
    });
  }
};

