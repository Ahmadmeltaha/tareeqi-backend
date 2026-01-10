# Tareeqi Backend API

Backend API for Tareeqi - A university carpooling application built with Node.js, Express, and PostgreSQL.

## Features

- User authentication with JWT and rate limiting
- Role-based authorization (Driver, Passenger, Both)
- Driver profile management with vehicle details
- Ride creation with Google Maps integration
- Booking system with seat management
- Review and rating system
- University-based ride filtering
- Gender-preference filtering for rides
- Traffic fee calculation for peak hours
- PostgreSQL database with transactional support

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **PostgreSQL** - Database
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **express-rate-limit** - Rate limiting for security

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```bash
cp .env.example .env
```

4. Configure environment variables (see Environment Variables section)

5. Create database:
```sql
CREATE DATABASE tareeqi;
```

6. Initialize database schema:
```bash
npm run init-db
```

7. Seed database (optional):
```bash
npm run seed
```

8. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will run on `http://localhost:5000`

## Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/tareeqi
JWT_SECRET=your_secure_jwt_secret_key_here
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret key for JWT signing | Yes |
| `PORT` | Server port (default: 5000) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `FRONTEND_URL` | Frontend URL for CORS | No |

> **Security Note:** Never commit your `.env` file to version control. Use strong, unique values for `JWT_SECRET` in production.

## API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <your_token>
```

---

### Auth Endpoints

#### Register User
```http
POST /api/auth/register
```
**Body:**
```json
{
  "full_name": "string",
  "email": "string",
  "phone": "string",
  "password": "string (min 6 chars)",
  "role": "passenger | driver | both",
  "gender": "male | female"
}
```
**Response:** `201 Created`
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": { ... },
    "token": "jwt_token"
  }
}
```

#### Login
```http
POST /api/auth/login
```
**Body:**
```json
{
  "email": "string",
  "password": "string"
}
```
**Response:** `200 OK`

#### Get Current User
```http
GET /api/auth/me
```
**Auth:** Required
**Response:** `200 OK`

---

### User Endpoints

#### Update Profile
```http
PUT /api/users/profile
```
**Auth:** Required
**Body:**
```json
{
  "full_name": "string",
  "phone": "string",
  "profile_picture": "string (URL)",
  "gender": "male | female"
}
```

#### Change Password
```http
PUT /api/users/:id/password
```
**Auth:** Required (self only)
**Body:**
```json
{
  "current_password": "string",
  "new_password": "string"
}
```

#### Deactivate Account
```http
DELETE /api/users/:id
```
**Auth:** Required (self only)

---

### Driver Endpoints

#### Create Driver Profile
```http
POST /api/drivers
```
**Auth:** Required (driver role)
**Body:**
```json
{
  "license_number": "string",
  "car_make": "string",
  "car_model": "string",
  "car_year": "number",
  "car_color": "string",
  "car_plate_number": "string",
  "car_seats": "number (1-8)"
}
```

#### Get Driver Profile
```http
GET /api/drivers/:userId
```
**Auth:** Required

#### Update Driver Profile
```http
PUT /api/drivers/:userId
```
**Auth:** Required (self only)

#### List All Drivers
```http
GET /api/drivers
```
**Auth:** Required
**Query Params:**
- `min_rating` - Minimum rating filter
- `car_make` - Filter by car make

---

### Ride Endpoints

#### Create Ride
```http
POST /api/rides
```
**Auth:** Required (driver role)
**Body:**
```json
{
  "origin": "string",
  "destination": "string",
  "origin_lat": "number",
  "origin_lng": "number",
  "destination_lat": "number",
  "destination_lng": "number",
  "departure_time": "ISO date string",
  "available_seats": "number (1-8)",
  "price_per_seat": "number",
  "description": "string",
  "amenities": ["wifi", "ac", "music"],
  "gender_preference": "male_only | female_only",
  "distance_km": "number",
  "fuel_type": "petrol | diesel | electric | hybrid",
  "direction": "to_university | from_university",
  "university_id": "number"
}
```

#### Search Rides
```http
GET /api/rides
```
**Auth:** Required
**Query Params:**
- `origin` - Search by origin (partial match)
- `destination` - Search by destination
- `departure_date` - Filter by date (YYYY-MM-DD)
- `min_seats` - Minimum available seats
- `max_price` - Maximum price per seat
- `university_id` - Filter by university
- `direction` - to_university | from_university
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20, max: 50)

**Response includes pagination:**
```json
{
  "success": true,
  "data": [...],
  "count": 10,
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### Get Ride Details
```http
GET /api/rides/:id
```
**Auth:** Required

#### Update Ride
```http
PUT /api/rides/:id
```
**Auth:** Required (ride owner only)

#### Complete Ride
```http
PUT /api/rides/:id/complete
```
**Auth:** Required (ride owner only)

#### Cancel Ride
```http
DELETE /api/rides/:id
```
**Auth:** Required (ride owner only)

---

### Booking Endpoints

#### Create Booking
```http
POST /api/bookings
```
**Auth:** Required
**Body:**
```json
{
  "ride_id": "number",
  "seats_booked": "number (1-8)",
  "pickup_location": "string",
  "dropoff_location": "string"
}
```

#### Get Passenger Bookings
```http
GET /api/bookings/passenger/:passengerId
```
**Auth:** Required (self only)
**Query Params:**
- `status` - pending | confirmed | cancelled | completed

#### Get Ride Bookings
```http
GET /api/bookings/ride/:rideId
```
**Auth:** Required (ride owner only)

#### Update Booking Status
```http
PUT /api/bookings/:id/status
```
**Auth:** Required
**Body:**
```json
{
  "status": "confirmed | cancelled | completed"
}
```

---

### Review Endpoints

#### Create Review
```http
POST /api/reviews
```
**Auth:** Required
**Body:**
```json
{
  "booking_id": "number",
  "reviewee_id": "number",
  "rating": "number (1-5)",
  "comment": "string"
}
```

#### Get User Reviews
```http
GET /api/reviews/user/:userId
```
**Auth:** Required

#### Update Review
```http
PUT /api/reviews/:id
```
**Auth:** Required (review owner only)

#### Delete Review
```http
DELETE /api/reviews/:id
```
**Auth:** Required (review owner only)

---

### University Endpoints

#### List Universities
```http
GET /api/universities
```
**Auth:** Required

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts with authentication data |
| `driver_profiles` | Driver-specific info and vehicle details |
| `universities` | List of universities for ride filtering |
| `rides` | Ride listings with route and pricing |
| `bookings` | Booking records linking passengers to rides |
| `reviews` | User reviews and ratings |

### Entity Relationships
- Users can have one driver profile (1:1)
- Drivers can create many rides (1:N)
- Rides can have many bookings (1:N)
- Bookings can have many reviews (1:N)
- Rides can be linked to a university (N:1)

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: 7-day token expiry
- **Rate Limiting**: 5 requests per 15 minutes on auth endpoints
- **CORS**: Configured for frontend origin
- **Request Size Limits**: 1MB max body size
- **Input Validation**: Server-side validation on all inputs
- **SQL Injection Prevention**: Parameterized queries

## Project Structure

```
backend/
├── config/
│   └── database.js          # Database connection pool
├── database/
│   ├── init.js              # Database initialization
│   ├── seed.js              # Seed data script
│   ├── schema.sql           # Database schema
│   └── seed.sql             # Sample data
├── middleware/
│   ├── auth.js              # JWT authentication
│   └── authorize.js         # Role-based authorization
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── bookings.js          # Booking routes
│   ├── drivers.js           # Driver routes
│   ├── reviews.js           # Review routes
│   ├── rides.js             # Ride routes
│   ├── universities.js      # University routes
│   └── users.js             # User routes
├── utils/
│   ├── response.js          # Response helpers
│   └── validators.js        # Input validators
├── .env                     # Environment variables
├── .gitignore
├── package.json
├── README.md
└── server.js                # Application entry point
```

## Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run init-db` - Initialize database schema
- `npm run seed` - Seed database with sample data

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "message": "Error description",
  "errors": [] // Optional validation errors
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

## Testing

After seeding the database, test accounts will be available. Check the seed file (`database/seed.sql`) for test credentials.

## License

ISC
