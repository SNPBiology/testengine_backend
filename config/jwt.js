import jwt from 'jsonwebtoken';

// Validate JWT_SECRET exists and is strong
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set! Application cannot start.');
}

if (JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET must be at least 32 characters long for security.');
}

const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
const JWT_ALGORITHM = 'HS256';

/**
 * Generate JWT access token with security best practices
 * @param {number} userId - User ID
 * @param {string} email - User email
 * @param {string} role - User role (student/admin)
 * @param {number} tokenVersion - Token version for invalidation (default: 0)
 * @returns {string} JWT token
 */
export const generateToken = (userId, email, role, tokenVersion = 0) => {
  return jwt.sign(
    {
      userId,
      email,
      role,
      tokenVersion  // For token invalidation on password change
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRE,
      algorithm: JWT_ALGORITHM  // Explicitly specify algorithm
    }
  );
};

/**
 * Verify JWT token with strict algorithm checking
 * @param {string} token - JWT token to verify
 * @returns {object|null} Decoded token payload or null if invalid
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM]  // Only allow HS256
    });
  } catch (error) {
    // Log specific error for debugging
    if (error.name === 'TokenExpiredError') {
      console.log('JWT expired:', error.expiredAt);
    } else if (error.name === 'JsonWebTokenError') {
      console.log('JWT invalid:', error.message);
    } else {
      console.error('JWT verification error:', error.message);
    }
    return null;
  }
};


