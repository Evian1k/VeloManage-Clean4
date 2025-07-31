import express from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Simple pickup request schema (you can enhance this or create a proper model)
const PickupRequest = mongoose.model('PickupRequest', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  userPhone: String,
  pickupLocation: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: String
  },
  status: {
    type: String,
    enum: ['pending', 'dispatched', 'en-route', 'at-location', 'completed', 'cancelled'],
    default: 'pending'
  },
  assignedTruck: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck' },
  requestTime: { type: Date, default: Date.now },
  dispatchTime: Date,
  completionTime: Date,
  notes: String
}, { timestamps: true }));

// @route   GET /api/v1/pickups
// @desc    Get pickup requests
// @access  Private
router.get('/', async (req, res) => {
  try {
    let filter = {};
    
    // Non-admin users can only see their own requests
    if (!req.user.isAdminUser()) {
      filter.userId = req.user._id;
    }

    // Apply status filter if provided
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const pickupRequests = await PickupRequest.find(filter)
      .populate('userId', 'name email phone')
      .populate('assignedTruck', 'truckId driver vehicle currentLocation status')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: pickupRequests,
      count: pickupRequests.length
    });

  } catch (error) {
    console.error('Get pickup requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving pickup requests'
    });
  }
});

// @route   POST /api/v1/pickups
// @desc    Create pickup request
// @access  Private
router.post('/', [
  body('pickupLocation.latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  body('pickupLocation.longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
  body('pickupLocation.address').optional().trim().isLength({ max: 200 }).withMessage('Address too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Check if user already has a pending request
    const existingRequest = await PickupRequest.findOne({
      userId: req.user._id,
      status: { $in: ['pending', 'dispatched', 'en-route'] }
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active pickup request'
      });
    }

    const pickupRequest = new PickupRequest({
      userId: req.user._id,
      userName: req.user.name,
      userPhone: req.user.phone,
      pickupLocation: req.body.pickupLocation,
      notes: req.body.notes
    });

    await pickupRequest.save();

    // Emit real-time notification to admins
    const io = req.app.get('socketio');
    io.to('admin-room').emit('pickup-request-received', {
      requestId: pickupRequest._id,
      userName: req.user.name,
      location: pickupRequest.pickupLocation,
      timestamp: pickupRequest.requestTime
    });

    res.status(201).json({
      success: true,
      message: 'Pickup request created successfully',
      data: pickupRequest
    });

  } catch (error) {
    console.error('Create pickup request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating pickup request'
    });
  }
});

// @route   PUT /api/v1/pickups/:id/status
// @desc    Update pickup request status
// @access  Admin
router.put('/:id/status', requireAdmin, [
  body('status').isIn(['pending', 'dispatched', 'en-route', 'at-location', 'completed', 'cancelled'])
    .withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const updateData = { status: req.body.status };
    
    // Set timestamps based on status
    if (req.body.status === 'dispatched' && !updateData.dispatchTime) {
      updateData.dispatchTime = new Date();
    } else if (req.body.status === 'completed') {
      updateData.completionTime = new Date();
    }

    const pickupRequest = await PickupRequest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('userId', 'name email phone');

    if (!pickupRequest) {
      return res.status(404).json({
        success: false,
        message: 'Pickup request not found'
      });
    }

    // Emit real-time update to user
    const io = req.app.get('socketio');
    io.to(`user-${pickupRequest.userId._id}`).emit('pickup-status-updated', {
      requestId: pickupRequest._id,
      status: pickupRequest.status,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: pickupRequest
    });

  } catch (error) {
    console.error('Update pickup status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating pickup status'
    });
  }
});

// @route   PUT /api/v1/pickups/:id/assign-truck
// @desc    Assign truck to pickup request
// @access  Admin
router.put('/:id/assign-truck', requireAdmin, [
  body('truckId').notEmpty().withMessage('Truck ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const pickupRequest = await PickupRequest.findByIdAndUpdate(
      req.params.id,
      { 
        assignedTruck: req.body.truckId,
        status: 'dispatched',
        dispatchTime: new Date()
      },
      { new: true }
    ).populate('userId', 'name email phone')
     .populate('assignedTruck', 'truckId driver vehicle');

    if (!pickupRequest) {
      return res.status(404).json({
        success: false,
        message: 'Pickup request not found'
      });
    }

    // Emit real-time updates
    const io = req.app.get('socketio');
    
    // Notify user
    io.to(`user-${pickupRequest.userId._id}`).emit('truck-dispatch-update', {
      requestId: pickupRequest._id,
      truck: pickupRequest.assignedTruck,
      status: 'dispatched',
      timestamp: pickupRequest.dispatchTime
    });

    res.json({
      success: true,
      message: 'Truck assigned successfully',
      data: pickupRequest
    });

  } catch (error) {
    console.error('Assign truck error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning truck'
    });
  }
});

export default router;