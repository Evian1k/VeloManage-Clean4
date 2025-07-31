import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Wrench } from 'lucide-react';
import RequestCard from './RequestCard';

const RequestList = ({ requests, onStatusUpdate, emptyMessage, statusFilter }) => {
  const filteredRequests = statusFilter ? requests.filter(r => r.status === statusFilter) : requests;

  if (requests.length === 0) {
    return (
      <Card className="admin-card">
        <CardContent className="text-center py-12">
          <Wrench className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">{emptyMessage}</h3>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <RequestCard
          key={request.id}
          request={request}
          onStatusUpdate={onStatusUpdate}
        />
      ))}
    </div>
  );
};

export default RequestList;