-- Migration: Add universities table and ride direction
-- Date: 2024-01-09

-- Create ride_direction enum type
DO $$ BEGIN
    CREATE TYPE ride_direction AS ENUM ('to_university', 'from_university');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create universities table
CREATE TABLE IF NOT EXISTS universities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for universities
CREATE INDEX IF NOT EXISTS idx_universities_city ON universities(city);
CREATE INDEX IF NOT EXISTS idx_universities_name ON universities(name);

-- Add direction and university_id columns to rides table
ALTER TABLE rides
ADD COLUMN IF NOT EXISTS direction ride_direction,
ADD COLUMN IF NOT EXISTS university_id INTEGER REFERENCES universities(id) ON DELETE SET NULL;

-- Add index for university_id on rides
CREATE INDEX IF NOT EXISTS idx_rides_university_id ON rides(university_id);
CREATE INDEX IF NOT EXISTS idx_rides_direction ON rides(direction);

-- Insert Jordanian universities with their coordinates
INSERT INTO universities (name, city, latitude, longitude) VALUES
    ('Hussein Technical University (HTU)', 'Amman', 31.9539, 35.9106),
    ('University of Jordan (UJ)', 'Amman', 32.0137, 35.8745),
    ('German Jordanian University (GJU)', 'Madaba', 31.8710, 35.8309),
    ('Princess Sumaya University for Technology (PSUT)', 'Amman', 32.0228, 35.8745),
    ('Jordan University of Science and Technology (JUST)', 'Irbid', 32.4950, 35.9911),
    ('Hashemite University', 'Zarqa', 32.1135, 36.1898),
    ('Yarmouk University', 'Irbid', 32.5355, 35.8517),
    ('Balqa Applied University', 'Salt', 32.0392, 35.7272),
    ('Al-Zaytoonah University', 'Amman', 31.8964, 35.9292),
    ('Philadelphia University', 'Amman', 32.0833, 35.9833),
    ('Applied Science Private University', 'Amman', 31.9878, 35.8608),
    ('Middle East University', 'Amman', 31.8933, 35.9767)
ON CONFLICT DO NOTHING;
