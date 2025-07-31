import React, { useEffect, useState, useRef } from 'react';
import { Bell, X, MessageSquare, Truck, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getTimeAgo } from '@/lib/utils';

const NotificationSystem = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const audioRef = useRef(null);
  const lastCheckRef = useRef(Date.now());

  // Create notification sound
  const playNotificationSound = () => {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  };

  // Check for new messages
  const checkNewMessages = () => {
    const allConversations = getAllStorageConversations();
    const newMessages = [];

    if (user?.isAdmin) {
      // Check all user conversations for new messages
      Object.keys(allConversations).forEach(userId => {
        const messages = allConversations[userId] || [];
        const newUserMessages = messages.filter(msg => 
          msg.sender === 'user' && 
          new Date(msg.timestamp).getTime() > lastCheckRef.current
        );
        
        newUserMessages.forEach(msg => {
          newMessages.push({
            id: `msg-${msg.id}`,
            type: 'message',
            title: 'New Message',
            message: `New message from user`,
            timestamp: msg.timestamp,
            isRead: false
          });
        });
      });
    } else if (user) {
      // Check for new admin replies
      const userMessages = allConversations[user.id] || [];
      const newAdminMessages = userMessages.filter(msg => 
        msg.sender === 'admin' && 
        new Date(msg.timestamp).getTime() > lastCheckRef.current
      );
      
      newAdminMessages.forEach(msg => {
        newMessages.push({
          id: `msg-${msg.id}`,
          type: 'message',
          title: 'Admin Reply',
          message: msg.text.substring(0, 50) + (msg.text.length > 50 ? '...' : ''),
          timestamp: msg.timestamp,
          isRead: false
        });
      });
    }

    return newMessages;
  };

  // Check for new pickup requests or status updates
  const checkPickupUpdates = () => {
    const pickupRequests = JSON.parse(localStorage.getItem('autocare_pickup_requests') || '[]');
    const newUpdates = [];

    if (user?.isAdmin) {
      // Check for new pickup requests
      const newRequests = pickupRequests.filter(req => 
        req.status === 'pending' &&
        new Date(req.requestTime).getTime() > lastCheckRef.current
      );
      
      newRequests.forEach(req => {
        newUpdates.push({
          id: `pickup-${req.id}`,
          type: 'pickup',
          title: 'New Pickup Request',
          message: `${req.userName} requested pickup`,
          timestamp: req.requestTime,
          isRead: false
        });
      });
    } else if (user) {
      // Check for status updates on user's requests
      const userRequests = pickupRequests.filter(req => req.userId === user.id);
      const updatedRequests = userRequests.filter(req => 
        req.dispatchTime && 
        new Date(req.dispatchTime).getTime() > lastCheckRef.current
      );
      
      updatedRequests.forEach(req => {
        newUpdates.push({
          id: `status-${req.id}`,
          type: 'status',
          title: 'Pickup Status Update',
          message: `Your pickup request is now ${req.status}`,
          timestamp: req.dispatchTime || req.requestTime,
          isRead: false
        });
      });
    }

    return newUpdates;
  };

  // Get all conversations from localStorage
  const getAllStorageConversations = () => {
    const conversations = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('autocare_messages_')) {
        const userId = key.replace('autocare_messages_', '');
        conversations[userId] = JSON.parse(localStorage.getItem(key) || '[]');
      }
    }
    return conversations;
  };

  // Check for updates periodically
  useEffect(() => {
    if (!user) return;

    const checkForUpdates = () => {
      const newMessages = checkNewMessages();
      const newPickups = checkPickupUpdates();
      const allNewNotifications = [...newMessages, ...newPickups];

      if (allNewNotifications.length > 0) {
        setNotifications(prev => [
          ...allNewNotifications,
          ...prev.slice(0, 19) // Keep only 20 most recent
        ]);
        setHasUnread(true);
        
        // Play notification sound
        try {
          playNotificationSound();
        } catch (error) {
          console.log('Could not play notification sound:', error);
        }
      }

      lastCheckRef.current = Date.now();
    };

    // Check immediately and then every 5 seconds
    checkForUpdates();
    const interval = setInterval(checkForUpdates, 5000);

    return () => clearInterval(interval);
  }, [user]);

  // Load saved notifications
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`autocare_notifications_${user.id}`);
      if (saved) {
        const savedNotifications = JSON.parse(saved);
        setNotifications(savedNotifications);
        setHasUnread(savedNotifications.some(n => !n.isRead));
      }
    }
  }, [user]);

  // Save notifications when they change
  useEffect(() => {
    if (user && notifications.length > 0) {
      localStorage.setItem(`autocare_notifications_${user.id}`, JSON.stringify(notifications));
    }
  }, [notifications, user]);

  const markAsRead = (notificationId) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    
    // Check if there are still unread notifications
    const stillHasUnread = notifications.some(n => n.id !== notificationId && !n.isRead);
    setHasUnread(stillHasUnread);
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setHasUnread(false);
  };

  const removeNotification = (notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="w-4 h-4" />;
      case 'pickup':
      case 'status':
        return <Truck className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative">
      {/* Notification Bell */}
      <Button
        onClick={() => setShowPanel(!showPanel)}
        variant="outline"
        size="sm"
        className={`relative border-red-900/50 hover:bg-red-900/20 ${
          hasUnread ? 'text-red-300 border-red-500' : 'text-gray-400'
        }`}
      >
        <Bell className={`w-4 h-4 ${hasUnread ? 'animate-pulse' : ''}`} />
        {unreadCount > 0 && (
          <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs bg-red-600 text-white border-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-12 z-50 w-80 max-h-96 overflow-hidden"
          >
            <Card className="glass-effect border-red-900/30 bg-black/80 backdrop-blur-sm">
              <CardContent className="p-0">
                <div className="p-4 border-b border-red-900/30">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-medium">Notifications</h3>
                    <div className="flex gap-2">
                      {unreadCount > 0 && (
                        <Button
                          onClick={markAllAsRead}
                          variant="ghost"
                          size="sm"
                          className="text-xs text-gray-400 hover:text-white"
                        >
                          Mark all read
                        </Button>
                      )}
                      <Button
                        onClick={() => setShowPanel(false)}
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No notifications yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {notifications.map((notification) => (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`p-3 border-b border-red-900/20 hover:bg-red-900/10 cursor-pointer transition-colors ${
                            !notification.isRead ? 'bg-red-900/5 border-l-2 border-l-red-500' : ''
                          }`}
                          onClick={() => markAsRead(notification.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-1 rounded-full ${
                              notification.type === 'message' ? 'bg-blue-600/20 text-blue-400' :
                              notification.type === 'pickup' ? 'bg-green-600/20 text-green-400' :
                              'bg-orange-600/20 text-orange-400'
                            }`}>
                              {getNotificationIcon(notification.type)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className={`text-sm font-medium ${
                                  !notification.isRead ? 'text-white' : 'text-gray-300'
                                }`}>
                                  {notification.title}
                                </h4>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeNotification(notification.id);
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-1 text-gray-500 hover:text-white"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {getTimeAgo(notification.timestamp)}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationSystem;