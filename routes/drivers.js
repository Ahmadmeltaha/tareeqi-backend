/**
 * @fileoverview Driver profile management routes
 * @module routes/drivers
 */

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { authorizeDriver } = require("../middleware/authorize");

/**
 * Create a new driver profile
 * @route POST /api/drivers
 * @security JWT
 * @param {string} req.body.license_number - Driver's license number
 * @param {string} req.body.car_make - Vehicle manufacturer
 * @param {string} req.body.car_model - Vehicle model
 * @param {number} req.body.car_year - Vehicle year
 * @param {string} req.body.car_color - Vehicle color
 * @param {string} req.body.car_plate_number - Vehicle plate number
 * @param {number} req.body.car_seats - Number of passenger seats (1-8)
 * @returns {Object} 201 - Created driver profile
 * @returns {Object} 409 - Profile already exists
 */
router.post("/", authenticateToken, authorizeDriver, async (req, res) => {
  try {
    const {
      license_number,
      car_make,
      car_model,
      car_year,
      car_color,
      car_plate_number,
      car_seats,
    } = req.body;

    if (
      !license_number ||
      !car_make ||
      !car_model ||
      !car_year ||
      !car_color ||
      !car_plate_number ||
      !car_seats
    ) {
      return res.status(400).json({
        success: false,
        message: "All driver profile fields are required",
      });
    }

    const existingProfile = await db.query(
      "SELECT * FROM driver_profiles WHERE user_id = $1",
      [req.user.id]
    );

    if (existingProfile.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Driver profile already exists for this user",
      });
    }

    const result = await db.query(
      `INSERT INTO driver_profiles
       (user_id, license_number, car_make, car_model, car_year, car_color, car_plate_number, car_seats)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.user.id,
        license_number,
        car_make,
        car_model,
        car_year,
        car_color,
        car_plate_number,
        car_seats,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Driver profile created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create driver profile error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "License number or car plate number already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.get("/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await db.query(
      `SELECT dp.*, u.full_name, u.profile_picture
       FROM driver_profiles dp
       JOIN users u ON dp.user_id = u.id
       WHERE dp.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Driver profile not found",
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get driver profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.put("/:userId", authenticateToken, authorizeDriver, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.id !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own driver profile",
      });
    }

    const {
      license_number,
      car_make,
      car_model,
      car_year,
      car_color,
      car_plate_number,
      car_seats,
    } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (license_number) {
      updates.push(`license_number = $${paramCount}`);
      values.push(license_number);
      paramCount++;
    }

    if (car_make) {
      updates.push(`car_make = $${paramCount}`);
      values.push(car_make);
      paramCount++;
    }

    if (car_model) {
      updates.push(`car_model = $${paramCount}`);
      values.push(car_model);
      paramCount++;
    }

    if (car_year) {
      updates.push(`car_year = $${paramCount}`);
      values.push(car_year);
      paramCount++;
    }

    if (car_color) {
      updates.push(`car_color = $${paramCount}`);
      values.push(car_color);
      paramCount++;
    }

    if (car_plate_number) {
      updates.push(`car_plate_number = $${paramCount}`);
      values.push(car_plate_number);
      paramCount++;
    }

    if (car_seats) {
      updates.push(`car_seats = $${paramCount}`);
      values.push(car_seats);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    values.push(userId);

    const result = await db.query(
      `UPDATE driver_profiles
       SET ${updates.join(", ")}
       WHERE user_id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Driver profile not found",
      });
    }

    res.json({
      success: true,
      message: "Driver profile updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update driver profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const { min_rating, car_make } = req.query;

    let query = `
      SELECT dp.*, u.full_name, u.profile_picture, u.phone
      FROM driver_profiles dp
      JOIN users u ON dp.user_id = u.id
      WHERE u.is_active = TRUE AND dp.license_verified = TRUE
    `;

    const params = [];
    let paramCount = 1;

    if (min_rating) {
      query += ` AND dp.rating >= $${paramCount}`;
      params.push(parseFloat(min_rating));
      paramCount++;
    }

    if (car_make) {
      query += ` AND LOWER(dp.car_make) = LOWER($${paramCount})`;
      params.push(car_make);
      paramCount++;
    }

    query += " ORDER BY dp.rating DESC, dp.total_rides DESC";

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get drivers error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
