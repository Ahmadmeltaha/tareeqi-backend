/**
 * @fileoverview Review and rating management routes
 * @module routes/reviews
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * Create a new review for a completed booking
 * @route POST /api/reviews
 * @security JWT
 * @param {number} req.body.booking_id - ID of the completed booking
 * @param {number} req.body.reviewee_id - ID of the user being reviewed
 * @param {number} req.body.rating - Rating from 1 to 5
 * @param {string} [req.body.comment] - Optional review comment
 * @returns {Object} 201 - Created review object
 * @returns {Object} 400 - Validation error
 * @returns {Object} 403 - Not authorized to review
 * @returns {Object} 409 - Already reviewed
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { booking_id, reviewee_id, rating, comment } = req.body;

    if (!booking_id || !reviewee_id || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID, reviewee ID, and rating are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const bookingCheck = await db.query(
      `SELECT b.*, r.driver_id
       FROM bookings b
       JOIN rides r ON b.ride_id = r.id
       WHERE b.id = $1 AND b.status = 'completed'`,
      [booking_id]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not completed'
      });
    }

    const booking = bookingCheck.rows[0];

    const isDriver = booking.driver_id === req.user.id;
    const isPassenger = booking.passenger_id === req.user.id;

    if (!isDriver && !isPassenger) {
      return res.status(403).json({
        success: false,
        message: 'You can only review bookings you were part of'
      });
    }

    if (isDriver && reviewee_id !== booking.passenger_id) {
      return res.status(400).json({
        success: false,
        message: 'As a driver, you can only review the passenger'
      });
    }

    if (isPassenger && reviewee_id !== booking.driver_id) {
      return res.status(400).json({
        success: false,
        message: 'As a passenger, you can only review the driver'
      });
    }

    const existingReview = await db.query(
      'SELECT * FROM reviews WHERE booking_id = $1 AND reviewer_id = $2',
      [booking_id, req.user.id]
    );

    if (existingReview.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'You have already reviewed this booking'
      });
    }

    const result = await db.query(
      `INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [booking_id, req.user.id, reviewee_id, rating, comment]
    );

    // Calculate average rating
    const statsResult = await db.query(
      `SELECT ROUND(AVG(rating)::numeric, 2) as avg_rating
       FROM reviews
       WHERE reviewee_id = $1`,
      [reviewee_id]
    );

    // Update driver profile with new rating
    await db.query(
      `UPDATE driver_profiles
       SET rating = $1
       WHERE user_id = $2`,
      [statsResult.rows[0].avg_rating, reviewee_id]
    );

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await db.query(
      `SELECT r.*,
              u1.full_name as reviewer_name,
              u1.profile_picture as reviewer_picture,
              u2.full_name as reviewee_name
       FROM reviews r
       JOIN users u1 ON r.reviewer_id = u1.id
       JOIN users u2 ON r.reviewee_id = u2.id
       WHERE r.reviewee_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    const stats = await db.query(
      `SELECT
         COUNT(*) as total_reviews,
         ROUND(AVG(rating)::numeric, 2) as average_rating,
         COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
         COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
         COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
         COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
         COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
       FROM reviews
       WHERE reviewee_id = $1`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        reviews: result.rows,
        stats: stats.rows[0]
      }
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.get('/booking/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const result = await db.query(
      `SELECT r.*,
              u1.full_name as reviewer_name,
              u1.profile_picture as reviewer_picture,
              u2.full_name as reviewee_name
       FROM reviews r
       JOIN users u1 ON r.reviewer_id = u1.id
       JOIN users u2 ON r.reviewee_id = u2.id
       WHERE r.booking_id = $1`,
      [bookingId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get booking reviews error:', error);
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
      `SELECT r.*,
              u1.full_name as reviewer_name,
              u1.profile_picture as reviewer_picture,
              u2.full_name as reviewee_name
       FROM reviews r
       JOIN users u1 ON r.reviewer_id = u1.id
       JOIN users u2 ON r.reviewee_id = u2.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const reviewCheck = await db.query(
      'SELECT * FROM reviews WHERE id = $1 AND reviewer_id = $2',
      [id, req.user.id]
    );

    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review not found or you are not the reviewer'
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (rating) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5'
        });
      }
      updates.push(`rating = $${paramCount}`);
      values.push(rating);
      paramCount++;
    }

    if (comment !== undefined) {
      updates.push(`comment = $${paramCount}`);
      values.push(comment);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(id);

    const result = await db.query(
      `UPDATE reviews
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (rating) {
      const reviewee_id = reviewCheck.rows[0].reviewee_id;

      // Recalculate average rating
      const statsResult = await db.query(
        `SELECT ROUND(AVG(rating)::numeric, 2) as avg_rating
         FROM reviews
         WHERE reviewee_id = $1`,
        [reviewee_id]
      );

      await db.query(
        `UPDATE driver_profiles
         SET rating = $1
         WHERE user_id = $2`,
        [statsResult.rows[0].avg_rating, reviewee_id]
      );
    }

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const reviewCheck = await db.query(
      'SELECT * FROM reviews WHERE id = $1 AND reviewer_id = $2',
      [id, req.user.id]
    );

    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review not found or you are not the reviewer'
      });
    }

    const reviewee_id = reviewCheck.rows[0].reviewee_id;

    await db.query('DELETE FROM reviews WHERE id = $1', [id]);

    // Recalculate average rating
    const statsResult = await db.query(
      `SELECT ROUND(AVG(rating)::numeric, 2) as avg_rating
       FROM reviews
       WHERE reviewee_id = $1`,
      [reviewee_id]
    );

    const newRating = statsResult.rows[0].avg_rating || 0;

    await db.query(
      `UPDATE driver_profiles
       SET rating = $1
       WHERE user_id = $2`,
      [newRating, reviewee_id]
    );

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
