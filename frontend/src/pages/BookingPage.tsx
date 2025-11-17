import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { createBooking, setContactInfo, setCabinId, setReturnCabinId, setMeals } from '../store/slices/ferrySlice';
import CabinSelector from '../components/CabinSelector';
import MealSelector from '../components/MealSelector';

const BookingPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { selectedFerry, selectedReturnFerry, passengers, vehicles, isCreatingBooking, bookingError, isRoundTrip } = useSelector(
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
  const [selectedMeals, setSelectedMeals] = useState<any[]>([]);
  const [mealsPrice, setMealsPrice] = useState(0);

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect if no ferry selected
    if (!selectedFerry) {
      navigate('/search');
      return;
    }

    // Redirect if no passengers
    if (passengers.length === 0) {
      navigate('/search');
      return;
    }
  }, [selectedFerry, passengers, navigate]);

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

  const handleCabinSelect = (cabinId: number | null, price: number, journey?: 'outbound' | 'return') => {
    if (journey === 'return') {
      setSelectedReturnCabinId(cabinId);
      setReturnCabinPrice(price);
      dispatch(setReturnCabinId(cabinId));
    } else {
      setSelectedCabinId(cabinId);
      setCabinPrice(price);
      dispatch(setCabinId(cabinId));
    }
  };

  const handleMealSelect = (meals: any[], totalPrice: number) => {
    setSelectedMeals(meals);
    setMealsPrice(totalPrice);
    // Dispatch to Redux store
    dispatch(setMeals(meals));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
  const vehiclePrice = selectedFerry.prices?.vehicle || 0;

  const passengersTotal = passengers.reduce((sum, p) => {
    if (p.type === 'adult') return sum + adultPrice;
    if (p.type === 'child') return sum + childPrice;
    return sum;
  }, 0);

  const vehiclesTotal = vehicles.length * vehiclePrice;
  const totalCabinPrice = cabinPrice + (isRoundTrip ? returnCabinPrice : 0);
  const subtotal = passengersTotal + vehiclesTotal + totalCabinPrice + mealsPrice;
  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + tax;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Complete Your Booking</h1>
          <p className="mt-2 text-gray-600">Review your details and confirm your reservation</p>

          {/* Round trip notice */}
          {isRoundTrip && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-blue-900">Round Trip Booking</h3>
                  <p className="mt-1 text-sm text-blue-700">
                    {selectedReturnFerry
                      ? `You can select different cabins and meals for your outbound and return journeys using the tabs below.`
                      : `Note: Return ferry will be automatically selected with the same options as your outbound journey. Select cabins and meals for both journeys using the tabs below.`
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
            {/* Contact Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
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
                      Last Name *
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
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
                    Phone Number *
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
                isRoundTrip={isRoundTrip}
              />
            </div>

            {/* Meal Selection */}
            <div className="bg-white rounded-lg shadow p-6">
              <MealSelector
                selectedMeals={selectedMeals}
                onMealSelect={handleMealSelect}
                passengerCount={totalPassengers}
                isRoundTrip={isRoundTrip}
              />
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
              <h2 className="text-xl font-semibold mb-4">Booking Summary</h2>

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

              {/* Return Ferry Details */}
              {isRoundTrip && selectedReturnFerry && (
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">🔙 Return Journey</p>
                  <p className="font-semibold">{selectedReturnFerry.operator}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    {selectedReturnFerry.departurePort} → {selectedReturnFerry.arrivalPort}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(selectedReturnFerry.departureTime).toLocaleDateString()}
                  </p>
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
                  <div className="space-y-1 text-sm text-gray-600">
                    {vehicles.map((v, i) => (
                      <div key={i}>{v.type}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Price Breakdown */}
              <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Passengers</span>
                  <span>€{passengersTotal.toFixed(2)}</span>
                </div>
                {totalVehicles > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Vehicles</span>
                    <span>€{vehiclesTotal.toFixed(2)}</span>
                  </div>
                )}
                {cabinPrice > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{isRoundTrip ? 'Cabin (Outbound)' : 'Cabin'}</span>
                    <span>€{cabinPrice.toFixed(2)}</span>
                  </div>
                )}
                {isRoundTrip && returnCabinPrice > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Cabin (Return)</span>
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