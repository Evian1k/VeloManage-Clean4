# AutoCare Pro Backend

A complete Node.js backend for the AutoCare Pro car service management system with real-time GPS tracking, messaging, and admin controls.

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Installation

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Setup environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your configurations:
   ```env
   PORT=3001
   MONGODB_URI=mongodb://localhost:27017/autocare-pro
   JWT_SECRET=your-super-secret-jwt-key
   ADMIN_PASSWORD=autocarpro12k@12k.wwc
   FRONTEND_URL=http://localhost:5173
   ```

4. **Start MongoDB** (if using local MongoDB):
   ```bash
   # On macOS with Homebrew
   brew services start mongodb-community
   
   # On Ubuntu/Debian
   sudo systemctl start mongod
   
   # On Windows
   net start MongoDB
   ```

5. **Initialize database with sample data:**
   ```bash
   npm run init-db
   ```

6. **Start the server:**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

The backend will be running at `http://localhost:3001`

## 📚 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user/admin
- `POST /api/v1/auth/verify-token` - Verify JWT token
- `POST /api/v1/auth/refresh-token` - Refresh JWT token

### Users
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update user profile

### Trucks
- `GET /api/v1/trucks` - Get all trucks
- `GET /api/v1/trucks/:id` - Get single truck
- `POST /api/v1/trucks` - Create truck (Admin only)
- `PUT /api/v1/trucks/:id/location` - Update truck location
- `PUT /api/v1/trucks/:id/status` - Update truck status (Admin only)
- `GET /api/v1/trucks/nearest/:lat/:lng` - Find nearest trucks
- `PUT /api/v1/trucks/:id/assign` - Assign truck (Admin only)

### Messages
- `GET /api/v1/messages` - Get user messages
- `POST /api/v1/messages` - Send message
- `GET /api/v1/messages/conversations` - Get all conversations (Admin only)
- `PUT /api/v1/messages/:id/read` - Mark message as read

### Pickup Requests
- `GET /api/v1/pickups` - Get pickup requests
- `POST /api/v1/pickups` - Create pickup request
- `PUT /api/v1/pickups/:id/status` - Update status (Admin only)

### Health Check
- `GET /health` - Server health status

## 🔐 Admin Accounts

The system has 5 pre-configured admin accounts:

| Name | Email | Role |
|------|-------|------|
| Emmanuel Evian | emmanuel.evian@autocare.com | main_admin |
| Ibrahim Mohamud | ibrahim.mohamud@autocare.com | admin |
| Joel Ng'ang'a | joel.nganga@autocare.com | admin |
| Patience Karanja | patience.karanja@autocare.com | admin |
| Joyrose Kinuthia | joyrose.kinuthia@autocare.com | admin |

**Admin Password:** `autocarpro12k@12k.wwc`

## 🚛 Sample Data

The initialization script creates:

- 5 admin users
- 3 sample trucks with drivers
- 2 demo regular users
- Sample locations in Nairobi, Kenya

## 🔧 Features

### Real-time Features
- WebSocket connections for live updates
- Real-time truck location tracking
- Live message notifications
- Instant status updates

### Security
- JWT authentication
- Password hashing with bcrypt
- Rate limiting
- Input validation
- CORS protection
- Helmet security headers

### Database
- MongoDB with Mongoose ODM
- Indexed collections for performance
- Data validation and relationships
- Location-based queries

### GPS & Mapping
- Haversine distance calculations
- Nearest truck finding
- Location history tracking
- Real-time position updates

## 🛠️ Development

### Scripts
```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm run init-db    # Initialize database with sample data
```

### Project Structure
```
backend/
├── models/          # Database models
│   ├── User.js      # User model with admin configs
│   ├── Truck.js     # Truck model with GPS tracking
│   ├── Message.js   # Messaging system model
│   └── ...
├── routes/          # API route handlers
│   ├── auth.js      # Authentication routes
│   ├── trucks.js    # Truck management routes
│   ├── messages.js  # Messaging routes
│   └── ...
├── middleware/      # Custom middleware
│   ├── auth.js      # JWT authentication
│   └── errorHandler.js
├── scripts/         # Utility scripts
│   └── init-database.js
├── server.js        # Main server file
└── package.json
```

## 🔗 Frontend Integration

Update your frontend API configuration:

```javascript
// In your frontend .env or config
VITE_API_URL=http://localhost:3001/api/v1
VITE_SOCKET_URL=http://localhost:3001
```

### Socket.io Events

**Client → Server:**
- `join-user-room` - Join user's notification room
- `join-admin-room` - Join admin notification room
- `truck-location-update` - Update truck position
- `new-message` - Send new message

**Server → Client:**
- `truck-location-updated` - Truck position changed
- `message-received` - New message received
- `pickup-request-received` - New pickup request
- `truck-dispatch-update` - Truck assignment update

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/autocare-pro
JWT_SECRET=your-production-secret-key
ADMIN_PASSWORD=autocarpro12k@12k.wwc
FRONTEND_URL=https://yourdomain.com
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 📱 Testing

### API Testing
You can test the API using tools like Postman or curl:

```bash
# Register a new user
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Admin login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"emmanuel.evian@autocare.com","password":"autocarpro12k@12k.wwc"}'
```

## 🔧 Troubleshooting

### Common Issues

1. **MongoDB Connection Error:**
   - Check if MongoDB is running
   - Verify MONGODB_URI in .env file
   - For MongoDB Atlas, check network access and credentials

2. **Port Already in Use:**
   - Change PORT in .env file
   - Kill existing process: `lsof -ti:3001 | xargs kill -9`

3. **JWT Errors:**
   - Ensure JWT_SECRET is set in .env
   - Check token expiration
   - Verify Authorization header format: `Bearer <token>`

4. **CORS Issues:**
   - Update FRONTEND_URL in .env
   - Check CORS configuration in server.js

### Logs
The server provides detailed console logs for debugging:
- ✅ Success messages (green)
- ❌ Error messages (red)
- 👤 User activities
- 🚛 Truck operations
- 📱 Real-time events

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review server logs
3. Verify environment configuration
4. Test with sample data

The backend is fully integrated with the existing frontend and maintains all features while providing real database persistence and scalability.