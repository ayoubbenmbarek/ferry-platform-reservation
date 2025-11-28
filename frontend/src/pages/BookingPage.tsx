import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { setContactInfo, setCabinId, setReturnCabinId, setMeals, setPromoCode, setPromoDiscount, clearPromoCode, addPassenger, updatePassenger, removePassenger, updateVehicle, removeVehicle } from '../store/slices/ferrySlice';
import CabinSelector from '../components/CabinSelector';
import MealSelector from '../components/MealSelector';
import PassengerForm from '../components/PassengerForm';
import VehicleForm, { VehicleFormData } from '../components/VehicleFormEnhanced';
import { PassengerInfo, PassengerType } from '../types/ferry';
import { promoCodeAPI } from '../services/api';
import BookingStepIndicator, { BookingStep } from '../components/BookingStepIndicator';

const BookingPage: React.FC = () => {
  const { t } = useTranslation(['booking', 'common']);
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { selectedFerry, selectedReturnFerry, passengers, vehicles, isCreatingBooking, bookingError, isRoundTrip, searchParams, promoCode, promoDiscount, promoValidationMessage } = useSelector(
    (state: RootState) => state.ferry
  );
  const { user } = useSelector((state: RootState) => state.auth);

  const [localContactInfo, setLocalContactInfo] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const [selectedCabinId, setSelectedCabinId] = useState<number | null>(null);
  const [selectedReturnCabinId, setSelectedReturnCabinId] = useState<number | null>(null);
  const [cabinPrice, setCabinPrice] = useState(0);
  const [returnCabinPrice, setReturnCabinPrice] = useState(0);
  const [cabinQuantity, setCabinQuantity] = useState(0);
  const [returnCabinQuantity, setReturnCabinQuantity] = useState(0);
  const [selectedMeals, setSelectedMeals] = useState<any[]>([]);
  const [mealsPrice, setMealsPrice] = useState(0);

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Promo code state
  const [promoCodeInput, setPromoCodeInput] = useState(promoCode || '');
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Ref to prevent duplicate passenger initialization
  const passengersInitializedRef = React.useRef(false);

  useEffect(() => {
    // Redirect if no ferry selected
    if (!selectedFerry) {
      navigate('/search');
      return;
    }

    // Initialize passenger placeholders based on searchParams if passengers array is empty
    // Use ref to prevent duplicate initialization during rapid re-renders
    if (passengers.length === 0 && searchParams.passengers && !passengersInitializedRef.current) {
      passengersInitializedRef.current = true;

      const { adults = 1, children = 0, infants = 0 } = searchParams.passengers;

      // Create placeholder passengers
      const placeholders: PassengerInfo[] = [];

      // Add adults
      for (let i = 0; i < adults; i++) {
        placeholders.push({
          id: `adult-${Date.now()}-${i}`,
          type: PassengerType.ADULT,
          firstName: '',
          lastName: '',
        });
      }

      // Add children
      for (let i = 0; i < children; i++) {
        placeholders.push({
          id: `child-${Date.now()}-${i}`,
          type: PassengerType.CHILD,
          firstName: '',
          lastName: '',
        });
      }

      // Add infants
      for (let i = 0; i < infants; i++) {
        placeholders.push({
          id: `infant-${Date.now()}-${i}`,
          type: PassengerType.INFANT,
          firstName: '',
          lastName: '',
        });
      }

      // Dispatch all passengers
      placeholders.forEach((p) => dispatch(addPassenger(p)));
    }
  }, [selectedFerry, navigate, passengers.length, searchParams.passengers, dispatch]);

  // Warn user before leaving page during booking
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Warn if booking is in progress and not yet created
      if (selectedFerry && !isCreatingBooking) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [selectedFerry, isCreatingBooking]);

  const handleCabinSelect = (cabinId: number | null, price: number, quantity: number, journey?: 'outbound' | 'return') => {
    // Calculate total price for multiple cabins
    const totalPrice = price * (quantity > 0 ? quantity : 1);

    if (journey === 'return') {
      setSelectedReturnCabinId(cabinId);
      setReturnCabinPrice(totalPrice);
      setReturnCabinQuantity(quantity);
      dispatch(setReturnCabinId(cabinId));
    } else {
      setSelectedCabinId(cabinId);
      setCabinPrice(totalPrice);
      setCabinQuantity(quantity);
      dispatch(setCabinId(cabinId));
    }

    // Log for debugging
    console.log(`Selected ${quantity} cabin(s) for €${price} each. Total: €${totalPrice}`);
  };

  const handleMealSelect = (meals: any[], totalPrice: number) => {
    setSelectedMeals(meals);
    setMealsPrice(totalPrice);
    // Dispatch to Redux store
    dispatch(setMeals(meals));
  };

  const handleApplyPromoCode = async () => {
    if (!promoCodeInput.trim()) {
      setPromoError('Please enter a promo code');
      return;
    }

    if (!localContactInfo.email) {
      setPromoError('Please enter your email first');
      return;
    }

    setIsValidatingPromo(true);
    setPromoError(null);

    try {
      const result = await promoCodeAPI.validate({
        code: promoCodeInput.trim(),
        booking_amount: subtotal,
        email: localContactInfo.email,
        operator: selectedFerry?.operator,
      });

      if (result.is_valid) {
        dispatch(setPromoCode(result.code));
        dispatch(setPromoDiscount({
          discount: result.discount_amount || 0,
          message: result.message,
        }));
        setPromoError(null);
      } else {
        setPromoError(result.message);
        dispatch(clearPromoCode());
      }
    } catch (err: any) {
      setPromoError(err.response?.data?.detail || 'Failed to validate promo code');
      dispatch(clearPromoCode());
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleRemovePromoCode = () => {
    setPromoCodeInput('');
    setPromoError(null);
    dispatch(clearPromoCode());
  };

  const handleSavePassenger = (passenger: PassengerInfo) => {
    // Check if updating existing passenger or adding new
    const existingIndex = passengers.findIndex(p => p.id === passenger.id);
    if (existingIndex >= 0) {
      // Update existing passenger
      dispatch(updatePassenger({
        id: passenger.id,
        data: passenger
      }));
    } else {
      // Add new passenger
      dispatch(addPassenger(passenger));
    }
  };

  const handleRemovePassenger = (passengerId: string) => {
    dispatch(removePassenger(passengerId));
  };

  const handleSaveVehicle = (vehicle: VehicleFormData) => {
    // Update existing vehicle
    dispatch(updateVehicle({
      id: vehicle.id,
      data: vehicle as any
    }));
  };

  const handleRemoveVehicle = (vehicleId: string) => {
    dispatch(removeVehicle(vehicleId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passenger details are all filled
    const incompletePassengers = passengers.filter(p => !p.firstName?.trim() || !p.lastName?.trim());
    if (incompletePassengers.length > 0) {
      setError('Please complete all passenger details (first name and last name are required)');
      // Scroll to passenger details section
      const passengerSection = document.getElementById('passenger-details-section');
      if (passengerSection) {
        passengerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    // Validate required contact information fields
    if (!localContactInfo.firstName || !localContactInfo.firstName.trim()) {
      setError('Please enter your first name');
      return;
    }

    if (!localContactInfo.lastName || !localContactInfo.lastName.trim()) {
      setError('Please enter your last name');
      return;
    }

    if (!localContactInfo.email || !localContactInfo.email.trim()) {
      setError('Please enter your email address');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(localContactInfo.email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!localContactInfo.phone || !localContactInfo.phone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    if (!acceptTerms) {
      setError('Please accept the terms and conditions');
      return;
    }

    // Update contact info in Redux
    dispatch(setContactInfo({
      first_name: localContactInfo.firstName,
      last_name: localContactInfo.lastName,
      email: localContactInfo.email,
      phone: localContactInfo.phone,
    }));

    // Navigate to payment page
    navigate('/payment');
  };

  if (!selectedFerry) {
    return null;
  }

  const totalPassengers = passengers.length;
  const totalVehicles = vehicles.length;

  // Calculate total price (simplified - should come from backend)
  const adultPrice = selectedFerry.prices?.adult || 0;
  const childPrice = selectedFerry.prices?.child || 0;
  const infantPrice = selectedFerry.prices?.infant || 0;
  const vehiclePrice = selectedFerry.prices?.vehicle || 0;

  // Return ferry prices (if round trip)
  const returnAdultPrice = selectedReturnFerry?.prices?.adult || 0;
  const returnChildPrice = selectedReturnFerry?.prices?.child || 0;
  const returnInfantPrice = selectedReturnFerry?.prices?.infant || 0;
  const returnVehiclePrice = selectedReturnFerry?.prices?.vehicle || 0;

  // Count passengers by type
  const adultsCount = passengers.filter(p => p.type === 'adult').length;
  const childrenCount = passengers.filter(p => p.type === 'child').length;
  const infantsCount = passengers.filter(p => p.type === 'infant').length;

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
    if (p.type === 'infant') {
      const outboundPrice = infantPrice;
      const returnPrice = (isRoundTrip && selectedReturnFerry) ? returnInfantPrice : 0;
      return sum + outboundPrice + returnPrice;
    }
    return sum;
  }, 0);

  // Calculate vehicle total (including return journey if round trip)
  const outboundVehiclesTotal = vehicles.length * vehiclePrice;
  const returnVehiclesTotal = (isRoundTrip && selectedReturnFerry) ? (vehicles.length * returnVehiclePrice) : 0;
  const vehiclesTotal = outboundVehiclesTotal + returnVehiclesTotal;

  const totalCabinPrice = cabinPrice + (isRoundTrip && selectedReturnFerry ? returnCabinPrice : 0);
  const subtotal = passengersTotal + vehiclesTotal + totalCabinPrice + mealsPrice;
  const discount = promoDiscount || 0;
  const discountedSubtotal = subtotal - discount;
  const tax = discountedSubtotal * 0.1; // 10% tax
  const total = discountedSubtotal + tax;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Booking Step Indicator */}
      <BookingStepIndicator
        currentStep={BookingStep.BOOKING_DETAILS}
        onBack={() => navigate('/search')}
      />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('booking:page.title')}</h1>
          <p className="mt-2 text-gray-600">{t('booking:page.subtitle')}</p>

          {/* Round trip notice */}
          {isRoundTrip && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-blue-900">{t('booking:page.roundTripNotice')}</h3>
                  <p className="mt-1 text-sm text-blue-700">
                    {selectedReturnFerry
                      ? t('booking:page.roundTripWithReturn')
                      : t('booking:page.roundTripNoReturn')
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Guest Checkout Notice */}
        {!user && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-green-900">Guest Checkout Available</h3>
                <p className="mt-1 text-sm text-green-700">
                  Continue as guest or{' '}
                  <a href="/login" className="font-semibold underline hover:text-green-800">
                    log in
                  </a>{' '}
                  to save your booking to your account.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Contact Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Passenger Details */}
            <div id="passenger-details-section" className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">{t('booking:passengerDetails.title')}</h2>
              <p className="text-sm text-gray-600 mb-4">
                Please provide details for all passengers. First name and last name are required.
              </p>

              {/* Progress indicator */}
              {passengers.length > 1 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-900 font-medium">
                      {passengers.filter(p => p.firstName && p.lastName).length} of {passengers.length} passengers completed
                    </span>
                    <div className="flex gap-1">
                      {passengers.map((p, idx) => (
                        <div
                          key={p.id}
                          className={`w-2 h-2 rounded-full ${
                            p.firstName && p.lastName ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                          title={`Passenger ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {passengers.map((passenger, index) => {
                  // Only expand the first incomplete passenger (progressive disclosure)
                  const firstIncompleteIndex = passengers.findIndex(p => !p.firstName || !p.lastName);
                  const shouldExpand = index === firstIncompleteIndex;

                  return (
                    <div key={passenger.id}>
                      <PassengerForm
                        passenger={passenger}
                        passengerNumber={index + 1}
                        onSave={handleSavePassenger}
                        onRemove={passengers.length > 1 ? handleRemovePassenger : undefined}
                        isExpanded={shouldExpand}
                        defaultType={passenger.type}
                      />
                      {/* Helper text for current passenger */}
                      {shouldExpand && (
                        <div className="mt-2 mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-sm text-yellow-800">
                          <p className="font-medium">💡 Tip: Fill all fields you want before clicking "Save Passenger"</p>
                          <p className="text-yellow-700 mt-1">
                            {t('booking:passengerDetails.requiredFields')}
                          </p>
                          <p className="text-yellow-700 mt-1">
                            You can always click "Edit" later to add more details.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vehicle Details */}
            {totalVehicles > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">🚗 Vehicle Details</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Please provide complete information about your vehicle(s).
                </p>

                <div className="space-y-4">
                  {vehicles.map((vehicle, index) => (
                    <VehicleForm
                      key={vehicle.id}
                      vehicle={vehicle as VehicleFormData}
                      vehicleNumber={index + 1}
                      onSave={handleSaveVehicle}
                      onRemove={vehicles.length > 1 ? handleRemoveVehicle : undefined}
                      isExpanded={index === 0}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Contact Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('booking:passengerDetails.firstName')} *
                    </label>
                    <input
                      type="text"
                      value={localContactInfo.firstName}
                      onChange={(e) =>
                        setLocalContactInfo({ ...localContactInfo, firstName: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('booking:passengerDetails.lastName')} *
                    </label>
                    <input
                      type="text"
                      value={localContactInfo.lastName}
                      onChange={(e) =>
                        setLocalContactInfo({ ...localContactInfo, lastName: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking:passengerDetails.email')} *</label>
                  <input
                    type="email"
                    value={localContactInfo.email}
                    onChange={(e) =>
                      setLocalContactInfo({ ...localContactInfo, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('booking:passengerDetails.phone')} *
                  </label>
                  <input
                    type="tel"
                    value={localContactInfo.phone}
                    onChange={(e) =>
                      setLocalContactInfo({ ...localContactInfo, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </form>
            </div>

            {/* Cabin Selection */}
            <div className="bg-white rounded-lg shadow p-6">
              <CabinSelector
                selectedCabinId={selectedCabinId}
                selectedReturnCabinId={selectedReturnCabinId}
                onCabinSelect={handleCabinSelect}
                passengerCount={totalPassengers}
                isRoundTrip={isRoundTrip && !!selectedReturnFerry}
              />
            </div>

            {/* Meal Selection */}
            <div className="bg-white rounded-lg shadow p-6">
              <MealSelector
                selectedMeals={selectedMeals}
                onMealSelect={handleMealSelect}
                passengerCount={totalPassengers}
                isRoundTrip={isRoundTrip && !!selectedReturnFerry}
              />
            </div>

            {/* Promo Code */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Promo Code</h2>
              {promoCode ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-semibold text-green-800">{promoCode}</p>
                      <p className="text-sm text-green-700">
                        {promoValidationMessage || `You save €${discount.toFixed(2)}!`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemovePromoCode}
                    className="text-gray-500 hover:text-red-600"
                    title="Remove promo code"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                      placeholder="Enter promo code"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 uppercase"
                    />
                    <button
                      onClick={handleApplyPromoCode}
                      disabled={isValidatingPromo || !promoCodeInput.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                    >
                      {isValidatingPromo ? 'Checking...' : 'Apply'}
                    </button>
                  </div>
                  {promoError && (
                    <p className="mt-2 text-sm text-red-600">{promoError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Terms and Conditions */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-3 text-sm text-gray-700">
                  I agree to the{' '}
                  <a href="/terms" className="text-blue-600 hover:text-blue-700 underline">
                    terms and conditions
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline">
                    privacy policy
                  </a>
                </span>
              </label>
            </div>

            {/* Error Message */}
            {(error || bookingError) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error || bookingError}</p>
              </div>
            )}
          </div>

          {/* Right Column - Booking Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-4">
              <h2 className="text-xl font-semibold mb-4">{t('booking:page.bookingSummary')}</h2>

              {/* Ferry Details */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <p className="text-sm text-gray-600 mb-1">
                  {isRoundTrip ? '🚢 Outbound Journey' : 'Operator'}
                </p>
                <p className="font-semibold">{selectedFerry.operator}</p>
                <p className="text-sm text-gray-600 mt-2">
                  {selectedFerry.departurePort} → {selectedFerry.arrivalPort}
                </p>
                <p className="text-sm text-gray-600">
                  {new Date(selectedFerry.departureTime).toLocaleDateString()}
                </p>
              </div>

              {/* Return Journey Details */}
              {isRoundTrip && (
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">🔙 Return Journey</p>
                  {selectedReturnFerry ? (
                    <>
                      <p className="font-semibold">{selectedReturnFerry.operator}</p>
                      <p className="text-sm text-gray-600 mt-2">
                        {selectedReturnFerry.departurePort} → {selectedReturnFerry.arrivalPort}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(selectedReturnFerry.departureTime).toLocaleDateString()}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600 mt-2">
                        {searchParams.returnDeparturePort || searchParams.arrivalPort} → {searchParams.returnArrivalPort || searchParams.departurePort}
                      </p>
                      <p className="text-sm text-yellow-600 font-medium mt-1">
                        Return ferry not yet selected
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Passengers */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  {totalPassengers} Passenger{totalPassengers !== 1 ? 's' : ''}
                </p>
                <div className="space-y-1 text-sm">
                  {passengers.map((p, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-gray-600">
                        {p.firstName} {p.lastName} ({p.type})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vehicles */}
              {totalVehicles > 0 && (
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    {totalVehicles} Vehicle{totalVehicles !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-2 text-sm text-gray-600">
                    {vehicles.map((v, i) => (
                      <div key={i} className="bg-gray-50 p-2 rounded">
                        <div className="font-medium text-gray-900">{v.type}</div>
                        {v.registration && (
                          <div className="text-xs">Registration: {v.registration}</div>
                        )}
                        {v.owner && (
                          <div className="text-xs">Owner: {v.owner}</div>
                        )}
                        {(v.make || v.model) && (
                          <div className="text-xs">{v.make} {v.model}</div>
                        )}
                        {(v.length || v.width || v.height) && (
                          <div className="text-xs">
                            Dimensions: {v.length || 0}cm × {v.width || 0}cm × {v.height || 0}cm
                          </div>
                        )}
                        {(v.hasTrailer || v.hasCaravan || v.hasRoofBox || v.hasBikeRack) && (
                          <div className="text-xs text-blue-600">
                            {v.hasTrailer && '🚚 Trailer '}
                            {v.hasCaravan && '🏕️ Caravan '}
                            {v.hasRoofBox && '📦 Roof Box '}
                            {v.hasBikeRack && '🚴 Bike Rack'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cabins */}
              {(cabinQuantity > 0 || returnCabinQuantity > 0) && (
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Cabins
                  </p>
                  <div className="space-y-1 text-sm text-gray-600">
                    {cabinQuantity > 0 && (
                      <div className="flex justify-between">
                        <span>Outbound: {cabinQuantity} cabin{cabinQuantity > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {returnCabinQuantity > 0 && (
                      <div className="flex justify-between">
                        <span>Return: {returnCabinQuantity} cabin{returnCabinQuantity > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Price Breakdown */}
              <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
                {isRoundTrip && selectedReturnFerry ? (
                  <>
                    {/* Outbound Passengers - Detailed by type */}
                    <div className="text-sm font-medium text-gray-700 mb-1">Outbound Journey:</div>
                    {adultsCount > 0 && (
                      <div className="flex justify-between text-sm pl-3">
                        <span className="text-gray-600">
                          {adultsCount} Adult{adultsCount > 1 ? 's' : ''} × €{adultPrice.toFixed(2)}
                        </span>
                        <span>€{(adultsCount * adultPrice).toFixed(2)}</span>
                      </div>
                    )}
                    {childrenCount > 0 && (
                      <div className="flex justify-between text-sm pl-3">
                        <span className="text-gray-600">
                          {childrenCount} Child{childrenCount > 1 ? 'ren' : ''} × €{childPrice.toFixed(2)}
                        </span>
                        <span>€{(childrenCount * childPrice).toFixed(2)}</span>
                      </div>
                    )}
                    {infantsCount > 0 && (
                      <div className="flex justify-between text-sm pl-3">
                        <span className="text-gray-600">
                          {infantsCount} Infant{infantsCount > 1 ? 's' : ''} × €{infantPrice.toFixed(2)}
                        </span>
                        <span>{infantPrice === 0 ? 'Free' : `€${(infantsCount * infantPrice).toFixed(2)}`}</span>
                      </div>
                    )}
                    {totalVehicles > 0 && (
                      <div className="flex justify-between text-sm pl-3">
                        <span className="text-gray-600">
                          {totalVehicles} Vehicle{totalVehicles > 1 ? 's' : ''} × €{vehiclePrice.toFixed(2)}
                        </span>
                        <span>€{outboundVehiclesTotal.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Return Passengers - Detailed by type */}
                    <div className="text-sm font-medium text-gray-700 mt-3 mb-1">Return Journey:</div>
                    {adultsCount > 0 && (
                      <div className="flex justify-between text-sm pl-3">
                        <span className="text-gray-600">
                          {adultsCount} Adult{adultsCount > 1 ? 's' : ''} × €{returnAdultPrice.toFixed(2)}
                        </span>
                        <span>€{(adultsCount * returnAdultPrice).toFixed(2)}</span>
                      </div>
                    )}
                    {childrenCount > 0 && (
                      <div className="flex justify-between text-sm pl-3">
                        <span className="text-gray-600">
                          {childrenCount} Child{childrenCount > 1 ? 'ren' : ''} × €{returnChildPrice.toFixed(2)}
                        </span>
                        <span>€{(childrenCount * returnChildPrice).toFixed(2)}</span>
                      </div>
                    )}
                    {infantsCount > 0 && (
                      <div className="flex justify-between text-sm pl-3">
                        <span className="text-gray-600">
                          {infantsCount} Infant{infantsCount > 1 ? 's' : ''} × €{returnInfantPrice.toFixed(2)}
                        </span>
                        <span>{returnInfantPrice === 0 ? 'Free' : `€${(infantsCount * returnInfantPrice).toFixed(2)}`}</span>
                      </div>
                    )}
                    {totalVehicles > 0 && (
                      <div className="flex justify-between text-sm pl-3">
                        <span className="text-gray-600">
                          {totalVehicles} Vehicle{totalVehicles > 1 ? 's' : ''} × €{returnVehiclePrice.toFixed(2)}
                        </span>
                        <span>€{returnVehiclesTotal.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* One-way trip - Detailed by passenger type */}
                    {adultsCount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {adultsCount} Adult{adultsCount > 1 ? 's' : ''} × €{adultPrice.toFixed(2)}
                        </span>
                        <span>€{(adultsCount * adultPrice).toFixed(2)}</span>
                      </div>
                    )}
                    {childrenCount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {childrenCount} Child{childrenCount > 1 ? 'ren' : ''} × €{childPrice.toFixed(2)}
                        </span>
                        <span>€{(childrenCount * childPrice).toFixed(2)}</span>
                      </div>
                    )}
                    {infantsCount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {infantsCount} Infant{infantsCount > 1 ? 's' : ''} × €{infantPrice.toFixed(2)}
                        </span>
                        <span>{infantPrice === 0 ? 'Free' : `€${(infantsCount * infantPrice).toFixed(2)}`}</span>
                      </div>
                    )}
                    {totalVehicles > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {totalVehicles} Vehicle{totalVehicles > 1 ? 's' : ''} × €{vehiclePrice.toFixed(2)}
                        </span>
                        <span>€{vehiclesTotal.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
                {cabinPrice > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {cabinQuantity > 0 && `${cabinQuantity} `}
                      Cabin{cabinQuantity > 1 ? 's' : ''}
                      {isRoundTrip && selectedReturnFerry ? ' (Outbound)' : ''}
                      {cabinQuantity > 0 && ` × €${(cabinPrice / cabinQuantity).toFixed(2)}`}
                    </span>
                    <span>€{cabinPrice.toFixed(2)}</span>
                  </div>
                )}
                {isRoundTrip && selectedReturnFerry && returnCabinPrice > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {returnCabinQuantity > 0 && `${returnCabinQuantity} `}
                      Cabin{returnCabinQuantity > 1 ? 's' : ''} (Return)
                      {returnCabinQuantity > 0 && ` × €${(returnCabinPrice / returnCabinQuantity).toFixed(2)}`}
                    </span>
                    <span>€{returnCabinPrice.toFixed(2)}</span>
                  </div>
                )}
                {mealsPrice > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Meals ({selectedMeals.length})
                      {isRoundTrip && (
                        <span className="text-xs text-gray-500">
                          {' '}
                          ({selectedMeals.filter((m) => m.journey_type === 'outbound').length} out,{' '}
                          {selectedMeals.filter((m) => m.journey_type === 'return').length} ret)
                        </span>
                      )}
                    </span>
                    <span>€{mealsPrice.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-100">
                  <span className="text-gray-700">Subtotal</span>
                  <span>€{subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Promo Discount</span>
                    <span>-€{discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax (10%)</span>
                  <span>€{tax.toFixed(2)}</span>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center mb-6">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-2xl font-bold text-blue-600">€{total.toFixed(2)}</span>
              </div>

              {/* Confirm Button */}
              <button
                onClick={handleSubmit}
                disabled={!acceptTerms}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Continue to Payment
              </button>

              <p className="text-xs text-gray-500 text-center mt-4">
                Review your booking details and proceed to payment
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingPage; 