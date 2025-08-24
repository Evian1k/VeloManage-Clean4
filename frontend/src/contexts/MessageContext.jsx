import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { apiService } from '../services/api';
import { useSocket } from './SocketContext';

const MessageContext = createContext();

export const useMessages = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessages must be used within a MessageProvider');
  }
  return context;
};

// Helper functions for local storage backup (fallback)
const getLocalConversations = () => {
  const conversations = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('autocare_messages_')) {
      const userId = key.replace('autocare_messages_', '');
      conversations[userId] = JSON.parse(localStorage.getItem(key) || '[]');
    }
  }
  return conversations;
};

const saveMessageLocally = (message, conversationId) => {
  const key = `autocare_messages_${conversationId}`;
  const existingMessages = JSON.parse(localStorage.getItem(key) || '[]');
  const newMessages = [...existingMessages, message];
  localStorage.setItem(key, JSON.stringify(newMessages));
};

const saveUserToMessageList = (user) => {
  const existingUsers = JSON.parse(localStorage.getItem('autocare_message_users') || '[]');
  const userExists = existingUsers.find(u => u.id === user.id);
  
  if (!userExists) {
    const newUserList = [...existingUsers, {
      id: user.id,
      name: user.name,
      email: user.email
    }];
    localStorage.setItem('autocare_message_users', JSON.stringify(newUserList));
    return newUserList;
  }
  return existingUsers;
};


export const MessageProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState({});
  const [usersWithMessages, setUsersWithMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // Normalize message objects to a consistent shape
  const normalizeMessage = (message) => {
    if (!message) return null;
    const createdAt = message.createdAt || message.timestamp || new Date().toISOString();
    const senderType = message.senderType || message.sender;
    const id = message.id || message._id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      ...message,
      id,
      senderType,
      createdAt
    };
  };

  const normalizeMessagesArray = (arr = []) => {
    return arr.map(normalizeMessage).filter(Boolean).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  };

  // Load messages from backend or user profile
  const loadMessages = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      if (user.isAdmin) {
        // Admin: Load all user messages and build conversations per user
        try {
          const adminResp = await apiService.getAdminAllMessages(1, 200, false);
          if (adminResp.success) {
            const msgs = adminResp.data?.messages || [];
            // Group by conversation id (userId as string)
            const byUser = {};
            const users = new Map();
            msgs.forEach((m) => {
              const convId = m.conversation || (m.senderType === 'user' ? (m.sender?._id || m.sender) : (m.recipient?._id || m.recipient));
              if (!convId) return;
              if (!byUser[convId]) byUser[convId] = [];
              byUser[convId].push(m);
              const uId = convId;
              const uName = (m.senderType === 'user' ? (m.sender?.name) : (m.recipient?.name)) || 'User';
              const uEmail = (m.senderType === 'user' ? (m.sender?.email) : (m.recipient?.email)) || '';
              users.set(uId, { id: uId, name: uName, email: uEmail });
            });

            // Fetch full conversation per user (ensure completeness)
            const userIds = Object.keys(byUser);
            const conversationsEntries = await Promise.all(userIds.map(async (uid) => {
              try {
                const convResp = await apiService.getMessagesForConversation(uid);
                const list = convResp.success ? (convResp.data || []) : byUser[uid];
                return [uid, normalizeMessagesArray(list)];
              } catch {
                return [uid, normalizeMessagesArray(byUser[uid])];
              }
            }));

            const normalizedConvos = Object.fromEntries(conversationsEntries);
            setConversations(normalizedConvos);
            setUsersWithMessages(Array.from(users.values()));
          } else {
            const localConvos = getLocalConversations();
            setConversations(localConvos);
            setUsersWithMessages(JSON.parse(localStorage.getItem('autocare_message_users') || '[]'));
          }
        } catch (e) {
          // Fallback to local storage
          const localConvos = getLocalConversations();
          setConversations(localConvos);
          setUsersWithMessages(JSON.parse(localStorage.getItem('autocare_message_users') || '[]'));
        }
      } else {
        // User: Check if messages are already loaded in user data
        if (user.messages && user.messages.length > 0) {
          // Messages already loaded from profile
          setConversations({ [user.id]: normalizeMessagesArray(user.messages) });
        } else {
          // Load messages from API
          const response = await apiService.getMessages();
          if (response.success) {
            setConversations({ [user.id]: normalizeMessagesArray(response.data || []) });
          } else {
            // Fallback to local storage
            const savedMessages = localStorage.getItem(`autocare_messages_${user.id}`);
            const parsed = savedMessages ? JSON.parse(savedMessages) : [];
            setConversations({ [user.id]: normalizeMessagesArray(parsed) });
          }
        }
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      
      // Use messages from user data if available
      if (!user.isAdmin && user.messages) {
        setConversations({ [user.id]: normalizeMessagesArray(user.messages) });
      } else {
        // Fallback to local storage
        if (user.isAdmin) {
          const localConvos = getLocalConversations();
          setConversations(localConvos);
        } else {
          const savedMessages = localStorage.getItem(`autocare_messages_${user.id}`);
          const parsed = savedMessages ? JSON.parse(savedMessages) : [];
          setConversations({ [user.id]: normalizeMessagesArray(parsed) });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadMessages();
    } else {
      setConversations({});
      setUsersWithMessages([]);
    }
  }, [user]);

  // Real-time: Listen for new messages via socket
  useEffect(() => {
    if (!socket) return;
    const handleMessageReceived = (data) => {
      // Only update if admin
      if (user && user.isAdmin) {
        const senderId = data.senderId || (data.sender && data.sender._id);
        if (!senderId) return;
        setConversations(prev => {
          const prevMessages = prev[senderId] || [];
          const incoming = normalizeMessage(data.message || data);
          return { ...prev, [senderId]: normalizeMessagesArray([...prevMessages, incoming]) };
        });
        setUsersWithMessages(prev => {
          if (prev.some(u => u.id === senderId)) return prev;
          // Add new user to list
          const newUser = {
            id: senderId,
            name: data.senderName || (data.sender && data.sender.name) || 'User',
            email: (data.sender && data.sender.email) || ''
          };
          return [newUser, ...prev];
        });
      }
    };
    socket.on('message-received', handleMessageReceived);
    return () => socket.off('message-received', handleMessageReceived);
  }, [socket, user]);

  const sendMessage = async (text) => {
    if (!user) return;
    
    try {
      // Send message to backend
      const messageData = {
        text: text,
        recipientId: user.isAdmin ? null : undefined // Admin needs to specify recipient
      };
      
      const response = await apiService.sendMessage(messageData);
      
      if (response.success) {
        // Update local state with the sent message
        const sentMessage = normalizeMessage(response.data);
        const conversationId = user.isAdmin ? (sentMessage.recipient?._id || sentMessage.recipient) : user.id;
        
        const currentMessages = conversations[conversationId] || [];
        const updatedMessages = normalizeMessagesArray([...currentMessages, sentMessage]);
        const newConversations = { ...conversations, [conversationId]: updatedMessages };
        setConversations(newConversations);
        
        // Also save locally as backup
        saveMessageLocally(sentMessage, conversationId);
        
        // If auto-reply was sent, add it to state
        if (response.autoReply) {
          const messagesWithReply = normalizeMessagesArray([...updatedMessages, normalizeMessage(response.autoReply)]);
          const finalConversations = { ...conversations, [conversationId]: messagesWithReply };
          setConversations(finalConversations);
          saveMessageLocally(response.autoReply, conversationId);
        }
        
        // Update user list for admin view
        if (!user.isAdmin) {
          saveUserToMessageList(user);
        }
      } else {
        throw new Error(response.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Fallback to local storage only
      const newMessage = {
        id: Date.now(),
        senderType: user.isAdmin ? 'admin' : 'user',
        text,
        createdAt: new Date().toISOString(),
        pending: true // Mark as pending sync
      };
      
      const conversationId = user.id;
      const currentMessages = conversations[conversationId] || [];
      const updatedMessages = normalizeMessagesArray([...currentMessages, newMessage]);
      const newConversations = { ...conversations, [conversationId]: updatedMessages };
      setConversations(newConversations);
      saveMessageLocally(newMessage, conversationId);
      
      // Save user to message list
      if (!user.isAdmin) {
        saveUserToMessageList(user);
      }
    }
  };

  const sendMessageToUser = async (userId, text) => {
    if (!user || !user.isAdmin) return;

    try {
      // Send message to backend
      const response = await apiService.sendMessage({
        text: text,
        recipientId: userId
      });
      
      if (response.success) {
        // Update local state with the sent message
        const sentMessage = normalizeMessage(response.data);
        const userMessages = conversations[userId] || [];
        const updatedMessages = normalizeMessagesArray([...userMessages, sentMessage]);
        const newConversations = { ...conversations, [userId]: updatedMessages };
        setConversations(newConversations);
        
        // Also save locally as backup
        saveMessageLocally(sentMessage, userId);
      } else {
        throw new Error(response.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send admin message:', error);
      
      // Fallback to local storage
      const newMessage = {
        id: Date.now(),
        senderType: 'admin',
        text,
        createdAt: new Date().toISOString(),
        pending: true
      };

      const userMessages = conversations[userId] || [];
      const updatedMessages = normalizeMessagesArray([...userMessages, newMessage]);
      const newConversations = { ...conversations, [userId]: updatedMessages };
      setConversations(newConversations);
      saveMessageLocally(newMessage, userId);
    }
  };

  const refreshMessages = () => {
    loadMessages();
  };

  const refreshUserList = () => {
    if (user?.isAdmin) {
      // Re-derive user list from conversations
      const list = Object.keys(conversations).map((uid) => {
        const msgs = conversations[uid] || [];
        const last = msgs[msgs.length - 1];
        return {
          id: uid,
          name: (last?.senderType === 'user' ? last?.sender?.name : last?.recipient?.name) || 'User',
          email: (last?.senderType === 'user' ? last?.sender?.email : last?.recipient?.email) || ''
        };
      });
      setUsersWithMessages(list);
    }
  };

  const value = {
    messages: user && !user.isAdmin ? conversations[user.id] || [] : [],
    conversations,
    usersWithMessages,
    selectedUser,
    setSelectedUser,
    sendMessage,
    sendMessageToUser,
    refreshMessages,
    refreshUserList,
    loading,
  };

  return (
    <MessageContext.Provider value={value}>
      {children}
    </MessageContext.Provider>
  );
};