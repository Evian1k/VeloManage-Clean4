import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Wrench,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Truck,
  MapPin,
} from 'lucide-react';

const RequestCard = ({ request, onStatusUpdate }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'approved': return 'status-approved';
      case 'rejected': return 'status-rejected';
      case 'completed': return 'status-completed';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <Card className="admin-card card-hover">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className="p-3 bg-red-600 rounded-lg">
              {request.trackingEnabled ? <Truck className="w-6 h-6 text-white" /> : <Wrench className="w-6 h-6 text-white" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-white">{request.serviceType}</h3>
                <Badge className={`${getStatusColor(request.status)} text-white`}>
                  {getStatusIcon(request.status)}
                  {request.status}
                </Badge>
                {request.trackingEnabled && request.status === 'approved' && (
                  <Badge variant="outline" className="border-blue-500 text-blue-500">
                    <MapPin className="w-3 h-3 mr-1" />
                    Tracking Enabled
                  </Badge>
                )}
              </div>
              <p className="text-gray-400 text-sm mb-2">Request ID: {request.id}</p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-3">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  User ID: {request.userId}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(request.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              {request.description && (
                <div className="p-3 bg-black/30 rounded-lg mb-3">
                  <p className="text-gray-300 text-sm">{request.description}</p>
                </div>
              )}
              
              {request.suggestedParts && request.suggestedParts.length > 0 && (
                <div>
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

              {request.adminNotes && (
                <div className="mt-3 p-3 bg-green-900/20 rounded-lg border border-green-500/30">
                  <p className="text-green-300 text-sm font-medium mb-1">Admin Notes:</p>
                  <p className="text-gray-300 text-sm">{request.adminNotes}</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 min-w-fit self-start lg:self-center">
            {request.status === 'pending' && (
              <>
                <Button onClick={() => onStatusUpdate(request, 'approved')} className="bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </Button>
                <Button onClick={() => onStatusUpdate(request, 'rejected')} variant="destructive">
                  <XCircle className="w-4 h-4" />
                  Reject
                </Button>
              </>
            )}
            {request.status === 'approved' && (
              <Button onClick={() => onStatusUpdate(request, 'completed')} className="bg-purple-600 hover:bg-purple-700 text-white">
                <CheckCircle className="w-4 h-4" />
                Complete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RequestCard;