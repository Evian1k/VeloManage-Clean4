import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';

const router = express.Router();

// @route   GET /api/v1/auth/test-admin
// @desc    Test admin email validation
// @access  Public
router.get('/test-admin/:email', (req, res) => {
  const email = req.params.email;
  const isAdmin = User.isAdminEmail(email);
  const adminData = User.getAdminByEmail(email);
  
  res.json({
    email,
    isAdmin,
    adminData,
    adminEmails: [
      'emmanuel.evian@autocare.com',
      'ibrahim.mohamud@autocare.com',
      'joel.nganga@autocare.com',
      'patience.karanja@autocare.com',
      'joyrose.kinuthia@autocare.com'
    ]
  });
});

// JWT token generation
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-fallback-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// @route   POST /api/v1/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
], async (req, res) => {
  try {
    console.log('Registration attempt:', { 
      email: req.body.email, 
      name: req.body.name,
      hasPassword: !!req.body.password 
    });

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, email, password, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('User already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Check if trying to register with admin email
    console.log('Checking if admin email:', email, 'Is admin:', User.isAdminEmail(email));
    if (User.isAdminEmail(email)) {
      // Admin registration - verify admin password
      const adminPassword = process.env.ADMIN_PASSWORD || 'autocarpro12k@12k.wwc';
      console.log('Admin password check:', { 
        provided: password, 
        expected: adminPassword, 
        match: password === adminPassword 
      });
      
      if (password !== adminPassword) {
        console.log('Admin password mismatch');
        return res.status(403).json({
          success: false,
          message: 'Invalid admin password for admin registration.'
        });
      }
      
      // Get admin data
      const adminData = User.getAdminByEmail(email);
      console.log('Admin data for email:', email, adminData);
      
      if (!adminData) {
        console.log('No admin data found for email:', email);
        return res.status(403).json({
          success: false,
          message: 'Email not authorized for admin registration.'
        });
      }

      // Create admin user
      console.log('Creating admin user with data:', {
        name: adminData.name,
        email: email,
        phone: phone || '',
        isAdmin: true,
        role: adminData.role
      });
      
      const adminUser = new User({
        name: adminData.name,
        email: email,
        password: password,
        phone: phone || '',
        isAdmin: true,
        role: adminData.role
      });

      console.log('Saving admin user...');
      await adminUser.save();
      console.log('Admin user saved successfully:', adminUser._id);

      // Generate JWT token
      const token = generateToken(adminUser._id);

      return res.status(201).json({
        success: true,
        message: 'Admin registered successfully',
        token,
        user: {
          id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          phone: adminUser.phone,
          isAdmin: adminUser.isAdmin,
          role: adminUser.role,
          vehicleCount: adminUser.vehicleCount,
          createdAt: adminUser.createdAt
        }
      });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      phone,
      isAdmin: false,
      role: 'user'
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        role: user.role,
        vehicleCount: user.vehicleCount,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @route   POST /api/v1/auth/login
// @desc    Login user and return JWT token
// @access  Public
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Check if this is an admin login
    if (User.isAdminEmail(email)) {
      // Verify admin password
      const adminPassword = process.env.ADMIN_PASSWORD || 'autocarpro12k@12k.wwc';
      if (password !== adminPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid admin credentials'
        });
      }

      // Get admin data
      const adminData = User.getAdminByEmail(email);
      if (!adminData) {
        return res.status(401).json({
          success: false,
          message: 'Admin not found'
        });
      }

      // Check if admin user exists in database, if not create one
      let adminUser = await User.findOne({ email });
      if (!adminUser) {
        adminUser = new User({
          name: adminData.name,
          email: email,
          password: adminPassword,
          isAdmin: true,
          role: adminData.role,
          vehicleCount: 0
        });
        await adminUser.save();
      }

      const token = generateToken(adminUser._id);

      return res.json({
        success: true,
        message: 'Admin login successful',
        token,
        user: {
          id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          isAdmin: true,
          role: adminUser.role,
          vehicleCount: adminUser.vehicleCount,
          createdAt: adminUser.createdAt
        }
      });
    }

    // Regular user login
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        role: user.role,
        vehicleCount: user.vehicleCount,
        lastService: user.lastService,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   GET /api/v1/auth/verify
// @desc    Verify JWT token and get user data
// @access  Private
router.get('/verify', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-fallback-secret');
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        role: user.role,
        vehicleCount: user.vehicleCount,
        lastService: user.lastService,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// @route   POST /api/v1/auth/refresh-token
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh-token', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-fallback-secret');
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Generate new token
    const newToken = generateToken(user._id);

    res.json({
      success: true,
      token: newToken,
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

export default router;