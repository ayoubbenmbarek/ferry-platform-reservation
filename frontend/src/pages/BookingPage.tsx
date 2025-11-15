import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { createBooking, setContactInfo } from '../store/slices/ferrySlice';

const BookingPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { selectedFerry, passengers, vehicles, isCreatingBooking, bookingError } = useSelector(
    (state: RootState) => state.ferry
  );
  const { user } = useSelector((state: RootState) => state.auth);

  const [localContactInfo, setLocalContactInfo] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!acceptTerms) {
      setError('Please accept the terms and conditions');
      return;
    }

    // Check if user is authenticated
    if (!user) {
      // Save the current state and redirect to login
      setError('Please log in or register to continue with payment');
      setTimeout(() => {
        navigate('/login', { state: { from: '/booking' } });
      }, 2000);
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
  const subtotal = passengersTotal + vehiclesTotal;
  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + tax;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Complete Your Booking</h1>
          <p className="mt-2 text-gray-600">Review your details and confirm your reservation</p>
        </div>

        {/* Login Notice for Non-authenticated Users */}
        {!user && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-blue-900">Login Required for Payment</h3>
                <p className="mt-1 text-sm text-blue-700">
                  You'll need to log in or create an account to complete your booking and payment.{' '}
                  <a href="/login" className="font-semibold underline hover:text-blue-800">
                    Log in now
                  </a>{' '}
                  or{' '}
                  <a href="/register" className="font-semibold underline hover:text-blue-800">
                    create an account
                  </a>
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
                <p className="text-sm text-gray-600 mb-1">Operator</p>
                <p className="font-semibold">{selectedFerry.operator}</p>
                <p className="text-sm text-gray-600 mt-2">
                  {selectedFerry.departurePort} → {selectedFerry.arrivalPort}
                </p>
                <p className="text-sm text-gray-600">
                  {new Date(selectedFerry.departureTime).toLocaleDateString()}
                </p>
              </div>

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