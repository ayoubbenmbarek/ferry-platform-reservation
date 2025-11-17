import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { resetBooking } from '../store/slices/ferrySlice';
import CreateAccountModal from '../components/CreateAccountModal';
import { setUser } from '../store/slices/authSlice';

const BookingConfirmationPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentBooking = useSelector((state: RootState) => state.ferry.currentBooking);
  const { user } = useSelector((state: RootState) => state.auth);
  const booking = location.state?.booking || currentBooking;

  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);

  useEffect(() => {
    // If no booking data, redirect to home
    if (!booking) {
      navigate('/');
    }

    // Show create account modal for guest bookings (non-logged-in users)
    if (booking && !user) {
      // Show modal after a short delay for better UX
      const timer = setTimeout(() => {
        setShowCreateAccountModal(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [booking, user, navigate]);

  if (!booking) {
    return null;
  }

  const handleNewBooking = () => {
    dispatch(resetBooking());
    navigate('/');
  };

  const handleViewBookings = () => {
    navigate('/my-bookings');
  };

  const handleAccountCreated = (token: string, userData: any) => {
    // Update auth state with new user
    dispatch(setUser(userData));
    // Show success message
    console.log('Account created and logged in successfully');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Success Message */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Booking Confirmed!</h1>
            <p className="text-gray-600">Your ferry reservation has been successfully confirmed.</p>
          </div>

          {/* Booking Reference */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Booking Reference</p>
              <p className="text-2xl font-bold text-blue-600">{booking.bookingReference}</p>
              <p className="text-xs text-gray-500 mt-2">
                Please save this reference number for your records
              </p>
            </div>
          </div>

          {/* Booking Details */}
          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold mb-4">Booking Details</h2>

            {/* Ferry Information */}
            <div className="mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Operator</p>
                  <p className="font-semibold">{booking.operator}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    booking.status === 'CONFIRMED' || booking.status === 'confirmed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {booking.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">Contact Information</p>
              <p className="text-sm text-gray-600">
                {booking.contactFirstName} {booking.contactLastName}
              </p>
              <p className="text-sm text-gray-600">{booking.contactEmail}</p>
              {booking.contactPhone && (
                <p className="text-sm text-gray-600">{booking.contactPhone}</p>
              )}
            </div>

            {/* Passengers */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Passengers ({booking.totalPassengers})
              </p>
              <div className="space-y-1">
                {booking.passengers?.map((p: any, i: number) => (
                  <div key={i} className="text-sm text-gray-600">
                    {p.firstName} {p.lastName} ({p.passengerType})
                  </div>
                ))}
              </div>
            </div>

            {/* Vehicles */}
            {booking.totalVehicles > 0 && (
              <div className="mb-4 pb-4 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Vehicles ({booking.totalVehicles})
                </p>
                <div className="space-y-1">
                  {booking.vehicles?.map((v: any, i: number) => (
                    <div key={i} className="text-sm text-gray-600">
                      {v.vehicleType} - {v.licensePlate}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cabin */}
            {(booking.cabinSupplement || booking.cabin_supplement) > 0 && (
              <div className="mb-4 pb-4 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">Cabin</p>
                <div className="text-sm text-gray-600">
                  Cabin Upgrade - €{(booking.cabinSupplement || booking.cabin_supplement)?.toFixed(2)}
                </div>
              </div>
            )}

            {/* Meals */}
            {booking.meals && booking.meals.length > 0 && (
              <div className="mb-4 pb-4 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Meals ({booking.meals.length})
                </p>
                <div className="space-y-1">
                  {booking.meals.map((meal: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm text-gray-600">
                      <span>
                        {meal.quantity}x Meal
                        {meal.dietaryType && ` (${meal.dietaryType})`}
                      </span>
                      <span>€{(meal.totalPrice || meal.total_price)?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Price Summary */}
            <div className="mb-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span>€{booking.subtotal?.toFixed(2)}</span>
                </div>
                {(booking.cabinSupplement || booking.cabin_supplement) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Cabin Supplement</span>
                    <span>€{(booking.cabinSupplement || booking.cabin_supplement)?.toFixed(2)}</span>
                  </div>
                )}
                {booking.meals && booking.meals.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Meals Total</span>
                    <span>€{booking.meals.reduce((sum: number, m: any) => sum + (m.totalPrice || m.total_price || 0), 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax (10%)</span>
                  <span>€{booking.taxAmount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span className="text-green-600">€{booking.totalAmount?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Operator Reference */}
            {booking.operatorBookingReference && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="text-gray-600">
                  Operator Reference: <span className="font-semibold">{booking.operatorBookingReference}</span>
                </p>
              </div>
            )}
          </div>

          {/* Important Information */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
            <h3 className="font-semibold text-yellow-900 mb-2">Important Information</h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• A confirmation email has been sent to {booking.contactEmail}</li>
              <li>• Please arrive at the port at least 30 minutes before departure</li>
              <li>• Bring a valid ID or passport for all passengers</li>
              <li>• Vehicle registration documents required if traveling with a vehicle</li>
            </ul>
          </div>

          {/* Create Account CTA for Guest Users */}
          {!user && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Want to manage your booking easily?</h3>
                  <p className="text-sm text-gray-600">
                    Create an account to track your booking, view history, and get exclusive benefits!
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateAccountModal(true)}
                  className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 whitespace-nowrap"
                >
                  Create Account
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-6">
            <button
              onClick={handleViewBookings}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              View My Bookings
            </button>
            <button
              onClick={handleNewBooking}
              className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50"
            >
              Make Another Booking
            </button>
          </div>
        </div>

        {/* Create Account Modal for Guest Bookings */}
        {!user && booking.bookingReference && booking.contactEmail && (
          <CreateAccountModal
            isOpen={showCreateAccountModal}
            onClose={() => setShowCreateAccountModal(false)}
            bookingReference={booking.bookingReference}
            bookingEmail={booking.contactEmail}
            onSuccess={handleAccountCreated}
          />
        )}
      </div>
    </div>
  );
};

export default BookingConfirmationPage;
