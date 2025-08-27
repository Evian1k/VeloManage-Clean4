// backend/routes/payments.js
import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { authenticateToken } from '../middleware/auth.js';

dotenv.config();

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Simple Payment model
const PaymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  method: { type: String, enum: ['stripe_card', 'mpesa', 'paypal'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  status: { type: String, enum: ['initiated', 'completed', 'failed'], default: 'initiated' },
  providerRef: { type: String },
  description: { type: String },
}, { timestamps: true });

const Payment = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);

// Public config
router.get('/config', authenticateToken, async (req, res) => {
  res.json({ success: true, data: { publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '' } });
});

// Create Payment Intent
router.post('/create-payment-intent', authenticateToken, async (req, res) => {
  try {
    const { amount, currency = 'usd', description = 'Service Payment' } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount, // amount in cents
      currency,
      description,
    });

    await Payment.create({ user: req.user._id, method: 'stripe_card', amount, currency: currency.toUpperCase(), status: 'initiated', providerRef: paymentIntent.id, description });

    res.json({ success: true, data: { clientSecret: paymentIntent.client_secret } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Confirm stripe payment (webhook is ideal; simple endpoint here)
router.post('/confirm-payment', authenticateToken, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const status = intent.status === 'succeeded' ? 'completed' : intent.status === 'requires_payment_method' ? 'failed' : 'initiated';
    await Payment.findOneAndUpdate({ providerRef: paymentIntentId }, { status });
    res.json({ success: true, message: 'Payment status updated', data: { status } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// List payments for admin and user
router.get('/', authenticateToken, async (req, res) => {
  const filter = req.user.isAdminUser ? {} : { user: req.user._id };
  const payments = await Payment.find(filter).sort({ createdAt: -1 }).populate('user', 'name email');
  res.json({ success: true, data: payments });
});

// MPesa STK push stub
router.post('/mpesa/initiate', authenticateToken, async (req, res) => {
  const { phone, amount, description = 'Service Payment' } = req.body;
  const payment = await Payment.create({ user: req.user._id, method: 'mpesa', amount, currency: 'KES', status: 'initiated', description, providerRef: `MPESA-${Date.now()}` });
  res.json({ success: true, message: 'MPesa request initiated', data: { paymentId: payment._id } });
});

// PayPal create order stub
router.post('/paypal/create-order', authenticateToken, async (req, res) => {
  const { amount, currency = 'USD', description = 'Service Payment' } = req.body;
  const payment = await Payment.create({ user: req.user._id, method: 'paypal', amount, currency, status: 'initiated', description, providerRef: `PAYPAL-${Date.now()}` });
  res.json({ success: true, message: 'PayPal order created', data: { orderId: payment.providerRef } });
});

export default router;
