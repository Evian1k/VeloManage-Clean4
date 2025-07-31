import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    trim: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'main_admin', 'super_admin', 'driver', 'mechanic', 'manager'],
    default: 'user'
  },
  vehicleCount: {
    type: Number,
    default: 0
  },
  lastService: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profile: {
    avatar: String,
    address: String,
    dateOfBirth: Date,
    emergencyContact: {
      name: String,
      phone: String
    }
  },
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'dark'
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

// Check if user is admin
userSchema.methods.isAdminUser = function() {
  return this.isAdmin && ['admin', 'main_admin', 'super_admin'].includes(this.role);
};

// Check role permissions
userSchema.methods.hasPermission = function(permission) {
  const rolePermissions = {
    super_admin: ['all'],
    main_admin: ['manage_users', 'manage_trucks', 'manage_branches', 'view_analytics', 'manage_bookings'],
    admin: ['manage_trucks', 'view_analytics', 'manage_bookings'],
    manager: ['manage_branch', 'manage_staff', 'view_reports'],
    mechanic: ['update_maintenance', 'view_trucks'],
    driver: ['update_location', 'view_assigned_trucks'],
    user: ['book_service', 'view_own_data']
  };

  const userPermissions = rolePermissions[this.role] || [];
  return userPermissions.includes('all') || userPermissions.includes(permission);
};

// Admin emails configuration
const ADMIN_EMAILS = [
  'emmanuel.evian@autocare.com',
  'ibrahim.mohamud@autocare.com',
  'joel.nganga@autocare.com',
  'patience.karanja@autocare.com',
  'joyrose.kinuthia@autocare.com'
];

// Static method to check if email is admin
userSchema.statics.isAdminEmail = function(email) {
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

// Static method to get admin user data
userSchema.statics.getAdminByEmail = function(email) {
  const adminData = {
    'emmanuel.evian@autocare.com': {
      name: 'Emmanuel Evian',
      role: 'main_admin'
    },
    'ibrahim.mohamud@autocare.com': {
      name: 'Ibrahim Mohamud',
      role: 'admin'
    },
    'joel.nganga@autocare.com': {
      name: 'Joel Ng\'ang\'a',
      role: 'admin'
    },
    'patience.karanja@autocare.com': {
      name: 'Patience Karanja',
      role: 'admin'
    },
    'joyrose.kinuthia@autocare.com': {
      name: 'Joyrose Kinuthia',
      role: 'admin'
    }
  };
  
  return adminData[email.toLowerCase()];
};

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ isAdmin: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.model('User', userSchema);

export default User;