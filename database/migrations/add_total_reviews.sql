-- Add total_reviews column to driver_profiles
ALTER TABLE driver_profiles
ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;
