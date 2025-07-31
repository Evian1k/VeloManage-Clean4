import express from 'express';
import User from '../models/User.js';
import Truck from '../models/Truck.js';
import Branch from '../models/Branch.js';
import Booking from '../models/Booking.js';
import Message from '../models/Message.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/v1/dashboard/overview
// @desc    Get complete dashboard overview
// @access  Admin only
router.get('/overview', requireAdmin, async (req, res) => {
  try {
    // Get real-time counts
    const [
      totalUsers,
      totalTrucks,
      totalBranches,
      activeBookings,
      unreadMessages,
      maintenanceDue
    ] = await Promise.all([
      User.countDocuments({ isAdmin: false, isActive: true }),
      Truck.countDocuments({ isActive: true }),
      Branch.countDocuments({ isActive: true }),
      Booking.countDocuments({ 
        status: { $in: ['pending', 'confirmed', 'assigned', 'in_progress'] }
      }),
      Message.countDocuments({ 
        senderType: 'user', 
        isRead: false 
      }),
      Truck.countDocuments({
        $or: [
          { status: 'maintenance' },
          { 'maintenance.nextService': { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }
        ]
      })
    ]);

    // Get fleet status distribution
    const fleetStatus = await Truck.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent activity
    const recentBookings = await Booking.find()
      .populate('customer', 'name email')
      .populate('truck', 'truckId vehicle.licensePlate')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentMessages = await Message.find({ senderType: 'user' })
      .populate('sender', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get branch performance
    const branchStats = await Branch.aggregate([
      {
        $lookup: {
          from: 'trucks',
          localField: 'assignedTrucks',
          foreignField: '_id',
          as: 'trucks'
        }
      },
      {
        $project: {
          name: 1,
          code: 1,
          truckCount: { $size: '$trucks' },
          maxCapacity: '$capacity.maxTrucks',
          utilizationRate: {
            $multiply: [
              { $divide: [{ $size: '$trucks' }, '$capacity.maxTrucks'] },
              100
            ]
          }
        }
      }
    ]);

    // Get today's statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStats = await Promise.all([
      Booking.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow }
      }),
      Booking.countDocuments({
        status: 'completed',
        updatedAt: { $gte: today, $lt: tomorrow }
      }),
      Message.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow }
      })
    ]);

    const dashboardData = {
      overview: {
        totalUsers,
        totalTrucks,
        totalBranches,
        activeBookings,
        unreadMessages,
        maintenanceDue
      },
      fleetStatus: fleetStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      todayStats: {
        newBookings: todayStats[0],
        completedBookings: todayStats[1],
        newMessages: todayStats[2]
      },
      recentActivity: {
        bookings: recentBookings,
        messages: recentMessages
      },
      branchStats,
      alerts: {
        maintenanceDue,
        unreadMessages,
        lowUtilization: branchStats.filter(b => b.utilizationRate < 30).length
      }
    };

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving dashboard data'
    });
  }
});

// @route   GET /api/v1/dashboard/fleet-map
// @desc    Get real-time fleet map data
// @access  Admin only
router.get('/fleet-map', requireAdmin, async (req, res) => {
  try {
    // Get all trucks with current locations
    const trucks = await Truck.find({ isActive: true })
      .populate('assignedRequest', 'customer route status')
      .select('truckId driver vehicle currentLocation status assignedRequest lastSeen');

    // Get all pickup requests with locations
    const pickupRequests = await Booking.find({
      status: { $in: ['pending', 'confirmed', 'assigned', 'in_progress'] },
      'route.origin': { $exists: true }
    })
      .populate('customer', 'name phone')
      .populate('truck', 'truckId vehicle.licensePlate')
      .select('bookingNumber customer truck route status priority createdAt');

    // Get branch locations
    const branches = await Branch.find({ isActive: true })
      .select('name code location contact services capacity assignedTrucks');

    const mapData = {
      trucks: trucks.map(truck => ({
        id: truck._id,
        truckId: truck.truckId,
        driver: truck.driver.name,
        licensePlate: truck.vehicle.licensePlate,
        location: truck.currentLocation,
        status: truck.status,
        lastSeen: truck.lastSeen,
        assignedRequest: truck.assignedRequest
      })),
      pickupRequests: pickupRequests.map(request => ({
        id: request._id,
        bookingNumber: request.bookingNumber,
        customer: request.customer,
        truck: request.truck,
        origin: request.route.origin,
        destination: request.route.destination,
        status: request.status,
        priority: request.priority,
        createdAt: request.createdAt
      })),
      branches: branches.map(branch => ({
        id: branch._id,
        name: branch.name,
        code: branch.code,
        location: branch.location,
        contact: branch.contact,
        services: branch.services,
        truckCount: branch.assignedTrucks.length,
        maxCapacity: branch.capacity.maxTrucks
      }))
    };

    res.json({
      success: true,
      data: mapData
    });

  } catch (error) {
    console.error('Get fleet map data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving fleet map data'
    });
  }
});

// @route   GET /api/v1/dashboard/notifications
// @desc    Get real-time notifications
// @access  Admin only
router.get('/notifications', requireAdmin, async (req, res) => {
  try {
    const notifications = [];

    // Unread messages
    const unreadMessages = await Message.find({
      senderType: 'user',
      isRead: false
    })
      .populate('sender', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

    unreadMessages.forEach(msg => {
      notifications.push({
        id: msg._id,
        type: 'message',
        title: 'New Message',
        message: `Message from ${msg.sender.name}`,
        timestamp: msg.createdAt,
        priority: 'medium',
        isRead: false
      });
    });

    // Maintenance due
    const maintenanceDue = await Truck.find({
      $or: [
        { status: 'maintenance' },
        { 'maintenance.nextService': { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }
      ]
    }).limit(5);

    maintenanceDue.forEach(truck => {
      notifications.push({
        id: `maintenance-${truck._id}`,
        type: 'maintenance',
        title: 'Maintenance Due',
        message: `Truck ${truck.truckId} needs maintenance`,
        timestamp: truck.maintenance.nextService || new Date(),
        priority: 'high',
        isRead: false
      });
    });

    // Pending bookings
    const pendingBookings = await Booking.find({
      status: 'pending'
    })
      .populate('customer', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    pendingBookings.forEach(booking => {
      notifications.push({
        id: `booking-${booking._id}`,
        type: 'booking',
        title: 'New Booking',
        message: `New booking from ${booking.customer.name}`,
        timestamp: booking.createdAt,
        priority: 'medium',
        isRead: false
      });
    });

    // Sort by timestamp (newest first)
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: {
        notifications: notifications.slice(0, 20), // Limit to 20 most recent
        counts: {
          total: notifications.length,
          unread: notifications.filter(n => !n.isRead).length,
          high: notifications.filter(n => n.priority === 'high').length
        }
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving notifications'
    });
  }
});

// @route   GET /api/v1/dashboard/performance
// @desc    Get performance metrics
// @access  Admin only
router.get('/performance', requireAdmin, async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Fleet utilization
    const fleetUtilization = await Truck.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [
                { $in: ['$status', ['dispatched', 'en-route', 'at-location']] },
                1,
                0
              ]
            }
          },
          available: {
            $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
          },
          maintenance: {
            $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] }
          }
        }
      }
    ]);

    // Booking completion rate
    const bookingStats = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Average rating
    const avgRating = await Booking.aggregate([
      {
        $match: {
          'rating.customerRating.score': { $exists: true },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating.customerRating.score' },
          totalRatings: { $sum: 1 }
        }
      }
    ]);

    const performance = {
      fleetUtilization: fleetUtilization[0] || {
        total: 0,
        active: 0,
        available: 0,
        maintenance: 0
      },
      bookingStats: bookingStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      customerSatisfaction: avgRating[0] || {
        avgRating: 0,
        totalRatings: 0
      },
      period: `${period} days`
    };

    res.json({
      success: true,
      data: performance
    });

  } catch (error) {
    console.error('Get performance metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving performance metrics'
    });
  }
});

export default router;