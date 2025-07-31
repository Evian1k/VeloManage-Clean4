import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Truck from '../models/Truck.js';
import Branch from '../models/Branch.js';

// Load environment variables
dotenv.config();

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autocare-pro');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Initialize admin users
const initializeAdmins = async () => {
  console.log('🔧 Initializing admin users...');
  
  const adminPassword = process.env.ADMIN_PASSWORD || 'autocarpro12k@12k.wwc';
  const admins = [
    {
      name: 'Emmanuel Evian',
      email: 'emmanuel.evian@autocare.com',
      role: 'main_admin'
    },
    {
      name: 'Ibrahim Mohamud',
      email: 'ibrahim.mohamud@autocare.com',
      role: 'admin'
    },
    {
      name: 'Joel Ng\'ang\'a',
      email: 'joel.nganga@autocare.com',
      role: 'admin'
    },
    {
      name: 'Patience Karanja',
      email: 'patience.karanja@autocare.com',
      role: 'admin'
    },
    {
      name: 'Joyrose Kinuthia',
      email: 'joyrose.kinuthia@autocare.com',
      role: 'admin'
    }
  ];

  for (const adminData of admins) {
    const existingAdmin = await User.findOne({ email: adminData.email });
    
    if (!existingAdmin) {
      const admin = new User({
        name: adminData.name,
        email: adminData.email,
        password: adminPassword,
        isAdmin: true,
        role: adminData.role,
        vehicleCount: 0
      });
      
      await admin.save();
      console.log(`✅ Created admin: ${adminData.name}`);
    } else {
      console.log(`👤 Admin already exists: ${adminData.name}`);
    }
  }
};

// Initialize branches
const initializeBranches = async () => {
  console.log('🏢 Initializing branches...');
  
  const branches = [
    {
      name: 'AutoCare CBD Branch',
      code: 'AC-CBD',
      location: {
        address: 'Kimathi Street, Nairobi CBD',
        city: 'Nairobi',
        state: 'Nairobi County',
        zipCode: '00100',
        coordinates: {
          latitude: -1.2921,
          longitude: 36.8219
        }
      },
      contact: {
        phone: '+254700100200',
        email: 'cbd@autocare.com'
      },
      workingHours: {
        monday: { open: '08:00', close: '18:00', isOpen: true },
        tuesday: { open: '08:00', close: '18:00', isOpen: true },
        wednesday: { open: '08:00', close: '18:00', isOpen: true },
        thursday: { open: '08:00', close: '18:00', isOpen: true },
        friday: { open: '08:00', close: '18:00', isOpen: true },
        saturday: { open: '09:00', close: '16:00', isOpen: true },
        sunday: { open: '10:00', close: '14:00', isOpen: false }
      },
      services: ['maintenance', 'repair', 'inspection', 'emergency'],
      capacity: {
        maxTrucks: 30,
        serviceSlots: 8
      }
    },
    {
      name: 'AutoCare Westlands Branch',
      code: 'AC-WL',
      location: {
        address: 'Westlands Road, Westlands',
        city: 'Nairobi',
        state: 'Nairobi County',
        zipCode: '00600',
        coordinates: {
          latitude: -1.2635,
          longitude: 36.8078
        }
      },
      contact: {
        phone: '+254700100201',
        email: 'westlands@autocare.com'
      },
      workingHours: {
        monday: { open: '07:30', close: '19:00', isOpen: true },
        tuesday: { open: '07:30', close: '19:00', isOpen: true },
        wednesday: { open: '07:30', close: '19:00', isOpen: true },
        thursday: { open: '07:30', close: '19:00', isOpen: true },
        friday: { open: '07:30', close: '19:00', isOpen: true },
        saturday: { open: '08:00', close: '17:00', isOpen: true },
        sunday: { open: '09:00', close: '15:00', isOpen: true }
      },
      services: ['maintenance', 'repair', 'fuel', 'car_wash'],
      capacity: {
        maxTrucks: 25,
        serviceSlots: 6
      }
    }
  ];

  for (const branchData of branches) {
    const existingBranch = await Branch.findOne({ code: branchData.code });
    
    if (!existingBranch) {
      const branch = new Branch(branchData);
      await branch.save();
      console.log(`✅ Created branch: ${branchData.name}`);
    } else {
      console.log(`🏢 Branch already exists: ${branchData.name}`);
    }
  }
};

// Initialize truck fleet
const initializeTrucks = async () => {
  console.log('🚛 Initializing truck fleet...');
  
  const trucks = [
    {
      truckId: 'TRK-001',
      driver: {
        name: 'John Smith',
        phone: '+254700123456',
        email: 'john.smith@autocare.com',
        licenseNumber: 'DL123456'
      },
      vehicle: {
        licensePlate: 'KDA-001T',
        make: 'Toyota',
        model: 'Hiace',
        year: 2020,
        capacity: '1.5 Tons'
      },
      currentLocation: {
        latitude: -1.2921,
        longitude: 36.8219,
        address: 'AutoCare Service Center, Nairobi CBD'
      },
      specifications: {
        fuelType: 'diesel',
        engineSize: '2.7L',
        transmission: 'manual'
      }
    },
    {
      truckId: 'TRK-002',
      driver: {
        name: 'Jane Doe',
        phone: '+254700234567',
        email: 'jane.doe@autocare.com',
        licenseNumber: 'DL234567'
      },
      vehicle: {
        licensePlate: 'KDB-002T',
        make: 'Isuzu',
        model: 'NPR',
        year: 2019,
        capacity: '2 Tons'
      },
      currentLocation: {
        latitude: -1.3032,
        longitude: 36.8335,
        address: 'Westlands, Nairobi'
      },
      specifications: {
        fuelType: 'diesel',
        engineSize: '3.0L',
        transmission: 'manual'
      }
    },
    {
      truckId: 'TRK-003',
      driver: {
        name: 'Michael Johnson',
        phone: '+254700345678',
        email: 'michael.johnson@autocare.com',
        licenseNumber: 'DL345678'
      },
      vehicle: {
        licensePlate: 'KDC-003T',
        make: 'Mitsubishi',
        model: 'Canter',
        year: 2021,
        capacity: '1.8 Tons'
      },
      currentLocation: {
        latitude: -1.2881,
        longitude: 36.8320,
        address: 'Karen, Nairobi'
      },
      specifications: {
        fuelType: 'diesel',
        engineSize: '3.9L',
        transmission: 'automatic'
      }
    }
  ];

  for (const truckData of trucks) {
    const existingTruck = await Truck.findOne({ truckId: truckData.truckId });
    
    if (!existingTruck) {
      const truck = new Truck(truckData);
      await truck.save();
      console.log(`✅ Created truck: ${truckData.truckId} - ${truckData.driver.name}`);
    } else {
      console.log(`🚛 Truck already exists: ${truckData.truckId}`);
    }
  }
};

// Create sample user data
const initializeSampleUsers = async () => {
  console.log('👥 Initializing sample users...');
  
  const sampleUsers = [
    {
      name: 'Demo User',
      email: 'user@demo.com',
      password: 'password123',
      phone: '+254700111222',
      vehicleCount: 2
    },
    {
      name: 'Test Customer',
      email: 'customer@test.com',
      password: 'password123',
      phone: '+254700333444',
      vehicleCount: 1
    }
  ];

  for (const userData of sampleUsers) {
    const existingUser = await User.findOne({ email: userData.email });
    
    if (!existingUser) {
      const user = new User(userData);
      await user.save();
      console.log(`✅ Created sample user: ${userData.name}`);
    } else {
      console.log(`👤 Sample user already exists: ${userData.name}`);
    }
  }
};

// Main initialization function
const initializeDatabase = async () => {
  try {
    console.log('🚀 Starting database initialization...');
    
    await connectDB();
    await initializeAdmins();
    await initializeBranches();
    await initializeTrucks();
    await initializeSampleUsers();
    
    console.log('✅ Database initialization completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Admin users created/verified');
    console.log('- Branch locations initialized');
    console.log('- Truck fleet initialized');
    console.log('- Sample users created');
    console.log('\n🔐 Admin Login Details:');
    console.log('Email: emmanuel.evian@autocare.com');
    console.log('Password: autocarpro12k@12k.wwc');
    console.log('\n👤 Sample User Login:');
    console.log('Email: user@demo.com');
    console.log('Password: password123');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run initialization if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
}

export default initializeDatabase;