import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  bookingNumber: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  truck: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Truck',
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  serviceType: {
    type: String,
    enum: ['delivery', 'pickup', 'transport', 'maintenance', 'emergency'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  schedule: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date
    },
    estimatedDuration: {
      type: Number, // in hours
      default: 4
    },
    actualDuration: {
      type: Number // in hours
    }
  },
  route: {
    origin: {
      address: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    destination: {
      address: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    waypoints: [{
      address: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      },
      order: Number
    }],
    estimatedDistance: Number, // in km
    actualDistance: Number // in km
  },
  cargo: {
    description: String,
    weight: Number, // in kg
    volume: Number, // in cubic meters
    specialRequirements: [String]
  },
  pricing: {
    baseRate: {
      type: Number,
      default: 0
    },
    distanceRate: {
      type: Number,
      default: 0
    },
    timeRate: {
      type: Number,
      default: 0
    },
    additionalCharges: [{
      description: String,
      amount: Number
    }],
    totalAmount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'KES'
    }
  },
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  notes: {
    customerNotes: String,
    driverNotes: String,
    adminNotes: String
  },
  timeline: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  }],
  rating: {
    customerRating: {
      score: {
        type: Number,
        min: 1,
        max: 5
      },
      feedback: String
    },
    driverRating: {
      score: {
        type: Number,
        min: 1,
        max: 5
      },
      feedback: String
    }
  }
}, {
  timestamps: true
});

// Generate booking number
bookingSchema.pre('save', async function(next) {
  if (!this.bookingNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    
    // Find the latest booking for this month
    const latestBooking = await this.constructor.findOne({
      bookingNumber: new RegExp(`^BK${year}${month}`)
    }).sort({ bookingNumber: -1 });
    
    let sequence = 1;
    if (latestBooking) {
      const lastSequence = parseInt(latestBooking.bookingNumber.slice(-4));
      sequence = lastSequence + 1;
    }
    
    this.bookingNumber = `BK${year}${month}${sequence.toString().padStart(4, '0')}`;
  }
  next();
});

// Calculate total amount
bookingSchema.methods.calculateTotal = function() {
  let total = this.pricing.baseRate || 0;
  
  if (this.route.estimatedDistance) {
    total += (this.route.estimatedDistance * (this.pricing.distanceRate || 0));
  }
  
  if (this.schedule.estimatedDuration) {
    total += (this.schedule.estimatedDuration * (this.pricing.timeRate || 0));
  }
  
  if (this.pricing.additionalCharges) {
    total += this.pricing.additionalCharges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
  }
  
  this.pricing.totalAmount = total;
  return total;
};

// Update status with timeline
bookingSchema.methods.updateStatus = function(newStatus, updatedBy, notes = '') {
  this.status = newStatus;
  this.timeline.push({
    status: newStatus,
    updatedBy,
    notes,
    timestamp: new Date()
  });
  return this.save();
};

// Check if booking can be cancelled
bookingSchema.methods.canBeCancelled = function() {
  return ['pending', 'confirmed', 'assigned'].includes(this.status);
};

// Static method to find available trucks for booking
bookingSchema.statics.findAvailableTrucks = async function(startDate, endDate, serviceType) {
  const conflictingBookings = await this.find({
    status: { $in: ['confirmed', 'assigned', 'in_progress'] },
    $or: [
      {
        'schedule.startDate': { $lte: endDate },
        'schedule.endDate': { $gte: startDate }
      }
    ]
  }).distinct('truck');
  
  const Truck = mongoose.model('Truck');
  return Truck.find({
    _id: { $nin: conflictingBookings },
    status: 'available',
    isActive: true
  });
};

// Indexes
bookingSchema.index({ bookingNumber: 1 });
bookingSchema.index({ customer: 1 });
bookingSchema.index({ truck: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ 'schedule.startDate': 1 });
bookingSchema.index({ serviceType: 1 });
bookingSchema.index({ createdAt: -1 });

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;