import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Bell, Wrench, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useService } from '@/contexts/ServiceContext';

const UserNotifications = ({ notifications }) => {
  const { markNotificationAsRead } = useService();
  const navigate = useNavigate();

  const handleNotificationClick = (notification) => {
    markNotificationAsRead(notification.id);
    if (notification.requestId) {
      const request = notifications.find(n => n.requestId === notification.requestId);
      if (request && request.trackingEnabled && request.status === 'approved') {
        navigate(`/tracking/${notification.requestId}`);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold text-white">Notifications</h2>
      
      {notifications.length === 0 ? (
        <Card className="glass-effect border-red-900/30">
          <CardContent className="text-center py-12">
            <Bell className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Notifications</h3>
            <p className="text-gray-400">You're all caught up!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={`glass-effect border-red-900/30 cursor-pointer card-hover ${
                !notification.read ? 'ring-2 ring-red-500/50' : ''
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      notification.type === 'service_reminder' ? 'bg-yellow-600' :
                      notification.type === 'status_update' ? 'bg-blue-600' :
                      'bg-green-600'
                    }`}>
                      {notification.type === 'service_reminder' ? <Clock className="w-4 h-4 text-white" /> :
                       notification.type === 'status_update' ? <Bell className="w-4 h-4 text-white" /> :
                       <Wrench className="w-4 h-4 text-white" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{notification.title}</h4>
                      <p className="text-gray-300 text-sm">{notification.message}</p>
                      <p className="text-gray-500 text-xs mt-1">
                        {new Date(notification.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-red-500 rounded-full notification-badge"></div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default UserNotifications;