/**
 * @fileoverview Authentication routes - Defines auth-related API endpoints.
 * Maps HTTP routes to auth controller functions.
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const {
  registerValidation,
  loginValidation,
  refreshValidation,
} = require('../middleware/validator');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * POST /api/auth/register
 * Register a new user account.
 */
router.post('/register', registerValidation, asyncHandler(authController.register));

/**
 * POST /api/auth/login
 * Authenticate and receive tokens.
 */
router.post('/login', loginValidation, asyncHandler(authController.login));

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token.
 */
router.post('/refresh', refreshValidation, asyncHandler(authController.refresh));

/**
 * POST /api/auth/logout
 * Logout and invalidate tokens.
 */
router.post('/logout', authenticate, asyncHandler(authController.logout));

module.exports = router;
