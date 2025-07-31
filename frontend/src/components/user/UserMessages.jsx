import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/contexts/MessageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';

const UserMessages = () => {
  const { user } = useAuth();
  const { messages, sendMessage } = useMessages();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessage(newMessage);
      setNewMessage('');
      toast({
        title: "Message sent!",
        description: "Your message has been sent to the admin team.",
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <Card className="glass-effect border-red-900/30 h-[70vh] flex flex-col">
        <CardHeader>
          <CardTitle className="text-white">Message Admin</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-y-auto pr-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-end gap-3 ${
                (message.sender === 'user' && !user.isAdmin) || (message.sender === 'admin' && user.isAdmin)
                  ? 'justify-end'
                  : 'justify-start'
              }`}
            >
              {(message.sender === 'admin' && !user.isAdmin) || (message.sender === 'user' && user.isAdmin) ? (
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-red-600 text-white">A</AvatarFallback>
                </Avatar>
              ) : null}

              <div
                className={`max-w-xs md:max-w-md p-3 rounded-2xl ${
                  (message.sender === 'user' && !user.isAdmin) || (message.sender === 'admin' && user.isAdmin)
                    ? 'bg-red-600 text-white rounded-br-none'
                    : 'bg-gray-700 text-white rounded-bl-none'
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <p className="text-xs opacity-70 mt-1 text-right">
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {(message.sender === 'user' && !user.isAdmin) || (message.sender === 'admin' && user.isAdmin) ? (
                 <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-blue-600 text-white">{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
              ) : null}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </CardContent>
        <div className="p-4 border-t border-red-900/30">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="bg-black/50 border-red-900/50 text-white placeholder:text-gray-400"
            />
            <Button type="submit" className="bg-gradient-to-r from-red-600 to-red-700 text-white">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </Card>
    </motion.div>
  );
};

export default UserMessages;