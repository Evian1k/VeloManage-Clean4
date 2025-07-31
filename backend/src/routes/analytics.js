import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Truck from '../models/Truck.js';
import Branch from '../models/Branch.js';
import Booking from '../models/Booking.js';
import Message from '../models/Message.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/v1/analytics/dashboard
// @desc    Get dashboard analytics
// @access  Admin only
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get basic counts
    const [
      totalUsers,
      totalTrucks,
      totalBranches,
      activeBookings,
      completedBookings,
      totalRevenue
    ] = await Promise.all([
      User.countDocuments({ isAdmin: false }),
      Truck.countDocuments({ isActive: true }),
      Branch.countDocuments({ isActive: true }),
      Booking.countDocuments({ 
        status: { $in: ['pending', 'confirmed', 'assigned', 'in_progress'] }
      }),
      Booking.countDocuments({ 
        status: 'completed',
        createdAt: { $gte: startDate }
      }),
      Booking.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$pricing.totalAmount' }
          }
        }
      ])
    ]);

    // Truck status distribution
    const truckStatusData = await Truck.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Booking trends (last 7 days)
    const bookingTrends = await Booking.aggregate([
      {
        $match: {
          createdAt: { 
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
          }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          bookings: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Service type distribution
    const serviceTypeData = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$serviceType',
          count: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' }
        }
      }
    ]);

    // Top performing branches
    const branchPerformance = await Branch.aggregate([
      {
        $lookup: {
          from: 'trucks',
          localField: 'assignedTrucks',
          foreignField: '_id',
          as: 'trucks'
        }
      },
      {
        $lookup: {
          from: 'bookings',
          let: { branchId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$branch', '$$branchId'] },
                createdAt: { $gte: startDate }
              }
            }
          ],
          as: 'bookings'
        }
      },
      {
        $project: {
          name: 1,
          code: 1,
          truckCount: { $size: '$trucks' },
          bookingCount: { $size: '$bookings' },
          revenue: {
            $sum: '$bookings.pricing.totalAmount'
          }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]);

    // Fleet utilization
    const fleetUtilization = await Truck.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          available: {
            $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
          },
          dispatched: {
            $sum: { $cond: [{ $eq: ['$status', 'dispatched'] }, 1, 0] }
          },
          maintenance: {
            $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] }
          }
        }
      }
    ]);

    // Average ratings
    const ratingStats = await Booking.aggregate([
      {
        $match: {
          'rating.customerRating.score': { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          avgCustomerRating: { $avg: '$rating.customerRating.score' },
          avgDriverRating: { $avg: '$rating.driverRating.score' },
          totalRatings: { $sum: 1 }
        }
      }
    ]);

    const analytics = {
      overview: {
        totalUsers,
        totalTrucks,
        totalBranches,
        activeBookings,
        completedBookings: completedBookings,
        totalRevenue: totalRevenue[0]?.total || 0,
        period: `${period} days`
      },
      truckStatus: truckStatusData.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      bookingTrends: bookingTrends.map(item => ({
        date: item._id.date,
        bookings: item.bookings,
        revenue: item.revenue
      })),
      serviceTypes: serviceTypeData,
      branchPerformance,
      fleetUtilization: fleetUtilization[0] || {
        total: 0,
        available: 0,
        dispatched: 0,
        maintenance: 0
      },
      ratings: ratingStats[0] || {
        avgCustomerRating: 0,
        avgDriverRating: 0,
        totalRatings: 0
      }
    };

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving analytics'
    });
  }
});

// @route   GET /api/v1/analytics/fleet
// @desc    Get fleet analytics
// @access  Admin only
router.get('/fleet', requireAdmin, async (req, res) => {
  try {
    // Fleet overview
    const fleetOverview = await Truck.aggregate([
      {
        $group: {
          _id: null,
          totalTrucks: { $sum: 1 },
          activeTrucks: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          avgAge: {
            $avg: {
              $subtract: [new Date().getFullYear(), '$vehicle.year']
            }
          }
        }
      }
    ]);

    // Truck utilization by status
    const utilizationData = await Truck.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          percentage: {
            $multiply: [
              { $divide: [{ $sum: 1 }, { $sum: 1 }] },
              100
            ]
          }
        }
      }
    ]);

    // Maintenance statistics
    const maintenanceStats = await Truck.aggregate([
      {
        $group: {
          _id: null,
          needsMaintenance: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$status', 'maintenance'] },
                    {
                      $lt: [
                        '$maintenance.nextService',
                        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                      ]
                    }
                  ]
                },
                1,
                0
              ]
            }
          },
          avgMileage: { $avg: '$maintenance.mileage' }
        }
      }
    ]);

    // Performance by truck
    const truckPerformance = await Booking.aggregate([
      {
        $match: {
          truck: { $exists: true },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$truck',
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.totalAmount' },
          avgRating: { $avg: '$rating.customerRating.score' }
        }
      },
      {
        $lookup: {
          from: 'trucks',
          localField: '_id',
          foreignField: '_id',
          as: 'truck'
        }
      },
      {
        $unwind: '$truck'
      },
      {
        $project: {
          truckId: '$truck.truckId',
          licensePlate: '$truck.vehicle.licensePlate',
          driver: '$truck.driver.name',
          totalBookings: 1,
          totalRevenue: 1,
          avgRating: 1
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        overview: fleetOverview[0] || {},
        utilization: utilizationData,
        maintenance: maintenanceStats[0] || {},
        topPerformers: truckPerformance
      }
    });

  } catch (error) {
    console.error('Get fleet analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving fleet analytics'
    });
  }
});

// @route   GET /api/v1/analytics/revenue
// @desc    Get revenue analytics
// @access  Admin only
router.get('/revenue', requireAdmin, async (req, res) => {
  try {
    const { period = '30', groupBy = 'day' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    let groupFormat;
    switch (groupBy) {
      case 'hour':
        groupFormat = '%Y-%m-%d %H:00';
        break;
      case 'day':
        groupFormat = '%Y-%m-%d';
        break;
      case 'week':
        groupFormat = '%Y-W%U';
        break;
      case 'month':
        groupFormat = '%Y-%m';
        break;
      default:
        groupFormat = '%Y-%m-%d';
    }

    // Revenue trends
    const revenueTrends = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            period: { $dateToString: { format: groupFormat, date: '$createdAt' } }
          },
          revenue: { $sum: '$pricing.totalAmount' },
          bookings: { $sum: 1 },
          avgBookingValue: { $avg: '$pricing.totalAmount' }
        }
      },
      { $sort: { '_id.period': 1 } }
    ]);

    // Revenue by service type
    const revenueByService = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$serviceType',
          revenue: { $sum: '$pricing.totalAmount' },
          bookings: { $sum: 1 },
          avgValue: { $avg: '$pricing.totalAmount' }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // Total revenue summary
    const totalRevenue = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$pricing.totalAmount' },
          totalBookings: { $sum: 1 },
          avgBookingValue: { $avg: '$pricing.totalAmount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: totalRevenue[0] || {
          totalRevenue: 0,
          totalBookings: 0,
          avgBookingValue: 0
        },
        trends: revenueTrends.map(item => ({
          period: item._id.period,
          revenue: item.revenue,
          bookings: item.bookings,
          avgBookingValue: item.avgBookingValue
        })),
        byServiceType: revenueByService,
        period: `${period} days`,
        groupBy
      }
    });

  } catch (error) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving revenue analytics'
    });
  }
});

export default router;