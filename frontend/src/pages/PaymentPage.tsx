import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { RootState, AppDispatch } from '../store';
import { createBooking } from '../store/slices/ferrySlice';
import { paymentAPI } from '../services/api';
import StripePaymentForm from '../components/Payment/StripePaymentForm';

// Initialize Stripe (will be loaded with publishable key from backend)
let stripePromise: Promise<any> | null = null;

const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { selectedFerry, passengers, vehicles, currentBooking } = useSelector((state: RootState) => state.ferry);

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal'>('card');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<number | null>(null);

  useEffect(() => {
    // Redirect if no booking in progress
    if (!selectedFerry || passengers.length === 0) {
      navigate('/');
      return;
    }

    initializePayment();
  }, [selectedFerry, passengers, navigate]);

  const initializePayment = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get Stripe configuration
      const config = await paymentAPI.getStripeConfig();
      stripePromise = loadStripe(config.publishableKey);

      // Create booking first
      const booking = await dispatch(createBooking()).unwrap();
      setBookingId(booking.id);

      // Create payment intent
      const paymentIntent = await paymentAPI.createPaymentIntent({
        booking_id: booking.id,
        amount: calculateTotal(),
        currency: 'EUR',
        payment_method: 'credit_card',
      });

      setClientSecret(paymentIntent.client_secret);
    } catch (err: any) {
      setError(err.message || err || 'Failed to initialize payment');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotal = () => {
    // This should match the calculation in BookingPage
    const basePrice = 85.0; // Base adult price
    const total = passengers.length * basePrice + vehicles.length * 120.0;
    const tax = total * 0.1;
    return total + tax;
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    try {
      // Confirm payment with backend
      const confirmation = await paymentAPI.confirmPayment(paymentIntentId);

      // Navigate to confirmation page
      navigate('/booking/confirmation', {
        state: {
          booking: {
            ...currentBooking,
            id: bookingId,
            booking_reference: confirmation.booking_reference || confirmation.confirmationNumber,
          },
        },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to confirm payment');
    }
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Preparing payment...</p>
        </div>
      </div>
    );
  }

  if (error && !clientSecret) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => navigate('/booking')}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Booking
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payment</h1>
          <p className="mt-2 text-gray-600">Complete your payment to confirm your booking</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payment Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              {/* Payment Method Selection */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h2>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`p-4 border-2 rounded-lg text-center transition-colors ${
                      paymentMethod === 'card'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                      />
                    </svg>
                    <span className="font-medium">Credit/Debit Card</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('paypal')}
                    disabled
                    className="p-4 border-2 rounded-lg text-center transition-colors border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                  >
                    <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.067 8.478c.492.88.556 2.014.3 3.327-.74 3.806-3.276 5.12-6.514 5.12h-.5a.805.805 0 00-.794.68l-.04.22-.63 3.993-.028.15a.805.805 0 01-.794.68H7.72a.483.483 0 01-.477-.558L7.418 21h1.518l.95-6.02h1.385c4.678 0 7.75-2.203 8.796-6.502z" />
                    </svg>
                    <span className="font-medium">PayPal (Coming Soon)</span>
                  </button>
                </div>
              </div>

              {/* Stripe Payment Form */}
              {paymentMethod === 'card' && clientSecret && stripePromise && (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <StripePaymentForm
                    clientSecret={clientSecret}
                    amount={calculateTotal()}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                </Elements>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Passengers ({passengers.length})</span>
                  <span className="font-medium">€{(passengers.length * 85).toFixed(2)}</span>
                </div>

                {vehicles.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Vehicles ({vehicles.length})</span>
                    <span className="font-medium">€{(vehicles.length * 120).toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax (10%)</span>
                  <span className="font-medium">€{(calculateTotal() - calculateTotal() / 1.1).toFixed(2)}</span>
                </div>

                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-bold">Total</span>
                    <span className="text-lg font-bold text-blue-600">€{calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedFerry && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-2">Route</h3>
                  <p className="text-sm text-gray-600">
                    {selectedFerry.departurePort} → {selectedFerry.arrivalPort}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedFerry.operator}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
