import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

const StatusUpdateDialog = ({ dialogState, setDialogState, updateRequestStatus }) => {
  const { isOpen, request, actionType } = dialogState;
  const [adminNotes, setAdminNotes] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (request) {
      setAdminNotes(request.adminNotes || '');
    }
  }, [request]);

  const handleClose = () => {
    setDialogState({ isOpen: false, request: null, actionType: '' });
    setAdminNotes('');
  };

  const confirmStatusUpdate = () => {
    if (request && actionType) {
      updateRequestStatus(request.id, actionType, adminNotes);
      toast({
        title: "Request Updated",
        description: `Request ${request.id} has been ${actionType}`,
      });
      handleClose();
    }
  };

  const titleMap = {
    approved: 'Approve Request',
    rejected: 'Reject Request',
    completed: 'Complete Request',
  };

  const placeholderMap = {
    approved: 'Add any special instructions or notes...',
    rejected: 'Please provide a reason for rejection...',
    completed: 'Add completion notes...',
  };

  const buttonClassMap = {
    approved: 'bg-green-600 hover:bg-green-700',
    rejected: 'bg-red-600 hover:bg-red-700',
    completed: 'bg-purple-600 hover:bg-purple-700',
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="glass-effect border-red-900/30">
        <DialogHeader>
          <DialogTitle className="text-white">
            {titleMap[actionType] || 'Update Status'}
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            {request && `Request ID: ${request.id} - ${request.serviceType}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="adminNotes" className="text-white">
              Admin Notes {actionType === 'rejected' ? '(Required)' : '(Optional)'}
            </Label>
            <Textarea
              id="adminNotes"
              placeholder={placeholderMap[actionType] || 'Add notes...'}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="bg-black/50 border-red-900/50 text-white placeholder:text-gray-400"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={confirmStatusUpdate}
            disabled={actionType === 'rejected' && !adminNotes.trim()}
            className={buttonClassMap[actionType]}
          >
            {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StatusUpdateDialog;