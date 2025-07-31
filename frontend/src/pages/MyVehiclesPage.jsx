import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Car, Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useService } from '@/contexts/ServiceContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const MyVehiclesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { vehicles, addVehicle, updateVehicle, deleteVehicle } = useService();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [currentVehicle, setCurrentVehicle] = useState(null);
  const [vehicleToDelete, setVehicleToDelete] = useState(null);

  const userVehicles = vehicles.filter(v => v.userId === user.id);

  const handleAddNew = () => {
    setCurrentVehicle({ make: '', model: '', year: '', licensePlate: '' });
    setIsDialogOpen(true);
  };

  const handleEdit = (vehicle) => {
    setCurrentVehicle(vehicle);
    setIsDialogOpen(true);
  };

  const handleDelete = (vehicle) => {
    setVehicleToDelete(vehicle);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    deleteVehicle(vehicleToDelete.id);
    toast({ title: "Vehicle Deleted", description: `${vehicleToDelete.make} ${vehicleToDelete.model} has been removed.` });
    setIsDeleteConfirmOpen(false);
    setVehicleToDelete(null);
  };

  const handleSave = () => {
    if (currentVehicle.id) {
      updateVehicle(currentVehicle);
      toast({ title: "Vehicle Updated", description: "Your vehicle details have been updated." });
    } else {
      addVehicle(currentVehicle);
      toast({ title: "Vehicle Added", description: "Your new vehicle has been added." });
    }
    setIsDialogOpen(false);
    setCurrentVehicle(null);
  };

  return (
    <div className="min-h-screen p-4">
      <Helmet>
        <title>My Vehicles - AutoCare Pro</title>
        <meta name="description" content="Manage your vehicles in the AutoCare Pro system." />
      </Helmet>

      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text">My Vehicles</h1>
              <p className="text-gray-300">Add, edit, and manage your vehicles</p>
            </div>
          </div>
          <Button onClick={handleAddNew} className="bg-gradient-to-r from-red-600 to-red-700 text-white">
            <Plus className="w-4 h-4" />
            Add New Vehicle
          </Button>
        </motion.div>

        {userVehicles.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="glass-effect border-red-900/30 text-center py-12">
              <CardContent>
                <Car className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Vehicles Found</h3>
                <p className="text-gray-400 mb-6">Get started by adding your first vehicle.</p>
                <Button onClick={handleAddNew} className="bg-gradient-to-r from-red-600 to-red-700 text-white">
                  Add Vehicle
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {userVehicles.map((vehicle, index) => (
              <motion.div
                key={vehicle.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="glass-effect border-red-900/30 card-hover h-full flex flex-col">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-white">{vehicle.make} {vehicle.model}</CardTitle>
                        <CardDescription className="text-gray-300">{vehicle.year}</CardDescription>
                      </div>
                      <div className="p-3 bg-red-600 rounded-lg">
                        <Car className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-lg font-semibold text-white bg-black/30 px-4 py-2 rounded-md text-center">
                      {vehicle.licensePlate}
                    </p>
                  </CardContent>
                  <div className="p-6 pt-0 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(vehicle)} className="flex-1 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white">
                      <Edit className="w-4 h-4 mr-2" /> Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(vehicle)} className="flex-1">
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Vehicle Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="glass-effect border-red-900/30">
          <DialogHeader>
            <DialogTitle className="text-white">{currentVehicle?.id ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle>
            <DialogDescription className="text-gray-300">
              {currentVehicle?.id ? 'Update the details of your vehicle.' : 'Enter the details of your new vehicle.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="make" className="text-right text-white">Make</Label>
              <Input id="make" value={currentVehicle?.make} onChange={(e) => setCurrentVehicle({...currentVehicle, make: e.target.value})} className="col-span-3 bg-black/50 border-red-900/50 text-white" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="model" className="text-right text-white">Model</Label>
              <Input id="model" value={currentVehicle?.model} onChange={(e) => setCurrentVehicle({...currentVehicle, model: e.target.value})} className="col-span-3 bg-black/50 border-red-900/50 text-white" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="year" className="text-right text-white">Year</Label>
              <Input id="year" type="number" value={currentVehicle?.year} onChange={(e) => setCurrentVehicle({...currentVehicle, year: e.target.value})} className="col-span-3 bg-black/50 border-red-900/50 text-white" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="licensePlate" className="text-right text-white">License Plate</Label>
              <Input id="licensePlate" value={currentVehicle?.licensePlate} onChange={(e) => setCurrentVehicle({...currentVehicle, licensePlate: e.target.value})} className="col-span-3 bg-black/50 border-red-900/50 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-gradient-to-r from-red-600 to-red-700 text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="glass-effect border-red-900/30">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Deletion</DialogTitle>
            <DialogDescription className="text-gray-300">
              Are you sure you want to delete the vehicle: {vehicleToDelete?.make} {vehicleToDelete?.model}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyVehiclesPage;