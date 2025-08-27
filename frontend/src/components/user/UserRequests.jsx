import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Plus, Wrench, Calendar, Clock, MapPin, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiService } from '@/services/api';

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

                {request.status === 'completed' && (
                  <div className="mt-4 p-3 bg-black/30 rounded-lg">
                    <p className="text-gray-300 mb-2">Rate your service</p>
                    <RatingForm request={request} />
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

const RatingForm = ({ request }) => {
  const [score, setScore] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    try {
      setSubmitting(true);
      setError('');
      await apiService.rateBooking(request.id, score, feedback);
      setSuccess(true);
    } catch (e) {
      setError(e.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) return <div className="text-green-400 text-sm">Thank you for your review!</div>;

  return (
    <div className="flex flex-col gap-2">
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <div className="flex items-center gap-2">
        <span className="text-gray-300 text-sm">Rating:</span>
        <select className="bg-black/50 border border-red-900/50 text-white rounded p-1" value={score} onChange={e => setScore(parseInt(e.target.value))} disabled={submitting}>
          {[1,2,3,4,5].map(n => (<option key={n} value={n}>{n}</option>))}
        </select>
      </div>
      <textarea className="bg-black/50 border border-red-900/50 text-white rounded p-2 text-sm" rows={2} placeholder="Optional feedback" value={feedback} onChange={e => setFeedback(e.target.value)} disabled={submitting} />
      <div>
        <Button size="sm" onClick={submit} disabled={submitting} className="bg-gradient-to-r from-green-600 to-green-700 text-white">
          {submitting ? 'Submitting...' : 'Submit Review'}
        </Button>
      </div>
    </div>
  );
};

export default UserRequests;