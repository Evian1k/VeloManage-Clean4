import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MapPin, Truck, Navigation, Home, Building, User, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const MapView = ({ showControls = true, height = 400 }) => {
  const { user } = useAuth();
  const canvasRef = useRef(null);
  const [mapCenter, setMapCenter] = useState({ lat: -1.2921, lng: 36.8219 }); // Nairobi center
  const [zoom, setZoom] = useState(1);
  const [mapData, setMapData] = useState({
    trucks: [],
    pickupRequests: [],
    branches: []
  });
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Load real map data from backend
  const loadMapData = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const response = await apiService.getFleetMapData();
      
      if (response.success) {
        setMapData(response.data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to load map data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Get user's current location
  const getUserLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          
          // Center map on user location if first time
          if (!userLocation) {
            setMapCenter({ lat: latitude, lng: longitude });
          }
        },
        (error) => {
          console.error('Error getting location:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, [userLocation]);

  // Convert lat/lng to canvas coordinates with more accurate projection
  const latLngToCanvas = (lat, lng, canvasWidth, canvasHeight) => {
    const centerLat = mapCenter.lat;
    const centerLng = mapCenter.lng;
    
    // More accurate mercator-like projection
    const latRad = lat * Math.PI / 180;
    const centerLatRad = centerLat * Math.PI / 180;
    
    const x = (canvasWidth / 2) + ((lng - centerLng) * 1000 * zoom);
    const y = (canvasHeight / 2) - ((latRad - centerLatRad) * 1000 * zoom);
    
    return { x, y };
  };

  const drawMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // Destructure data from mapData state
    const { trucks, pickupRequests, branches } = mapData;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw map background with street-like appearance
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, width, height);

    // Draw road network (simplified grid)
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 3;
    
    // Major roads
    for (let i = 0; i < width; i += 100) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 100) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Minor roads
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    for (let i = 50; i < width; i += 100) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 50; i < height; i += 100) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Draw branches first (as base layer)
    mapData.branches.forEach((branch) => {
      if (branch.location?.coordinates) {
        const pos = latLngToCanvas(
          branch.location.coordinates.latitude, 
          branch.location.coordinates.longitude, 
          width, 
          height
        );
        
        if (pos.x >= 0 && pos.x <= width && pos.y >= 0 && pos.y <= height) {
          // Draw branch building
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(pos.x - 8, pos.y - 8, 16, 16);
          
          // Draw branch label
          ctx.fillStyle = 'white';
          ctx.font = '10px Arial';
          ctx.fillText(branch.name, pos.x + 12, pos.y - 8);
          ctx.fillText(`${branch.truckCount}/${branch.maxCapacity} trucks`, pos.x + 12, pos.y + 4);
        }
      }
    });

    // Draw pickup requests
    pickupRequests.forEach((request, index) => {
      if (request.pickupLocation) {
        const pos = latLngToCanvas(request.pickupLocation.lat, request.pickupLocation.lng, width, height);
        
        // Draw pickup point
        ctx.fillStyle = getStatusColor(request.status);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 12, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw pickup icon
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('P', pos.x, pos.y + 5);
        
        // Draw label
        ctx.fillStyle = 'white';
        ctx.font = '11px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(request.userName, pos.x + 15, pos.y - 10);
        ctx.fillText(request.status, pos.x + 15, pos.y + 5);
      }
    });

    // Draw trucks
    trucks.forEach((truck, index) => {
      if (truck.location) {
        const pos = latLngToCanvas(truck.location.lat, truck.location.lng, width, height);
        
        // Draw truck
        ctx.fillStyle = getTruckColor(truck.status);
        ctx.fillRect(pos.x - 8, pos.y - 8, 16, 16);
        
        // Draw truck icon
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('T', pos.x, pos.y + 3);
        
        // Draw label
        ctx.fillStyle = 'white';
        ctx.font = '11px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(truck.driver, pos.x + 12, pos.y - 10);
        ctx.fillText(truck.licensePlate, pos.x + 12, pos.y + 5);
        ctx.fillText(truck.status, pos.x + 12, pos.y + 18);
      }
    });

    // Draw user location if provided
    if (userLocation) {
      const pos = latLngToCanvas(userLocation.lat, userLocation.lng, width, height);
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 10, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('U', pos.x, pos.y + 4);
      
      ctx.fillStyle = 'white';
      ctx.font = '11px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('You', pos.x + 12, pos.y);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f59e0b',
      dispatched: '#3b82f6',
      'en-route': '#eab308',
      'at-location': '#8b5cf6',
      completed: '#10b981'
    };
    return colors[status] || '#6b7280';
  };

  const getTruckColor = (status) => {
    const colors = {
      available: '#10b981',
      dispatched: '#3b82f6',
      'en-route': '#eab308',
      'at-location': '#8b5cf6',
      completed: '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  useEffect(() => {
    drawMap();
  }, [mapData, userLocation, mapCenter, zoom]);

  const handleCanvasClick = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Simple click handling - could be enhanced for selecting items
    console.log('Map clicked at:', x, y);
  };

  return (
    <Card className="glass-effect border-red-900/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Navigation className="w-5 h-5" />
            Live Map View
          </CardTitle>
          {showControls && (
            <div className="flex gap-2">
              <Button
                onClick={() => setZoom(Math.min(zoom + 0.2, 3))}
                variant="outline"
                size="sm"
                className="border-red-900/50 text-red-300 hover:bg-red-900/20"
              >
                Zoom In
              </Button>
              <Button
                onClick={() => setZoom(Math.max(zoom - 0.2, 0.5))}
                variant="outline"
                size="sm"
                className="border-red-900/50 text-red-300 hover:bg-red-900/20"
              >
                Zoom Out
              </Button>
              <Button
                onClick={() => {
                  setMapCenter({ lat: -1.2921, lng: 36.8219 });
                  setZoom(1);
                }}
                variant="outline"
                size="sm"
                className="border-red-900/50 text-red-300 hover:bg-red-900/20"
              >
                <Home className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <canvas
            ref={canvasRef}
            width={600}
            height={400}
            className="w-full border border-red-900/30 rounded-lg cursor-crosshair"
            onClick={handleCanvasClick}
            style={{ maxHeight: '400px' }}
          />
          
          {/* Legend */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span className="text-gray-300">Available Truck</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              <span className="text-gray-300">Dispatched Truck</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
              <span className="text-gray-300">En Route</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
              <span className="text-gray-300">At Location</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
              <span className="text-gray-300">Pending Pickup</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span className="text-gray-300">Your Location</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              <span className="text-gray-300">Service Center</span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-white">{mapData.trucks.filter(t => t.status === 'available').length}</div>
              <div className="text-sm text-gray-400">Available</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">{mapData.trucks.filter(t => t.status === 'dispatched').length}</div>
              <div className="text-sm text-gray-400">Dispatched</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">{mapData.pickupRequests.filter(r => r.status === 'pending').length}</div>
              <div className="text-sm text-gray-400">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">{mapData.pickupRequests.filter(r => r.status === 'dispatched' || r.status === 'en-route').length}</div>
              <div className="text-sm text-gray-400">Active</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MapView;