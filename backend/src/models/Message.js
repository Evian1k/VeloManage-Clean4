import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null for messages to all admins
  },
  conversation: {
    type: String,
    required: true // format: userId for user conversations, 'admin-broadcast' for admin messages
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  senderType: {
    type: String,
    enum: ['user', 'admin'],
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isAutoReply: {
    type: Boolean,
    default: false
  },
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    type: String
  }],
  metadata: {
    ipAddress: String,
    userAgent: String,
    location: {
      city: String,
      country: String
    }
  }
}, {
  timestamps: true
});

// Static method to send auto-reply
messageSchema.statics.sendAutoReply = async function(userId) {
  // Check if user has already received an auto-reply
  const existingAutoReply = await this.findOne({
    conversation: userId.toString(),
    isAutoReply: true
  });

  if (existingAutoReply) {
    return null; // Don't send another auto-reply
  }

  try {
    // Create auto-reply message
    const autoReply = new this({
      sender: null, // System message
      recipient: userId,
      conversation: userId.toString(),
      text: "Thanks for your message! An admin will review it shortly and get back to you.",
      senderType: 'admin',
      isAutoReply: true,
      isRead: false
    });

    const savedAutoReply = await autoReply.save();
    console.log(`✅ Auto-reply sent to user ${userId}`);
    return savedAutoReply;
  } catch (error) {
    console.error('Error sending auto-reply:', error);
    return null;
  }
};

// Static method to get conversation between user and admin
messageSchema.statics.getConversation = function(userId, limit = 50) {
  return this.find({
    conversation: userId.toString()
  })
  .populate('sender', 'name email role')
  .populate('recipient', 'name email role')
  .sort({ createdAt: -1 })
  .limit(limit);
};

// Static method to get all user conversations for admin
messageSchema.statics.getAllConversations = async function() {
  const conversations = await this.aggregate([
    {
      $match: {
        conversation: { $ne: 'admin-broadcast' }
      }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $group: {
        _id: '$conversation',
        lastMessage: { $first: '$$ROOT' },
        messageCount: { $sum: 1 },
        unreadCount: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$senderType', 'user'] }, { $eq: ['$isRead', false] }] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  // Populate user data
  await this.populate(conversations, {
    path: 'lastMessage.sender',
    model: 'User',
    select: 'name email phone'
  });

  return conversations;
};

// Static method to mark messages as read
messageSchema.statics.markAsRead = function(conversationId, senderType = null) {
  const query = { conversation: conversationId };
  if (senderType) {
    query.senderType = senderType;
  }
  
  return this.updateMany(query, { isRead: true });
};

// Instance method to mark single message as read
messageSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

// Indexes for better performance
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ recipient: 1 });
messageSchema.index({ senderType: 1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ isAutoReply: 1 });
messageSchema.index({ createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;