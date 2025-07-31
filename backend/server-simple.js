import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// Socket.io setup for real-time features
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// In-memory storage for testing (replace with MongoDB in production)
let messages = [];
let locations = [];
let trucks = [];
let payments = [];
let users = [
  { _id: '1', name: 'Admin User', email: 'admin@autocare.com', role: 'admin' },
  { _id: '2', name: 'Test User', email: 'user@autocare.com', role: 'user' }
];

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple auth middleware for testing
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.sendStatus(401);
  }
  
  // Simple mock user for testing
  req.user = { _id: '2', name: 'Test User', email: 'user@autocare.com', role: 'user', isAdminUser: () => false };
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: 'v1'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AutoCare Pro API Server (Simple Mode)',
    version: '1.0.0',
    status: 'Running without MongoDB for testing'
  });
});

// Messages API
app.get('/api/v1/messages', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: messages.filter(m => m.conversation === req.user._id)
  });
});

app.post('/api/v1/messages', authenticateToken, (req, res) => {
  const { text } = req.body;
  const message = {
    _id: Date.now().toString(),
    sender: req.user._id,
    conversation: req.user._id,
    text,
    senderType: 'user',
    createdAt: new Date(),
    isRead: false
  };
  
  messages.push(message);
  
  // Broadcast to admin room
  io.to('admin-room').emit('message-received', {
    messageId: message._id,
    text: message.text,
    senderType: message.senderType,
    senderName: req.user.name,
    senderId: req.user._id,
    timestamp: message.createdAt
  });
  
  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: message
  });
});

app.get('/api/v1/messages/admin/all', authenticateToken, requireAdmin, (req, res) => {
  res.json({
    success: true,
    data: {
      messages: messages.filter(m => m.senderType === 'user'),
      unreadCount: messages.filter(m => m.senderType === 'user' && !m.isRead).length
    }
  });
});

// Payments API
app.get('/api/v1/payments/config', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    }
  });
});

app.post('/api/v1/payments/create-payment-intent', authenticateToken, (req, res) => {
  const { amount, currency = 'usd', description = 'AutoCare Pro Service Payment' } = req.body;
  
  // Mock Stripe payment intent
  const paymentIntent = {
    id: `pi_${Date.now()}`,
    client_secret: `pi_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
    amount: Math.round(amount * 100),
    currency,
    description,
    status: 'requires_payment_method'
  };
  
  // Broadcast payment attempt to admins
  io.to('admin-room').emit('payment-initiated', {
    userId: req.user._id,
    userName: req.user.name,
    amount: amount,
    currency,
    paymentIntentId: paymentIntent.id,
    timestamp: new Date()
  });
  
  res.json({
    success: true,
    data: {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    }
  });
});

app.post('/api/v1/payments/confirm-payment', authenticateToken, (req, res) => {
  const { paymentIntentId } = req.body;
  
  // Mock successful payment
  const payment = {
    id: paymentIntentId,
    amount: 5000, // $50.00 in cents
    currency: 'usd',
    status: 'succeeded'
  };
  
  payments.push(payment);
  
  // Broadcast successful payment to admins
  io.to('admin-room').emit('payment-completed', {
    userId: req.user._id,
    userName: req.user.name,
    amount: payment.amount / 100,
    currency: payment.currency,
    paymentIntentId: payment.id,
    timestamp: new Date()
  });
  
  res.json({
    success: true,
    message: 'Payment confirmed successfully',
    data: payment
  });
});

// Locations API
app.post('/api/v1/locations', authenticateToken, (req, res) => {
  const { latitude, longitude, address, locationType = 'current' } = req.body;
  
  const location = {
    _id: Date.now().toString(),
    user: req.user._id,
    latitude,
    longitude,
    address,
    locationType,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  locations.push(location);
  
  // Broadcast location update to admins
  io.to('admin-room').emit('location-shared', {
    userId: req.user._id,
    userName: req.user.name,
    location: { ...location, user: req.user },
    timestamp: new Date()
  });
  
  res.status(201).json({
    success: true,
    message: 'Location shared successfully',
    data: { ...location, user: req.user }
  });
});

app.get('/api/v1/locations/all', authenticateToken, requireAdmin, (req, res) => {
  const locationsWithUsers = locations.map(loc => ({
    ...loc,
    user: users.find(u => u._id === loc.user) || { name: 'Unknown User', email: 'unknown@example.com' }
  }));
  
  res.json({
    success: true,
    data: locationsWithUsers
  });
});

// Trucks API
app.get('/api/v1/trucks', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: trucks,
    count: trucks.length
  });
});

app.post('/api/v1/trucks', authenticateToken, requireAdmin, (req, res) => {
  const truck = {
    _id: Date.now().toString(),
    ...req.body,
    status: 'available',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  trucks.push(truck);
  
  res.status(201).json({
    success: true,
    message: 'Truck added successfully',
    data: truck
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);

  socket.on('join-user-room', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`👤 User ${userId} joined their room`);
  });

  socket.on('join-admin-room', () => {
    socket.join('admin-room');
    console.log('👨‍💼 Admin joined admin room');
  });

  socket.on('disconnect', () => {
    console.log('👤 User disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('socketio', io);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist.`
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 AutoCare Pro Backend Server (Simple Mode) running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 API Base URL: http://localhost:${PORT}/api/v1`);
  console.log(`🔧 Health Check: http://localhost:${PORT}/health`);
  console.log('⚠️  Running in simple mode without MongoDB for testing');
});

export default app;