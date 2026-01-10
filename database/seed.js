const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function seedDatabase() {
  const client = await pool.connect();

  try {
    console.log('Seeding database...');

    const seedSQL = fs.readFileSync(
      path.join(__dirname, 'seed.sql'),
      'utf8'
    );

    await client.query(seedSQL);

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
