import express from 'express';
import { body, validationResult } from 'express-validator';
import Message from '../models/Message.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/v1/messages
// @desc    Get user's messages
// @access  Private
router.get('/', async (req, res) => {
  try {
    const conversationId = req.user.isAdminUser() ? 
      req.query.userId || 'admin-broadcast' : 
      req.user._id.toString();

    const messages = await Message.getConversation(conversationId);

    res.json({
      success: true,
      data: messages
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving messages'
    });
  }
});

// @route   POST /api/v1/messages
// @desc    Send message
// @access  Private
router.post('/', [
  body('text').trim().isLength({ min: 1, max: 1000 }).withMessage('Message must be between 1 and 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { text, recipientId } = req.body;
    const isAdmin = req.user.isAdminUser();
    
    // Determine conversation ID
    let conversationId;
    let recipient = null;
    
    if (isAdmin && recipientId) {
      // Admin sending to specific user
      conversationId = recipientId;
      recipient = recipientId;
    } else if (!isAdmin) {
      // User sending to admin
      conversationId = req.user._id.toString();
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid message configuration'
      });
    }

    // Create message
    const message = new Message({
      sender: req.user._id,
      recipient,
      conversation: conversationId,
      text,
      senderType: isAdmin ? 'admin' : 'user'
    });

    await message.save();

    // Populate sender information
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name email role')
      .populate('recipient', 'name email role');

    // Send auto-reply for first user message
    let autoReply = null;
    if (!isAdmin) {
      autoReply = await Message.sendAutoReply(req.user._id);
    }

    // Emit real-time notification
    const io = req.app.get('socketio');
    const eventData = {
      messageId: message._id,
      text: message.text,
      senderType: message.senderType,
      senderName: req.user.name,
      senderId: req.user._id,
      timestamp: message.createdAt,
      conversationId,
      message: populatedMessage
    };

    if (isAdmin && recipientId) {
      // Admin sending to specific user
      io.to(`user-${recipientId}`).emit('message-received', eventData);
      console.log(`📨 Admin message sent to user ${recipientId}`);
    } else if (!isAdmin) {
      // User sending to all admins
      io.to('admin-room').emit('message-received', eventData);
      console.log(`📨 User message sent to admin room from ${req.user.name}`);
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: populatedMessage,
      autoReply: autoReply
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message'
    });
  }
});

// @route   GET /api/v1/messages/conversations
// @desc    Get all conversations (Admin only)
// @access  Admin
router.get('/conversations', requireAdmin, async (req, res) => {
  try {
    const conversations = await Message.getAllConversations();

    res.json({
      success: true,
      data: conversations
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving conversations'
    });
  }
});

// @route   PUT /api/v1/messages/read/:conversationId
// @desc    Mark messages as read
// @access  Private
router.put('/read/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const senderType = req.user.isAdminUser() ? 'user' : 'admin';

    await Message.markAsRead(conversationId, senderType);

    res.json({
      success: true,
      message: 'Messages marked as read'
    });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking messages as read'
    });
  }
});

// @route   GET /api/v1/messages/admin/all
// @desc    Get all user messages for admins (Admin only)
// @access  Admin
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, unreadOnly = false } = req.query;
    const skip = (page - 1) * limit;

    let query = { senderType: 'user' };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const messages = await Message.find(query)
      .populate('sender', 'name email phone role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalMessages = await Message.countDocuments(query);
    const unreadCount = await Message.countDocuments({
      senderType: 'user',
      isRead: false
    });

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalMessages / limit),
          totalMessages,
          hasNextPage: skip + messages.length < totalMessages,
          hasPrevPage: page > 1
        },
        unreadCount
      }
    });

  } catch (error) {
    console.error('Get admin messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving admin messages'
    });
  }
});

export default router;