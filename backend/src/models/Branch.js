import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  location: {
    address: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    zipCode: {
      type: String,
      trim: true
    },
    coordinates: {
      latitude: {
        type: Number,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180
      }
    }
  },
  contact: {
    phone: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    fax: {
      type: String,
      trim: true
    }
  },
  workingHours: {
    monday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    tuesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    wednesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    thursday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    friday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    saturday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    sunday: { open: String, close: String, isOpen: { type: Boolean, default: false } }
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  staff: [{
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['manager', 'supervisor', 'mechanic', 'driver', 'admin_staff'],
      default: 'mechanic'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  assignedTrucks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Truck'
  }],
  services: [{
    type: String,
    enum: ['maintenance', 'repair', 'inspection', 'emergency', 'fuel', 'car_wash']
  }],
  capacity: {
    maxTrucks: {
      type: Number,
      default: 50
    },
    serviceSlots: {
      type: Number,
      default: 10
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  establishedDate: {
    type: Date,
    default: Date.now
  },
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Virtual for current truck count
branchSchema.virtual('currentTruckCount').get(function() {
  return this.assignedTrucks.length;
});

// Virtual for staff count
branchSchema.virtual('staffCount').get(function() {
  return this.staff.filter(s => s.isActive).length;
});

// Instance method to check if branch is open
branchSchema.methods.isOpenNow = function() {
  const now = new Date();
  const currentDay = now.toLocaleLowerCase().substring(0, 3); // mon, tue, etc.
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const daySchedule = this.workingHours[currentDay];
  if (!daySchedule || !daySchedule.isOpen) return false;

  const openTime = this.parseTime(daySchedule.open);
  const closeTime = this.parseTime(daySchedule.close);

  return currentTime >= openTime && currentTime <= closeTime;
};

// Helper method to parse time string (HH:MM)
branchSchema.methods.parseTime = function(timeString) {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

// Static method to find branches by service type
branchSchema.statics.findByService = function(serviceType) {
  return this.find({
    services: serviceType,
    isActive: true
  }).populate('manager', 'name email phone')
    .populate('staff.employee', 'name email phone');
};

// Static method to find nearest branches
branchSchema.statics.findNearby = function(latitude, longitude, maxDistance = 50) {
  return this.find({
    'location.coordinates.latitude': { $exists: true },
    'location.coordinates.longitude': { $exists: true },
    isActive: true
  }).then(branches => {
    return branches
      .map(branch => {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          branch.location.coordinates.latitude,
          branch.location.coordinates.longitude
        );
        return { branch, distance };
      })
      .filter(item => item.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .map(item => item.branch);
  });
};

// Calculate distance using Haversine formula
branchSchema.statics.calculateDistance = function(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Indexes
branchSchema.index({ code: 1 });
branchSchema.index({ 'location.city': 1 });
branchSchema.index({ 'location.coordinates.latitude': 1, 'location.coordinates.longitude': 1 });
branchSchema.index({ isActive: 1 });
branchSchema.index({ services: 1 });

const Branch = mongoose.model('Branch', branchSchema);

export default Branch;