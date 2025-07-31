import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useService } from '@/contexts/ServiceContext';
import AdminHeader from '@/components/admin/AdminHeader';
import AdminStats from '@/components/admin/AdminStats';
import RequestList from '@/components/admin/RequestList';
import StatusUpdateDialog from '@/components/admin/StatusUpdateDialog';
import AdminMessages from '@/components/admin/AdminMessages';
import AdminUserConversations from '@/components/admin/AdminUserConversations';
import TruckDispatch from '@/components/admin/TruckDispatch';
import AddTruckForm from '@/components/admin/AddTruckForm';
import PaymentForm from '@/components/PaymentForm';
import GoogleMap from '@/components/GoogleMap';
import { useSocket } from '@/contexts/SocketContext';
import { Wrench, MessageSquare, Truck, CreditCard, MapPin, Plus } from 'lucide-react';

const sidebarTabs = [
  { value: 'requests', label: 'Service Requests', icon: <Wrench className="w-5 h-5 mr-2" /> },
  { value: 'trucks', label: 'Fleet Management', icon: <Truck className="w-5 h-5 mr-2" /> },
  { value: 'messages', label: 'Messages', icon: <MessageSquare className="w-5 h-5 mr-2" /> },
  { value: 'payments', label: 'Payments', icon: <CreditCard className="w-5 h-5 mr-2" /> },
  { value: 'locations', label: 'Locations', icon: <MapPin className="w-5 h-5 mr-2" /> },
];

const AdminDashboard = () => {
  const { requests, updateRequestStatus } = useService();
  const { notifications, removeNotification } = useSocket();
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    request: null,
    actionType: '',
  });
  const [trucks, setTrucks] = useState([]);
  const [activeTab, setActiveTab] = useState('requests');

  const handleStatusUpdate = (request, action) => {
    setDialogState({ isOpen: true, request, actionType: action });
  };

  const handleTruckAdded = (newTruck) => {
    setTrucks(prev => [newTruck, ...prev]);
  };

  const handlePaymentSuccess = (paymentIntent) => {
    console.log('Payment successful:', paymentIntent);
  };

  const pendingRequests = requests.filter(req => req.status === 'pending');
  const approvedRequests = requests.filter(req => req.status === 'approved');
  const completedRequests = requests.filter(req => req.status === 'completed');

  const requestTabs = [
    { value: 'pending', label: 'Pending', data: pendingRequests, emptyMessage: 'No pending requests. All requests have been processed.' },
    { value: 'approved', label: 'Approved', data: approvedRequests, emptyMessage: 'No requests are currently approved.' },
    { value: 'completed', label: 'Completed', data: completedRequests, emptyMessage: 'No requests have been completed yet.' },
    { value: 'all', label: 'All Requests', data: requests, emptyMessage: 'No service requests in the system.' },
  ];

  return (
    <div className="min-h-screen flex bg-black">
      {/* Sidebar */}
      <aside className="w-64 bg-red-900 border-r border-red-800 flex flex-col py-8 px-4 min-h-screen">
        <div className="mb-8">
          <span className="text-2xl font-bold text-white">Admin Panel</span>
        </div>
        <nav className="flex flex-col gap-2">
          {sidebarTabs.map(tab => (
            <button
              key={tab.value}
              className={`flex items-center px-4 py-3 rounded-lg text-left transition-colors font-medium text-white hover:bg-red-700/80 ${activeTab === tab.value ? 'bg-red-600' : 'bg-red-800'}`}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      </aside>
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen bg-black">
        <Helmet>
          <title>Admin Dashboard - AutoCare Pro</title>
          <meta name="description" content="Administrative dashboard for managing service requests, approvals, and system oversight." />
        </Helmet>
        {/* Header */}
        <header className="bg-red-900 border-b border-red-800 px-8 py-4">
          <AdminHeader />
        </header>
        {/* Stats */}
        <div className="px-8 py-4">
          <AdminStats requests={requests} />
        </div>
        {/* Main Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex-1 px-8 py-6"
        >
          {/* Service Requests Tab */}
          {activeTab === 'requests' && (
            <Tabs defaultValue="pending" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4 bg-red-900 border border-red-800">
                {requestTabs.map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value} className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-white">
                    {tab.label} ({tab.data.length})
                  </TabsTrigger>
                ))}
              </TabsList>
              {requestTabs.map(tab => (
                <TabsContent key={tab.value} value={tab.value} className="space-y-4">
                  <RequestList 
                    requests={tab.data}
                    onStatusUpdate={handleStatusUpdate}
                    emptyMessage={tab.emptyMessage}
                    statusFilter={tab.value !== 'all' ? tab.value : undefined}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
          {/* Fleet Management Tab */}
          {activeTab === 'trucks' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Fleet Management</h2>
                <AddTruckForm onTruckAdded={handleTruckAdded} />
              </div>
              <TruckDispatch />
            </div>
          )}
          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[80vh]">
              {/* User List Section */}
              <AdminUserConversations />
              {/* Conversation Section */}
              <div className="lg:col-span-2">
                <AdminMessages />
              </div>
            </div>
          )}
          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white mb-6">Payment Management</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PaymentForm onPaymentSuccess={handlePaymentSuccess} />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Recent Payment Notifications</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {notifications
                      .filter(notif => notif.type === 'payment')
                      .slice(0, 10)
                      .map(notif => (
                        <div key={notif.id} className="p-3 bg-red-900 rounded-lg border border-red-800">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-white">{notif.title}</h4>
                              <p className="text-sm text-gray-300">{notif.message}</p>
                            </div>
                            <button
                              onClick={() => removeNotification(notif.id)}
                              className="text-gray-400 hover:text-white"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Locations Tab */}
          {activeTab === 'locations' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white mb-6">User Locations</h2>
              <GoogleMap 
                showUserLocations={true}
                allowLocationSharing={false}
              />
            </div>
          )}
        </motion.div>
        {/* Status Update Dialog */}
        <StatusUpdateDialog
          dialogState={dialogState}
          setDialogState={setDialogState}
          updateRequestStatus={updateRequestStatus}
        />
      </div>
    </div>
  );
};

export default AdminDashboard;