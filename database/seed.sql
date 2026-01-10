-- Seed data for Tareeqi carpooling application
-- Comprehensive Test Data with Gender Feature

-- Clear existing data
TRUNCATE TABLE reviews, bookings, rides, driver_profiles, users RESTART IDENTITY CASCADE;

-- DRIVERS (password for all: test123)
INSERT INTO users (full_name, email, phone, password_hash, role, gender, is_verified, is_active) VALUES
('Ahmad', 'ahmad@test.com', '+962781234567', '$2a$10$e97Z1K4VJ1SQU5UL9jGJuO2AAi9IjwNo6gK5wm5HP.qQ3HhocNJDu', 'driver', 'male', TRUE, TRUE),
('Omar', 'omar@test.com', '+962782345678', '$2a$10$e97Z1K4VJ1SQU5UL9jGJuO2AAi9IjwNo6gK5wm5HP.qQ3HhocNJDu', 'driver', 'male', TRUE, TRUE),
('Fatima', 'fatima@test.com', '+962783456789', '$2a$10$e97Z1K4VJ1SQU5UL9jGJuO2AAi9IjwNo6gK5wm5HP.qQ3HhocNJDu', 'driver', 'female', TRUE, TRUE);

-- PASSENGERS (password for all: test123)
INSERT INTO users (full_name, email, phone, password_hash, role, gender, is_verified, is_active) VALUES
('Sara', 'sara@test.com', '+962784567890', '$2a$10$e97Z1K4VJ1SQU5UL9jGJuO2AAi9IjwNo6gK5wm5HP.qQ3HhocNJDu', 'passenger', 'female', TRUE, TRUE),
('Lina', 'lina@test.com', '+962785678901', '$2a$10$e97Z1K4VJ1SQU5UL9jGJuO2AAi9IjwNo6gK5wm5HP.qQ3HhocNJDu', 'passenger', 'female', TRUE, TRUE),
('Khaled', 'khaled@test.com', '+962786789012', '$2a$10$e97Z1K4VJ1SQU5UL9jGJuO2AAi9IjwNo6gK5wm5HP.qQ3HhocNJDu', 'passenger', 'male', TRUE, TRUE);

-- Driver Profiles
INSERT INTO driver_profiles (user_id, license_number, car_make, car_model, car_year, car_color, car_plate_number, car_seats, fuel_type, license_verified, rating, total_rides) VALUES
(1, 'HTU-DL-001', 'Toyota', 'Camry', 2020, 'White', 'ABC-1234', 4, 'petrol', TRUE, 4.8, 0),
(2, 'UJ-DL-002', 'Hyundai', 'Elantra', 2021, 'Silver', 'XYZ-5678', 4, 'hybrid', TRUE, 4.7, 0),
(3, 'JUST-DL-003', 'Kia', 'Sportage', 2019, 'Black', 'JKL-9012', 5, 'petrol', TRUE, 4.9, 0);

-- RIDES (6 total as per requirements)
-- All rides include gender_preference and distance_km

-- Ride 1: Ahmad - Zarqa → HTU, Tomorrow 7:30 AM, 3 seats, 1.50 JOD, Male only
INSERT INTO rides (driver_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng, departure_time, available_seats, price_per_seat, status, description, amenities, gender_preference, distance_km, created_at) VALUES
(1, 'Zarqa', 'HTU', 32.0853, 36.0878, 32.1872, 35.8833, NOW() + INTERVAL '1 day' + INTERVAL '7 hours 30 minutes', 3, 1.50, 'scheduled', 'Morning commute to HTU', ARRAY['AC', 'Music'], 'male_only', 25, NOW());

-- Ride 2: Ahmad - HTU → Zarqa, Tomorrow 4:00 PM, 3 seats, 1.50 JOD, Male only
INSERT INTO rides (driver_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng, departure_time, available_seats, price_per_seat, status, description, amenities, gender_preference, distance_km, created_at) VALUES
(1, 'HTU', 'Zarqa', 32.1872, 35.8833, 32.0853, 36.0878, NOW() + INTERVAL '1 day' + INTERVAL '16 hours', 3, 1.50, 'scheduled', 'Afternoon return from HTU', ARRAY['AC', 'Music'], 'male_only', 25, NOW());

-- Ride 3: Omar - Salt → UJ, Tomorrow 8:00 AM, 2 seats, 2.00 JOD, Male only
INSERT INTO rides (driver_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng, departure_time, available_seats, price_per_seat, status, description, amenities, gender_preference, distance_km, created_at) VALUES
(2, 'Salt', 'UJ', 32.0395, 35.7275, 31.9522, 35.8973, NOW() + INTERVAL '1 day' + INTERVAL '8 hours', 2, 2.00, 'scheduled', 'Morning ride to UJ', ARRAY['AC', 'WiFi'], 'male_only', 30, NOW());

-- Ride 4: Omar - Irbid → JUST, Day after tomorrow 7:00 AM, 3 seats, 2.50 JOD, Male only
INSERT INTO rides (driver_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng, departure_time, available_seats, price_per_seat, status, description, amenities, gender_preference, distance_km, created_at) VALUES
(2, 'Irbid', 'JUST', 32.5556, 35.8489, 32.3205, 36.0347, NOW() + INTERVAL '2 days' + INTERVAL '7 hours', 3, 2.50, 'scheduled', 'Daily commute to JUST', ARRAY['AC', 'Music'], 'male_only', 45, NOW());

-- Ride 5: Fatima - Madaba → HTU, Tomorrow 7:00 AM, 2 seats, 2.00 JOD, Female only
INSERT INTO rides (driver_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng, departure_time, available_seats, price_per_seat, status, description, amenities, gender_preference, distance_km, created_at) VALUES
(3, 'Madaba', 'HTU', 31.7195, 35.7947, 32.1872, 35.8833, NOW() + INTERVAL '1 day' + INTERVAL '7 hours', 2, 2.00, 'scheduled', 'Safe ride for female students', ARRAY['AC'], 'female_only', 35, NOW());

-- Ride 6: Fatima - Amman → GJU, Day after tomorrow 8:30 AM, 3 seats, 1.75 JOD, Female only
INSERT INTO rides (driver_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng, departure_time, available_seats, price_per_seat, status, description, amenities, gender_preference, distance_km, created_at) VALUES
(3, 'Amman', 'GJU', 31.9454, 35.9284, 32.0106, 35.8939, NOW() + INTERVAL '2 days' + INTERVAL '8 hours 30 minutes', 3, 1.75, 'scheduled', 'Comfortable ride to GJU', ARRAY['AC', 'Music'], 'female_only', 30, NOW());

-- BOOKINGS (3 as per requirements)
-- Sara requested seat on Fatima's ride #5 (pending)
INSERT INTO bookings (ride_id, passenger_id, seats_booked, total_price, status, pickup_location, dropoff_location) VALUES
(5, 4, 1, 2.00, 'pending', 'Madaba City Center', 'HTU Main Gate');

-- Khaled requested seat on Ahmad's ride #1 (confirmed/accepted)
INSERT INTO bookings (ride_id, passenger_id, seats_booked, total_price, status, pickup_location, dropoff_location) VALUES
(1, 6, 1, 1.50, 'confirmed', 'Zarqa New Bus Station', 'HTU Main Gate');

-- Lina requested seat on Fatima's ride #6 (pending)
INSERT INTO bookings (ride_id, passenger_id, seats_booked, total_price, status, pickup_location, dropoff_location) VALUES
(6, 5, 1, 1.75, 'pending', 'Amman - 7th Circle', 'GJU Main Entrance');
