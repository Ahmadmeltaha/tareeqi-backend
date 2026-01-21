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
    ('Hussein Technical University (HTU)', 'Amman', 31.97242820, 35.83250120),
    ('University of Jordan (UJ)', 'Amman', 32.01488560, 35.87297820),
    ('German Jordanian University (GJU)', 'Madaba', 31.77665620, 35.80245790),
    ('Princess Sumaya University for Technology (PSUT)', 'Amman', 32.02347100, 35.87617400),
    ('Jordan University of Science and Technology (JUST)', 'Irbid', 32.49499560, 35.99117070),
    ('Hashemite University', 'Zarqa', 32.10288310, 36.18112150),
    ('Yarmouk University', 'Irbid', 32.53517910, 35.85669310),
    ('Balqa Applied University', 'Salt', 32.02495890, 35.71679360),
    ('Al-Zaytoonah University', 'Amman', 31.83281700, 35.89251970),
    ('Philadelphia University', 'Amman', 32.16481250, 35.85143750),
    ('Applied Science Private University', 'Amman', 32.04000760, 35.90039890),
    ('Middle East University', 'Amman', 31.80930480, 35.91979380),
    ('Mutah University', 'Karak', 31.09365620, 35.71737420),
    ('Irbid National University', 'Irbid', 32.40632990, 35.95032060),
    ('Tafila Technical University', 'Tafila', 30.84100040, 35.64292560),
    ('Al al-Bayt University', 'Mafraq', 32.33306200, 36.24106450),
    ('Amman Arab University', 'Amman', 32.11631740, 35.88184760),
    ('Jerash University', 'Jerash', 32.25211780, 35.89781640),
    ('American University of Madaba (AUM)', 'Madaba', 31.66117440, 35.80073330),
    ('Petra University', 'Amman', 31.89272600, 35.87465760),
    ('Zarqa University', 'Zarqa', 32.05959600, 36.15619700),
    ('Ajloun National University', 'Ajloun', 32.39654760, 35.82296780),
    ('Al-Hussein Bin Talal University', 'Maan', 30.26710520, 35.67849580)
ON CONFLICT DO NOTHING;
