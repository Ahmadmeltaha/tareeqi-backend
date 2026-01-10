/**
 * @fileoverview Ride management routes for creating, searching, and managing rides
 * @module routes/rides
 */

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { authorizeDriver } = require("../middleware/authorize");

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/**
 * Calculate traffic fee based on peak hours and distance
 * Peak hours in Jordan: 7-9 AM and 4-6 PM
 * Fee rate: 0.05 JOD per km during peak hours
 * @param {string} departureTime - Departure time in ISO format or datetime-local format
 * @param {number} distanceKm - Distance in kilometers
 * @returns {number} Traffic fee in JOD (0 if not peak hours)
 */
function calculateTrafficFee(departureTime, distanceKm) {
  if (!distanceKm || !departureTime) {
    return 0;
  }

  // Parse the departure time
  // The frontend sends datetime-local format: "2026-01-06T07:30" (no timezone)
  // We need to extract the hour directly from the string if it's in local format
  let hour;
  const timeString = String(departureTime);

  // Check if it's in ISO format with T separator (from datetime-local input)
  if (timeString.includes("T") && !timeString.endsWith("Z")) {
    // Format: "2026-01-06T07:30" - this is local time, extract hour directly
    const timePart = timeString.split("T")[1];
    hour = parseInt(timePart.split(":")[0], 10);
  } else {
    // It's a full ISO string with Z (UTC) or other format
    // Convert to Jordan time (UTC+3)
    const date = new Date(departureTime);
    const utcHour = date.getUTCHours();
    hour = (utcHour + 3) % 24;
  }

  // Peak hours: 7-9 AM (7, 8) and 4-6 PM (16, 17)
  const isMorningPeak = hour >= 7 && hour < 9;
  const isAfternoonPeak = hour >= 16 && hour < 18;

  if (isMorningPeak || isAfternoonPeak) {
    // Traffic fee: 0.05 JOD per km during peak hours
    const fee = parseFloat(distanceKm) * 0.05;
    return Math.round(fee * 100) / 100; // Round to 2 decimal places
  }

  return 0;
}

router.post("/", authenticateToken, authorizeDriver, async (req, res) => {
  try {
    const {
      origin,
      destination,
      origin_lat,
      origin_lng,
      destination_lat,
      destination_lng,
      departure_time,
      available_seats,
      price_per_seat,
      description,
      amenities,
      gender_preference,
      distance_km,
      fuel_type,
      ac_enabled,
      direction,
      university_id,
    } = req.body;

    if (
      !origin ||
      !destination ||
      !departure_time ||
      !available_seats ||
      !price_per_seat
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Origin, destination, departure time, available seats, and price are required",
      });
    }

    const driverProfile = await db.query(
      "SELECT * FROM driver_profiles WHERE user_id = $1",
      [req.user.id]
    );

    if (driverProfile.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please create a driver profile first",
      });
    }

    // Validate available_seats is within valid range and does not exceed car capacity
    const seatsNum = parseInt(available_seats);
    if (isNaN(seatsNum) || seatsNum < 1 || seatsNum > 8) {
      return res.status(400).json({
        success: false,
        message: "Available seats must be between 1 and 8",
      });
    }

    if (seatsNum > driverProfile.rows[0].car_seats) {
      return res.status(400).json({
        success: false,
        message: `Available seats cannot exceed your car capacity (${driverProfile.rows[0].car_seats} seats)`,
      });
    }

    // Validate university_id if provided
    if (university_id) {
      const uniCheck = await db.query(
        "SELECT id FROM universities WHERE id = $1",
        [university_id]
      );
      if (uniCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid university selected",
        });
      }
    }

    // Validate departure time is not in the past
    const departureDate = new Date(departure_time);
    const now = new Date();
    if (departureDate < now) {
      return res.status(400).json({
        success: false,
        message:
          "Departure time cannot be in the past. Please select a future date and time.",
      });
    }

    // Calculate traffic fee for peak hours
    const traffic_fee = calculateTrafficFee(departure_time, distance_km);

    const result = await db.query(
      `INSERT INTO rides
       (driver_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng,
        departure_time, total_seats, available_seats, price_per_seat, description, amenities,
        gender_preference, distance_km, fuel_type, ac_enabled, traffic_fee, direction, university_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING *`,
      [
        req.user.id,
        origin,
        destination,
        origin_lat,
        origin_lng,
        destination_lat,
        destination_lng,
        departure_time,
        available_seats, // total_seats
        available_seats, // available_seats (same initially)
        price_per_seat,
        description,
        amenities || [],
        gender_preference || "male_only",
        distance_km,
        fuel_type || "petrol",
        ac_enabled || false,
        traffic_fee,
        direction || null,
        university_id || null,
      ]
    );

    res.status(201).json({
      success: true,
      message:
        traffic_fee > 0
          ? `Ride created successfully. Traffic fee of ${traffic_fee} JOD applied for peak hours.`
          : "Ride created successfully",
      data: result.rows[0],
      traffic_fee_applied: traffic_fee,
    });
  } catch (error) {
    console.error("Create ride error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const {
      origin,
      destination,
      departure_date,
      min_seats,
      max_price,
      status = "scheduled",
      university_id,
      direction,
      user_lat,
      user_lng,
      max_distance_km,
      page = 1,
      limit = 20,
    } = req.query;

    // Pagination settings with limits
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20)); // Max 50, min 1
    const offset = (pageNum - 1) * limitNum;

    // Get current user's gender
    const userResult = await db.query(
      "SELECT gender FROM users WHERE id = $1",
      [req.user.id]
    );
    const userGender = userResult.rows[0]?.gender;

    let query = `
      SELECT r.*,
             u.full_name as driver_name,
             u.phone as driver_phone,
             u.profile_picture as driver_picture,
             dp.car_make,
             dp.car_model,
             dp.car_year,
             dp.car_color,
             dp.car_plate_number,
             dp.rating as driver_rating,
             (SELECT COUNT(*) FROM reviews WHERE reviewee_id = r.driver_id) as total_reviews,
             uni.name as university_name,
             uni.city as university_city
      FROM rides r
      JOIN users u ON r.driver_id = u.id
      JOIN driver_profiles dp ON r.driver_id = dp.user_id
      LEFT JOIN universities uni ON r.university_id = uni.id
      WHERE r.status = $1
    `;

    const params = [status];
    let paramCount = 2;

    // Filter by gender preference - only show rides that match user's gender
    if (userGender) {
      query += ` AND (r.gender_preference = $${paramCount})`;
      params.push(userGender === "male" ? "male_only" : "female_only");
      paramCount++;
    }

    // Filter by university
    if (university_id) {
      query += ` AND r.university_id = $${paramCount}`;
      params.push(parseInt(university_id));
      paramCount++;
    }

    // Filter by direction
    if (direction) {
      query += ` AND r.direction = $${paramCount}`;
      params.push(direction);
      paramCount++;
    }

    if (origin) {
      query += ` AND LOWER(r.origin) LIKE LOWER($${paramCount})`;
      params.push(`%${origin}%`);
      paramCount++;
    }

    if (destination) {
      query += ` AND LOWER(r.destination) LIKE LOWER($${paramCount})`;
      params.push(`%${destination}%`);
      paramCount++;
    }

    if (departure_date) {
      query += ` AND DATE(r.departure_time) = $${paramCount}`;
      params.push(departure_date);
      paramCount++;
    }

    if (min_seats) {
      query += ` AND r.available_seats >= $${paramCount}`;
      params.push(parseInt(min_seats));
      paramCount++;
    }

    if (max_price) {
      query += ` AND r.price_per_seat <= $${paramCount}`;
      params.push(parseFloat(max_price));
      paramCount++;
    }

    // Get total count before pagination (for pagination metadata)
    const countQuery = query.replace(
      /SELECT r\.\*[\s\S]*?FROM rides r/,
      "SELECT COUNT(*) as total FROM rides r"
    );
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0]?.total || 0);

    // Add ordering and pagination
    query += ` ORDER BY r.departure_time ASC`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limitNum, offset);

    let result = await db.query(query, params);

    // If user location provided, filter by distance
    if (user_lat && user_lng && max_distance_km) {
      const userLatNum = parseFloat(user_lat);
      const userLngNum = parseFloat(user_lng);
      const maxDistNum = parseFloat(max_distance_km);

      result.rows = result.rows.filter((ride) => {
        // For rides to university, check distance from user to pickup (origin)
        // For rides from university, check distance from user to dropoff (destination)
        let checkLat, checkLng;

        if (ride.direction === "to_university") {
          checkLat = ride.origin_lat;
          checkLng = ride.origin_lng;
        } else if (ride.direction === "from_university") {
          checkLat = ride.destination_lat;
          checkLng = ride.destination_lng;
        } else {
          // For rides without direction, check both
          const distToOrigin = calculateDistance(
            userLatNum,
            userLngNum,
            parseFloat(ride.origin_lat),
            parseFloat(ride.origin_lng)
          );
          const distToDest = calculateDistance(
            userLatNum,
            userLngNum,
            parseFloat(ride.destination_lat),
            parseFloat(ride.destination_lng)
          );
          return distToOrigin <= maxDistNum || distToDest <= maxDistNum;
        }

        if (!checkLat || !checkLng) return true;

        const distance = calculateDistance(
          userLatNum,
          userLngNum,
          parseFloat(checkLat),
          parseFloat(checkLng)
        );
        return distance <= maxDistNum;
      });
    }

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    console.error("Get rides error:", error);
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
      `SELECT r.*,
              u.full_name as driver_name,
              u.phone as driver_phone,
              u.email as driver_email,
              u.profile_picture as driver_picture,
              dp.car_make,
              dp.car_model,
              dp.car_year,
              dp.car_color,
              dp.car_plate_number,
              dp.car_seats,
              dp.rating as driver_rating,
              dp.total_rides as driver_total_rides,
              (SELECT COUNT(*) FROM reviews WHERE reviewee_id = r.driver_id) as total_reviews
       FROM rides r
       JOIN users u ON r.driver_id = u.id
       JOIN driver_profiles dp ON r.driver_id = dp.user_id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get ride error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.get("/driver/:driverId", authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { status } = req.query;

    let query = `
      SELECT r.*
      FROM rides r
      WHERE r.driver_id = $1
    `;

    const params = [driverId];

    if (status) {
      query += " AND r.status = $2";
      params.push(status);
    }

    query += " ORDER BY r.departure_time DESC";

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get driver rides error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.put("/:id", authenticateToken, authorizeDriver, async (req, res) => {
  try {
    const { id } = req.params;

    const rideCheck = await db.query(
      "SELECT * FROM rides WHERE id = $1 AND driver_id = $2",
      [id, req.user.id]
    );

    if (rideCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Ride not found or you are not the driver",
      });
    }

    const {
      departure_time,
      available_seats,
      price_per_seat,
      description,
      amenities,
      status,
      origin,
      destination,
      origin_lat,
      origin_lng,
      destination_lat,
      destination_lng,
      direction,
      university_id,
      gender_preference,
      distance_km,
      fuel_type,
    } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (departure_time) {
      updates.push(`departure_time = $${paramCount}`);
      values.push(departure_time);
      paramCount++;
    }

    if (available_seats !== undefined) {
      updates.push(`available_seats = $${paramCount}`);
      values.push(available_seats);
      paramCount++;
    }

    if (price_per_seat !== undefined) {
      updates.push(`price_per_seat = $${paramCount}`);
      values.push(price_per_seat);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }

    if (amenities) {
      updates.push(`amenities = $${paramCount}`);
      values.push(amenities);
      paramCount++;
    }

    if (status) {
      updates.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (origin) {
      updates.push(`origin = $${paramCount}`);
      values.push(origin);
      paramCount++;
    }

    if (destination) {
      updates.push(`destination = $${paramCount}`);
      values.push(destination);
      paramCount++;
    }

    if (origin_lat !== undefined) {
      updates.push(`origin_lat = $${paramCount}`);
      values.push(origin_lat);
      paramCount++;
    }

    if (origin_lng !== undefined) {
      updates.push(`origin_lng = $${paramCount}`);
      values.push(origin_lng);
      paramCount++;
    }

    if (destination_lat !== undefined) {
      updates.push(`destination_lat = $${paramCount}`);
      values.push(destination_lat);
      paramCount++;
    }

    if (destination_lng !== undefined) {
      updates.push(`destination_lng = $${paramCount}`);
      values.push(destination_lng);
      paramCount++;
    }

    if (direction !== undefined) {
      updates.push(`direction = $${paramCount}`);
      values.push(direction);
      paramCount++;
    }

    if (university_id !== undefined) {
      updates.push(`university_id = $${paramCount}`);
      values.push(university_id);
      paramCount++;
    }

    if (gender_preference) {
      updates.push(`gender_preference = $${paramCount}`);
      values.push(gender_preference);
      paramCount++;
    }

    if (distance_km !== undefined) {
      updates.push(`distance_km = $${paramCount}`);
      values.push(distance_km);
      paramCount++;
    }

    if (fuel_type) {
      updates.push(`fuel_type = $${paramCount}`);
      values.push(fuel_type);
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
      `UPDATE rides
       SET ${updates.join(", ")}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    res.json({
      success: true,
      message: "Ride updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update ride error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Complete a ride
router.put(
  "/:id/complete",
  authenticateToken,
  authorizeDriver,
  async (req, res) => {
    try {
      const { id } = req.params;

      const rideCheck = await db.query(
        "SELECT * FROM rides WHERE id = $1 AND driver_id = $2",
        [id, req.user.id]
      );

      if (rideCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Ride not found or you are not the driver",
        });
      }

      const ride = rideCheck.rows[0];

      if (ride.status !== "scheduled") {
        return res.status(400).json({
          success: false,
          message: "Only scheduled rides can be marked as completed",
        });
      }

      const client = await db.pool.connect();

      try {
        await client.query("BEGIN");

        // Mark all confirmed bookings as completed
        await client.query(
          "UPDATE bookings SET status = 'completed' WHERE ride_id = $1 AND status = 'confirmed'",
          [id]
        );

        // Cancel any pending bookings (they were never confirmed before ride ended)
        await client.query(
          "UPDATE bookings SET status = 'cancelled' WHERE ride_id = $1 AND status = 'pending'",
          [id]
        );

        // Mark the ride as completed
        await client.query(
          "UPDATE rides SET status = 'completed' WHERE id = $1",
          [id]
        );

        // Increment driver's total_rides count
        await client.query(
          "UPDATE driver_profiles SET total_rides = total_rides + 1 WHERE user_id = $1",
          [req.user.id]
        );

        await client.query("COMMIT");

        res.json({
          success: true,
          message: "Ride marked as completed successfully",
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Complete ride error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

router.delete("/:id", authenticateToken, authorizeDriver, async (req, res) => {
  try {
    const { id } = req.params;

    const rideCheck = await db.query(
      "SELECT * FROM rides WHERE id = $1 AND driver_id = $2",
      [id, req.user.id]
    );

    if (rideCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Ride not found or you are not the driver",
      });
    }

    const client = await db.pool.connect();

    try {
      await client.query("BEGIN");

      // Cancel all bookings for this ride
      await client.query(
        "UPDATE bookings SET status = 'cancelled' WHERE ride_id = $1 AND status != 'cancelled'",
        [id]
      );

      // Cancel the ride
      await client.query(
        "UPDATE rides SET status = 'cancelled' WHERE id = $1",
        [id]
      );

      await client.query("COMMIT");

      res.json({
        success: true,
        message:
          "Ride cancelled successfully. All passengers have been notified.",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Cancel ride error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
