import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Car, Bell, Wrench, MessageSquare, MapPin, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useService } from '@/contexts/ServiceContext';
import { useSocket } from '@/contexts/SocketContext';
import UserHeader from '@/components/user/UserHeader';
import UserOverview from '@/components/user/UserOverview';
import UserRequests from '@/components/user/UserRequests';
import UserNotifications from '@/components/user/UserNotifications';
import UserMessages from '@/components/user/UserMessages';
import LocationSharing from '@/components/user/LocationSharing';
import PaymentForm from '@/components/PaymentForm';
import GoogleMap from '@/components/GoogleMap';

const UserDashboard = () => {
  const { user } = useAuth();
  const { requests, notifications } = useService();
  const { addNotification } = useSocket();
  const [activeTab, setActiveTab] = useState('overview');

  const userRequests = requests.filter(req => req.userId === user.id);
  const unreadNotifications = notifications.filter(n => !n.read);

  const handlePaymentSuccess = (paymentIntent) => {
    addNotification({
      id: Date.now(),
      type: 'success',
      title: 'Payment Successful',
      message: `Payment of $${paymentIntent.amount / 100} completed successfully`
    });
  };

  const handleLocationShared = (location) => {
    addNotification({
      id: Date.now(),
      type: 'success',
      title: 'Location Shared',
      message: 'Your location has been shared with admins'
    });
  };

  const TABS = [
    { id: 'overview', label: 'Overview', icon: <Car className="w-4 h-4" /> },
    { id: 'requests', label: 'My Requests', icon: <Wrench className="w-4 h-4" /> },
    { id: 'location', label: 'Location & Map', icon: <MapPin className="w-4 h-4" /> },
    { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'messages', label: 'Messages', icon: <MessageSquare className="w-4 h-4" /> }
  ];

  return (
    <div className="min-h-screen p-4">
      <Helmet>
        <title>Dashboard - AutoCare Pro</title>
        <meta name="description" content="Manage your vehicle services, track requests, and stay updated with your AutoCare Pro dashboard." />
      </Helmet>

      <UserHeader unreadCount={unreadNotifications.length} onNotificationClick={() => setActiveTab('notifications')} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="flex flex-wrap gap-2 mb-8"
      >
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "outline"}
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id 
              ? "bg-gradient-to-r from-red-600 to-red-700 text-white" 
              : "border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            }
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </motion.div>

      {activeTab === 'overview' && <UserOverview userRequests={userRequests} unreadNotifications={unreadNotifications} user={user} />}
      {activeTab === 'requests' && <UserRequests userRequests={userRequests} />}
      {activeTab === 'location' && (
        <div className="space-y-6">
          <LocationSharing />
          <GoogleMap 
            showUserLocations={false}
            allowLocationSharing={true}
            onLocationShared={handleLocationShared}
          />
        </div>
      )}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white mb-6">Make a Payment</h2>
          <PaymentForm onPaymentSuccess={handlePaymentSuccess} />
        </div>
      )}
      {activeTab === 'notifications' && <UserNotifications notifications={notifications} />}
      {activeTab === 'messages' && <UserMessages />}
    </div>
  );
};

export default UserDashboard;