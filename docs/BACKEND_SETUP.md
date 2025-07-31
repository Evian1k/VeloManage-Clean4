# 🚀 AutoCare Pro - Complete Full-Stack Setup Guide

This guide will help you set up the complete AutoCare Pro system with both frontend and backend running together.

## 📋 Prerequisites

Before starting, make sure you have:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **MongoDB** - Choose one:
  - Local MongoDB - [Download here](https://www.mongodb.com/try/download/community)
  - MongoDB Atlas (cloud) - [Sign up here](https://cloud.mongodb.com/)
- **Git** - [Download here](https://git-scm.com/)

## 🗂️ Project Structure

```
autocare-pro/
├── frontend/          # React frontend (existing)
│   ├── src/
│   ├── package.json
│   └── ...
├── backend/           # Node.js backend (new)
│   ├── models/
│   ├── routes/
│   ├── server.js
│   └── package.json
└── README.md
```

## 🚀 Quick Start (5 Minutes)

### Step 1: Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env file (use default values for quick start)
# PORT=3001
# MONGODB_URI=mongodb://localhost:27017/autocare-pro
# JWT_SECRET=your-super-secret-jwt-key
# ADMIN_PASSWORD=autocarpro12k@12k.wwc
```

### Step 2: Start MongoDB

**Option A: Local MongoDB**
```bash
# macOS with Homebrew
brew services start mongodb-community

# Ubuntu/Debian
sudo systemctl start mongod

# Windows
net start MongoDB
```

**Option B: Use MongoDB Atlas (Cloud)**
- Update `MONGODB_URI` in `.env` with your Atlas connection string

### Step 3: Initialize Database

```bash
# Create sample data (admins, trucks, users)
npm run init-db
```

### Step 4: Start Backend

```bash
# Start development server
npm run dev
```

✅ Backend running at `http://localhost:3001`

### Step 5: Frontend Setup

```bash
# In a new terminal, navigate to frontend
cd ../frontend  # or wherever your frontend is

# Install dependencies (if not already done)
npm install

# Start frontend
npm run dev
```

✅ Frontend running at `http://localhost:5173`

## 🔐 Login Credentials

### Admin Accounts
| Name | Email | Password |
|------|-------|----------|
| Emmanuel Evian | emmanuel.evian@autocare.com | autocarpro12k@12k.wwc |
| Ibrahim Mohamud | ibrahim.mohamud@autocare.com | autocarpro12k@12k.wwc |
| Joel Ng'ang'a | joel.nganga@autocare.com | autocarpro12k@12k.wwc |
| Patience Karanja | patience.karanja@autocare.com | autocarpro12k@12k.wwc |
| Joyrose Kinuthia | joyrose.kinuthia@autocare.com | autocarpro12k@12k.wwc |

### Sample Users
| Name | Email | Password |
|------|-------|----------|
| Demo User | user@demo.com | password123 |
| Test Customer | customer@test.com | password123 |

## 🔧 Frontend Integration

To connect your existing frontend to the backend, update these configurations:

### 1. Create Frontend Environment File

Create `.env` in your frontend directory:

```env
# Frontend .env
VITE_API_URL=http://localhost:3001/api/v1
VITE_SOCKET_URL=http://localhost:3001
```

### 2. Update API Service

Create or update `src/services/api.js`:

```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const token = localStorage.getItem('autocare_token');
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }

    return response.json();
  }

  // Authentication
  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  // Trucks
  async getTrucks() {
    return this.request('/trucks');
  }

  async updateTruckLocation(truckId, location) {
    return this.request(`/trucks/${truckId}/location`, {
      method: 'PUT',
      body: JSON.stringify(location)
    });
  }

  // Messages
  async getMessages() {
    return this.request('/messages');
  }

  async sendMessage(text, recipientId = null) {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({ text, recipientId })
    });
  }

  // Pickup Requests
  async getPickupRequests() {
    return this.request('/pickups');
  }

  async createPickupRequest(data) {
    return this.request('/pickups', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
}

export default new ApiService();
```

### 3. Update Authentication Context

Update your `AuthContext` to use the backend:

```javascript
// In your AuthContext.jsx
import apiService from '../services/api';

const login = async (email, password) => {
  try {
    const response = await apiService.login(email, password);
    
    if (response.success) {
      const { token, user } = response;
      localStorage.setItem('autocare_token', token);
      localStorage.setItem('autocare_user', JSON.stringify(user));
      setUser(user);
      return user;
    }
  } catch (error) {
    throw new Error(error.message);
  }
};
```

### 4. Setup Socket.io for Real-time Features

Install Socket.io client:

```bash
npm install socket.io-client
```

Create `src/services/socket.js`:

```javascript
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(user) {
    this.socket = io(SOCKET_URL);
    
    this.socket.on('connect', () => {
      console.log('Connected to server');
      
      if (user.isAdmin) {
        this.socket.emit('join-admin-room');
      } else {
        this.socket.emit('join-user-room', user.id);
      }
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }
}

export default new SocketService();
```

## 📱 Testing the Complete System

### 1. Test Admin Login
1. Go to `http://localhost:5173`
2. Login with: `emmanuel.evian@autocare.com` / `autocarpro12k@12k.wwc`
3. Navigate to Admin Dashboard
4. Check "Truck Dispatch" tab
5. Verify map shows trucks and locations

### 2. Test User Features
1. Open new incognito window
2. Register new user or login with: `user@demo.com` / `password123`
3. Go to "Truck Pickup" tab
4. Click "Get My Current Location"
5. Submit pickup request
6. Check admin window for real-time notification

### 3. Test Real-time Features
1. Keep both admin and user windows open
2. Send message from user → admin gets notification sound
3. Reply from admin → user gets notification
4. Create pickup request → admin sees immediate update
5. Assign truck → user gets status update

## 🛠️ Production Deployment

### Backend Deployment (Heroku/Railway/VPS)

1. **Environment Variables:**
```env
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/autocare-pro
JWT_SECRET=your-production-secret-key
ADMIN_PASSWORD=autocarpro12k@12k.wwc
FRONTEND_URL=https://yourdomain.com
```

2. **Deploy Commands:**
```bash
# Build and start
npm start

# Or with PM2
npm install -g pm2
pm2 start server.js --name "autocare-backend"
```

### Frontend Deployment (Vercel/Netlify)

Update frontend `.env` for production:
```env
VITE_API_URL=https://your-backend-domain.com/api/v1
VITE_SOCKET_URL=https://your-backend-domain.com
```

## 🔧 Troubleshooting

### Common Issues

1. **"Cannot connect to MongoDB"**
   - Check if MongoDB is running
   - Verify connection string in `.env`
   - For Atlas: check network access settings

2. **"Port 3001 already in use"**
   ```bash
   # Kill existing process
   lsof -ti:3001 | xargs kill -9
   # Or change PORT in .env
   ```

3. **CORS errors**
   - Update `FRONTEND_URL` in backend `.env`
   - Check both servers are running

4. **Token errors**
   - Clear localStorage: `localStorage.clear()`
   - Re-login to get new token

5. **Real-time not working**
   - Check Socket.io connection in browser dev tools
   - Verify both frontend and backend Socket.io setup

### Debug Commands

```bash
# Check backend health
curl http://localhost:3001/health

# Check API endpoints
curl http://localhost:3001/api/v1/trucks

# View backend logs
npm run dev  # shows console logs

# Check database
mongosh autocare-pro
db.users.find()
db.trucks.find()
```

## 📞 Support

If you encounter issues:

1. Check console logs in both frontend and backend
2. Verify all environment variables are set
3. Ensure both servers are running on correct ports
4. Test API endpoints directly with curl/Postman
5. Check database connection and data

## ✅ Success Checklist

- [ ] Backend running on port 3001
- [ ] Frontend running on port 5173
- [ ] MongoDB connected and initialized
- [ ] Admin login working
- [ ] User registration working
- [ ] Real-time notifications working
- [ ] GPS location sharing working
- [ ] Map displaying trucks and locations
- [ ] Truck dispatch working
- [ ] Messages system working

**🎉 Your AutoCare Pro system is now fully functional with a complete backend!**

The system now has:
- ✅ Real database persistence
- ✅ Secure authentication
- ✅ Real-time updates
- ✅ GPS tracking
- ✅ Admin controls
- ✅ Scalable architecture
- ✅ Production-ready setup