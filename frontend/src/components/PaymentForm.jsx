import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, CreditCard, DollarSign } from 'lucide-react';

// Initialize Stripe
let stripePromise;

const PaymentFormContent = ({ onPaymentSuccess, onPaymentError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('usd');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState('card'); // card | mpesa | paypal
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const handleCreatePaymentIntent = async () => {
    if (!amount || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const token = localStorage.getItem('autocare_token') || localStorage.getItem('token');
      const response = await fetch('/api/v1/payments/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          currency,
          description: description || 'AutoCare Pro Service Payment'
        })
      });

      const data = await response.json();

      if (data.success) {
        setClientSecret(data.data.clientSecret);
      } else {
        setError(data.message || 'Failed to create payment intent');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (method === 'card' && (!stripe || !elements)) return;

    if (method === 'card') {
      if (!clientSecret) {
        await handleCreatePaymentIntent();
        return;
      }

      setIsProcessing(true);
      setError('');

      const cardElement = elements.getElement(CardElement);

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: 'AutoCare Pro Customer',
          },
        }
      });

      if (error) {
        setError(error.message);
        setIsProcessing(false);
      } else {
        try {
          const token = localStorage.getItem('autocare_token') || localStorage.getItem('token');
          await fetch('/api/v1/payments/confirm-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ paymentIntentId: paymentIntent.id })
          });
          onPaymentSuccess && onPaymentSuccess(paymentIntent);
          setAmount('');
          setDescription('');
          setClientSecret('');
        } catch (err) {
          console.error('Payment confirmation error:', err);
        }
        setIsProcessing(false);
      }
      return;
    }

    // MPesa stub flow
    if (method === 'mpesa') {
      try {
        setIsProcessing(true);
        const token = localStorage.getItem('autocare_token') || localStorage.getItem('token');
        const response = await fetch('/api/v1/payments/mpesa/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ amount: parseFloat(amount), phone: '2547XXXXXXXX', description: description || 'AutoCare Pro Service Payment' })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'MPesa initiation failed');
        onPaymentSuccess && onPaymentSuccess({ id: data.data.paymentId, amount: parseFloat(amount) * 100 });
        setAmount(''); setDescription('');
      } catch (e) {
        setError(e.message);
        onPaymentError && onPaymentError(e);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // PayPal stub flow
    if (method === 'paypal') {
      try {
        setIsProcessing(true);
        const token = localStorage.getItem('autocare_token') || localStorage.getItem('token');
        const response = await fetch('/api/v1/payments/paypal/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ amount: parseFloat(amount), currency: currency.toUpperCase(), description: description || 'AutoCare Pro Service Payment' })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'PayPal order failed');
        onPaymentSuccess && onPaymentSuccess({ id: data.data.orderId, amount: parseFloat(amount) * 100 });
        setAmount(''); setDescription('');
      } catch (e) {
        setError(e.message);
        onPaymentError && onPaymentError(e);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const cardStyle = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment
        </CardTitle>
        <CardDescription>
          Enter payment details for AutoCare Pro services
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10"
                step="0.01"
                min="0.01"
                disabled={isProcessing}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency} disabled={isProcessing}>
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usd">USD - US Dollar</SelectItem>
                <SelectItem value="eur">EUR - Euro</SelectItem>
                <SelectItem value="gbp">GBP - British Pound</SelectItem>
                <SelectItem value="kes">KES - Kenyan Shilling</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Payment Method</Label>
            <Select value={method} onValueChange={setMethod} disabled={isProcessing}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">Card (Stripe)</SelectItem>
                <SelectItem value="mpesa">M-Pesa (Simulated)</SelectItem>
                <SelectItem value="paypal">PayPal (Simulated)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              placeholder="Service description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          {method === 'card' && clientSecret && (
            <div className="space-y-2">
              <Label>Card Details</Label>
              <div className="p-3 border rounded-md">
                <CardElement options={cardStyle} />
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!stripe || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {clientSecret ? 'Processing Payment...' : 'Creating Payment...'}
              </>
            ) : (
              method === 'card' ? (clientSecret ? `Pay $${amount}` : 'Create Payment') : (method === 'mpesa' ? 'Pay with M-Pesa' : 'Pay with PayPal')
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const PaymentForm = ({ onPaymentSuccess, onPaymentError }) => {
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStripeConfig = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/payments/config', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();

        if (data.success) {
          setStripePublishableKey(data.data.publishableKey);
          stripePromise = loadStripe(data.data.publishableKey);
        } else {
          setError('Failed to load payment configuration');
        }
      } catch (err) {
        setError('Failed to initialize payment system');
      } finally {
        setLoading(false);
      }
    };

    fetchStripeConfig();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading payment system...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <PaymentFormContent 
        onPaymentSuccess={onPaymentSuccess}
        onPaymentError={onPaymentError}
      />
    </Elements>
  );
};

export default PaymentForm;