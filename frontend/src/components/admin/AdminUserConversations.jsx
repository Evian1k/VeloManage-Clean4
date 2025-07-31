import React from 'react';
import { useMessages } from '@/contexts/MessageContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const AdminUserConversations = () => {
  const { usersWithMessages, conversations, selectedUser, setSelectedUser } = useMessages();

  return (
    <div className="h-full flex flex-col bg-red-900 border border-red-800 rounded-lg p-4 overflow-y-auto">
      <h3 className="text-lg font-bold text-white mb-4">Users</h3>
      {usersWithMessages.length === 0 ? (
        <div className="text-gray-300 text-center mt-8">No user messages yet.</div>
      ) : (
        usersWithMessages.map((user) => (
          <div
            key={user.id}
            onClick={() => setSelectedUser(user)}
            className={`flex items-center gap-3 p-3 mb-2 rounded-lg cursor-pointer transition-colors ${selectedUser?.id === user.id ? 'bg-red-600' : 'hover:bg-red-800'}`}
          >
            <Avatar>
              <AvatarFallback className="bg-blue-600 text-white">{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-white">{user.name}</p>
              <p className="text-xs text-gray-300 truncate">
                {conversations[user.id]?.slice(-1)[0]?.text || 'No messages yet'}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default AdminUserConversations;
