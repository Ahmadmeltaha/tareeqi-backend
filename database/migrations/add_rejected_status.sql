-- Add 'rejected' to booking_status enum
-- Run this migration: psql -U postgres -d tareeqi -f database/migrations/add_rejected_status.sql

ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'rejected';
