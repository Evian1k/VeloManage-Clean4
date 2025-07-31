import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import NotificationSystem from '@/components/NotificationSystem';

const AdminHeader = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
    toast({
      title: "Logged out",
      description: "Admin session ended successfully.",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8"
    >
      <div>
        <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-300">Welcome back, {user.name} - System Administrator</p>
      </div>
      
      <div className="flex items-center gap-4 mt-4 md:mt-0">
        <NotificationSystem />
        
        <div className="flex items-center gap-2 px-3 py-1 bg-red-600 rounded-full">
          <Shield className="w-4 h-4 text-white" />
          <span className="text-white text-sm font-medium">Admin</span>
        </div>
        
        <Avatar>
          <AvatarFallback className="bg-red-600 text-white">
            {user.name.split(' ').map(n => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
        
        <Button
          variant="outline"
          onClick={handleLogout}
          className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>
    </motion.div>
  );
};

export default AdminHeader;