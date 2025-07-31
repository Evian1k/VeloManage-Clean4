import React from 'react';
import { motion } from 'framer-motion';
import { Wrench, Clock, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const AdminStats = ({ requests }) => {
  const pendingRequests = requests.filter(req => req.status === 'pending');
  const approvedRequests = requests.filter(req => req.status === 'approved');
  const completedRequests = requests.filter(req => req.status === 'completed');

  const stats = [
    { label: 'Total Requests', value: requests.length, icon: <Wrench className="w-6 h-6" />, color: 'text-blue-500' },
    { label: 'Pending', value: pendingRequests.length, icon: <Clock className="w-6 h-6" />, color: 'text-yellow-500' },
    { label: 'Approved', value: approvedRequests.length, icon: <CheckCircle className="w-6 h-6" />, color: 'text-green-500' },
    { label: 'Completed', value: completedRequests.length, icon: <CheckCircle className="w-6 h-6" />, color: 'text-purple-500' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
    >
      {stats.map((stat, index) => (
        <Card key={index} className="admin-card card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">{stat.label}</p>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
              </div>
              <div className={stat.color}>
                {stat.icon}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </motion.div>
  );
};

export default AdminStats;