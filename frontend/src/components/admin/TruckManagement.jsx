import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Truck, 
  MapPin, 
  FileText, 
  Upload,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const TruckManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState(null);
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
      capacity: '',
      fuelType: 'diesel',
      engineSize: '',
      transmission: 'manual'
    },
    currentLocation: {
      latitude: -1.2921,
      longitude: 36.8219,
      address: 'Nairobi, Kenya'
    },
    maintenance: {
      lastService: '',
      nextService: '',
      mileage: 0,
      notes: []
    },
    specifications: {
      maxWeight: '',
      dimensions: '',
      features: []
    }
  });
  const [uploadingDocs, setUploadingDocs] = useState(false);

  useEffect(() => {
    loadTrucks();
  }, []);

  const loadTrucks = async () => {
    try {
      setLoading(true);
      const response = await apiService.getTrucks();
      
      if (response.success) {
        setTrucks(response.data || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load trucks",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading trucks:', error);
      toast({
        title: "Error",
        description: "Failed to load trucks",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (path, value) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const resetForm = () => {
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
        capacity: '',
        fuelType: 'diesel',
        engineSize: '',
        transmission: 'manual'
      },
      currentLocation: {
        latitude: -1.2921,
        longitude: 36.8219,
        address: 'Nairobi, Kenya'
      },
      maintenance: {
        lastService: '',
        nextService: '',
        mileage: 0,
        notes: []
      },
      specifications: {
        maxWeight: '',
        dimensions: '',
        features: []
      }
    });
    setEditingTruck(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      let response;
      if (editingTruck) {
        response = await apiService.updateTruck(editingTruck._id, formData);
      } else {
        response = await apiService.createTruck(formData);
      }
      
      if (response.success) {
        toast({
          title: "Success",
          description: editingTruck ? "Truck updated successfully" : "Truck added successfully"
        });
        
        setIsDialogOpen(false);
        resetForm();
        loadTrucks();
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to save truck",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error saving truck:', error);
      toast({
        title: "Error",
        description: "Failed to save truck",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (truck) => {
    setEditingTruck(truck);
    setFormData({
      truckId: truck.truckId || '',
      driver: {
        name: truck.driver?.name || '',
        phone: truck.driver?.phone || '',
        email: truck.driver?.email || '',
        licenseNumber: truck.driver?.licenseNumber || ''
      },
      vehicle: {
        licensePlate: truck.vehicle?.licensePlate || '',
        make: truck.vehicle?.make || '',
        model: truck.vehicle?.model || '',
        year: truck.vehicle?.year || new Date().getFullYear(),
        capacity: truck.vehicle?.capacity || '',
        fuelType: truck.vehicle?.fuelType || 'diesel',
        engineSize: truck.vehicle?.engineSize || '',
        transmission: truck.vehicle?.transmission || 'manual'
      },
      currentLocation: {
        latitude: truck.currentLocation?.latitude || -1.2921,
        longitude: truck.currentLocation?.longitude || 36.8219,
        address: truck.currentLocation?.address || 'Nairobi, Kenya'
      },
      maintenance: {
        lastService: truck.maintenance?.lastService ? new Date(truck.maintenance.lastService).toISOString().split('T')[0] : '',
        nextService: truck.maintenance?.nextService ? new Date(truck.maintenance.nextService).toISOString().split('T')[0] : '',
        mileage: truck.maintenance?.mileage || 0,
        notes: truck.maintenance?.notes || []
      },
      specifications: {
        maxWeight: truck.specifications?.maxWeight || '',
        dimensions: truck.specifications?.dimensions || '',
        features: truck.specifications?.features || []
      }
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (truckId) => {
    if (window.confirm('Are you sure you want to delete this truck?')) {
      try {
        const response = await apiService.deleteTruck(truckId);
        
        if (response.success) {
          toast({
            title: "Success",
            description: "Truck deleted successfully"
          });
          loadTrucks();
        } else {
          toast({
            title: "Error",
            description: "Failed to delete truck",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Error deleting truck:', error);
        toast({
          title: "Error",
          description: "Failed to delete truck",
          variant: "destructive"
        });
      }
    }
  };

  const handleDocumentUpload = async (truckId, files) => {
    try {
      setUploadingDocs(true);
      
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('truckDocuments', file);
      });
      
      const response = await apiService.uploadTruckDocuments(truckId, formData);
      
      if (response.success) {
        toast({
          title: "Success",
          description: `${files.length} document(s) uploaded successfully`
        });
        loadTrucks();
      } else {
        toast({
          title: "Error",
          description: "Failed to upload documents",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error uploading documents:', error);
      toast({
        title: "Error",
        description: "Failed to upload documents",
        variant: "destructive"
      });
    } finally {
      setUploadingDocs(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'dispatched': return 'bg-blue-500';
      case 'maintenance': return 'bg-red-500';
      case 'en-route': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'available': return <CheckCircle className="w-4 h-4" />;
      case 'dispatched': return <MapPin className="w-4 h-4" />;
      case 'maintenance': return <AlertTriangle className="w-4 h-4" />;
      case 'en-route': return <Clock className="w-4 h-4" />;
      default: return <Truck className="w-4 h-4" />;
    }
  };

  if (!user?.isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">Access denied. Admin privileges required.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Fleet Management</h2>
          <p className="text-gray-600">Add, edit, and manage your company's trucks</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadTrucks} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Add Truck
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTruck ? 'Edit Truck' : 'Add New Truck'}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="truckId">Truck ID *</Label>
                    <Input
                      id="truckId"
                      value={formData.truckId}
                      onChange={(e) => handleInputChange('truckId', e.target.value)}
                      placeholder="TR-001"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="licensePlate">License Plate *</Label>
                    <Input
                      id="licensePlate"
                      value={formData.vehicle.licensePlate}
                      onChange={(e) => handleInputChange('vehicle.licensePlate', e.target.value)}
                      placeholder="KCA 123A"
                      required
                    />
                  </div>
                </div>

                {/* Vehicle Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Vehicle Information</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="make">Make</Label>
                      <Input
                        id="make"
                        value={formData.vehicle.make}
                        onChange={(e) => handleInputChange('vehicle.make', e.target.value)}
                        placeholder="Toyota"
                      />
                    </div>
                    <div>
                      <Label htmlFor="model">Model</Label>
                      <Input
                        id="model"
                        value={formData.vehicle.model}
                        onChange={(e) => handleInputChange('vehicle.model', e.target.value)}
                        placeholder="Hilux"
                      />
                    </div>
                    <div>
                      <Label htmlFor="year">Year</Label>
                      <Input
                        id="year"
                        type="number"
                        value={formData.vehicle.year}
                        onChange={(e) => handleInputChange('vehicle.year', parseInt(e.target.value))}
                        min="1990"
                        max={new Date().getFullYear() + 1}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="capacity">Capacity (tons)</Label>
                      <Input
                        id="capacity"
                        type="number"
                        step="0.1"
                        value={formData.vehicle.capacity}
                        onChange={(e) => handleInputChange('vehicle.capacity', e.target.value)}
                        placeholder="3.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fuelType">Fuel Type</Label>
                      <Select 
                        value={formData.vehicle.fuelType} 
                        onValueChange={(value) => handleInputChange('vehicle.fuelType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="diesel">Diesel</SelectItem>
                          <SelectItem value="petrol">Petrol</SelectItem>
                          <SelectItem value="electric">Electric</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="transmission">Transmission</Label>
                      <Select 
                        value={formData.vehicle.transmission} 
                        onValueChange={(value) => handleInputChange('vehicle.transmission', value)}
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
                  </div>
                </div>

                {/* Driver Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Driver Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="driverName">Driver Name *</Label>
                      <Input
                        id="driverName"
                        value={formData.driver.name}
                        onChange={(e) => handleInputChange('driver.name', e.target.value)}
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="driverPhone">Phone Number *</Label>
                      <Input
                        id="driverPhone"
                        value={formData.driver.phone}
                        onChange={(e) => handleInputChange('driver.phone', e.target.value)}
                        placeholder="+254700123456"
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
                        onChange={(e) => handleInputChange('driver.email', e.target.value)}
                        placeholder="john@example.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="licenseNumber">License Number</Label>
                      <Input
                        id="licenseNumber"
                        value={formData.driver.licenseNumber}
                        onChange={(e) => handleInputChange('driver.licenseNumber', e.target.value)}
                        placeholder="DL123456"
                      />
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Current Location</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="latitude">Latitude</Label>
                      <Input
                        id="latitude"
                        type="number"
                        step="any"
                        value={formData.currentLocation.latitude}
                        onChange={(e) => handleInputChange('currentLocation.latitude', parseFloat(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="longitude">Longitude</Label>
                      <Input
                        id="longitude"
                        type="number"
                        step="any"
                        value={formData.currentLocation.longitude}
                        onChange={(e) => handleInputChange('currentLocation.longitude', parseFloat(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={formData.currentLocation.address}
                        onChange={(e) => handleInputChange('currentLocation.address', e.target.value)}
                        placeholder="Nairobi, Kenya"
                      />
                    </div>
                  </div>
                </div>

                {/* Maintenance */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Maintenance</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="lastService">Last Service</Label>
                      <Input
                        id="lastService"
                        type="date"
                        value={formData.maintenance.lastService}
                        onChange={(e) => handleInputChange('maintenance.lastService', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="nextService">Next Service</Label>
                      <Input
                        id="nextService"
                        type="date"
                        value={formData.maintenance.nextService}
                        onChange={(e) => handleInputChange('maintenance.nextService', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="mileage">Mileage (km)</Label>
                      <Input
                        id="mileage"
                        type="number"
                        value={formData.maintenance.mileage}
                        onChange={(e) => handleInputChange('maintenance.mileage', parseInt(e.target.value))}
                        placeholder="50000"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : editingTruck ? 'Update Truck' : 'Add Truck'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Trucks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trucks.map((truck) => (
          <Card key={truck._id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    {truck.truckId}
                  </CardTitle>
                  <p className="text-sm text-gray-600">{truck.vehicle?.licensePlate}</p>
                </div>
                <Badge className={`${getStatusColor(truck.status)} text-white`}>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(truck.status)}
                    {truck.status}
                  </div>
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Vehicle</p>
                  <p className="text-sm text-gray-600">
                    {truck.vehicle?.make} {truck.vehicle?.model} ({truck.vehicle?.year})
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium">Driver</p>
                  <p className="text-sm text-gray-600">{truck.driver?.name}</p>
                  <p className="text-xs text-gray-500">{truck.driver?.phone}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium">Location</p>
                  <p className="text-xs text-gray-500">{truck.currentLocation?.address}</p>
                </div>

                {truck.documents && truck.documents.length > 0 && (
                  <div>
                    <p className="text-sm font-medium">Documents</p>
                    <p className="text-xs text-gray-500">{truck.documents.length} file(s)</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(truck)}>
                    <Edit3 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => document.getElementById(`file-${truck._id}`).click()}
                    disabled={uploadingDocs}
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    Docs
                  </Button>
                  <input
                    id={`file-${truck._id}`}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.png"
                    style={{ display: 'none' }}
                    onChange={(e) => handleDocumentUpload(truck._id, e.target.files)}
                  />
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => handleDelete(truck._id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {trucks.length === 0 && !loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Truck className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">No trucks found</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Truck
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TruckManagement;