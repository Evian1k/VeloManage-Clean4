import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
  city: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  postalCode: {
    type: String,
    trim: true
  },
  accuracy: {
    type: Number, // GPS accuracy in meters
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  locationType: {
    type: String,
    enum: ['current', 'home', 'work', 'pickup', 'delivery'],
    default: 'current'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Index for geospatial queries
locationSchema.index({ latitude: 1, longitude: 1 });
locationSchema.index({ user: 1 });
locationSchema.index({ isActive: 1 });
locationSchema.index({ locationType: 1 });
locationSchema.index({ createdAt: -1 });

// Static method to get all active user locations for admin
locationSchema.statics.getAllActiveLocations = function() {
  return this.find({ isActive: true })
    .populate('user', 'name email phone role')
    .sort({ updatedAt: -1 });
};

// Static method to get user's current location
locationSchema.statics.getUserCurrentLocation = function(userId) {
  return this.findOne({ 
    user: userId, 
    isActive: true,
    locationType: 'current'
  }).populate('user', 'name email phone');
};

// Static method to find nearby locations
locationSchema.statics.findNearby = function(latitude, longitude, radiusInKm = 10) {
  const radiusInRadians = radiusInKm / 6371; // Earth's radius in km
  
  return this.find({
    isActive: true,
    latitude: {
      $gte: latitude - radiusInRadians,
      $lte: latitude + radiusInRadians
    },
    longitude: {
      $gte: longitude - radiusInRadians,
      $lte: longitude + radiusInRadians
    }
  }).populate('user', 'name email phone');
};

// Instance method to calculate distance to another location
locationSchema.methods.distanceTo = function(otherLocation) {
  const R = 6371; // Earth's radius in km
  const dLat = (otherLocation.latitude - this.latitude) * Math.PI / 180;
  const dLon = (otherLocation.longitude - this.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.latitude * Math.PI / 180) * Math.cos(otherLocation.latitude * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

const Location = mongoose.model('Location', locationSchema);

export default Location;