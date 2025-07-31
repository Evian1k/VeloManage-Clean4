import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Booking from '../models/Booking.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/v1/users/profile
// @desc    Get current user's complete profile with messages and requests
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get user data
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's messages
    const messages = await Message.find({
      $or: [
        { sender: userId },
        { recipient: userId },
        { conversation: userId.toString() }
      ]
    }).populate('sender', 'name email role')
      .populate('recipient', 'name email role')
      .sort({ createdAt: 1 });

    // Get user's bookings/requests
    const bookings = await Booking.find({ customer: userId })
      .populate('truck', 'truckId vehicle driver')
      .populate('driver', 'name phone')
      .sort({ createdAt: -1 });

    // Prepare response data
    const profileData = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        role: user.role,
        vehicleCount: user.vehicleCount,
        lastService: user.lastService,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      messages: messages.map(msg => ({
        id: msg._id,
        text: msg.text,
        sender: msg.sender,
        recipient: msg.recipient,
        senderType: msg.senderType,
        isRead: msg.isRead,
        isAutoReply: msg.isAutoReply,
        createdAt: msg.createdAt
      })),
      bookings: bookings.map(booking => ({
        id: booking._id,
        bookingNumber: booking.bookingNumber,
        serviceType: booking.serviceType,
        status: booking.status,
        priority: booking.priority,
        truck: booking.truck,
        driver: booking.driver,
        schedule: booking.schedule,
        route: booking.route,
        pricing: booking.pricing,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt
      })),
      statistics: {
        totalMessages: messages.length,
        unreadMessages: messages.filter(m => !m.isRead && m.senderType === 'admin').length,
        totalBookings: bookings.length,
        activeBookings: bookings.filter(b => ['pending', 'confirmed', 'assigned', 'in_progress'].includes(b.status)).length,
        completedBookings: bookings.filter(b => b.status === 'completed').length
      }
    };

    res.json({
      success: true,
      data: profileData
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving profile data'
    });
  }
});

// @route   PUT /api/v1/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
  body('phone').optional().isMobilePhone(),
  body('email').optional().isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const userId = req.user._id;
    const updateData = {};

    // Only update fields that are provided
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.phone) updateData.phone = req.body.phone;
    if (req.body.email) updateData.email = req.body.email;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        role: user.role,
        vehicleCount: user.vehicleCount,
        lastService: user.lastService,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
});

// @route   GET /api/v1/users
// @desc    Get all users (Admin only)
// @access  Admin
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = '' } = req.query;
    
    // Build search filter
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) {
      filter.role = role;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      select: '-password',
      sort: { createdAt: -1 }
    };

    const users = await User.paginate(filter, options);

    res.json({
      success: true,
      data: users.docs,
      pagination: {
        page: users.page,
        limit: users.limit,
        total: users.totalDocs,
        pages: users.totalPages,
        hasNext: users.hasNextPage,
        hasPrev: users.hasPrevPage
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving users'
    });
  }
});

// @route   GET /api/v1/users/:id
// @desc    Get user by ID (Admin only)
// @access  Admin
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's messages and bookings for admin view
    const [messages, bookings] = await Promise.all([
      Message.find({
        $or: [
          { sender: user._id },
          { recipient: user._id },
          { conversation: user._id.toString() }
        ]
      }).populate('sender', 'name email role')
        .sort({ createdAt: -1 })
        .limit(10),
      
      Booking.find({ customer: user._id })
        .populate('truck', 'truckId vehicle')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isAdmin: user.isAdmin,
          role: user.role,
          vehicleCount: user.vehicleCount,
          lastService: user.lastService,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        recentMessages: messages,
        recentBookings: bookings,
        statistics: {
          totalMessages: await Message.countDocuments({
            $or: [
              { sender: user._id },
              { recipient: user._id },
              { conversation: user._id.toString() }
            ]
          }),
          totalBookings: await Booking.countDocuments({ customer: user._id })
        }
      }
    });

  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user'
    });
  }
});

// @route   PUT /api/v1/users/:id
// @desc    Update user by ID (Admin only)
// @access  Admin
router.put('/:id', requireAdmin, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isMobilePhone(),
  body('role').optional().isIn(['user', 'admin', 'main_admin', 'super_admin', 'driver', 'mechanic', 'manager']),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });

  } catch (error) {
    console.error('Update user error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating user'
    });
  }
});

// @route   DELETE /api/v1/users/:id
// @desc    Deactivate user (Admin only)
// @access  Admin
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    // Don't actually delete, just deactivate
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deactivated successfully',
      data: user
    });

  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating user'
    });
  }
});

export default router;