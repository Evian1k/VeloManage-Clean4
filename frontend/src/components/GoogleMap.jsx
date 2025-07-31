import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, MapPin, Share2, Users } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';

const GoogleMap = ({ 
  showUserLocations = false, 
  allowLocationSharing = false,
  onLocationShared = null 
}) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [userLocations, setUserLocations] = useState([]);
  const [sharingLocation, setSharingLocation] = useState(false);
  const { addNotification } = useSocket();

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      try {
        const loader = new Loader({
          apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'your-google-maps-api-key-here',
          version: 'weekly',
        });

        const google = await loader.load();
        
        const mapInstance = new google.maps.Map(mapRef.current, {
          center: { lat: 40.7128, lng: -74.0060 }, // Default to NYC
          zoom: 10,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        });

        setMap(mapInstance);

        // Try to get user's current location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              };
              setUserLocation(pos);
              mapInstance.setCenter(pos);
              mapInstance.setZoom(14);

              // Add current location marker
              new google.maps.Marker({
                position: pos,
                map: mapInstance,
                title: 'Your Location',
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: '#4285F4',
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: '#ffffff'
                }
              });
            },
            () => {
              console.log('Geolocation service failed');
            }
          );
        }

        setLoading(false);
      } catch (err) {
        setError('Failed to load Google Maps');
        setLoading(false);
      }
    };

    initMap();
  }, []);

  // Fetch and display user locations for admins
  useEffect(() => {
    if (showUserLocations && map) {
      fetchUserLocations();
    }
  }, [showUserLocations, map]);

  const fetchUserLocations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/locations/all', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setUserLocations(data.data);
        displayUserMarkers(data.data);
      }
    } catch (err) {
      console.error('Error fetching user locations:', err);
    }
  };

  const displayUserMarkers = (locations) => {
    if (!map) return;

    const google = window.google;
    
    locations.forEach((location) => {
      const marker = new google.maps.Marker({
        position: {
          lat: location.latitude,
          lng: location.longitude
        },
        map: map,
        title: location.user.name,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#FF6B6B',
          fillOpacity: 1,
          strokeWeight: 1,
          strokeColor: '#ffffff'
        }
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div class="p-2">
            <h3 class="font-semibold">${location.user.name}</h3>
            <p class="text-sm text-gray-600">${location.user.email}</p>
            <p class="text-sm">${location.address || 'No address provided'}</p>
            <p class="text-xs text-gray-500">
              ${new Date(location.updatedAt).toLocaleString()}
            </p>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });
    });
  };

  const shareCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setSharingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude, accuracy } = position.coords;

          // Reverse geocoding to get address
          let address = '';
          try {
            const google = window.google;
            const geocoder = new google.maps.Geocoder();
            const response = await geocoder.geocode({
              location: { lat: latitude, lng: longitude }
            });

            if (response.results[0]) {
              address = response.results[0].formatted_address;
            }
          } catch (err) {
            console.log('Geocoding failed:', err);
          }

          // Send location to backend
          const token = localStorage.getItem('token');
          const response = await fetch('/api/v1/locations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              latitude,
              longitude,
              address,
              accuracy,
              locationType: 'current'
            })
          });

          const data = await response.json();

          if (data.success) {
            addNotification({
              id: Date.now(),
              type: 'success',
              title: 'Location Shared',
              message: 'Your location has been shared successfully'
            });

            onLocationShared && onLocationShared(data.data);

            // Update map center
            if (map) {
              map.setCenter({ lat: latitude, lng: longitude });
              map.setZoom(16);
            }
          } else {
            setError(data.message || 'Failed to share location');
          }
        } catch (err) {
          setError('Failed to share location');
        } finally {
          setSharingLocation(false);
        }
      },
      (error) => {
        setError('Unable to retrieve your location');
        setSharingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Loading map...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          {showUserLocations ? 'User Locations' : 'Location Sharing'}
        </CardTitle>
        <CardDescription>
          {showUserLocations 
            ? 'View all user locations on the map'
            : 'Share your current location with admins'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {allowLocationSharing && (
            <div className="flex gap-2">
              <Button
                onClick={shareCurrentLocation}
                disabled={sharingLocation}
                className="flex items-center gap-2"
              >
                {sharingLocation ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sharing Location...
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" />
                    Share My Location
                  </>
                )}
              </Button>
              
              {showUserLocations && (
                <Button
                  variant="outline"
                  onClick={fetchUserLocations}
                  className="flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  Refresh Locations
                </Button>
              )}
            </div>
          )}

          <div 
            ref={mapRef} 
            className="w-full h-96 rounded-lg border"
            style={{ minHeight: '400px' }}
          />

          {showUserLocations && (
            <div className="text-sm text-gray-600">
              Showing {userLocations.length} user location(s)
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GoogleMap;