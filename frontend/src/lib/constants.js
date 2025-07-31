// Application Configuration
export const APP_CONFIG = {
  name: 'AutoCare Pro',
  version: '1.0.0',
  description: 'Premium Car Management System',
  company: 'AutoCare Solutions',
  supportEmail: 'support@autocare.com',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
};

// API Configuration
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 10000,
  retryAttempts: 3,
  retryDelay: 1000
};

// Service Types
export const SERVICE_TYPES = {
  BRAKE_REPAIR: 'Brake Repair',
  ROUTINE_3000KM: '3000km Routine Maintenance',
  VEHICLE_PICKUP: 'Vehicle Pickup',
  OIL_CHANGE: 'Oil Change',
  TIRE_REPLACEMENT: 'Tire Replacement',
  ENGINE_DIAGNOSTIC: 'Engine Diagnostic',
  TRANSMISSION_SERVICE: 'Transmission Service',
  AC_REPAIR: 'AC Repair',
  BATTERY_REPLACEMENT: 'Battery Replacement',
  WHEEL_ALIGNMENT: 'Wheel Alignment',
  BRAKE_SERVICE: 'Brake Service',
  SUSPENSION_REPAIR: 'Suspension Repair'
};

// Request Status
export const REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Priority Levels
export const PRIORITY_LEVELS = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent'
};

// Vehicle Makes (common ones)
export const VEHICLE_MAKES = [
  'Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'BMW', 'Mercedes-Benz',
  'Audi', 'Volkswagen', 'Hyundai', 'Kia', 'Mazda', 'Subaru', 'Jeep',
  'Ram', 'GMC', 'Cadillac', 'Lexus', 'Infiniti', 'Acura', 'Volvo',
  'Land Rover', 'Porsche', 'Tesla', 'Mitsubishi', 'Buick', 'Lincoln',
  'Jaguar', 'Mini', 'Fiat', 'Alfa Romeo', 'Genesis', 'Other'
];

// Notification Types
export const NOTIFICATION_TYPES = {
  SERVICE_APPROVED: 'service_approved',
  SERVICE_COMPLETED: 'service_completed',
  SERVICE_CANCELLED: 'service_cancelled',
  REMINDER: 'reminder',
  SYSTEM: 'system',
  PROMOTION: 'promotion'
};

// User Roles
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  MECHANIC: 'mechanic',
  MANAGER: 'manager'
};

// Storage Keys
export const STORAGE_KEYS = {
  USER: 'autocare_user',
  REQUESTS: 'autocare_requests',
  VEHICLES: 'autocare_vehicles',
  NOTIFICATIONS: 'autocare_notifications',
  THEME: 'autocare_theme',
  SETTINGS: 'autocare_settings'
};

// Route Paths
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  ADMIN: '/admin',
  SERVICE_REQUEST: '/request-service',
  TRACKING: '/tracking',
  MY_VEHICLES: '/my-vehicles',
  SERVICE_HISTORY: '/service-history',
  SETTINGS: '/settings'
};

// Validation Limits
export const VALIDATION_LIMITS = {
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  EMAIL_MAX_LENGTH: 255,
  PHONE_MIN_LENGTH: 10,
  PHONE_MAX_LENGTH: 15,
  PASSWORD_MIN_LENGTH: 8,
  DESCRIPTION_MIN_LENGTH: 10,
  DESCRIPTION_MAX_LENGTH: 500,
  LICENSE_PLATE_MIN_LENGTH: 3,
  LICENSE_PLATE_MAX_LENGTH: 10
};

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  INPUT: 'yyyy-MM-dd',
  DATETIME: 'MMM dd, yyyy HH:mm',
  TIME: 'HH:mm'
};

// Theme Configuration
export const THEME_CONFIG = {
  colors: {
    primary: {
      50: '#fef2f2',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      900: '#7f1d1d'
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      500: '#6b7280',
      900: '#111827'
    }
  },
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  }
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  FILE_TOO_LARGE: `File size must be less than ${APP_CONFIG.maxFileSize / 1024 / 1024}MB`,
  INVALID_FILE_TYPE: 'Invalid file type. Please upload a valid image or PDF file.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  DEFAULT: 'An unexpected error occurred. Please try again.'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN: 'Welcome back! You have been successfully logged in.',
  REGISTER: 'Account created successfully! Welcome to AutoCare Pro.',
  SERVICE_REQUEST: 'Service request submitted successfully!',
  PROFILE_UPDATE: 'Profile updated successfully!',
  PASSWORD_CHANGE: 'Password changed successfully!',
  VEHICLE_ADDED: 'Vehicle added successfully!',
  VEHICLE_UPDATED: 'Vehicle updated successfully!',
  SERVICE_APPROVED: 'Service request approved successfully!',
  SERVICE_COMPLETED: 'Service marked as completed successfully!'
};

// Feature Flags (for gradual rollout of new features)
export const FEATURE_FLAGS = {
  REAL_TIME_NOTIFICATIONS: false,
  FILE_UPLOAD: false,
  PAYMENT_INTEGRATION: false,
  CHAT_SUPPORT: false,
  ANALYTICS_DASHBOARD: false,
  MOBILE_APP_INTEGRATION: false
};

// Admin Configuration
export const ADMIN_CONFIG = {
  ADMINS: [
    {
      name: 'Emmanuel Evian',
      email: 'emmanuel.evian@autocare.com',
      username: 'emmanuelevian',
      password: 'autocarpro12k@12k.wwc',
      role: 'main_admin'
    },
    {
      name: 'Ibrahim Mohamud',
      email: 'ibrahim.mohamud@autocare.com',
      username: 'ibrahim.mohamud',
      password: 'autocarpro12k@12k.wwc',
      role: 'admin'
    },
    {
      name: 'Joel Ng\'ang\'a',
      email: 'joel.nganga@autocare.com',
      username: 'joel.nganga',
      password: 'autocarpro12k@12k.wwc',
      role: 'admin'
    },
    {
      name: 'Patience Karanja',
      email: 'patience.karanja@autocare.com',
      username: 'patience.karanja',
      password: 'autocarpro12k@12k.wwc',
      role: 'admin'
    },
    {
      name: 'Joyrose Kinuthia',
      email: 'joyrose.kinuthia@autocare.com',
      username: 'joyrose.kinuthia',
      password: 'autocarpro12k@12k.wwc',
      role: 'admin'
    }
  ],
  EMAILS: [
    'emmanuel.evian@autocare.com',
    'ibrahim.mohamud@autocare.com',
    'joel.nganga@autocare.com',
    'patience.karanja@autocare.com',
    'joyrose.kinuthia@autocare.com'
  ],
  PERMISSIONS: {
    VIEW_ALL_REQUESTS: true,
    APPROVE_REQUESTS: true,
    VIEW_ANALYTICS: true,
    MANAGE_USERS: true,
    SYSTEM_SETTINGS: true
  }
};

// Performance Monitoring
export const PERFORMANCE_CONFIG = {
  METRICS: {
    PAGE_LOAD_THRESHOLD: 3000, // 3 seconds
    API_RESPONSE_THRESHOLD: 2000, // 2 seconds
    RENDER_THRESHOLD: 100 // 100ms
  },
  TRACKING: {
    ENABLED: process.env.NODE_ENV === 'production',
    SAMPLE_RATE: 0.1 // 10% sampling
  }
};

export default {
  APP_CONFIG,
  API_CONFIG,
  SERVICE_TYPES,
  REQUEST_STATUS,
  PRIORITY_LEVELS,
  VEHICLE_MAKES,
  NOTIFICATION_TYPES,
  USER_ROLES,
  STORAGE_KEYS,
  ROUTES,
  VALIDATION_LIMITS,
  DATE_FORMATS,
  THEME_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  FEATURE_FLAGS,
  ADMIN_CONFIG,
  PERFORMANCE_CONFIG
};