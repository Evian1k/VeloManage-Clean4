import express from 'express';
import { body, validationResult } from 'express-validator';
import Branch from '../models/Branch.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/v1/branches
// @desc    Get all branches
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { city, service, isActive } = req.query;
    const filter = {};
    
    if (city) filter['location.city'] = new RegExp(city, 'i');
    if (service) filter.services = service;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const branches = await Branch.find(filter)
      .populate('manager', 'name email phone')
      .populate('staff.employee', 'name email phone role')
      .populate('assignedTrucks', 'truckId vehicle.licensePlate status')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: branches,
      count: branches.length
    });

  } catch (error) {
    console.error('Get branches error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving branches'
    });
  }
});

// @route   GET /api/v1/branches/:id
// @desc    Get single branch
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id)
      .populate('manager', 'name email phone role')
      .populate('staff.employee', 'name email phone role')
      .populate('assignedTrucks', 'truckId vehicle driver currentLocation status');

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    res.json({
      success: true,
      data: branch
    });

  } catch (error) {
    console.error('Get branch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving branch'
    });
  }
});

// @route   POST /api/v1/branches
// @desc    Create new branch
// @access  Admin only
router.post('/', requireAdmin, [
  body('name').trim().notEmpty().withMessage('Branch name is required'),
  body('code').trim().notEmpty().withMessage('Branch code is required'),
  body('location.address').trim().notEmpty().withMessage('Address is required'),
  body('location.city').trim().notEmpty().withMessage('City is required'),
  body('contact.phone').trim().notEmpty().withMessage('Phone number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Check if branch code already exists
    const existingBranch = await Branch.findOne({ 
      code: req.body.code.toUpperCase() 
    });

    if (existingBranch) {
      return res.status(400).json({
        success: false,
        message: 'Branch code already exists'
      });
    }

    const branch = new Branch({
      ...req.body,
      code: req.body.code.toUpperCase()
    });

    await branch.save();

    res.status(201).json({
      success: true,
      message: 'Branch created successfully',
      data: branch
    });

  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating branch'
    });
  }
});

// @route   PUT /api/v1/branches/:id
// @desc    Update branch
// @access  Admin only
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('manager', 'name email phone')
     .populate('staff.employee', 'name email phone');

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    res.json({
      success: true,
      message: 'Branch updated successfully',
      data: branch
    });

  } catch (error) {
    console.error('Update branch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating branch'
    });
  }
});

// @route   POST /api/v1/branches/:id/staff
// @desc    Add staff to branch
// @access  Admin only
router.post('/:id/staff', requireAdmin, [
  body('employee').notEmpty().withMessage('Employee ID is required'),
  body('role').isIn(['manager', 'supervisor', 'mechanic', 'driver', 'admin_staff'])
    .withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Check if employee is already assigned
    const existingStaff = branch.staff.find(
      s => s.employee.toString() === req.body.employee && s.isActive
    );

    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: 'Employee already assigned to this branch'
      });
    }

    branch.staff.push({
      employee: req.body.employee,
      role: req.body.role,
      startDate: new Date()
    });

    await branch.save();

    const updatedBranch = await Branch.findById(req.params.id)
      .populate('staff.employee', 'name email phone');

    res.json({
      success: true,
      message: 'Staff member added successfully',
      data: updatedBranch
    });

  } catch (error) {
    console.error('Add staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding staff member'
    });
  }
});

// @route   PUT /api/v1/branches/:id/staff/:staffId
// @desc    Update staff member
// @access  Admin only
router.put('/:id/staff/:staffId', requireAdmin, async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    const staffMember = branch.staff.id(req.params.staffId);
    if (!staffMember) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Update staff member
    Object.assign(staffMember, req.body);
    await branch.save();

    const updatedBranch = await Branch.findById(req.params.id)
      .populate('staff.employee', 'name email phone');

    res.json({
      success: true,
      message: 'Staff member updated successfully',
      data: updatedBranch
    });

  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating staff member'
    });
  }
});

// @route   GET /api/v1/branches/nearby/:lat/:lng
// @desc    Find nearby branches
// @access  Private
router.get('/nearby/:lat/:lng', async (req, res) => {
  try {
    const { lat, lng } = req.params;
    const { maxDistance = 50, service } = req.query;

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
    }

    let nearbyBranches = await Branch.findNearby(latitude, longitude, maxDistance);

    // Filter by service type if specified
    if (service) {
      nearbyBranches = nearbyBranches.filter(branch => 
        branch.services.includes(service)
      );
    }

    res.json({
      success: true,
      data: nearbyBranches,
      count: nearbyBranches.length
    });

  } catch (error) {
    console.error('Find nearby branches error:', error);
    res.status(500).json({
      success: false,
      message: 'Error finding nearby branches'
    });
  }
});

// @route   GET /api/v1/branches/:id/analytics
// @desc    Get branch analytics
// @access  Admin only
router.get('/:id/analytics', requireAdmin, async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id)
      .populate('assignedTrucks', 'status')
      .populate('staff.employee', 'isActive');

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Calculate analytics
    const analytics = {
      trucks: {
        total: branch.assignedTrucks.length,
        available: branch.assignedTrucks.filter(t => t.status === 'available').length,
        inUse: branch.assignedTrucks.filter(t => ['dispatched', 'en-route', 'at-location'].includes(t.status)).length,
        maintenance: branch.assignedTrucks.filter(t => t.status === 'maintenance').length
      },
      staff: {
        total: branch.staff.length,
        active: branch.staff.filter(s => s.isActive).length,
        byRole: {}
      },
      capacity: {
        truckUtilization: (branch.assignedTrucks.length / branch.capacity.maxTrucks) * 100,
        isAtCapacity: branch.assignedTrucks.length >= branch.capacity.maxTrucks
      },
      status: {
        isOpen: branch.isOpenNow(),
        operatingHours: branch.workingHours
      }
    };

    // Group staff by role
    branch.staff.forEach(staff => {
      const role = staff.role;
      analytics.staff.byRole[role] = (analytics.staff.byRole[role] || 0) + 1;
    });

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Get branch analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving branch analytics'
    });
  }
});

export default router;