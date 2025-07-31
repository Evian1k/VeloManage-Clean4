import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Loader2, Truck, Plus, MapPin } from 'lucide-react';
import { useSocket } from '../../contexts/SocketContext';

const AddTruckForm = ({ onTruckAdded, trigger }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { addNotification } = useSocket();

  const [formData, setFormData] = useState({
    truckId: '',
    driver: {
      name: '',
      phone: '',
      email: '',
      licenseNumber: ''
    },
    vehicle: {
      licensePlate: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      capacity: ''
    },
    currentLocation: {
      latitude: '',
      longitude: '',
      address: ''
    },
    specifications: {
      fuelType: 'diesel',
      engineSize: '',
      transmission: 'manual'
    }
  });

  const handleInputChange = (section, field, value) => {
    if (section) {
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Try to get address using reverse geocoding
        let address = '';
        try {
          const response = await fetch(
            `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=YOUR_OPENCAGE_API_KEY`
          );
          const data = await response.json();
          if (data.results && data.results[0]) {
            address = data.results[0].formatted;
          }
        } catch (err) {
          console.log('Reverse geocoding failed:', err);
        }

        setFormData(prev => ({
          ...prev,
          currentLocation: {
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            address: address || `${latitude}, ${longitude}`
          }
        }));
      },
      (error) => {
        setError('Unable to retrieve current location');
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // Validate required fields
      if (!formData.truckId || !formData.driver.name || !formData.driver.phone || 
          !formData.vehicle.licensePlate || !formData.currentLocation.latitude || 
          !formData.currentLocation.longitude) {
        setError('Please fill in all required fields');
        setIsSubmitting(false);
        return;
      }

      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/trucks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          currentLocation: {
            ...formData.currentLocation,
            latitude: parseFloat(formData.currentLocation.latitude),
            longitude: parseFloat(formData.currentLocation.longitude)
          },
          vehicle: {
            ...formData.vehicle,
            year: parseInt(formData.vehicle.year)
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Truck added successfully!');
        addNotification({
          id: Date.now(),
          type: 'success',
          title: 'Truck Added',
          message: `Truck ${formData.truckId} has been added successfully`
        });

        // Reset form
        setFormData({
          truckId: '',
          driver: {
            name: '',
            phone: '',
            email: '',
            licenseNumber: ''
          },
          vehicle: {
            licensePlate: '',
            make: '',
            model: '',
            year: new Date().getFullYear(),
            capacity: ''
          },
          currentLocation: {
            latitude: '',
            longitude: '',
            address: ''
          },
          specifications: {
            fuelType: 'diesel',
            engineSize: '',
            transmission: 'manual'
          }
        });

        onTruckAdded && onTruckAdded(data.data);
        
        // Close dialog after 2 seconds
        setTimeout(() => {
          setIsOpen(false);
          setSuccess('');
        }, 2000);
      } else {
        setError(data.message || 'Failed to add truck');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultTrigger = (
    <Button className="flex items-center gap-2">
      <Plus className="h-4 w-4" />
      Add Pickup Truck
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Add New Pickup Truck
          </DialogTitle>
          <DialogDescription>
            Fill in the truck and driver details to add a new pickup truck to the fleet.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="truckId">Truck ID *</Label>
                <Input
                  id="truckId"
                  value={formData.truckId}
                  onChange={(e) => handleInputChange(null, 'truckId', e.target.value)}
                  placeholder="TRUCK001"
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Driver Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Driver Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="driverName">Driver Name *</Label>
                  <Input
                    id="driverName"
                    value={formData.driver.name}
                    onChange={(e) => handleInputChange('driver', 'name', e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="driverPhone">Phone Number *</Label>
                  <Input
                    id="driverPhone"
                    value={formData.driver.phone}
                    onChange={(e) => handleInputChange('driver', 'phone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="driverEmail">Email</Label>
                  <Input
                    id="driverEmail"
                    type="email"
                    value={formData.driver.email}
                    onChange={(e) => handleInputChange('driver', 'email', e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="licenseNumber">License Number</Label>
                  <Input
                    id="licenseNumber"
                    value={formData.driver.licenseNumber}
                    onChange={(e) => handleInputChange('driver', 'licenseNumber', e.target.value)}
                    placeholder="DL123456789"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vehicle Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vehicle Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="licensePlate">License Plate *</Label>
                  <Input
                    id="licensePlate"
                    value={formData.vehicle.licensePlate}
                    onChange={(e) => handleInputChange('vehicle', 'licensePlate', e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input
                    id="capacity"
                    value={formData.vehicle.capacity}
                    onChange={(e) => handleInputChange('vehicle', 'capacity', e.target.value)}
                    placeholder="5 tons"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="make">Make</Label>
                  <Input
                    id="make"
                    value={formData.vehicle.make}
                    onChange={(e) => handleInputChange('vehicle', 'make', e.target.value)}
                    placeholder="Ford"
                  />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={formData.vehicle.model}
                    onChange={(e) => handleInputChange('vehicle', 'model', e.target.value)}
                    placeholder="F-150"
                  />
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    value={formData.vehicle.year}
                    onChange={(e) => handleInputChange('vehicle', 'year', e.target.value)}
                    min="1990"
                    max={new Date().getFullYear() + 1}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Location */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={getCurrentLocation}
                  className="flex items-center gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  Get Current Location
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="latitude">Latitude *</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={formData.currentLocation.latitude}
                    onChange={(e) => handleInputChange('currentLocation', 'latitude', e.target.value)}
                    placeholder="40.7128"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="longitude">Longitude *</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={formData.currentLocation.longitude}
                    onChange={(e) => handleInputChange('currentLocation', 'longitude', e.target.value)}
                    placeholder="-74.0060"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.currentLocation.address}
                  onChange={(e) => handleInputChange('currentLocation', 'address', e.target.value)}
                  placeholder="123 Main St, New York, NY 10001"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Specifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Specifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="fuelType">Fuel Type</Label>
                  <Select 
                    value={formData.specifications.fuelType}
                    onValueChange={(value) => handleInputChange('specifications', 'fuelType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="petrol">Petrol</SelectItem>
                      <SelectItem value="diesel">Diesel</SelectItem>
                      <SelectItem value="electric">Electric</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="transmission">Transmission</Label>
                  <Select 
                    value={formData.specifications.transmission}
                    onValueChange={(value) => handleInputChange('specifications', 'transmission', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="automatic">Automatic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="engineSize">Engine Size</Label>
                  <Input
                    id="engineSize"
                    value={formData.specifications.engineSize}
                    onChange={(e) => handleInputChange('specifications', 'engineSize', e.target.value)}
                    placeholder="2.5L"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Truck...
                </>
              ) : (
                'Add Truck'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddTruckForm;