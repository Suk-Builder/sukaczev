/**
 * @fileoverview User service layer - Business logic for user operations.
 * Coordinates between models, caching, and event publishing.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const redis = require('../config/redis');
const rabbitmq = require('../config/rabbitmq');
const logger = require('./loggerService');

/**
 * JWT secret keys from environment.
 */
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

/**
 * Token expiration times.
 */
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Registers a new user.
 *
 * @async
 * @param {Object} userData - Registration data
 * @param {string} userData.username - Username (2-20 chars)
 * @param {string} userData.email - Email address
 * @param {string} userData.password - Plain text password
 * @param {string} [userData.displayName] - Optional display name
 * @returns {Promise<Object>} Created user with tokens
 */
async function register(userData) {
  const { username, email, password, displayName } = userData;

  // Hash password with bcrypt (12 rounds)
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user in database
  const user = await User.create({
    username,
    email,
    passwordHash,
    displayName: displayName || username,
    avatarUrl: null,
  });

  // Generate tokens
  const tokens = generateTokens(user);

  // Cache user data
  await redis.setCachedUser(user.id, sanitizeUser(user));

  // Publish event (non-blocking)
  rabbitmq.publishUserCreated(user).catch((err) => {
    logger.warn('Failed to publish user.created event', { error: err.message });
  });

  return {
    user: sanitizeUser(user),
    tokens,
  };
}

/**
 * Authenticates a user and generates tokens.
 *
 * @async
 * @param {string} usernameOrEmail - Username or email
 * @param {string} password - Plain text password
 * @returns {Promise<Object>} User data with tokens
 * @throws {Error} If credentials are invalid
 */
async function login(usernameOrEmail, password) {
  // Find user by username or email
  let user;
  if (usernameOrEmail.includes('@')) {
    user = await User.findByEmail(usernameOrEmail, true);
  } else {
    user = await User.findByUsername(usernameOrEmail, true);
  }

  if (!user) {
    const error = new Error('Invalid credentials');
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    const error = new Error('Invalid credentials');
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  // Generate tokens
  const tokens = generateTokens(user);

  // Cache user data
  await redis.setCachedUser(user.id, sanitizeUser(user));

  logger.info('User logged in', { userId: user.id, username: user.username });

  return {
    user: sanitizeUser(user),
    tokens,
  };
}

/**
 * Refreshes access token using refresh token.
 *
 * @async
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New tokens
 * @throws {Error} If refresh token is invalid
 */
async function refreshToken(refreshToken) {
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    // Check if token is blacklisted
    const isBlacklisted = await redis.isTokenBlacklisted(refreshToken);
    if (isBlacklisted) {
      const error = new Error('Token has been revoked');
      error.code = 'TOKEN_REVOKED';
      throw error;
    }

    // Get user from cache or database
    let user = await redis.getCachedUser(decoded.userId);
    if (!user) {
      user = await User.findById(decoded.userId);
      if (user) {
        await redis.setCachedUser(user.id, sanitizeUser(user));
      }
    }

    if (!user) {
      const error = new Error('User not found');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    // Generate new tokens (token rotation)
    const tokens = generateTokens(user);

    // Blacklist old refresh token
    await redis.blacklistToken(refreshToken, REFRESH_TOKEN_EXPIRY_SECONDS);

    logger.info('Token refreshed', { userId: user.id });

    return {
      user: sanitizeUser(user),
      tokens,
    };
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      const error = new Error('Invalid or expired refresh token');
      error.code = 'INVALID_TOKEN';
      throw error;
    }
    throw err;
  }
}

/**
 * Logs out a user by blacklisting their tokens.
 *
 * @async
 * @param {string} accessToken - Access token to blacklist
 * @param {string} refreshToken - Refresh token to blacklist
 * @returns {Promise<void>}
 */
async function logout(accessToken, refreshToken) {
  // Blacklist both tokens
  await Promise.all([
    redis.blacklistToken(accessToken, ACCESS_TOKEN_EXPIRY_SECONDS),
    redis.blacklistToken(refreshToken, REFRESH_TOKEN_EXPIRY_SECONDS),
  ]);

  logger.info('User logged out');
}

/**
 * Gets user by ID with caching.
 *
 * @async
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>} User object
 */
async function getUserById(userId) {
  // Try cache first
  let user = await redis.getCachedUser(userId);
  if (user) {
    return user;
  }

  // Fetch from database
  user = await User.findById(userId);
  if (user) {
    await redis.setCachedUser(userId, sanitizeUser(user));
  }

  return user ? sanitizeUser(user) : null;
}

/**
 * Updates user information.
 *
 * @async
 * @param {string} userId - User UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} Updated user
 */
async function updateUser(userId, updates) {
  const allowedUpdates = {};
  const fieldMappings = {
    displayName: 'display_name',
    avatarUrl: 'avatar_url',
    bio: 'bio',
  };

  for (const [key, value] of Object.entries(updates)) {
    if (fieldMappings[key] && value !== undefined) {
      allowedUpdates[fieldMappings[key]] = value;
    }
  }

  // Update in database
  const user = await User.update(userId, allowedUpdates);

  if (user) {
    // Invalidate and update cache
    const sanitized = sanitizeUser(user);
    await redis.setCachedUser(userId, sanitized);

    // Publish event
    const changedFields = Object.keys(allowedUpdates);
    rabbitmq.publishUserUpdated(user, changedFields).catch((err) => {
      logger.warn('Failed to publish user.updated event', { error: err.message });
    });
  }

  return user;
}

/**
 * Follows a user.
 *
 * @async
 * @param {string} followerId - User who is following
 * @param {string} followingId - User being followed
 * @returns {Promise<Object>} Follow result
 */
async function followUser(followerId, followingId) {
  if (followerId === followingId) {
    const error = new Error('Cannot follow yourself');
    error.code = 'SELF_FOLLOW';
    throw error;
  }

  const followData = await User.follow(followerId, followingId);

  // Invalidate caches for both users
  await redis.invalidateFollowCaches(followerId);
  await redis.invalidateFollowCaches(followingId);
  await redis.invalidateUser(followerId);
  await redis.invalidateUser(followingId);

  // Publish event
  rabbitmq.publishUserFollowed(followData).catch((err) => {
    logger.warn('Failed to publish user.followed event', { error: err.message });
  });

  return {
    followerId: followData.follower_id,
    followingId: followData.following_id,
    createdAt: followData.created_at,
  };
}

/**
 * Unfollows a user.
 *
 * @async
 * @param {string} followerId - User who is unfollowing
 * @param {string} followingId - User being unfollowed
 * @returns {Promise<boolean>} True if unfollowed
 */
async function unfollowUser(followerId, followingId) {
  const result = await User.unfollow(followerId, followingId);

  if (result) {
    // Invalidate caches
    await redis.invalidateFollowCaches(followerId);
    await redis.invalidateFollowCaches(followingId);
    await redis.invalidateUser(followerId);
    await redis.invalidateUser(followingId);

    // Publish event
    rabbitmq.publishUserUnfollowed({ follower_id: followerId, following_id: followingId }).catch((err) => {
      logger.warn('Failed to publish user.unfollowed event', { error: err.message });
    });
  }

  return result;
}

/**
 * Gets followers with caching.
 *
 * @async
 * @param {string} userId - User UUID
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Followers data
 */
async function getFollowers(userId, options = {}) {
  const page = Math.floor(options.offset / options.limit) + 1 || 1;

  // Try cache
  const cached = await redis.getCachedFollowers(userId, page);
  if (cached) {
    return cached;
  }

  const result = await User.getFollowers(userId, options);

  // Cache result
  await redis.setCachedFollowers(userId, page, result);

  return result;
}

/**
 * Gets following list with caching.
 *
 * @async
 * @param {string} userId - User UUID
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Following data
 */
async function getFollowing(userId, options = {}) {
  const page = Math.floor(options.offset / options.limit) + 1 || 1;

  // Try cache
  const cached = await redis.getCachedFollowing(userId, page);
  if (cached) {
    return cached;
  }

  const result = await User.getFollowing(userId, options);

  // Cache result
  await redis.setCachedFollowing(userId, page, result);

  return result;
}

/**
 * Generates JWT access and refresh tokens.
 *
 * @param {Object} user - User object
 * @returns {Object} Tokens object
 */
function generateTokens(user) {
  const payload = {
    userId: user.id,
    username: user.username,
    level: user.level,
  };

  const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'sukaczev-user-service',
    audience: 'sukaczev-api',
  });

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    JWT_REFRESH_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRY,
      issuer: 'sukaczev-user-service',
      audience: 'sukaczev-api',
    }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    tokenType: 'Bearer',
  };
}

/**
 * Verifies an access token.
 *
 * @async
 * @param {string} token - Access token
 * @returns {Promise<Object>} Decoded token payload
 * @throws {Error} If token is invalid
 */
async function verifyAccessToken(token) {
  const decoded = jwt.verify(token, JWT_ACCESS_SECRET, {
    issuer: 'sukaczev-user-service',
    audience: 'sukaczev-api',
  });

  // Check blacklist
  const isBlacklisted = await redis.isTokenBlacklisted(token);
  if (isBlacklisted) {
    const error = new Error('Token has been revoked');
    error.code = 'TOKEN_REVOKED';
    throw error;
  }

  return decoded;
}

/**
 * Removes sensitive fields from user object.
 *
 * @param {Object} user - Raw user object from database
 * @returns {Object} Sanitized user object
 */
function sanitizeUser(user) {
  const sanitized = { ...user };
  delete sanitized.password_hash;
  return sanitized;
}

/**
 * Adds coins to a user's account.
 *
 * @async
 * @param {string} userId - User UUID
 * @param {number} amount - Amount of coins to add
 * @returns {Promise<Object>} Updated coin balance
 */
async function addCoins(userId, amount) {
  const { query } = require('../config/db');
  const sql = `
    UPDATE users
    SET coins = coins + $2
    WHERE id = $1
    RETURNING coins
  `;
  const result = await query(sql, [userId, amount]);

  if (result.rows[0]) {
    // Invalidate cache
    await redis.invalidateUser(userId);
  }

  return result.rows[0];
}

/**
 * Deducts coins from a user's account.
 *
 * @async
 * @param {string} userId - User UUID
 * @param {number} amount - Amount of coins to deduct
 * @returns {Promise<Object>} Updated coin balance
 * @throws {Error} If insufficient coins
 */
async function deductCoins(userId, amount) {
  const { query } = require('../config/db');

  // Use atomic operation with check
  const sql = `
    UPDATE users
    SET coins = coins - $2
    WHERE id = $1 AND coins >= $2
    RETURNING coins
  `;
  const result = await query(sql, [userId, amount]);

  if (result.rowCount === 0) {
    const error = new Error('Insufficient coins');
    error.code = 'INSUFFICIENT_COINS';
    throw error;
  }

  // Invalidate cache
  await redis.invalidateUser(userId);

  return result.rows[0];
}

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getUserById,
  updateUser,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  verifyAccessToken,
  addExperience: User.addExperience,
  addCoins,
  deductCoins,
  sanitizeUser,
};
