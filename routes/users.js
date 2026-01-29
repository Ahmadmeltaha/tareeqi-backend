/**
 * @fileoverview User management routes for profile and account operations
 * @module routes/users
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { authorizeSelf } = require("../middleware/authorize");

/**
 * Update current user's profile
 * @route PUT /api/users/profile
 * @security JWT
 * @param {string} [req.body.full_name] - User's full name
 * @param {string} [req.body.phone] - User's phone number
 * @param {string} [req.body.profile_picture] - URL to profile picture
 * @param {string} [req.body.gender] - User's gender (male/female)
 * @returns {Object} 200 - Updated user object
 */
router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const { full_name, phone, profile_picture, gender } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (full_name) {
      updates.push(`full_name = $${paramCount}`);
      values.push(full_name);
      paramCount++;
    }

    if (phone) {
      updates.push(`phone = $${paramCount}`);
      values.push(phone);
      paramCount++;
    }

    if (profile_picture !== undefined) {
      updates.push(`profile_picture = $${paramCount}`);
      values.push(profile_picture);
      paramCount++;
    }

    if (gender && (gender === "male" || gender === "female")) {
      updates.push(`gender = $${paramCount}`);
      values.push(gender);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    values.push(req.user.id);

    const result = await db.query(
      `UPDATE users
       SET ${updates.join(", ")}
       WHERE id = $${paramCount}
       RETURNING id, full_name, email, phone, role, gender, profile_picture, is_verified, updated_at`,
      values
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update profile error:", error);
    if (error.code === "23505") {
      return res.status(400).json({
        success: false,
        message: "Phone number already in use",
      });
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// DELETE /api/users/profile - Delete (deactivate) current user's account
router.delete("/profile", authenticateToken, async (req, res) => {
 try {
    const client = await db.pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Delete reviews BY this user (as reviewer)
      await client.query("DELETE FROM reviews WHERE reviewer_id = $1", [
        req.user.id,
      ]);

      // 2. Delete reviews FOR this user (as reviewee/driver)
      await client.query("DELETE FROM reviews WHERE reviewee_id = $1", [
        req.user.id,
      ]);

      // 3. Delete bookings for this user's rides (if driver)
      await client.query(
        `DELETE FROM bookings 
         WHERE ride_id IN (SELECT id FROM rides WHERE driver_id = $1)`,
        [req.user.id],
      );

      // 4. Delete this user's bookings (as passenger)
      await client.query("DELETE FROM bookings WHERE passenger_id = $1", [
        req.user.id,
      ]);

      // 5. Delete this user's rides (if driver)
      await client.query("DELETE FROM rides WHERE driver_id = $1", [
        req.user.id,
      ]);

      // 6. Delete driver profile (if exists)
      await client.query("DELETE FROM driver_profiles WHERE user_id = $1", [
        req.user.id,
      ]);

      // 7. Finally delete the user
      await client.query("DELETE FROM users WHERE id = $1", [req.user.id]);

      await client.query("COMMIT");

      res.json({
        success: true,
        message: "Account permanently deleted",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.profile_picture,
              u.is_verified, u.created_at,
              dp.car_make, dp.car_model, dp.car_year, dp.car_color,
              dp.car_seats, dp.rating, dp.total_rides
       FROM users u
       LEFT JOIN driver_profiles dp ON u.id = dp.user_id
       WHERE u.id = $1 AND u.is_active = TRUE`,
      [id]
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
});

router.put("/:id", authenticateToken, authorizeSelf, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, profile_picture } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (full_name) {
      updates.push(`full_name = $${paramCount}`);
      values.push(full_name);
      paramCount++;
    }

    if (phone) {
      updates.push(`phone = $${paramCount}`);
      values.push(phone);
      paramCount++;
    }

    if (profile_picture !== undefined) {
      updates.push(`profile_picture = $${paramCount}`);
      values.push(profile_picture);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    values.push(id);

    const result = await db.query(
      `UPDATE users
       SET ${updates.join(", ")}
       WHERE id = $${paramCount}
       RETURNING id, full_name, email, phone, role, profile_picture, is_verified, updated_at`,
      values
    );

    res.json({
      success: true,
      message: "User updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.put(
  "/:id/password",
  authenticateToken,
  authorizeSelf,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        return res.status(400).json({
          success: false,
          message: "Current password and new password are required",
        });
      }

      if (new_password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 6 characters long",
        });
      }

      const userResult = await db.query(
        "SELECT password_hash FROM users WHERE id = $1",
        [id]
      );

      const isPasswordValid = await bcrypt.compare(
        current_password,
        userResult.rows[0].password_hash
      );

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      const new_password_hash = await bcrypt.hash(new_password, 10);

      await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
        new_password_hash,
        id,
      ]);

      res.json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (error) {
      console.error("Update password error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

module.exports = router;
