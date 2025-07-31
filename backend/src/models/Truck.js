import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180
  },
  address: {
    type: String,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const truckSchema = new mongoose.Schema({
  truckId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  driver: {
    name: {
      type: String,
      required: true,
      trim: true
    },
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
    licenseNumber: {
      type: String,
      trim: true
    }
  },
  vehicle: {
    licensePlate: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    make: {
      type: String,
      trim: true
    },
    model: {
      type: String,
      trim: true
    },
    year: {
      type: Number,
      min: 1990,
      max: new Date().getFullYear() + 1
    },
    capacity: {
      type: String,
      trim: true
    }
  },
  status: {
    type: String,
    enum: ['available', 'dispatched', 'en-route', 'at-location', 'completed', 'maintenance', 'offline'],
    default: 'available'
  },
  currentLocation: {
    type: locationSchema,
    required: true
  },
  locationHistory: [{
    type: locationSchema
  }],
  assignedRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PickupRequest',
    default: null
  },
  route: {
    origin: locationSchema,
    destination: locationSchema,
    estimatedDuration: Number, // in minutes
    actualDuration: Number,
    distance: Number // in kilometers
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  specifications: {
    fuelType: {
      type: String,
      enum: ['petrol', 'diesel', 'electric', 'hybrid']
    },
    engineSize: String,
    transmission: {
      type: String,
      enum: ['manual', 'automatic']
    }
  },
  maintenance: {
    lastService: Date,
    nextService: Date,
    mileage: {
      type: Number,
      default: 0
    },
    notes: [String]
  },
  documents: [{
    name: String,
    filename: String,
    type: String,
    size: Number,
    url: String,
    uploadDate: {
      type: Date,
      default: Date.now
    },
    category: {
      type: String,
      enum: ['insurance', 'registration', 'inspection', 'maintenance', 'other'],
      default: 'other'
    }
  }]
}, {
  timestamps: true
});

// Update location and add to history
truckSchema.methods.updateLocation = function(latitude, longitude, address = '') {
  // Add current location to history
  if (this.currentLocation && this.currentLocation.latitude) {
    this.locationHistory.push({
      ...this.currentLocation.toObject(),
      timestamp: this.currentLocation.timestamp || new Date()
    });
  }
  
  // Update current location
  this.currentLocation = {
    latitude,
    longitude,
    address,
    timestamp: new Date()
  };
  
  this.lastSeen = new Date();
  
  // Keep only last 100 location history entries
  if (this.locationHistory.length > 100) {
    this.locationHistory = this.locationHistory.slice(-100);
  }
  
  return this.save();
};

// Check if truck is available for assignment
truckSchema.methods.isAvailable = function() {
  return this.status === 'available' && this.isActive;
};

// Assign truck to a pickup request
truckSchema.methods.assignToRequest = function(requestId) {
  this.assignedRequest = requestId;
  this.status = 'dispatched';
  return this.save();
};

// Complete current assignment
truckSchema.methods.completeAssignment = function() {
  this.assignedRequest = null;
  this.status = 'available';
  this.route = {};
  return this.save();
};

// Calculate distance between two points (Haversine formula)
truckSchema.statics.calculateDistance = function(lat1, lon1, lat2, lon2) {
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

// Find nearest available trucks
truckSchema.statics.findNearestAvailable = function(latitude, longitude, maxDistance = 50) {
  return this.find({
    status: 'available',
    isActive: true
  }).then(trucks => {
    return trucks
      .map(truck => {
        const distance = this.calculateDistance(
          latitude, 
          longitude, 
          truck.currentLocation.latitude, 
          truck.currentLocation.longitude
        );
        return { truck, distance };
      })
      .filter(item => item.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .map(item => item.truck);
  });
};

// Indexes for better performance
truckSchema.index({ truckId: 1 });
truckSchema.index({ 'vehicle.licensePlate': 1 });
truckSchema.index({ status: 1 });
truckSchema.index({ isActive: 1 });
truckSchema.index({ assignedRequest: 1 });
truckSchema.index({ 'currentLocation.latitude': 1, 'currentLocation.longitude': 1 });
truckSchema.index({ lastSeen: -1 });
truckSchema.index({ createdAt: -1 });

const Truck = mongoose.model('Truck', truckSchema);

export default Truck;