import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { RootState, AppDispatch } from '../store';
import { createBooking } from '../store/slices/ferrySlice';
import { paymentAPI, bookingAPI } from '../services/api';
import StripePaymentForm from '../components/Payment/StripePaymentForm';
import BookingExpirationTimer from '../components/BookingExpirationTimer';

// Initialize Stripe (will be loaded with publishable key from backend)
let stripePromise: Promise<any> | null = null;

const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { bookingId: existingBookingId } = useParams<{ bookingId: string }>();
  const { selectedFerry, passengers, vehicles, currentBooking } = useSelector((state: RootState) => state.ferry);

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal'>('card');
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [bookingTotal, setBookingTotal] = useState<number>(0);
  const [bookingDetails, setBookingDetails] = useState<any>(null);

  // Use ref to prevent double initialization in React StrictMode
  const initializingRef = useRef(false);
  const initializedRef = useRef(false);

  const calculateTotal = () => {
    // This should match the calculation in BookingPage
    const basePrice = 85.0; // Base adult price
    const total = passengers.length * basePrice + vehicles.length * 120.0;
    const tax = total * 0.1;
    return total + tax;
  };

  const initializePayment = useCallback(async () => {
    // Mark as initializing to prevent duplicate calls
    if (initializingRef.current || initializedRef.current) {
      return;
    }
    initializingRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      // Get Stripe configuration
      const config = await paymentAPI.getStripeConfig();
      stripePromise = loadStripe(config.publishableKey);

      let booking: any;

      // Check if paying for existing booking or creating new one
      if (existingBookingId) {
        // Fetch existing booking
        booking = await bookingAPI.getById(parseInt(existingBookingId));
        setBookingId(booking.id);
        setBookingDetails(booking);
      } else {
        // Create new booking
        booking = await dispatch(createBooking()).unwrap();
        setBookingId(booking.id);
        setBookingDetails(booking);
      }

      // Use the actual total from the booking (includes cabin, meals, tax, etc.)
      const totalAmount = booking.totalAmount || booking.total_amount || calculateTotal();
      setBookingTotal(totalAmount);

      // Create payment intent
      const paymentIntent = await paymentAPI.createPaymentIntent({
        booking_id: booking.id,
        amount: totalAmount,
        currency: 'EUR',
        payment_method: 'credit_card',
      });

      setClientSecret(paymentIntent.client_secret);

      // Mark as successfully initialized
      initializedRef.current = true;
    } catch (err: any) {
      setError(err.message || err || 'Failed to initialize payment');
      // Reset on error so user can retry
      initializingRef.current = false;
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingBookingId, dispatch]);

  useEffect(() => {
    // If paying for existing booking, skip ferry/passenger checks
    if (existingBookingId) {
      if (initializingRef.current || initializedRef.current) {
        return;
      }
      initializePayment();
      return;
    }

    // Redirect if no booking in progress (for new bookings)
    if (!selectedFerry || passengers.length === 0) {
      navigate('/');
      return;
    }

    // Prevent duplicate initialization (important for React StrictMode in development)
    if (initializingRef.current || initializedRef.current) {
      return;
    }

    initializePayment();
  }, [selectedFerry, passengers, navigate, existingBookingId, initializePayment]);

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    setIsConfirming(true);
    try {
      // Confirm payment with backend
      const confirmation = await paymentAPI.confirmPayment(paymentIntentId);

      // Fetch the updated booking to get the latest status
      if (bookingId) {
        const updatedBooking = await bookingAPI.getById(bookingId);

        // Navigate to confirmation page with updated booking data
        navigate('/booking/confirmation', {
          state: {
            booking: updatedBooking,
          },
        });
      } else {
        // Fallback if no bookingId (shouldn't happen)
        navigate('/booking/confirmation', {
          state: {
            booking: {
              ...currentBooking,
              id: bookingId,
              booking_reference: confirmation.booking_reference || confirmation.confirmationNumber,
            },
          },
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to confirm payment');
      setIsConfirming(false);
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

  const handleBookingExpired = () => {
    setError('Your booking has expired. Please start a new search.');
    setTimeout(() => {
      navigate('/');
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payment</h1>
          <p className="mt-2 text-gray-600">Complete your payment to confirm your booking</p>
        </div>

        {/* Expiration Timer */}
        {bookingDetails?.expiresAt && new Date(bookingDetails.expiresAt) > new Date() && (
          <div className="mb-6">
            <BookingExpirationTimer
              expiresAt={bookingDetails.expiresAt}
              onExpired={handleBookingExpired}
            />
          </div>
        )}

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
                    amount={bookingTotal}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    isConfirming={isConfirming}
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
                {bookingDetails ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">€{((bookingDetails.subtotal || 0)).toFixed(2)}</span>
                    </div>

                    {(bookingDetails.cabinSupplement || bookingDetails.cabin_supplement) > 0 && (
                      <div className="flex justify-between text-sm text-gray-500 pl-4">
                        <span>• Cabin Supplement</span>
                        <span>€{(bookingDetails.cabinSupplement || bookingDetails.cabin_supplement).toFixed(2)}</span>
                      </div>
                    )}

                    {bookingDetails.meals && bookingDetails.meals.length > 0 && (
                      <div className="flex justify-between text-sm text-gray-500 pl-4">
                        <span>• Meals ({bookingDetails.meals.length})</span>
                        <span>€{bookingDetails.meals.reduce((sum: number, m: any) => sum + (m.totalPrice || m.total_price || 0), 0).toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax (10%)</span>
                      <span className="font-medium">€{(bookingDetails.taxAmount || bookingDetails.tax_amount || 0).toFixed(2)}</span>
                    </div>

                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <div className="flex justify-between">
                        <span className="text-lg font-bold">Total</span>
                        <span className="text-lg font-bold text-blue-600">€{bookingTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                      <div className="text-xs text-blue-800">
                        <p className="font-medium">Booking Reference:</p>
                        <p className="font-mono">{bookingDetails.bookingReference || bookingDetails.booking_reference}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>

              {(selectedFerry || bookingDetails) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  {/* Outbound Journey */}
                  <h3 className="font-medium text-gray-900 mb-2">
                    {(bookingDetails?.isRoundTrip || bookingDetails?.is_round_trip) ? 'Outbound Journey' : 'Route'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {bookingDetails?.departurePort || bookingDetails?.departure_port || selectedFerry?.departurePort} → {bookingDetails?.arrivalPort || bookingDetails?.arrival_port || selectedFerry?.arrivalPort}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {bookingDetails?.operator || selectedFerry?.operator}
                  </p>
                  {(bookingDetails?.departureTime || bookingDetails?.departure_time) && (
                    <p className="text-xs text-gray-500 mt-1">
                      Departure: {new Date(bookingDetails.departureTime || bookingDetails.departure_time).toLocaleString()}
                    </p>
                  )}

                  {/* Return Journey */}
                  {(bookingDetails?.isRoundTrip || bookingDetails?.is_round_trip) && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <h3 className="font-medium text-gray-900 mb-2">Return Journey</h3>
                      <p className="text-sm text-gray-600">
                        {bookingDetails?.returnDeparturePort || bookingDetails?.return_departure_port || bookingDetails?.arrivalPort || bookingDetails?.arrival_port} → {bookingDetails?.returnArrivalPort || bookingDetails?.return_arrival_port || bookingDetails?.departurePort || bookingDetails?.departure_port}
                      </p>
                      {(bookingDetails?.returnOperator || bookingDetails?.return_operator) && (
                        <p className="text-sm text-gray-600 mt-1">
                          {bookingDetails?.returnOperator || bookingDetails?.return_operator}
                        </p>
                      )}
                      {(bookingDetails?.returnDepartureTime || bookingDetails?.return_departure_time) && (
                        <p className="text-xs text-gray-500 mt-1">
                          Departure: {new Date(bookingDetails.returnDepartureTime || bookingDetails.return_departure_time).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
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
