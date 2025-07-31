import express from 'express';
import { body, validationResult } from 'express-validator';
import Location from '../models/Location.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/v1/locations
// @desc    Share user location
// @access  Private
router.post('/', [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('address').optional().isString().withMessage('Address must be a string'),
  body('locationType').optional().isIn(['current', 'home', 'work', 'pickup', 'delivery']).withMessage('Invalid location type'),
  body('notes').optional().isString().isLength({ max: 500 }).withMessage('Notes must be less than 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      latitude,
      longitude,
      address,
      city,
      state,
      country,
      postalCode,
      accuracy,
      locationType = 'current',
      notes
    } = req.body;

    // Deactivate previous current location if this is a new current location
    if (locationType === 'current') {
      await Location.updateMany(
        { user: req.user._id, locationType: 'current' },
        { isActive: false }
      );
    }

    // Create new location
    const location = new Location({
      user: req.user._id,
      latitude,
      longitude,
      address,
      city,
      state,
      country,
      postalCode,
      accuracy,
      locationType,
      notes
    });

    await location.save();

    // Populate user data
    const populatedLocation = await Location.findById(location._id)
      .populate('user', 'name email phone role');

    // Broadcast location update to admins
    const io = req.app.get('socketio');
    io.to('admin-room').emit('location-shared', {
      userId: req.user._id,
      userName: req.user.name,
      location: populatedLocation,
      timestamp: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Location shared successfully',
      data: populatedLocation
    });

  } catch (error) {
    console.error('Share location error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sharing location'
    });
  }
});

// @route   GET /api/v1/locations/my
// @desc    Get user's locations
// @access  Private
router.get('/my', async (req, res) => {
  try {
    const { type } = req.query;
    let query = { user: req.user._id, isActive: true };
    
    if (type) {
      query.locationType = type;
    }

    const locations = await Location.find(query)
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: locations
    });

  } catch (error) {
    console.error('Get user locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving locations'
    });
  }
});

// @route   GET /api/v1/locations/all
// @desc    Get all user locations (Admin only)
// @access  Admin
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const locations = await Location.getAllActiveLocations();

    res.json({
      success: true,
      data: locations
    });

  } catch (error) {
    console.error('Get all locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving all locations'
    });
  }
});

// @route   GET /api/v1/locations/nearby
// @desc    Find nearby locations
// @access  Private
router.get('/nearby', [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('radius').optional().isFloat({ min: 0.1, max: 100 }).withMessage('Radius must be between 0.1 and 100 km')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { latitude, longitude, radius = 10 } = req.query;

    const nearbyLocations = await Location.findNearby(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius)
    );

    res.json({
      success: true,
      data: nearbyLocations
    });

  } catch (error) {
    console.error('Find nearby locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error finding nearby locations'
    });
  }
});

// @route   PUT /api/v1/locations/:id
// @desc    Update location
// @access  Private
router.put('/:id', [
  body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('address').optional().isString().withMessage('Address must be a string'),
  body('notes').optional().isString().isLength({ max: 500 }).withMessage('Notes must be less than 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const location = await Location.findById(id);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Check if user owns this location or is admin
    if (location.user.toString() !== req.user._id.toString() && !req.user.isAdminUser()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this location'
      });
    }

    // Update location
    Object.assign(location, req.body);
    await location.save();

    const populatedLocation = await Location.findById(location._id)
      .populate('user', 'name email phone role');

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: populatedLocation
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating location'
    });
  }
});

// @route   DELETE /api/v1/locations/:id
// @desc    Delete location
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const location = await Location.findById(id);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Check if user owns this location or is admin
    if (location.user.toString() !== req.user._id.toString() && !req.user.isAdminUser()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this location'
      });
    }

    // Soft delete by setting isActive to false
    location.isActive = false;
    await location.save();

    res.json({
      success: true,
      message: 'Location deleted successfully'
    });

  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting location'
    });
  }
});

export default router;