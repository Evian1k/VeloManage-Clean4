import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, MapPin, Navigation, Clock, User, Send, Map } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateTime, getTimeAgo } from '@/lib/utils';
import MapView from '@/components/MapView';

const TruckDispatch = () => {
  const [trucks, setTrucks] = useState([]);
  const [pickupRequests, setPickupRequests] = useState([]);
  const [showMap, setShowMap] = useState(true);
  const { toast } = useToast();

  // Load data from localStorage
  useEffect(() => {
    const savedTrucks = localStorage.getItem('autocare_trucks');
    const savedRequests = localStorage.getItem('autocare_pickup_requests');
    
    if (savedTrucks) {
      setTrucks(JSON.parse(savedTrucks));
    } else {
      // Initialize with some sample trucks
      const initialTrucks = [
        {
          id: 'truck-001',
          driver: 'John Smith',
          phone: '+1234567890',
          licensePlate: 'TRK-001',
          status: 'available',
          location: { lat: -1.2921, lng: 36.8219, address: 'Nairobi CBD' },
          assignedRequest: null,
          lastUpdate: new Date().toISOString()
        },
        {
          id: 'truck-002',
          driver: 'Jane Doe',
          phone: '+1234567891',
          licensePlate: 'TRK-002',
          status: 'available',
          location: { lat: -1.3032, lng: 36.8335, address: 'Westlands' },
          assignedRequest: null,
          lastUpdate: new Date().toISOString()
        }
      ];
      setTrucks(initialTrucks);
      localStorage.setItem('autocare_trucks', JSON.stringify(initialTrucks));
    }

    if (savedRequests) {
      setPickupRequests(JSON.parse(savedRequests));
    } else {
      // Initialize with sample pickup requests
      const initialRequests = [
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
          requestTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          assignedTruck: null,
          estimatedTime: null
        }
      ];
      setPickupRequests(initialRequests);
      localStorage.setItem('autocare_pickup_requests', JSON.stringify(initialRequests));
    }
  }, []);

  const getStatusColor = (status) => {
    const colors = {
      available: 'bg-green-100 text-green-800 border-green-200',
      dispatched: 'bg-blue-100 text-blue-800 border-blue-200',
      'en-route': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'at-location': 'bg-purple-100 text-purple-800 border-purple-200',
      completed: 'bg-gray-100 text-gray-800 border-gray-200',
      pending: 'bg-orange-100 text-orange-800 border-orange-200'
    };
    return colors[status] || colors.pending;
  };

  const assignTruckToRequest = (requestId, truckId) => {
    const updatedRequests = pickupRequests.map(request => {
      if (request.id === requestId) {
        return {
          ...request,
          status: 'dispatched',
          assignedTruck: truckId,
          dispatchTime: new Date().toISOString(),
          estimatedTime: '45 minutes'
        };
      }
      return request;
    });

    const updatedTrucks = trucks.map(truck => {
      if (truck.id === truckId) {
        return {
          ...truck,
          status: 'dispatched',
          assignedRequest: requestId,
          lastUpdate: new Date().toISOString()
        };
      }
      return truck;
    });

    setPickupRequests(updatedRequests);
    setTrucks(updatedTrucks);
    localStorage.setItem('autocare_pickup_requests', JSON.stringify(updatedRequests));
    localStorage.setItem('autocare_trucks', JSON.stringify(updatedTrucks));

    const request = pickupRequests.find(r => r.id === requestId);
    const truck = trucks.find(t => t.id === truckId);
    
    toast({
      title: "Truck Dispatched!",
      description: `${truck.driver} (${truck.licensePlate}) has been dispatched to ${request.userName}`,
    });
  };

  const updateTruckStatus = (truckId, newStatus) => {
    const updatedTrucks = trucks.map(truck => {
      if (truck.id === truckId) {
        return {
          ...truck,
          status: newStatus,
          lastUpdate: new Date().toISOString()
        };
      }
      return truck;
    });

    setTrucks(updatedTrucks);
    localStorage.setItem('autocare_trucks', JSON.stringify(updatedTrucks));

    toast({
      title: "Status Updated",
      description: `Truck status updated to ${newStatus}`,
    });
  };

  const simulateGPSUpdate = (truckId) => {
    const updatedTrucks = trucks.map(truck => {
      if (truck.id === truckId) {
        // Simulate GPS movement
        const randomLat = truck.location.lat + (Math.random() - 0.5) * 0.01;
        const randomLng = truck.location.lng + (Math.random() - 0.5) * 0.01;
        
        return {
          ...truck,
          location: {
            ...truck.location,
            lat: randomLat,
            lng: randomLng
          },
          lastUpdate: new Date().toISOString()
        };
      }
      return truck;
    });

    setTrucks(updatedTrucks);
    localStorage.setItem('autocare_trucks', JSON.stringify(updatedTrucks));

    toast({
      title: "GPS Updated",
      description: "Truck location has been updated",
    });
  };

  const availableTrucks = trucks.filter(truck => truck.status === 'available');
  const pendingRequests = pickupRequests.filter(request => request.status === 'pending');
  const activeDispatches = pickupRequests.filter(request => 
    request.status === 'dispatched' || request.status === 'en-route' || request.status === 'at-location'
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-effect border-red-900/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-600/20 rounded-lg">
                <Truck className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Available Trucks</p>
                <p className="text-2xl font-bold text-white">{availableTrucks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-effect border-red-900/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-600/20 rounded-lg">
                <Clock className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Pending Requests</p>
                <p className="text-2xl font-bold text-white">{pendingRequests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-effect border-red-900/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <Navigation className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Active Dispatches</p>
                <p className="text-2xl font-bold text-white">{activeDispatches.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-effect border-red-900/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600/20 rounded-lg">
                <MapPin className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Trucks</p>
                <p className="text-2xl font-bold text-white">{trucks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Pickup Requests */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="glass-effect border-red-900/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Pending Pickup Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-96 overflow-y-auto">
              {pendingRequests.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No pending pickup requests</p>
                </div>
              ) : (
                pendingRequests.map((request) => (
                  <div key={request.id} className="bg-black/30 p-4 rounded-lg border border-red-900/20">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-white">{request.userName}</h4>
                        <p className="text-sm text-gray-400">{request.vehicleInfo}</p>
                      </div>
                      <Badge className={getStatusColor(request.status)}>
                        {request.status}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <MapPin className="w-4 h-4 text-green-400" />
                        <span>Pickup: {request.pickupLocation.address}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Navigation className="w-4 h-4 text-blue-400" />
                        <span>Destination: {request.destination.address}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Clock className="w-4 h-4 text-orange-400" />
                        <span>Requested: {getTimeAgo(request.requestTime)}</span>
                      </div>
                    </div>

                    {availableTrucks.length > 0 && (
                      <div className="flex gap-2">
                        <Select onValueChange={(truckId) => assignTruckToRequest(request.id, truckId)}>
                          <SelectTrigger className="bg-black/50 border-red-900/50 text-white">
                            <SelectValue placeholder="Assign Truck" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTrucks.map((truck) => (
                              <SelectItem key={truck.id} value={truck.id}>
                                {truck.driver} - {truck.licensePlate}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Truck Fleet Management */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="glass-effect border-red-900/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Truck Fleet Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-96 overflow-y-auto">
              {trucks.map((truck) => (
                <div key={truck.id} className="bg-black/30 p-4 rounded-lg border border-red-900/20">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-white">{truck.driver}</h4>
                      <p className="text-sm text-gray-400">{truck.licensePlate}</p>
                    </div>
                    <Badge className={getStatusColor(truck.status)}>
                      {truck.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <MapPin className="w-4 h-4 text-red-400" />
                      <span>{truck.location.address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <User className="w-4 h-4 text-blue-400" />
                      <span>{truck.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Clock className="w-4 h-4 text-orange-400" />
                      <span>Updated: {getTimeAgo(truck.lastUpdate)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {truck.status !== 'available' && (
                      <Select onValueChange={(status) => updateTruckStatus(truck.id, status)}>
                        <SelectTrigger className="bg-black/50 border-red-900/50 text-white">
                          <SelectValue placeholder="Update Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en-route">En Route</SelectItem>
                          <SelectItem value="at-location">At Location</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="available">Mark Available</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    
                    <Button
                      onClick={() => simulateGPSUpdate(truck.id)}
                      variant="outline"
                      size="sm"
                      className="border-red-900/50 text-red-300 hover:bg-red-900/20"
                    >
                      <Navigation className="w-4 h-4 mr-1" />
                      GPS Update
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Active Dispatches */}
      {activeDispatches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="glass-effect border-red-900/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                Active Dispatches
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeDispatches.map((dispatch) => {
                const assignedTruck = trucks.find(t => t.id === dispatch.assignedTruck);
                return (
                  <div key={dispatch.id} className="bg-black/30 p-4 rounded-lg border border-red-900/20">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <h4 className="font-semibold text-white mb-2">Customer</h4>
                        <p className="text-sm text-gray-300">{dispatch.userName}</p>
                        <p className="text-sm text-gray-400">{dispatch.vehicleInfo}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-white mb-2">Assigned Truck</h4>
                        <p className="text-sm text-gray-300">{assignedTruck?.driver}</p>
                        <p className="text-sm text-gray-400">{assignedTruck?.licensePlate}</p>
                        <Badge className={getStatusColor(assignedTruck?.status)}>
                          {assignedTruck?.status}
                        </Badge>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-white mb-2">Progress</h4>
                        <p className="text-sm text-gray-300">ETA: {dispatch.estimatedTime}</p>
                        <p className="text-sm text-gray-400">
                          Dispatched: {getTimeAgo(dispatch.dispatchTime)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Map View */}
      {showMap && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <Map className="w-5 h-5" />
              Live Fleet Map
            </h3>
            <Button
              onClick={() => setShowMap(!showMap)}
              variant="outline"
              size="sm"
              className="border-red-900/50 text-red-300 hover:bg-red-900/20"
            >
              {showMap ? 'Hide Map' : 'Show Map'}
            </Button>
          </div>
          <MapView 
            trucks={trucks} 
            pickupRequests={pickupRequests}
            showControls={true}
          />
        </motion.div>
      )}
    </div>
  );
};

export default TruckDispatch;