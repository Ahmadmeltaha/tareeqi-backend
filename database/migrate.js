const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('Running migrations...');

    // Add total_seats column if it doesn't exist
    await client.query(`
      ALTER TABLE rides
      ADD COLUMN IF NOT EXISTS total_seats INTEGER;
    `);

    // Set total_seats to available_seats for existing rides (if null)
    await client.query(`
      UPDATE rides
      SET total_seats = COALESCE(total_seats, available_seats +
        (SELECT COALESCE(SUM(seats_booked), 0) FROM bookings WHERE ride_id = rides.id AND status != 'cancelled'))
      WHERE total_seats IS NULL;
    `);

    // Make total_seats NOT NULL with default
    await client.query(`
      ALTER TABLE rides
      ALTER COLUMN total_seats SET NOT NULL;
    `).catch(() => {
      // Column might already be NOT NULL
    });

    // Add distance_km column if it doesn't exist
    await client.query(`
      ALTER TABLE rides
      ADD COLUMN IF NOT EXISTS distance_km DECIMAL(10, 2);
    `);

    // Add fuel_type column if it doesn't exist
    await client.query(`
      ALTER TABLE rides
      ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(20) DEFAULT 'petrol';
    `);

    // Add ac_enabled column if it doesn't exist
    await client.query(`
      ALTER TABLE rides
      ADD COLUMN IF NOT EXISTS ac_enabled BOOLEAN DEFAULT FALSE;
    `);

    // Add gender_preference column if it doesn't exist
    await client.query(`
      ALTER TABLE rides
      ADD COLUMN IF NOT EXISTS gender_preference VARCHAR(20) DEFAULT 'male_only';
    `);

    // Add gender column to users if it doesn't exist
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
    `);

    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { migrate };
