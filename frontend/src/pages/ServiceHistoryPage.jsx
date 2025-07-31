import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Wrench, Truck, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useService } from '@/contexts/ServiceContext';

const ServiceHistoryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { requests } = useService();

  const completedRequests = requests
    .filter(req => req.userId === user.id && req.status === 'completed')
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  return (
    <div className="min-h-screen p-4">
      <Helmet>
        <title>Service History - AutoCare Pro</title>
        <meta name="description" content="View your completed service history with AutoCare Pro." />
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
              <h1 className="text-3xl md:text-4xl font-bold gradient-text">Service History</h1>
              <p className="text-gray-300">A record of all your completed services</p>
            </div>
          </div>
        </motion.div>

        {completedRequests.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="glass-effect border-red-900/30 text-center py-12">
              <CardContent>
                <Calendar className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Completed Services</h3>
                <p className="text-gray-400">Your completed service requests will appear here.</p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {completedRequests.map((request, index) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="glass-effect border-red-900/30 card-hover">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-white flex items-center gap-2">
                          {request.trackingEnabled ? <Truck className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                          {request.serviceType}
                        </CardTitle>
                        <CardDescription className="text-gray-300">
                          Completed on: {new Date(request.updatedAt || request.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge className="status-completed text-white">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Completed
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {request.description && (
                        <div className="p-3 bg-black/30 rounded-lg">
                          <p className="text-sm font-medium text-white mb-1">Service Description:</p>
                          <p className="text-gray-300 text-sm">{request.description}</p>
                        </div>
                      )}
                      {request.adminNotes && (
                        <div className="p-3 bg-green-900/20 rounded-lg border border-green-500/30">
                          <p className="text-green-300 text-sm font-medium mb-1">Admin Completion Notes:</p>
                          <p className="text-gray-300 text-sm">{request.adminNotes}</p>
                        </div>
                      )}
                      {request.suggestedParts && request.suggestedParts.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-400 mb-2">Parts Used:</p>
                          <div className="flex flex-wrap gap-2">
                            {request.suggestedParts.map((part, i) => (
                              <Badge key={i} variant="outline" className="border-red-500 text-red-500">
                                {part}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceHistoryPage;