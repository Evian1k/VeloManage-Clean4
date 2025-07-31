import express from 'express';
import { body, validationResult } from 'express-validator';
import Booking from '../models/Booking.js';
import Truck from '../models/Truck.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/v1/bookings
// @desc    Get bookings
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { status, serviceType, startDate, endDate } = req.query;
    let filter = {};
    
    // Non-admin users can only see their own bookings
    if (!req.user.isAdminUser()) {
      filter.customer = req.user._id;
    }

    // Apply filters
    if (status) filter.status = status;
    if (serviceType) filter.serviceType = serviceType;
    
    if (startDate || endDate) {
      filter['schedule.startDate'] = {};
      if (startDate) filter['schedule.startDate'].$gte = new Date(startDate);
      if (endDate) filter['schedule.startDate'].$lte = new Date(endDate);
    }

    const bookings = await Booking.find(filter)
      .populate('customer', 'name email phone')
      .populate('truck', 'truckId vehicle driver')
      .populate('driver', 'name email phone')
      .populate('branch', 'name code location.city')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: bookings,
      count: bookings.length
    });

  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving bookings'
    });
  }
});

// @route   GET /api/v1/bookings/:id
// @desc    Get single booking
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('truck', 'truckId vehicle driver currentLocation')
      .populate('driver', 'name email phone')
      .populate('branch', 'name code location contact')
      .populate('timeline.updatedBy', 'name role');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check access permissions
    if (!req.user.isAdminUser() && booking.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: booking
    });

  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving booking'
    });
  }
});

// @route   POST /api/v1/bookings
// @desc    Create new booking
// @access  Private
router.post('/', [
  body('serviceType').isIn(['delivery', 'pickup', 'transport', 'maintenance', 'emergency'])
    .withMessage('Invalid service type'),
  body('schedule.startDate').isISO8601().withMessage('Valid start date required'),
  body('route.origin.address').optional().trim(),
  body('route.destination.address').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Check for conflicting bookings if truck is specified
    if (req.body.truck) {
      const startDate = new Date(req.body.schedule.startDate);
      const endDate = new Date(req.body.schedule.endDate || 
        new Date(startDate.getTime() + (req.body.schedule.estimatedDuration || 4) * 60 * 60 * 1000));

      const conflictingBooking = await Booking.findOne({
        truck: req.body.truck,
        status: { $in: ['confirmed', 'assigned', 'in_progress'] },
        $or: [
          {
            'schedule.startDate': { $lte: endDate },
            'schedule.endDate': { $gte: startDate }
          }
        ]
      });

      if (conflictingBooking) {
        return res.status(400).json({
          success: false,
          message: 'Truck is not available for the selected time slot'
        });
      }
    }

    const booking = new Booking({
      ...req.body,
      customer: req.user._id
    });

    // Calculate total amount
    booking.calculateTotal();
    await booking.save();

    // Emit real-time notification to admins
    const io = req.app.get('socketio');
    io.to('admin-room').emit('booking-created', {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      customer: req.user.name,
      serviceType: booking.serviceType,
      timestamp: booking.createdAt
    });

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating booking'
    });
  }
});

// @route   PUT /api/v1/bookings/:id/status
// @desc    Update booking status
// @access  Admin only
router.put('/:id/status', requireAdmin, [
  body('status').isIn(['pending', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    await booking.updateStatus(req.body.status, req.user._id, req.body.notes);

    // Update truck status if needed
    if (booking.truck) {
      let truckStatus = 'available';
      if (['assigned', 'in_progress'].includes(req.body.status)) {
        truckStatus = 'dispatched';
      }
      
      await Truck.findByIdAndUpdate(booking.truck, { status: truckStatus });
    }

    // Emit real-time update
    const io = req.app.get('socketio');
    io.to(`user-${booking.customer}`).emit('booking-status-updated', {
      bookingId: booking._id,
      status: req.body.status,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      data: booking
    });

  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating booking status'
    });
  }
});

// @route   PUT /api/v1/bookings/:id/assign
// @desc    Assign truck and driver to booking
// @access  Admin only
router.put('/:id/assign', requireAdmin, [
  body('truck').notEmpty().withMessage('Truck ID is required'),
  body('driver').optional().isMongoId().withMessage('Valid driver ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check truck availability
    const truck = await Truck.findById(req.body.truck);
    if (!truck || !truck.isAvailable()) {
      return res.status(400).json({
        success: false,
        message: 'Truck is not available'
      });
    }

    // Update booking
    booking.truck = req.body.truck;
    if (req.body.driver) booking.driver = req.body.driver;
    
    await booking.updateStatus('assigned', req.user._id, 'Truck and driver assigned');

    // Update truck status
    await truck.assignToRequest(booking._id);

    // Emit real-time updates
    const io = req.app.get('socketio');
    
    // Notify customer
    io.to(`user-${booking.customer}`).emit('booking-assigned', {
      bookingId: booking._id,
      truck: truck.truckId,
      driver: truck.driver.name,
      timestamp: new Date()
    });

    // Notify driver if assigned
    if (req.body.driver) {
      io.to(`user-${req.body.driver}`).emit('booking-assigned-to-driver', {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Booking assigned successfully',
      data: booking
    });

  } catch (error) {
    console.error('Assign booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning booking'
    });
  }
});

// @route   GET /api/v1/bookings/available-trucks
// @desc    Get available trucks for booking
// @access  Private
router.get('/available-trucks', async (req, res) => {
  try {
    const { startDate, endDate, serviceType } = req.query;

    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date is required'
      });
    }

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 4 * 60 * 60 * 1000); // Default 4 hours

    const availableTrucks = await Booking.findAvailableTrucks(start, end, serviceType);

    res.json({
      success: true,
      data: availableTrucks,
      count: availableTrucks.length
    });

  } catch (error) {
    console.error('Get available trucks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving available trucks'
    });
  }
});

// @route   POST /api/v1/bookings/:id/rating
// @desc    Add rating to booking
// @access  Private
router.post('/:id/rating', [
  body('score').isInt({ min: 1, max: 5 }).withMessage('Rating score must be between 1 and 5'),
  body('feedback').optional().trim().isLength({ max: 500 }).withMessage('Feedback too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only rate completed bookings'
      });
    }

    // Determine rating type based on user role
    if (booking.customer.toString() === req.user._id.toString()) {
      booking.rating.customerRating = {
        score: req.body.score,
        feedback: req.body.feedback
      };
    } else if (booking.driver && booking.driver.toString() === req.user._id.toString()) {
      booking.rating.driverRating = {
        score: req.body.score,
        feedback: req.body.feedback
      };
    } else {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to rate this booking'
      });
    }

    await booking.save();

    res.json({
      success: true,
      message: 'Rating added successfully',
      data: booking.rating
    });

  } catch (error) {
    console.error('Add rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding rating'
    });
  }
});

export default router;