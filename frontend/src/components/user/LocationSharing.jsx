import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Clock, Send, Truck, Map } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getTimeAgo } from '@/lib/utils';
import MapView from '@/components/MapView';

const LocationSharing = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [pickupRequests, setPickupRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trucks, setTrucks] = useState([]);
  const [showMap, setShowMap] = useState(true);

  useEffect(() => {
    // Load user's pickup requests
    const savedRequests = localStorage.getItem('autocare_pickup_requests');
    if (savedRequests) {
      const allRequests = JSON.parse(savedRequests);
      const userRequests = allRequests.filter(req => req.userId === user?.id);
      setPickupRequests(userRequests);
    }

    // Load trucks data for map
    const savedTrucks = localStorage.getItem('autocare_trucks');
    if (savedTrucks) {
      setTrucks(JSON.parse(savedTrucks));
    }
  }, [user]);

  const getCurrentLocation = () => {
    setLoading(true);
    
    if (!navigator.geolocation) {
      toast({
        title: "Location not supported",
        description: "Your browser doesn't support location sharing",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        setLocation({ lat, lng });
        
        // Simulate reverse geocoding (in real app, use Google Maps API or similar)
        const mockAddress = `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setAddress(mockAddress);
        setIsSharing(true);
        setLoading(false);
        
        toast({
          title: "Location obtained!",
          description: "Your current location has been captured",
        });
      },
      (error) => {
        console.error('Error getting location:', error);
        setLoading(false);
        
        let errorMessage = "Failed to get location";
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied. Please enable location permissions.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
        }
        
        toast({
          title: "Location Error",
          description: errorMessage,
          variant: "destructive"
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const shareLocationForPickup = () => {
    if (!location || !address.trim()) {
      toast({
        title: "Missing Information",
        description: "Please get your location and add an address description",
        variant: "destructive"
      });
      return;
    }

    const pickupRequest = {
      id: `pickup-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      userPhone: user.phone || '+1234567890',
      serviceType: 'Vehicle Pickup',
      vehicleInfo: 'Vehicle details needed',
      pickupLocation: {
        lat: location.lat,
        lng: location.lng,
        address: address
      },
      destination: {
        lat: -1.2921,
        lng: 36.8219,
        address: 'AutoCare Service Center, CBD'
      },
      status: 'pending',
      priority: 'normal',
      requestTime: new Date().toISOString(),
      assignedTruck: null,
      estimatedTime: null
    };

    // Save to localStorage
    const savedRequests = localStorage.getItem('autocare_pickup_requests');
    const allRequests = savedRequests ? JSON.parse(savedRequests) : [];
    allRequests.push(pickupRequest);
    localStorage.setItem('autocare_pickup_requests', JSON.stringify(allRequests));

    // Update local state
    setPickupRequests([...pickupRequests, pickupRequest]);

    toast({
      title: "Pickup Request Sent!",
      description: "Your location has been shared. A truck will be dispatched shortly.",
    });

    // Reset form
    setLocation(null);
    setAddress('');
    setIsSharing(false);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-orange-100 text-orange-800 border-orange-200',
      dispatched: 'bg-blue-100 text-blue-800 border-blue-200',
      'en-route': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'at-location': 'bg-purple-100 text-purple-800 border-purple-200',
      completed: 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[status] || colors.pending;
  };

  const activeRequest = pickupRequests.find(req => 
    req.status === 'dispatched' || req.status === 'en-route' || req.status === 'at-location'
  );

  return (
    <div className="space-y-6">
      {/* Active Pickup Status */}
      {activeRequest && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="glass-effect border-green-900/30 bg-green-900/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-green-400" />
                Truck En Route to Your Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-gray-300">Status:</p>
                  <Badge className={getStatusColor(activeRequest.status)}>
                    {activeRequest.status.replace('-', ' ')}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-gray-300">ETA:</p>
                  <p className="text-white font-semibold">
                    {activeRequest.estimatedTime || '45 minutes'}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <MapPin className="w-4 h-4 text-green-400" />
                  <span>Pickup: {activeRequest.pickupLocation.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Navigation className="w-4 h-4 text-blue-400" />
                  <span>Destination: {activeRequest.destination.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span>Requested: {getTimeAgo(activeRequest.requestTime)}</span>
                </div>
              </div>

              <div className="bg-blue-900/20 p-3 rounded-lg border border-blue-900/30">
                <p className="text-sm text-blue-200">
                  <strong>Next Steps:</strong> Stay at your location and watch for the truck. 
                  The driver will contact you when they arrive.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Location Sharing Form */}
      {!activeRequest && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="glass-effect border-red-900/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Share Your Location for Pickup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <Button
                  onClick={getCurrentLocation}
                  disabled={loading}
                  className="bg-gradient-to-r from-red-600 to-red-700 text-white"
                >
                  {loading ? (
                    <>
                      <Navigation className="w-4 h-4 mr-2 animate-spin" />
                      Getting Location...
                    </>
                  ) : (
                    <>
                      <Navigation className="w-4 h-4 mr-2" />
                      Get My Current Location
                    </>
                  )}
                </Button>
                <p className="text-sm text-gray-400 mt-2">
                  Allow location access to automatically share your coordinates
                </p>
              </div>

              {isSharing && location && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="bg-green-900/20 p-4 rounded-lg border border-green-900/30">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-green-400" />
                      <span className="text-green-300 font-medium">Location Captured</span>
                    </div>
                    <p className="text-sm text-gray-300">
                      Latitude: {location.lat.toFixed(6)}<br />
                      Longitude: {location.lng.toFixed(6)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-white">
                      Address Description (Optional)
                    </Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g., Near KFC, opposite bank, red building..."
                      className="bg-black/50 border-red-900/50 text-white placeholder:text-gray-400"
                    />
                    <p className="text-sm text-gray-400">
                      Add landmarks or details to help the driver find you easily
                    </p>
                  </div>

                  <Button
                    onClick={shareLocationForPickup}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Request Truck Pickup
                  </Button>
                </motion.div>
              )}

              <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-900/30">
                <h4 className="text-blue-200 font-medium mb-2">How it works:</h4>
                <ol className="text-sm text-blue-100 space-y-1">
                  <li>1. Click "Get My Current Location" to share your GPS coordinates</li>
                  <li>2. Add address details to help the driver find you</li>
                  <li>3. Click "Request Truck Pickup" to send your location to dispatch</li>
                  <li>4. A truck will be assigned and dispatched to your location</li>
                  <li>5. Track the truck's progress in real-time</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Pickup History */}
      {pickupRequests.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="glass-effect border-red-900/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Your Pickup Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-64 overflow-y-auto">
              {pickupRequests.map((request) => (
                <div key={request.id} className="bg-black/30 p-4 rounded-lg border border-red-900/20">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-white">Pickup Request</h4>
                      <p className="text-sm text-gray-400">
                        {getTimeAgo(request.requestTime)}
                      </p>
                    </div>
                    <Badge className={getStatusColor(request.status)}>
                      {request.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <MapPin className="w-4 h-4 text-green-400" />
                      <span>From: {request.pickupLocation.address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Navigation className="w-4 h-4 text-blue-400" />
                      <span>To: {request.destination.address}</span>
                    </div>
                    {request.estimatedTime && (
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Clock className="w-4 h-4 text-orange-400" />
                        <span>ETA: {request.estimatedTime}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
              Your Location & Nearby Trucks
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
            pickupRequests={pickupRequests.filter(req => req.userId === user?.id)}
            userLocation={location}
            showControls={true}
          />
        </motion.div>
      )}
    </div>
  );
};

export default LocationSharing;