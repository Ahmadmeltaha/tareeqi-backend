-- Migration: Add gender support to users and rides

-- Create gender enum types
DO $$ BEGIN
    CREATE TYPE user_gender AS ENUM ('male', 'female');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ride_gender_preference AS ENUM ('male_only', 'female_only');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add gender to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender user_gender;

-- Add gender_preference to rides table
ALTER TABLE rides ADD COLUMN IF NOT EXISTS gender_preference ride_gender_preference DEFAULT 'male_only';

-- Add fuel_type to driver_profiles for price calculation
DO $$ BEGIN
    CREATE TYPE fuel_type AS ENUM ('petrol', 'hybrid', 'electric');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS fuel_type fuel_type DEFAULT 'petrol';

-- Add distance field to rides for price calculation
ALTER TABLE rides ADD COLUMN IF NOT EXISTS distance_km DECIMAL(10, 2);
