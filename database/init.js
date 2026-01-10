const fs = require("fs");
const path = require("path");
const { pool } = require("../config/database");

async function initDatabase() {
  const client = await pool.connect();

  try {
    console.log("Initializing database schema...");

    const schemaSQL = fs.readFileSync(
      path.join(__dirname, "schema.sql"),
      "utf8"
    );

    await client.query(schemaSQL);

    console.log("Database schema initialized successfully!");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { initDatabase };
