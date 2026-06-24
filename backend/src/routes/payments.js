// backend/routes/payments.js
import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Lazy-init Stripe so the server can boot even without STRIPE_SECRET_KEY set
let _stripe = null;
function getStripe() {
  if (_stripe) return _stripe;
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

// Create Payment Intent
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd' } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required (in cents)' });
    }
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
    });
    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Payment intent error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Confirm payment
router.post('/confirm/:id', async (req, res) => {
  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(req.params.id);
    res.json({ success: true, status: paymentIntent.status, paymentIntent });
  } catch (error) {
    console.error('Payment confirm error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
