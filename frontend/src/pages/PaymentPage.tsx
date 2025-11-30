import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { RootState, AppDispatch } from '../store';
import { createBooking } from '../store/slices/ferrySlice';
import api, { paymentAPI, bookingAPI } from '../services/api';
import StripePaymentForm from '../components/Payment/StripePaymentForm';
import BookingExpirationTimer from '../components/BookingExpirationTimer';
import BookingStepIndicator, { BookingStep } from '../components/BookingStepIndicator';

// Initialize Stripe (will be loaded with publishable key from backend)
let stripePromise: Promise<any> | null = null;

const PaymentPage: React.FC = () => {
  const { t } = useTranslation(['payment', 'common']);
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { bookingId: existingBookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const { selectedFerry, selectedReturnFerry, passengers, vehicles, currentBooking, isRoundTrip, totalCabinPrice, totalReturnCabinPrice, selectedMeals, hasCancellationProtection, promoDiscount } = useSelector((state: RootState) => state.ferry);

  // Check for cabin upgrade payment
  const paymentType = searchParams.get('type');
  const isCabinUpgrade = paymentType === 'cabin_upgrade';

  // Parse cabin selections from URL (format: "cabinId:qty,cabinId:qty")
  const parseCabinSelections = (selectionsStr: string | null): { cabinId: number; quantity: number }[] => {
    if (!selectionsStr) return [];
    return selectionsStr.split(',').map(item => {
      const [cabinId, qty] = item.split(':');
      return { cabinId: parseInt(cabinId), quantity: parseInt(qty) };
    }).filter(s => s.cabinId && s.quantity);
  };

  const cabinUpgradeData = isCabinUpgrade ? {
    // Support both old format (cabin_id) and new format (cabin_selections)
    cabinSelections: parseCabinSelections(searchParams.get('cabin_selections')),
    cabinId: parseInt(searchParams.get('cabin_id') || '0'), // Legacy support
    totalCabins: parseInt(searchParams.get('total_cabins') || searchParams.get('quantity') || '1'),
    journeyType: searchParams.get('journey_type') || 'outbound',
    amount: parseFloat(searchParams.get('amount') || '0'),
    alertId: searchParams.get('alert_id')
  } : null;

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal'>('card');
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [bookingTotal, setBookingTotal] = useState<number>(0);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  // Store cabin details for display in summary
  const [cabinDetails, setCabinDetails] = useState<Record<number, { name: string; price: number }>>({});

  // Use ref to prevent double initialization in React StrictMode
  const initializingRef = useRef(false);
  const initializedRef = useRef(false);

  const calculateTotal = () => {
    // This should match the calculation in BookingPage
    // Get prices from selected ferries
    const adultPrice = selectedFerry?.prices?.adult || 0;
    const childPrice = selectedFerry?.prices?.child || 0;
    const vehiclePrice = selectedFerry?.prices?.vehicle || 0;

    // Return ferry prices (if round trip)
    const returnAdultPrice = selectedReturnFerry?.prices?.adult || 0;
    const returnChildPrice = selectedReturnFerry?.prices?.child || 0;
    const returnVehiclePrice = selectedReturnFerry?.prices?.vehicle || 0;

    // Calculate passenger total (including return journey if round trip)
    const passengersTotal = passengers.reduce((sum, p) => {
      if (p.type === 'adult') {
        const outboundPrice = adultPrice;
        const returnPrice = (isRoundTrip && selectedReturnFerry) ? returnAdultPrice : 0;
        return sum + outboundPrice + returnPrice;
      }
      if (p.type === 'child') {
        const outboundPrice = childPrice;
        const returnPrice = (isRoundTrip && selectedReturnFerry) ? returnChildPrice : 0;
        return sum + outboundPrice + returnPrice;
      }
      // Infants are usually free
      return sum;
    }, 0);

    // Calculate vehicle total (including return journey if round trip)
    const outboundVehiclesTotal = vehicles.length * vehiclePrice;
    const returnVehiclesTotal = (isRoundTrip && selectedReturnFerry) ? (vehicles.length * returnVehiclePrice) : 0;
    const vehiclesTotal = outboundVehiclesTotal + returnVehiclesTotal;

    // Calculate cabin total (from Redux state)
    const cabinsTotal = (totalCabinPrice || 0) + (totalReturnCabinPrice || 0);

    // Calculate meals total (from Redux state)
    const mealsTotal = selectedMeals?.reduce((sum: number, meal: any) => sum + (meal.price || 0) * (meal.quantity || 1), 0) || 0;

    // Cancellation protection
    const CANCELLATION_PROTECTION_PRICE = 15.00;
    const cancellationProtectionTotal = hasCancellationProtection ? CANCELLATION_PROTECTION_PRICE : 0;

    // Subtotal before discount
    const subtotal = passengersTotal + vehiclesTotal + cabinsTotal + mealsTotal + cancellationProtectionTotal;

    // Apply promo discount
    const discount = promoDiscount || 0;
    const discountedSubtotal = subtotal - discount;

    // No tax in final calculation (removed as per BookingPage pattern)
    return Math.max(0, discountedSubtotal);
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
        // Fetch existing booking from backend to get latest status
        console.log('Fetching existing booking by ID:', existingBookingId);
        booking = await bookingAPI.getById(parseInt(existingBookingId));
        setBookingId(booking.id);
        setBookingDetails(booking);
      } else if (currentBooking && currentBooking.id) {
        // Always fetch from backend to get the latest status
        // (Redux state might be stale if user navigated back after payment)
        console.log('Fetching current booking from backend to verify status:', currentBooking.id);
        booking = await bookingAPI.getById(currentBooking.id);
        setBookingId(booking.id);
        setBookingDetails(booking);
      } else {
        // Create new booking if no booking exists
        console.log('Creating new booking...');
        booking = await dispatch(createBooking()).unwrap();
        setBookingId(booking.id);
        setBookingDetails(booking);
      }

      // For cabin upgrades on confirmed bookings, don't redirect - allow payment for the upgrade
      if (!isCabinUpgrade && (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED')) {
        console.log('Booking already confirmed/completed, redirecting to confirmation page');
        navigate('/booking/confirmation', {
          state: { booking }
        });
        return;
      }

      // Fetch cabin details for cabin upgrade summary display
      if (isCabinUpgrade && cabinUpgradeData && cabinUpgradeData.cabinSelections.length > 0) {
        try {
          const cabinsResponse = await api.get('/cabins');
          const cabinsMap: Record<number, { name: string; price: number }> = {};
          (cabinsResponse.data || []).forEach((c: any) => {
            cabinsMap[c.id] = { name: c.name, price: c.base_price };
          });
          setCabinDetails(cabinsMap);
        } catch (err) {
          console.warn('Could not fetch cabin details:', err);
        }
      }

      // Calculate amount based on payment type
      let totalAmount: number;
      if (isCabinUpgrade && cabinUpgradeData) {
        // For cabin upgrades, use the cabin supplement amount (with 10% tax)
        totalAmount = cabinUpgradeData.amount * 1.10;
        console.log('Cabin upgrade payment:', cabinUpgradeData.amount, '+ tax =', totalAmount);
      } else {
        // Use the actual total from the booking (includes cabin, meals, tax, etc.)
        // Use explicit check for undefined/null to allow 0 as a valid value
        totalAmount = booking.totalAmount !== undefined && booking.totalAmount !== null
          ? booking.totalAmount
          : (booking.total_amount !== undefined && booking.total_amount !== null
              ? booking.total_amount
              : calculateTotal());
      }
      setBookingTotal(totalAmount);

      // Create payment intent with cabin upgrade metadata if applicable
      const paymentIntentData: any = {
        booking_id: booking.id,
        amount: totalAmount,
        currency: 'EUR',
        payment_method: 'credit_card',
      };

      if (isCabinUpgrade && cabinUpgradeData) {
        paymentIntentData.metadata = {
          type: 'cabin_upgrade',
          cabin_selections: cabinUpgradeData.cabinSelections.map(s => `${s.cabinId}:${s.quantity}`).join(','),
          total_cabins: cabinUpgradeData.totalCabins,
          journey_type: cabinUpgradeData.journeyType,
          alert_id: cabinUpgradeData.alertId
        };
      }

      const paymentIntent = await paymentAPI.createPaymentIntent(paymentIntentData);

      // Handle free booking (100% discount)
      if (paymentIntent.client_secret === 'free_booking') {
        // Booking is already confirmed, redirect to confirmation
        navigate('/booking/confirmation', {
          state: { booking: bookingDetails || booking }
        });
        return;
      }

      setClientSecret(paymentIntent.client_secret);

      // Mark as successfully initialized
      initializedRef.current = true;
    } catch (err: any) {
      console.log('Payment initialization error:', err);

      // Check if booking is already paid
      const errorMessage = err.response?.data?.detail || err.message || err || 'Failed to initialize payment';

      // Handle already paid booking (can be 400 or 500 status)
      if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('already paid')) {
        console.log('Booking already paid, redirecting to confirmation');
        navigate('/booking/confirmation', {
          state: { booking: bookingDetails }
        });
        return;
      }

      // Also check if booking status is already CONFIRMED/COMPLETED
      if (bookingDetails && (bookingDetails.status === 'CONFIRMED' || bookingDetails.status === 'COMPLETED')) {
        console.log('Booking already confirmed, redirecting to confirmation');
        navigate('/booking/confirmation', {
          state: { booking: bookingDetails }
        });
        return;
      }

      setError(errorMessage);
      // Reset on error so user can retry
      initializingRef.current = false;
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingBookingId, currentBooking, dispatch]);

  // Reset initialization refs when there's no currentBooking (user modified booking details)
  useEffect(() => {
    if (!currentBooking && !existingBookingId) {
      // Reset refs so a new booking will be created
      initializingRef.current = false;
      initializedRef.current = false;
    }
  }, [currentBooking, existingBookingId]);

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
    // Note: We only check for selectedFerry, not passengers, because passengers
    // are validated on the BookingPage before navigation to PaymentPage
    if (!selectedFerry) {
      navigate('/booking');
      return;
    }

    // Prevent duplicate initialization (important for React StrictMode in development)
    if (initializingRef.current || initializedRef.current) {
      return;
    }

    initializePayment();
  }, [selectedFerry, navigate, existingBookingId, initializePayment]);

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    setIsConfirming(true);
    try {
      // Confirm payment with backend
      const confirmation = await paymentAPI.confirmPayment(paymentIntentId);

      // If this is a cabin upgrade payment, add the cabins to the booking
      if (isCabinUpgrade && cabinUpgradeData && bookingId) {
        try {
          // Handle multi-cabin selections
          if (cabinUpgradeData.cabinSelections.length > 0) {
            // Add each cabin selection
            for (const selection of cabinUpgradeData.cabinSelections) {
              await api.post(`/bookings/${bookingId}/add-cabin`, {
                cabin_id: selection.cabinId,
                quantity: selection.quantity,
                journey_type: cabinUpgradeData.journeyType
              });
            }
          } else if (cabinUpgradeData.cabinId) {
            // Legacy: single cabin
            await api.post(`/bookings/${bookingId}/add-cabin`, {
              cabin_id: cabinUpgradeData.cabinId,
              quantity: cabinUpgradeData.totalCabins,
              journey_type: cabinUpgradeData.journeyType
            });
          }

          // Mark alert as fulfilled if there was one
          if (cabinUpgradeData.alertId) {
            try {
              await api.patch(`/availability-alerts/${cabinUpgradeData.alertId}`, {
                status: 'fulfilled'
              });
            } catch (alertErr) {
              console.warn('Could not mark alert as fulfilled:', alertErr);
            }
          }
        } catch (cabinErr) {
          console.error('Failed to add cabin after payment:', cabinErr);
          // Continue anyway since payment was successful
        }
      }

      // Fetch the updated booking to get the latest status
      if (bookingId) {
        const updatedBooking = await bookingAPI.getById(bookingId);

        // For cabin upgrades, redirect to booking details instead of confirmation
        if (isCabinUpgrade) {
          navigate(`/booking/${bookingId}`, {
            state: { cabinUpgradeSuccess: true }
          });
        } else {
          // Navigate to confirmation page with updated booking data
          navigate('/booking/confirmation', {
            state: {
              booking: updatedBooking,
            },
          });
        }
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
      <div className="min-h-screen bg-gray-50 py-4 md:py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 md:p-6 shadow-lg">
            {/* Error Icon */}
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-base md:text-lg font-semibold text-red-800 mb-2">
                  Booking Creation Failed
                </h3>
                <p className="text-sm md:text-base text-red-700 leading-relaxed">{error}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate('/booking')}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm md:text-base"
              >
                ← Back to Booking
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm md:text-base"
              >
                Try Again
              </button>
            </div>

            {/* Help Text */}
            <p className="mt-4 text-xs md:text-sm text-gray-600">
              If this problem persists, please contact support or try booking a different sailing.
            </p>
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
    <div className="min-h-screen bg-gray-50">
      {/* Booking Step Indicator */}
      <BookingStepIndicator
        currentStep={BookingStep.PAYMENT}
        onBack={() => navigate('/booking')}
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {isCabinUpgrade ? t('payment:cabinUpgrade.title', 'Cabin Upgrade Payment') : t('payment:title')}
          </h1>
          <p className="mt-2 text-gray-600">
            {isCabinUpgrade
              ? t('payment:cabinUpgrade.subtitle', 'Complete payment to add a cabin to your booking')
              : t('payment:subtitle')}
          </p>
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
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('payment:paymentMethod.title')}</h2>
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
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: 'stripe',
                    },
                  }}
                >
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
                <div className="mt-4 bg-red-50 border-2 border-red-300 rounded-lg p-3 md:p-4 shadow-md animate-pulse">
                  <div className="flex items-start">
                    <svg className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm md:text-base text-red-800 font-medium">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {isCabinUpgrade ? t('payment:cabinUpgrade.summary', 'Cabin Upgrade Summary') : t('payment:orderSummary.title')}
              </h2>

              <div className="space-y-3 mb-4">
                {isCabinUpgrade && cabinUpgradeData ? (
                  <>
                    {/* Cabin Upgrade Summary */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                      <p className="text-sm text-purple-700 font-medium">
                        {t('payment:cabinUpgrade.addingCabin', 'Adding cabin to booking')}:
                      </p>
                      <p className="text-purple-900 font-semibold">
                        {bookingDetails?.booking_reference || bookingDetails?.bookingReference}
                      </p>
                    </div>

                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600 font-medium">
                        {cabinUpgradeData.journeyType === 'return' ? 'Return' : 'Outbound'} Journey
                      </span>
                    </div>

                    {/* Show each cabin type with quantity */}
                    {cabinUpgradeData.cabinSelections.length > 0 ? (
                      <div className="space-y-2 border-l-2 border-purple-200 pl-3 mb-3">
                        {cabinUpgradeData.cabinSelections.map((selection, idx) => {
                          const cabin = cabinDetails[selection.cabinId];
                          const cabinPrice = cabin ? cabin.price * selection.quantity : 0;
                          return (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                {cabin?.name || `Cabin #${selection.cabinId}`} × {selection.quantity}
                              </span>
                              <span className="font-medium">€{cabinPrice.toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm text-gray-500 pl-4">
                        <span>• {cabinUpgradeData.totalCabins} × Cabin</span>
                        <span>€{cabinUpgradeData.amount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-gray-600">{t('payment:cabinUpgrade.cabinCost', 'Subtotal')}</span>
                      <span className="font-medium">€{cabinUpgradeData.amount.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax (10%)</span>
                      <span className="font-medium">€{(cabinUpgradeData.amount * 0.10).toFixed(2)}</span>
                    </div>

                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <div className="flex justify-between">
                        <div>
                          <span className="text-lg font-bold">{t('payment:orderSummary.total')}</span>
                          <span className="text-sm text-gray-500 block">{cabinUpgradeData.totalCabins} cabin{cabinUpgradeData.totalCabins > 1 ? 's' : ''}</span>
                        </div>
                        <span className="text-lg font-bold text-blue-600">€{bookingTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                ) : bookingDetails ? (
                  <>
                    {/* Show itemized breakdown */}
                    <div className="space-y-2 text-sm">
                      {/* Base fare (passengers + vehicles) */}
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          {bookingDetails.totalPassengers || bookingDetails.total_passengers || 1} Passenger(s)
                          {(bookingDetails.totalVehicles || bookingDetails.total_vehicles || 0) > 0 &&
                            ` + ${bookingDetails.totalVehicles || bookingDetails.total_vehicles} Vehicle(s)`}
                        </span>
                        <span className="font-medium">
                          €{(
                            (bookingDetails.subtotal || 0) -
                            (bookingDetails.cabinSupplement || bookingDetails.cabin_supplement || 0) -
                            (bookingDetails.returnCabinSupplement || bookingDetails.return_cabin_supplement || 0) -
                            (bookingDetails.meals?.reduce((sum: number, m: any) => sum + (m.totalPrice || m.total_price || 0), 0) || 0) -
                            (bookingDetails.hasCancellationProtection || bookingDetails.has_cancellation_protection ? 15 : 0)
                          ).toFixed(2)}
                        </span>
                      </div>

                      {/* Cabin supplement */}
                      {((bookingDetails.cabinSupplement || bookingDetails.cabin_supplement || 0) +
                        (bookingDetails.returnCabinSupplement || bookingDetails.return_cabin_supplement || 0)) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Cabin(s)</span>
                          <span className="font-medium">
                            €{((bookingDetails.cabinSupplement || bookingDetails.cabin_supplement || 0) +
                               (bookingDetails.returnCabinSupplement || bookingDetails.return_cabin_supplement || 0)).toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Meals */}
                      {bookingDetails.meals && bookingDetails.meals.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Meals ({bookingDetails.meals.length})</span>
                          <span className="font-medium">€{bookingDetails.meals.reduce((sum: number, m: any) => sum + (m.totalPrice || m.total_price || 0), 0).toFixed(2)}</span>
                        </div>
                      )}

                      {/* Cancellation Protection */}
                      {(bookingDetails.hasCancellationProtection || bookingDetails.has_cancellation_protection) && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Cancellation Protection</span>
                          <span className="font-medium">€15.00</span>
                        </div>
                      )}

                      {/* Subtotal line */}
                      <div className="flex justify-between border-t border-gray-100 pt-2">
                        <span className="text-gray-700 font-medium">Subtotal</span>
                        <span className="font-medium">€{(bookingDetails.subtotal || 0).toFixed(2)}</span>
                      </div>

                      {/* Promo discount */}
                      {(bookingDetails.discountAmount || bookingDetails.discount_amount) > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Promo Discount {bookingDetails.promoCode || bookingDetails.promo_code ? `(${bookingDetails.promoCode || bookingDetails.promo_code})` : ''}</span>
                          <span>-€{(bookingDetails.discountAmount || bookingDetails.discount_amount).toFixed(2)}</span>
                        </div>
                      )}

                      {/* Tax */}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax (10%)</span>
                        <span className="font-medium">€{(bookingDetails.taxAmount || bookingDetails.tax_amount || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <div className="flex justify-between">
                        <span className="text-lg font-bold">{t('payment:orderSummary.total')}</span>
                        <span className="text-lg font-bold text-blue-600">€{bookingTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                      <div className="text-xs text-blue-800">
                        <p className="font-medium">{t('payment:bookingReference')}:</p>
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
                        <span className="text-lg font-bold">{t('payment:orderSummary.total')}</span>
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
                    {(bookingDetails?.isRoundTrip || bookingDetails?.is_round_trip) ? t('payment:orderSummary.outboundJourney') : t('payment:orderSummary.route')}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {bookingDetails?.departurePort || bookingDetails?.departure_port || selectedFerry?.departurePort} → {bookingDetails?.arrivalPort || bookingDetails?.arrival_port || selectedFerry?.arrivalPort}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {bookingDetails?.operator || selectedFerry?.operator}
                  </p>
                  {(bookingDetails?.departureTime || bookingDetails?.departure_time) && (
                    <p className="text-xs text-gray-500 mt-1">
                      {t('payment:orderSummary.departure')}: {new Date(bookingDetails.departureTime || bookingDetails.departure_time).toLocaleString()}
                    </p>
                  )}

                  {/* Return Journey */}
                  {(bookingDetails?.isRoundTrip || bookingDetails?.is_round_trip) && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <h3 className="font-medium text-gray-900 mb-2">{t('payment:orderSummary.returnJourney')}</h3>
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
                          {t('payment:orderSummary.departure')}: {new Date(bookingDetails.returnDepartureTime || bookingDetails.return_departure_time).toLocaleString()}
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
