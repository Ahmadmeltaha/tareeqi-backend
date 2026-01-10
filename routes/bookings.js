/**
 * @fileoverview Booking management routes for creating and managing ride bookings
 * @module routes/bookings
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * Create a new booking for a ride
 * @route POST /api/bookings
 * @security JWT
 * @param {number} req.body.ride_id - ID of the ride to book
 * @param {number} req.body.seats_booked - Number of seats to book (1-8)
 * @param {string} [req.body.pickup_location] - Custom pickup location
 * @param {string} [req.body.dropoff_location] - Custom dropoff location
 * @returns {Object} 201 - Created booking object
 * @returns {Object} 400 - Validation error or insufficient seats
 * @returns {Object} 404 - Ride not found
 * @returns {Object} 409 - Already booked this ride
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      ride_id,
      seats_booked,
      pickup_location,
      dropoff_location
    } = req.body;

    if (!ride_id || !seats_booked) {
      return res.status(400).json({
        success: false,
        message: 'Ride ID and seats booked are required'
      });
    }

    // Validate seats_booked is within valid range (1-8)
    const seatsNum = parseInt(seats_booked);
    if (isNaN(seatsNum) || seatsNum < 1 || seatsNum > 8) {
      return res.status(400).json({
        success: false,
        message: 'Seats booked must be between 1 and 8'
      });
    }

    const rideResult = await db.query(
      'SELECT * FROM rides WHERE id = $1 AND status = $2',
      [ride_id, 'scheduled']
    );

    if (rideResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found or not available for booking'
      });
    }

    const ride = rideResult.rows[0];

    // Check if ride has already departed
    if (new Date(ride.departure_time) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This ride has already departed'
      });
    }

    if (ride.driver_id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot book your own ride'
      });
    }

    if (ride.available_seats < seats_booked) {
      return res.status(400).json({
        success: false,
        message: `Only ${ride.available_seats} seats available`
      });
    }

    // Check for any existing booking (including cancelled)
    const existingBooking = await db.query(
      "SELECT * FROM bookings WHERE ride_id = $1 AND passenger_id = $2",
      [ride_id, req.user.id]
    );

    // Total price = (price per seat * seats) + traffic fee (if any)
    const traffic_fee = parseFloat(ride.traffic_fee) || 0;
    const total_price = (ride.price_per_seat * seats_booked) + traffic_fee;
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      let bookingResult;

      if (existingBooking.rows.length > 0) {
        const booking = existingBooking.rows[0];

        // If booking is pending or confirmed, user already has an active booking
        if (booking.status === 'pending' || booking.status === 'confirmed') {
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            message: 'You have already booked this ride'
          });
        }

        // If booking was cancelled, reactivate it by updating to pending
        bookingResult = await client.query(
          `UPDATE bookings
           SET status = 'pending', seats_booked = $1, total_price = $2,
               pickup_location = $3, dropoff_location = $4
           WHERE id = $5
           RETURNING *`,
          [seats_booked, total_price, pickup_location, dropoff_location, booking.id]
        );
      } else {
        // No existing booking, create new one
        bookingResult = await client.query(
          `INSERT INTO bookings
           (ride_id, passenger_id, seats_booked, total_price, pickup_location, dropoff_location)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [ride_id, req.user.id, seats_booked, total_price, pickup_location, dropoff_location]
        );
      }

      await client.query(
        'UPDATE rides SET available_seats = available_seats - $1 WHERE id = $2',
        [seats_booked, ride_id]
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Booking created successfully',
        data: bookingResult.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.get('/passenger/:passengerId', authenticateToken, async (req, res) => {
  try {
    const { passengerId } = req.params;

    if (req.user.id !== parseInt(passengerId)) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own bookings'
      });
    }

    const { status } = req.query;

    let query = `
      SELECT b.*,
             r.origin,
             r.destination,
             r.departure_time,
             r.price_per_seat,
             r.status as ride_status,
             r.driver_id,
             u.full_name as driver_name,
             u.phone as driver_phone,
             u.profile_picture as driver_picture,
             dp.car_make,
             dp.car_model,
             dp.car_color,
             dp.car_plate_number,
             dp.rating as driver_rating,
             (SELECT COUNT(*) FROM reviews WHERE reviewee_id = r.driver_id) as driver_total_reviews,
             CASE WHEN rev.id IS NOT NULL THEN true ELSE false END as has_review
      FROM bookings b
      JOIN rides r ON b.ride_id = r.id
      JOIN users u ON r.driver_id = u.id
      JOIN driver_profiles dp ON r.driver_id = dp.user_id
      LEFT JOIN reviews rev ON rev.booking_id = b.id AND rev.reviewer_id = b.passenger_id
      WHERE b.passenger_id = $1
    `;

    const params = [passengerId];

    if (status) {
      query += ' AND b.status = $2';
      params.push(status);
    }

    query += ' ORDER BY r.departure_time DESC';

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get passenger bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.get('/ride/:rideId', authenticateToken, async (req, res) => {
  try {
    const { rideId } = req.params;

    const rideCheck = await db.query(
      'SELECT driver_id FROM rides WHERE id = $1',
      [rideId]
    );

    if (rideCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    if (rideCheck.rows[0].driver_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only view bookings for your own rides'
      });
    }

    const result = await db.query(
      `SELECT b.*,
              u.full_name as passenger_name,
              u.phone as passenger_phone,
              u.profile_picture as passenger_picture
       FROM bookings b
       JOIN users u ON b.passenger_id = u.id
       WHERE b.ride_id = $1
       ORDER BY b.created_at DESC`,
      [rideId]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get ride bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT b.*,
              r.origin,
              r.destination,
              r.departure_time,
              r.driver_id,
              u.full_name as passenger_name,
              u.phone as passenger_phone
       FROM bookings b
       JOIN rides r ON b.ride_id = r.id
       JOIN users u ON b.passenger_id = u.id
       WHERE b.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = result.rows[0];

    if (booking.passenger_id !== req.user.id && booking.driver_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own bookings'
      });
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (confirmed, cancelled, completed)'
      });
    }

    const bookingCheck = await db.query(
      `SELECT b.*, r.driver_id, r.available_seats
       FROM bookings b
       JOIN rides r ON b.ride_id = r.id
       WHERE b.id = $1`,
      [id]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingCheck.rows[0];

    const isDriver = booking.driver_id === req.user.id;
    const isPassenger = booking.passenger_id === req.user.id;

    if (!isDriver && !isPassenger) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this booking'
      });
    }

    if (status === 'confirmed' && !isDriver) {
      return res.status(403).json({
        success: false,
        message: 'Only the driver can confirm bookings'
      });
    }

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      if (status === 'cancelled' && booking.status !== 'cancelled') {
        await client.query(
          'UPDATE rides SET available_seats = available_seats + $1 WHERE id = $2',
          [booking.seats_booked, booking.ride_id]
        );
      }

      const result = await client.query(
        'UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Booking status updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
