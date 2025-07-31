import express from 'express';
import { body, validationResult } from 'express-validator';
import Truck from '../models/Truck.js';
import { requireAdmin } from '../middleware/auth.js';
import { uploadTruckDocuments, handleUploadError, processUploadedFiles } from '../middleware/upload.js';

const router = express.Router();

// @route   GET /api/v1/trucks
// @desc    Get all trucks
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { status, isActive } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const trucks = await Truck.find(filter)
      .populate('assignedRequest', 'pickupLocation status userName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: trucks,
      count: trucks.length
    });

  } catch (error) {
    console.error('Get trucks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving trucks'
    });
  }
});

// @route   GET /api/v1/trucks/:id
// @desc    Get single truck
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const truck = await Truck.findById(req.params.id)
      .populate('assignedRequest', 'pickupLocation status userName userPhone');

    if (!truck) {
      return res.status(404).json({
        success: false,
        message: 'Truck not found'
      });
    }

    res.json({
      success: true,
      data: truck
    });

  } catch (error) {
    console.error('Get truck error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving truck'
    });
  }
});

// @route   POST /api/v1/trucks
// @desc    Create new truck
// @access  Admin only
router.post('/', requireAdmin, uploadTruckDocuments, handleUploadError, [
  body('truckId').trim().notEmpty().withMessage('Truck ID is required'),
  body('driver.name').trim().notEmpty().withMessage('Driver name is required'),
  body('driver.phone').trim().notEmpty().withMessage('Driver phone is required'),
  body('vehicle.licensePlate').trim().notEmpty().withMessage('License plate is required'),
  body('currentLocation.latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  body('currentLocation.longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Check if truck ID or license plate already exists
    const existingTruck = await Truck.findOne({
      $or: [
        { truckId: req.body.truckId },
        { 'vehicle.licensePlate': req.body.vehicle.licensePlate.toUpperCase() }
      ]
    });

    if (existingTruck) {
      return res.status(400).json({
        success: false,
        message: 'Truck ID or license plate already exists'
      });
    }

    // Process uploaded documents
    const uploadedDocs = processUploadedFiles(req.files);
    
    const truck = new Truck({
      ...req.body,
      documents: uploadedDocs
    });
    await truck.save();

    res.status(201).json({
      success: true,
      message: 'Truck created successfully',
      data: truck
    });

  } catch (error) {
    console.error('Create truck error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating truck'
    });
  }
});

// @route   PUT /api/v1/trucks/:id/location
// @desc    Update truck location
// @access  Private
router.put('/:id/location', [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
  body('address').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { latitude, longitude, address = '' } = req.body;
    const truck = await Truck.findById(req.params.id);

    if (!truck) {
      return res.status(404).json({
        success: false,
        message: 'Truck not found'
      });
    }

    await truck.updateLocation(latitude, longitude, address);

    // Emit real-time update via Socket.io
    const io = req.app.get('socketio');
    io.emit('truck-location-updated', {
      truckId: truck._id,
      location: truck.currentLocation,
      status: truck.status
    });

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        currentLocation: truck.currentLocation,
        lastSeen: truck.lastSeen
      }
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating location'
    });
  }
});

// @route   PUT /api/v1/trucks/:id/status
// @desc    Update truck status
// @access  Admin only
router.put('/:id/status', requireAdmin, [
  body('status').isIn(['available', 'dispatched', 'en-route', 'at-location', 'completed', 'maintenance', 'offline'])
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

    const truck = await Truck.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    if (!truck) {
      return res.status(404).json({
        success: false,
        message: 'Truck not found'
      });
    }

    // Emit real-time update
    const io = req.app.get('socketio');
    io.emit('truck-status-updated', {
      truckId: truck._id,
      status: truck.status,
      assignedRequest: truck.assignedRequest
    });

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: truck
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating status'
    });
  }
});

// @route   GET /api/v1/trucks/nearest/:lat/:lng
// @desc    Find nearest available trucks
// @access  Private
router.get('/nearest/:lat/:lng', async (req, res) => {
  try {
    const { lat, lng } = req.params;
    const { maxDistance = 50 } = req.query;

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
    }

    const nearestTrucks = await Truck.findNearestAvailable(latitude, longitude, maxDistance);

    res.json({
      success: true,
      data: nearestTrucks,
      count: nearestTrucks.length
    });

  } catch (error) {
    console.error('Find nearest trucks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error finding nearest trucks'
    });
  }
});

// @route   PUT /api/v1/trucks/:id/assign
// @desc    Assign truck to pickup request
// @access  Admin only
router.put('/:id/assign', requireAdmin, [
  body('requestId').notEmpty().withMessage('Request ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const truck = await Truck.findById(req.params.id);
    if (!truck) {
      return res.status(404).json({
        success: false,
        message: 'Truck not found'
      });
    }

    if (!truck.isAvailable()) {
      return res.status(400).json({
        success: false,
        message: 'Truck is not available for assignment'
      });
    }

    await truck.assignToRequest(req.body.requestId);

    // Emit real-time update
    const io = req.app.get('socketio');
    io.emit('truck-assigned', {
      truckId: truck._id,
      requestId: req.body.requestId,
      status: truck.status
    });

    res.json({
      success: true,
      message: 'Truck assigned successfully',
      data: truck
    });

  } catch (error) {
    console.error('Assign truck error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning truck'
    });
  }
});

// @route   PUT /api/v1/trucks/:id/complete
// @desc    Complete truck assignment
// @access  Admin only
router.put('/:id/complete', requireAdmin, async (req, res) => {
  try {
    const truck = await Truck.findById(req.params.id);
    if (!truck) {
      return res.status(404).json({
        success: false,
        message: 'Truck not found'
      });
    }

    await truck.completeAssignment();

    // Emit real-time update
    const io = req.app.get('socketio');
    io.emit('truck-assignment-completed', {
      truckId: truck._id,
      status: truck.status
    });

    res.json({
      success: true,
      message: 'Assignment completed successfully',
      data: truck
    });

  } catch (error) {
    console.error('Complete assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing assignment'
    });
  }
});

// @route   POST /api/v1/trucks/:id/documents
// @desc    Upload documents for truck
// @access  Admin only
router.post('/:id/documents', requireAdmin, uploadTruckDocuments, handleUploadError, async (req, res) => {
  try {
    const truck = await Truck.findById(req.params.id);
    if (!truck) {
      return res.status(404).json({
        success: false,
        message: 'Truck not found'
      });
    }

    // Process uploaded documents
    const uploadedDocs = processUploadedFiles(req.files);
    
    if (uploadedDocs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Add documents to truck
    truck.documents = truck.documents || [];
    truck.documents.push(...uploadedDocs);
    await truck.save();

    res.json({
      success: true,
      message: `${uploadedDocs.length} document(s) uploaded successfully`,
      data: {
        uploadedDocuments: uploadedDocs,
        truck: truck
      }
    });

  } catch (error) {
    console.error('Upload truck documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading documents'
    });
  }
});

// @route   DELETE /api/v1/trucks/:id/documents/:docId
// @desc    Delete truck document
// @access  Admin only
router.delete('/:id/documents/:docId', requireAdmin, async (req, res) => {
  try {
    const truck = await Truck.findById(req.params.id);
    if (!truck) {
      return res.status(404).json({
        success: false,
        message: 'Truck not found'
      });
    }

    const docIndex = truck.documents.findIndex(doc => doc._id.toString() === req.params.docId);
    if (docIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Remove document from truck
    const removedDoc = truck.documents[docIndex];
    truck.documents.splice(docIndex, 1);
    await truck.save();

    // Try to delete physical file
    // deleteFile(removedDoc.url.replace('/uploads/', ''));

    res.json({
      success: true,
      message: 'Document deleted successfully',
      data: truck
    });

  } catch (error) {
    console.error('Delete truck document error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting document'
    });
  }
});

export default router;