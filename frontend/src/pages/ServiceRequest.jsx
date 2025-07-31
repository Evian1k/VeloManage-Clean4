
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { ArrowLeft, Car, Wrench, Truck, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useService } from '@/contexts/ServiceContext';
import { useToast } from '@/components/ui/use-toast';

const ServiceRequest = () => {
  const navigate = useNavigate();
  const { createServiceRequest, serviceTypes, spareParts } = useService();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    serviceType: '',
    vehicleInfo: '',
    description: '',
    urgency: 'normal',
    preferredDate: '',
    contactNumber: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const request = createServiceRequest(formData);
      toast({
        title: "Request Submitted!",
        description: `Your ${formData.serviceType} request has been submitted successfully. Request ID: ${request.id}`,
      });
      navigate('/dashboard');
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getServiceIcon = (serviceType) => {
    if (serviceType.includes('Pickup')) return <Truck className="w-6 h-6" />;
    return <Wrench className="w-6 h-6" />;
  };

  const getServiceDescription = (serviceType) => {
    const descriptions = {
      'Brake Repair': 'Professional brake system inspection, repair, and replacement services',
      '3000km Routine Maintenance': 'Comprehensive vehicle maintenance including oil change, filter replacement, and system checks',
      'Vehicle Pickup': 'Professional vehicle pickup and delivery service with real-time GPS tracking',
      'Oil Change': 'Quick and efficient engine oil and filter replacement service',
      'Tire Replacement': 'Professional tire installation and wheel alignment services',
      'Engine Diagnostic': 'Advanced computer diagnostics to identify and resolve engine issues',
      'Transmission Service': 'Complete transmission fluid change and system maintenance',
      'AC Repair': 'Air conditioning system repair and refrigerant recharge services'
    };
    return descriptions[serviceType] || 'Professional automotive service';
  };

  const suggestedParts = formData.serviceType ? spareParts[formData.serviceType.replace(/\s+/g, '_').toUpperCase()] || [] : [];

  return (
    <div className="min-h-screen p-4">
      <Helmet>
        <title>Request Service - AutoCare Pro</title>
        <meta name="description" content="Request professional car services including brake repair, routine maintenance, and vehicle pickup with real-time tracking." />
      </Helmet>

      <div className="max-w-4xl mx-auto">
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
            <h1 className="text-3xl md:text-4xl font-bold gradient-text">Request Service</h1>
            <p className="text-gray-300">Submit a new service request for your vehicle</p>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-2"
          >
            <Card className="glass-effect border-red-900/30">
              <CardHeader>
                <CardTitle className="text-white">Service Details</CardTitle>
                <CardDescription className="text-gray-300">
                  Please provide details about the service you need
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Service Type */}
                  <div className="space-y-2">
                    <Label htmlFor="serviceType" className="text-white">Service Type *</Label>
                    <Select
                      value={formData.serviceType}
                      onValueChange={(value) => handleSelectChange('serviceType', value)}
                    >
                      <SelectTrigger className="bg-black/50 border-red-900/50 text-white">
                        <SelectValue placeholder="Select a service" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(serviceTypes).map((service) => (
                          <SelectItem key={service} value={service}>
                            {service}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Vehicle Information */}
                  <div className="space-y-2">
                    <Label htmlFor="vehicleInfo" className="text-white">Vehicle Information *</Label>
                    <Input
                      id="vehicleInfo"
                      name="vehicleInfo"
                      placeholder="e.g., Toyota Camry 2020, License Plate: ABC-123"
                      value={formData.vehicleInfo}
                      onChange={handleChange}
                      required
                      className="bg-black/50 border-red-900/50 text-white placeholder:text-gray-400"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-white">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Describe the issue or specific requirements..."
                      value={formData.description}
                      onChange={handleChange}
                      rows={4}
                      className="bg-black/50 border-red-900/50 text-white placeholder:text-gray-400"
                    />
                  </div>

                  {/* Urgency */}
                  <div className="space-y-2">
                    <Label htmlFor="urgency" className="text-white">Urgency Level</Label>
                    <Select
                      value={formData.urgency}
                      onValueChange={(value) => handleSelectChange('urgency', value)}
                    >
                      <SelectTrigger className="bg-black/50 border-red-900/50 text-white">
                        <SelectValue placeholder="Select urgency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low - Can wait a few days</SelectItem>
                        <SelectItem value="normal">Normal - Within this week</SelectItem>
                        <SelectItem value="high">High - As soon as possible</SelectItem>
                        <SelectItem value="emergency">Emergency - Immediate attention</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Preferred Date */}
                  <div className="space-y-2">
                    <Label htmlFor="preferredDate" className="text-white">Preferred Date</Label>
                    <Input
                      id="preferredDate"
                      name="preferredDate"
                      type="date"
                      value={formData.preferredDate}
                      onChange={handleChange}
                      min={new Date().toISOString().split('T')[0]}
                      className="bg-black/50 border-red-900/50 text-white"
                    />
                  </div>

                  {/* Contact Number */}
                  <div className="space-y-2">
                    <Label htmlFor="contactNumber" className="text-white">Contact Number *</Label>
                    <Input
                      id="contactNumber"
                      name="contactNumber"
                      type="tel"
                      placeholder="Your phone number for updates"
                      value={formData.contactNumber}
                      onChange={handleChange}
                      required
                      className="bg-black/50 border-red-900/50 text-white placeholder:text-gray-400"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={loading || !formData.serviceType || !formData.vehicleInfo || !formData.contactNumber}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white red-glow"
                  >
                    {loading ? "Submitting Request..." : "Submit Service Request"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            {/* Service Preview */}
            {formData.serviceType && (
              <Card className="glass-effect border-red-900/30">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    {getServiceIcon(formData.serviceType)}
                    Service Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-white mb-2">{formData.serviceType}</h3>
                      <p className="text-gray-300 text-sm">{getServiceDescription(formData.serviceType)}</p>
                    </div>
                    
                    {formData.serviceType === 'Vehicle Pickup' && (
                      <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-400 font-medium">GPS Tracking Included</span>
                        </div>
                        <p className="text-gray-300 text-sm">
                          Real-time tracking will be available once your request is approved
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span>Estimated response: 2-4 hours</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Suggested Parts */}
            {suggestedParts.length > 0 && (
              <Card className="glass-effect border-red-900/30">
                <CardHeader>
                  <CardTitle className="text-white">Suggested Parts</CardTitle>
                  <CardDescription className="text-gray-300">
                    Parts commonly needed for this service
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {suggestedParts.map((part, index) => (
                      <Badge key={index} variant="outline" className="border-red-500 text-red-500 mr-2 mb-2">
                        {part}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-gray-400 text-sm mt-3">
                    Final parts selection will be confirmed during service
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Service Info */}
            <Card className="glass-effect border-red-900/30">
              <CardHeader>
                <CardTitle className="text-white">Service Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">Response Time</p>
                      <p className="text-gray-400">Admin review within 2-4 hours</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Car className="w-4 h-4 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">Professional Service</p>
                      <p className="text-gray-400">Certified technicians and quality parts</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">Real-time Updates</p>
                      <p className="text-gray-400">Track your service progress live</p>
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

export default ServiceRequest;
