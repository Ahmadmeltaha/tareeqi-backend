-- Migration: Add traffic_fee column to rides table
-- Date: 2025-01-10

-- Add traffic_fee column to rides table
ALTER TABLE rides
ADD COLUMN IF NOT EXISTS traffic_fee DECIMAL(10, 2) DEFAULT 0.00;

-- Add index for traffic_fee
CREATE INDEX IF NOT EXISTS idx_rides_traffic_fee ON rides(traffic_fee);
