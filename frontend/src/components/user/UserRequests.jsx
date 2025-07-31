import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Plus, Wrench, Calendar, Clock, MapPin, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const UserRequests = ({ userRequests }) => {
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">My Service Requests</h2>
        <Link to="/request-service">
          <Button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white">
            <Plus className="w-4 h-4" />
            New Request
          </Button>
        </Link>
      </div>

      {userRequests.length === 0 ? (
        <Card className="glass-effect border-red-900/30">
          <CardContent className="text-center py-12">
            <Wrench className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Requests Yet</h3>
            <p className="text-gray-400 mb-6">Start by creating your first service request</p>
            <Link to="/request-service">
              <Button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white">
                Create Request
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {userRequests.map((request) => (
            <Card key={request.id} className="glass-effect border-red-900/30 card-hover">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-600 rounded-lg">
                      {request.trackingEnabled ? <Truck className="w-6 h-6 text-white" /> : <Wrench className="w-6 h-6 text-white" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{request.serviceType}</h3>
                      <p className="text-gray-400">Request ID: {request.id}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(request.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Est. {new Date(request.estimatedCompletion).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Badge className={`${getStatusColor(request.status)} text-white`}>
                      {request.status}
                    </Badge>
                    
                    {request.trackingEnabled && request.status === 'approved' && (
                      <Link to={`/tracking/${request.id}`}>
                        <Button size="sm" className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white">
                          <MapPin className="w-4 h-4" />
                          Track
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
                
                {request.description && (
                  <div className="mt-4 p-3 bg-black/30 rounded-lg">
                    <p className="text-gray-300">{request.description}</p>
                  </div>
                )}
                
                {request.suggestedParts && request.suggestedParts.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-400 mb-2">Suggested Parts:</p>
                    <div className="flex flex-wrap gap-2">
                      {request.suggestedParts.map((part, index) => (
                        <Badge key={index} variant="outline" className="border-red-500 text-red-500">
                          {part}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default UserRequests;