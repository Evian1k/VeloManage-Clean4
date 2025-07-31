import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wrench, Car, Bell, Plus, Calendar, Settings, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useService } from '@/contexts/ServiceContext';

const UserOverview = ({ userRequests, unreadNotifications, user }) => {
  const { vehicles } = useService();
  const userVehicles = vehicles.filter(v => v.userId === user.id);

  const quickActionButtons = [
    { to: "/request-service", icon: <Plus className="w-6 h-6" />, label: "New Request", isLink: true },
    { to: "/my-vehicles", icon: <Car className="w-6 h-6" />, label: "My Vehicles", isLink: true },
    { to: "/service-history", icon: <Calendar className="w-6 h-6" />, label: "Service History", isLink: true },
    { to: "/settings", icon: <Settings className="w-6 h-6" />, label: "Settings", isLink: true }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'approved': return 'status-approved';
      case 'rejected': return 'status-rejected';
      case 'completed': return 'status-completed';
      default: return 'bg-gray-500';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-effect border-red-900/30 card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Requests</p>
                <p className="text-2xl font-bold text-white">{userRequests.length}</p>
              </div>
              <Wrench className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-effect border-red-900/30 card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Vehicles</p>
                <p className="text-2xl font-bold text-white">{userVehicles.length}</p>
              </div>
              <Car className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-effect border-red-900/30 card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Notifications</p>
                <p className="text-2xl font-bold text-white">{unreadNotifications.length}</p>
              </div>
              <Bell className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-effect border-red-900/30">
        <CardHeader>
          <CardTitle className="text-white">Quick Actions</CardTitle>
          <CardDescription className="text-gray-300">Get started with common tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActionButtons.map((action, index) => {
              const button = (
                <Button
                  key={index}
                  onClick={action.onClick}
                  variant={action.isLink ? "default" : "outline"}
                  className={`w-full h-20 flex flex-col items-center justify-center gap-2 ${action.isLink ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white' : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'}`}
                >
                  {action.icon}
                  {action.label}
                </Button>
              );
              return action.isLink ? <Link to={action.to} key={index}>{button}</Link> : button;
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-effect border-red-900/30">
        <CardHeader>
          <CardTitle className="text-white">Recent Requests</CardTitle>
          <CardDescription className="text-gray-300">Your latest service requests</CardDescription>
        </CardHeader>
        <CardContent>
          {userRequests.length === 0 ? (
            <div className="text-center py-8">
              <Wrench className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No service requests yet</p>
              <Link to="/request-service">
                <Button className="mt-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white">
                  Create Your First Request
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {userRequests.slice(0, 3).map((request) => (
                <div key={request.id} className="flex items-center justify-between p-4 bg-black/30 rounded-lg border border-red-900/30">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-red-600 rounded-lg">
                      {request.trackingEnabled ? <Truck className="w-4 h-4 text-white" /> : <Wrench className="w-4 h-4 text-white" />}
                    </div>
                    <div>
                      <p className="font-medium text-white">{request.serviceType}</p>
                      <p className="text-sm text-gray-400">{new Date(request.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Badge className={`${getStatusColor(request.status)} text-white`}>
                    {request.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default UserOverview;