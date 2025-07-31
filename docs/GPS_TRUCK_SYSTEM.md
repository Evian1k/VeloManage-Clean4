# GPS Tracking & Truck Dispatch System

## 🚛 Overview

The AutoCare Pro GPS Tracking & Truck Dispatch System allows admins to manage a fleet of trucks and dispatch them to users who need vehicle pickup services. Users can share their real GPS location, and trucks can be tracked in real-time.

## 🎯 Features

### For Users:
- **GPS Location Sharing**: Share current location using browser geolocation
- **Pickup Requests**: Request truck pickup with location details
- **Real-time Tracking**: Track assigned truck status and ETA
- **Location Description**: Add landmarks and details to help drivers
- **Pickup History**: View all previous pickup requests

### For Admins:
- **Fleet Management**: Manage truck fleet with driver details
- **Dispatch Control**: Assign trucks to pickup requests
- **GPS Monitoring**: Track truck locations and status updates
- **Real-time Updates**: Update truck status (en-route, at-location, completed)
- **Request Management**: View and manage all pickup requests

## 📱 User Experience

### Requesting Truck Pickup:

1. **Access Location Tab**: Go to Dashboard → Truck Pickup
2. **Share Location**: Click "Get My Current Location" (browser will ask for permission)
3. **Add Details**: Enter address description or landmarks
4. **Submit Request**: Click "Request Truck Pickup"
5. **Track Progress**: See real-time updates when truck is dispatched

### Location Sharing Process:
```javascript
// Browser asks for location permission
navigator.geolocation.getCurrentPosition(
  (position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    // Location captured and ready to share
  }
);
```

### Pickup Status Flow:
1. **Pending** → User submitted pickup request
2. **Dispatched** → Admin assigned truck to request
3. **En Route** → Truck is on the way to pickup location
4. **At Location** → Truck has arrived at pickup location
5. **Completed** → Pickup completed successfully

## 🔧 Admin Operations

### Truck Fleet Management:

**Available Actions:**
- View all trucks and their current status
- See truck locations and last GPS update
- Update truck status manually
- Simulate GPS updates for testing

**Truck Status Types:**
- `available` - Ready for assignment
- `dispatched` - Assigned to a pickup request
- `en-route` - Traveling to pickup location
- `at-location` - Arrived at pickup location
- `completed` - Job completed, returning to available

### Dispatch Process:

1. **View Pending Requests**: See all users waiting for pickup
2. **Select Available Truck**: Choose from trucks marked as available
3. **Assign Truck**: Use dropdown to assign truck to request
4. **Monitor Progress**: Track truck status and update as needed
5. **Complete Job**: Mark as completed when pickup is done

### Dashboard Sections:

#### Statistics Cards:
- **Available Trucks**: Number of trucks ready for dispatch
- **Pending Requests**: Users waiting for pickup
- **Active Dispatches**: Trucks currently on jobs
- **Total Fleet**: Total number of trucks

#### Management Panels:
- **Pending Pickup Requests**: New requests needing truck assignment
- **Truck Fleet Status**: Current status of all trucks
- **Active Dispatches**: Ongoing pickup operations

## 📊 Data Structure

### Truck Object:
```javascript
{
  id: 'truck-001',
  driver: 'John Smith',
  phone: '+1234567890',
  licensePlate: 'TRK-001',
  status: 'available',
  location: {
    lat: -1.2921,
    lng: 36.8219,
    address: 'Nairobi CBD'
  },
  assignedRequest: null,
  lastUpdate: '2024-01-15T10:30:00Z'
}
```

### Pickup Request Object:
```javascript
{
  id: 'pickup-001',
  userId: 1,
  userName: 'Customer A',
  userPhone: '+1234567892',
  serviceType: 'Vehicle Pickup',
  vehicleInfo: 'Toyota Camry 2020 - KDA 123A',
  pickupLocation: {
    lat: -1.2881,
    lng: 36.8320,
    address: 'Karen Shopping Centre, Nairobi'
  },
  destination: {
    lat: -1.2921,
    lng: 36.8219,
    address: 'AutoCare Service Center, CBD'
  },
  status: 'pending',
  priority: 'normal',
  requestTime: '2024-01-15T08:30:00Z',
  assignedTruck: null,
  estimatedTime: '45 minutes'
}
```

## 🗄️ Data Storage

### LocalStorage Keys:
- `autocare_trucks` - Fleet information
- `autocare_pickup_requests` - All pickup requests

### Real-time Updates:
- Truck locations updated via GPS simulation
- Status changes saved immediately
- User notifications for status updates

## 🔄 System Workflow

### Complete Pickup Flow:

1. **User Side:**
   - User needs vehicle pickup
   - Shares GPS location via browser
   - Adds address description
   - Submits pickup request

2. **Admin Side:**
   - Sees new pickup request in pending list
   - Reviews user location and details
   - Selects available truck from fleet
   - Assigns truck to pickup request

3. **Dispatch & Tracking:**
   - Truck status changes to "dispatched"
   - User sees truck assigned with ETA
   - Admin can update truck status as it progresses
   - GPS updates show truck movement

4. **Completion:**
   - Truck arrives at location (status: "at-location")
   - Pickup completed (status: "completed")
   - Truck becomes available for next assignment

## 🎨 UI Components

### User Components:
- **LocationSharing.jsx**: Main location sharing interface
- **GPS Permission**: Browser geolocation access
- **Address Input**: Manual address description
- **Status Display**: Active pickup tracking
- **History View**: Previous pickup requests

### Admin Components:
- **TruckDispatch.jsx**: Complete fleet management dashboard
- **Fleet Overview**: Statistics and metrics
- **Request Management**: Pending pickup assignments
- **Truck Monitoring**: Real-time fleet status
- **GPS Simulation**: Testing truck movement

## 🌍 GPS Features

### Location Accuracy:
- **High Accuracy**: Enabled for precise coordinates
- **Timeout**: 10 seconds maximum wait time
- **Cache**: 1 minute maximum cached location age

### Error Handling:
- Permission denied → Clear error message
- Position unavailable → Fallback options
- Timeout → Retry mechanism
- Network issues → Offline mode

### Location Privacy:
- Location only shared when user explicitly requests pickup
- Coordinates stored securely in localStorage
- No continuous tracking - only when needed

## 🔧 Testing the System

### User Testing:
1. Login as regular user
2. Go to Dashboard → Truck Pickup
3. Click "Get My Current Location"
4. Allow browser location permission
5. Add address description
6. Submit pickup request
7. Check pickup history

### Admin Testing:
1. Login as admin
2. Go to Admin Dashboard → Truck Dispatch
3. View pending pickup requests
4. Assign available truck to request
5. Update truck status using dropdown
6. Use "GPS Update" button to simulate movement
7. Check active dispatches section

### GPS Simulation:
- Click "GPS Update" to simulate truck movement
- Coordinates change slightly to show movement
- Last update timestamp refreshes
- Status can be updated to track progress

## 🚀 Future Enhancements

### Real GPS Integration:
- Integrate with Google Maps API for real addresses
- Actual truck GPS tracking via mobile devices
- Route optimization for multiple pickups
- Real-time traffic updates

### Advanced Features:
- Push notifications for status updates
- SMS alerts to users and drivers
- Photo confirmation at pickup/delivery
- Digital signatures for completed services
- Payment integration for pickup fees

### Fleet Management:
- Driver mobile app for status updates
- Fuel tracking and maintenance schedules
- Performance analytics and reporting
- Route history and optimization
- Customer rating system

## 📋 Summary

The GPS Tracking & Truck Dispatch System provides:

✅ **Simple Location Sharing**: One-click GPS coordinate sharing
✅ **Fleet Management**: Complete truck and driver management
✅ **Real-time Tracking**: Live status updates and monitoring
✅ **User-Friendly Interface**: Easy-to-use for both users and admins
✅ **Persistent Data**: All requests and truck data saved
✅ **Status Management**: Clear workflow from request to completion

The system is fully functional with simulated GPS data and provides a solid foundation for real-world GPS tracking integration.