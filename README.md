# ExamPrep Backend Server

Backend API for the ExamPrep NEET preparation platform.

## Tech Stack

- **Node.js** with **Express.js**
- **Supabase** (PostgreSQL)
- **JWT** for authentication
- **bcryptjs** for password hashing

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   
   Create a `.env` file in the `server` directory with the following variables:
   ```env
   PORT=5000
   NODE_ENV=development
   
   SUPABASE_URL=https://zcogeuffmweybkjuiaqo.supabase.co
   SUPABASE_ANON_KEY=your_supabase_anon_key
   
   JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_2024
   JWT_EXPIRE=7d
   
   CLIENT_URL=http://localhost:5173
   ```

3. **Start Server**
   ```bash
   npm start
   # or for development with auto-reload
   npm run dev
   ```

## API Endpoints

### Authentication

#### POST `/api/auth/signup`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "userId": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "student"
    },
    "token": "jwt_token_here"
  }
}
```

#### POST `/api/auth/login`
Login with existing credentials.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "userId": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "student"
    },
    "token": "jwt_token_here"
  }
}
```

#### GET `/api/auth/profile`
Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "1234567890",
    "role": "student",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "profile": {
      "student_id": "STU123456789",
      "date_of_birth": null,
      "profile_picture": null,
      "preferences": {}
    }
  }
}
```

#### POST `/api/auth/logout`
Logout user (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

### Health Check

#### GET `/api/health`
Check if server is running.

**Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Project Structure

```
server/
├── config/
│   ├── supabase.js       # Supabase client configuration
│   └── jwt.js            # JWT token utilities
├── controllers/
│   └── authController.js # Authentication logic
├── middleware/
│   ├── auth.js           # JWT authentication middleware
│   └── validation.js     # Request validation middleware
├── routes/
│   └── authRoutes.js     # Authentication routes
├── package.json
└── server.js             # Main server file
```

## Development

- The server runs on port 5000 by default
- CORS is enabled for the client URL (default: http://localhost:5173)
- All API endpoints are prefixed with `/api`
- JWT tokens expire after 7 days by default

## Security Features

- Password hashing with bcrypt
- JWT-based authentication
- Helmet for security headers
- CORS protection
- Input validation with express-validator
- Role-based access control

## Next Steps

- Add more routes for tests, questions, analytics
- Implement refresh token mechanism
- Add rate limiting
- Set up email verification
- Add password reset functionality


