
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { ArrowLeft, MapPin, Clock, Truck, Phone, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useService } from '@/contexts/ServiceContext';
import { useToast } from '@/components/ui/use-toast';

const TrackingPage = () => {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { requests } = useService();
  const { toast } = useToast();
  const [truckLocation, setTruckLocation] = useState({ lat: -1.2921, lng: 36.8219 }); // Nairobi
  const [estimatedArrival, setEstimatedArrival] = useState(null);

  const request = requests.find(req => req.id === requestId);

  useEffect(() => {
    if (!request || !request.trackingEnabled || request.status !== 'approved') {
      navigate('/dashboard');
      return;
    }

    setEstimatedArrival(request.estimatedArrival);

    // Simulate truck movement
    const interval = setInterval(() => {
      setTruckLocation(prev => ({
        lat: prev.lat + (Math.random() - 0.5) * 0.001,
        lng: prev.lng + (Math.random() - 0.5) * 0.001
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [request, navigate]);

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Request Not Found</h2>
          <p className="text-gray-400 mb-6">The tracking request could not be found or is not available for tracking.</p>
          <Button onClick={() => navigate('/dashboard')} className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleCallDriver = () => {
    toast({
      title: "🚧 Feature Coming Soon!",
      description: "Driver calling isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀"
    });
  };

  const handleGetDirections = () => {
    toast({
      title: "🚧 Feature Coming Soon!",
      description: "Navigation directions isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀"
    });
  };

  return (
    <div className="min-h-screen p-4">
      <Helmet>
        <title>Track Vehicle Pickup - AutoCare Pro</title>
        <meta name="description" content="Real-time GPS tracking for your vehicle pickup service with live location updates and estimated arrival time." />
      </Helmet>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4 mb-8"
        >
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text">Live Tracking</h1>
            <p className="text-gray-300">Real-time vehicle pickup tracking</p>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Map Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-2"
          >
            <Card className="glass-effect border-red-900/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-red-500" />
                  Live GPS Tracking
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Track your pickup truck in real-time
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Simulated Map */}
                <div className="map-container rounded-lg h-96 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900"></div>
                  
                  {/* Grid Pattern */}
                  <div className="absolute inset-0 opacity-20">
                    <div className="grid grid-cols-8 grid-rows-6 h-full w-full">
                      {Array.from({ length: 48 }).map((_, i) => (
                        <div key={i} className="border border-gray-600"></div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Truck Icon */}
                  <motion.div
                    animate={{
                      x: [0, 20, -10, 15, 0],
                      y: [0, -15, 10, -5, 0]
                    }}
                    transition={{
                      duration: 10,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute z-10 p-3 bg-red-600 rounded-full shadow-lg truck-animation"
                  >
                    <Truck className="w-6 h-6 text-white" />
                  </motion.div>
                  
                  {/* Location Markers */}
                  <div className="absolute top-4 left-4 p-2 bg-green-600 rounded-full">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  <div className="absolute bottom-4 right-4 p-2 bg-blue-600 rounded-full">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  
                  {/* Route Line */}
                  <svg className="absolute inset-0 w-full h-full">
                    <path
                      d="M 50 50 Q 200 100 350 300"
                      stroke="#ef4444"
                      strokeWidth="3"
                      fill="none"
                      strokeDasharray="10,5"
                      className="opacity-60"
                    />
                  </svg>
                  
                  <div className="text-center text-white z-20">
                    <h3 className="text-xl font-bold mb-2">Nairobi Service Area</h3>
                    <p className="text-gray-300">Truck Location: {truckLocation.lat.toFixed(4)}, {truckLocation.lng.toFixed(4)}</p>
                  </div>
                </div>
                
                {/* Map Controls */}
                <div className="flex justify-between items-center mt-4">
                  <div className="flex gap-2">
                    <Badge className="bg-green-600 text-white">
                      <MapPin className="w-3 h-3 mr-1" />
                      Pickup Location
                    </Badge>
                    <Badge className="bg-blue-600 text-white">
                      <MapPin className="w-3 h-3 mr-1" />
                      Service Center
                    </Badge>
                  </div>
                  <Button
                    onClick={handleGetDirections}
                    variant="outline"
                    size="sm"
                    className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Get Directions
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Tracking Info Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            {/* Request Details */}
            <Card className="glass-effect border-red-900/30">
              <CardHeader>
                <CardTitle className="text-white">Request Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-gray-400 text-sm">Service Type</p>
                    <p className="text-white font-medium">{request.serviceType}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Request ID</p>
                    <p className="text-white font-medium">{request.id}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Status</p>
                    <Badge className="status-approved text-white">
                      Approved - Truck Dispatched
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Estimated Arrival */}
            <Card className="glass-effect border-red-900/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-red-500" />
                  Estimated Arrival
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-2">
                    {estimatedArrival ? new Date(estimatedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </div>
                  <p className="text-gray-400 text-sm">
                    {estimatedArrival ? new Date(estimatedArrival).toLocaleDateString() : 'Calculating...'}
                  </p>
                  <div className="mt-4 p-3 bg-green-900/20 rounded-lg border border-green-500/30">
                    <p className="text-green-400 text-sm font-medium">On Time</p>
                    <p className="text-gray-300 text-xs">Truck is following schedule</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Driver Contact */}
            <Card className="glass-effect border-red-900/30">
              <CardHeader>
                <CardTitle className="text-white">Driver Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-600 rounded-lg">
                      <Truck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Driver: John Mwangi</p>
                      <p className="text-gray-400 text-sm">License: KCA 123X</p>
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleCallDriver}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call Driver
                  </Button>
                  
                  <div className="text-center text-gray-400 text-xs">
                    Driver will contact you 10 minutes before arrival
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tracking Timeline */}
            <Card className="glass-effect border-red-900/30">
              <CardHeader>
                <CardTitle className="text-white">Tracking Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-white text-sm font-medium">Request Approved</p>
                      <p className="text-gray-400 text-xs">
                        {new Date(request.updatedAt || request.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-white text-sm font-medium">Truck Dispatched</p>
                      <p className="text-gray-400 text-xs">
                        {new Date(Date.now() - 30 * 60 * 1000).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 animate-pulse"></div>
                    <div>
                      <p className="text-white text-sm font-medium">En Route</p>
                      <p className="text-gray-400 text-xs">Currently tracking...</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-gray-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-gray-500 text-sm font-medium">Arrival</p>
                      <p className="text-gray-500 text-xs">Pending...</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default TrackingPage;
