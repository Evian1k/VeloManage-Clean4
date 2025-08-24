import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('autocare_token') || localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('autocare_user') || localStorage.getItem('user') || '{}');
    
    if (!token) return;

    // Initialize socket connection
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
      auth: {
        token
      }
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
      
      // Join appropriate rooms based on user role
      const adminRoles = ['admin', 'main_admin', 'super_admin'];
      if (adminRoles.includes(user.role) || user.isAdmin) {
        newSocket.emit('join-admin-room');
      } else {
        newSocket.emit('join-user-room', user.id || user._id);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    // Listen for real-time events
    newSocket.on('message-received', (data) => {
      console.log('New message received:', data);
      addNotification({
        id: Date.now(),
        type: 'message',
        title: 'New Message',
        message: `New message from ${data.senderName}`,
        data
      });
    });

    newSocket.on('payment-initiated', (data) => {
      console.log('Payment initiated:', data);
      addNotification({
        id: Date.now(),
        type: 'payment',
        title: 'Payment Initiated',
        message: `${data.userName} initiated a payment of $${data.amount}`,
        data
      });
    });

    newSocket.on('payment-completed', (data) => {
      console.log('Payment completed:', data);
      addNotification({
        id: Date.now(),
        type: 'payment',
        title: 'Payment Completed',
        message: `Payment of $${data.amount} completed by ${data.userName}`,
        data
      });
    });

    newSocket.on('payment-failed', (data) => {
      console.log('Payment failed:', data);
      addNotification({
        id: Date.now(),
        type: 'payment',
        title: 'Payment Failed',
        message: `Payment of $${data.amount} failed`,
        data
      });
    });

    newSocket.on('location-shared', (data) => {
      console.log('Location shared:', data);
      addNotification({
        id: Date.now(),
        type: 'location',
        title: 'Location Shared',
        message: `${data.userName} shared their location`,
        data
      });
    });

    newSocket.on('pickup-request-received', (data) => {
      console.log('Pickup request received:', data);
      addNotification({
        id: Date.now(),
        type: 'pickup',
        title: 'New Pickup Request',
        message: `New pickup request from ${data.userName}`,
        data
      });
    });

    newSocket.on('truck-dispatch-update', (data) => {
      console.log('Truck dispatch update:', data);
      addNotification({
        id: Date.now(),
        type: 'truck',
        title: 'Truck Dispatched',
        message: `Truck ${data.truckId} has been dispatched`,
        data
      });
    });

    newSocket.on('truck-location-updated', (data) => {
      console.log('Truck location updated:', data);
      // Don't create notifications for frequent location updates
      // Just emit the event for components that need it
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const addNotification = (notification) => {
    setNotifications(prev => [notification, ...prev.slice(0, 99)]); // Keep last 100
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      removeNotification(notification.id);
    }, 5000);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const sendMessage = (data) => {
    if (socket && isConnected) {
      socket.emit('new-message', data);
    }
  };

  const updateTruckLocation = (data) => {
    if (socket && isConnected) {
      socket.emit('truck-location-update', data);
    }
  };

  const sendPickupRequest = (data) => {
    if (socket && isConnected) {
      socket.emit('new-pickup-request', data);
    }
  };

  const dispatchTruck = (data) => {
    if (socket && isConnected) {
      socket.emit('truck-dispatched', data);
    }
  };

  const value = {
    socket,
    isConnected,
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    sendMessage,
    updateTruckLocation,
    sendPickupRequest,
    dispatchTruck
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;