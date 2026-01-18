/**
 * @fileoverview Authentication routes for user registration, login, and session management
 * @module routes/auth
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const db = require("../config/database");
const { validateRegistration, validateLogin } = require("../utils/validators");

// Rate limiting for authentication routes to prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 100 : 5, // Higher limit in development
  message: {
    success: false,
    message:
      "Too many authentication attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Register a new user
 * @route POST /api/auth/register
 * @param {string} req.body.full_name - User's full name
 * @param {string} req.body.email - User's email address
 * @param {string} req.body.phone - User's phone number
 * @param {string} req.body.password - User's password (min 6 characters)
 * @param {string} req.body.role - User role (passenger, driver, or both)
 * @param {string} req.body.gender - User gender (male or female)
 * @returns {Object} 201 - User object and JWT token
 * @returns {Object} 400 - Validation error
 * @returns {Object} 409 - User already exists
 */
router.post("/register", authLimiter, async (req, res) => {
  try {
    const { full_name, email, phone, password, role, gender } = req.body;

    const errors = validateRegistration(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // Validate gender
    if (!gender || !["male", "female"].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: "Gender is required and must be male or female",
      });
    }

    const existingUser = await db.query(
      "SELECT * FROM users WHERE email = $1 OR phone = $2",
      [email, phone]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "User with this email or phone already exists",
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, gender)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, full_name, email, phone, role, gender, is_verified, created_at`,
      [full_name, email, phone, password_hash, role || "passenger", gender]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * Authenticate user and return JWT token
 * @route POST /api/auth/login
 * @param {string} req.body.email - User's email address
 * @param {string} req.body.password - User's password
 * @returns {Object} 200 - User object and JWT token
 * @returns {Object} 400 - Validation error
 * @returns {Object} 401 - Invalid credentials
 * @returns {Object} 403 - Account deactivated
 */
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const errors = validateLogin(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    const result = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    delete user.password_hash;

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * Get current authenticated user's profile
 * @route GET /api/auth/me
 * @security JWT
 * @returns {Object} 200 - User profile data
 * @returns {Object} 401 - Not authenticated
 * @returns {Object} 404 - User not found
 */
router.get(
  "/me",
  require("../middleware/auth").authenticateToken,
  async (req, res) => {
    try {
      const result = await db.query(
        "SELECT id, full_name, email, phone, role, gender, profile_picture, is_verified, is_active, created_at FROM users WHERE id = $1",
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

module.exports = router;
