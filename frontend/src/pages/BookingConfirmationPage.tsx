import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { resetBooking } from '../store/slices/ferrySlice';
import CreateAccountModal from '../components/CreateAccountModal';
import { setUser } from '../store/slices/authSlice';
import BookingStepIndicator, { BookingStep } from '../components/BookingStepIndicator';

const BookingConfirmationPage: React.FC = () => {
  const { t } = useTranslation(['booking', 'common']);
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
    <div className="min-h-screen bg-gray-50">
      {/* Booking Step Indicator */}
      <BookingStepIndicator
        currentStep={BookingStep.CONFIRMATION}
        canGoBack={false}
      />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Success Message */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('booking:confirmation.title')}</h1>
            <p className="text-gray-600">{t('booking:confirmation.message')}</p>
          </div>

          {/* Booking Reference */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">{t('booking:confirmation.bookingReferenceLabel')}</p>
              <p className="text-2xl font-bold text-blue-600">{booking.bookingReference}</p>
              <p className="text-xs text-gray-500 mt-2">
                {t('booking:confirmation.saveReference')}
              </p>
            </div>
          </div>

          {/* Booking Details */}
          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold mb-4">{t('booking:confirmation.bookingDetails')}</h2>

            {/* Ferry Information */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              {/* Outbound Journey */}
              <div className="mb-4">
                {booking.isRoundTrip && (
                  <p className="text-sm font-medium text-blue-600 mb-2">{t('booking:confirmation.outboundJourney')}</p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">{t('booking:confirmation.operator')}</p>
                    <p className="font-semibold">{booking.operator}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">{t('booking:confirmation.status')}</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      booking.status === 'CONFIRMED' || booking.status === 'confirmed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                  {booking.departurePort && (
                    <div>
                      <p className="text-sm text-gray-600">{t('booking:confirmation.route')}</p>
                      <p className="font-semibold">{booking.departurePort} → {booking.arrivalPort}</p>
                    </div>
                  )}
                  {booking.departureTime && (
                    <div>
                      <p className="text-sm text-gray-600">{t('booking:confirmation.departure')}</p>
                      <p className="font-semibold">{new Date(booking.departureTime).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Return Journey */}
              {booking.isRoundTrip && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-medium text-blue-600 mb-2">{t('booking:confirmation.returnJourney')}</p>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Only show operator if return ferry was selected */}
                    {booking.returnSailingId && booking.returnOperator && (
                      <div>
                        <p className="text-sm text-gray-600">{t('booking:confirmation.operator')}</p>
                        <p className="font-semibold">{booking.returnOperator}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-600">{t('booking:confirmation.route')}</p>
                      <p className="font-semibold">
                        {booking.returnDeparturePort || booking.arrivalPort} → {booking.returnArrivalPort || booking.departurePort}
                      </p>
                    </div>
                    {booking.returnSailingId && booking.returnDepartureTime ? (
                      <div>
                        <p className="text-sm text-gray-600">{t('booking:confirmation.departure')}</p>
                        <p className="font-semibold">{new Date(booking.returnDepartureTime).toLocaleString()}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-600">{t('booking:confirmation.status')}</p>
                        <p className="font-semibold text-yellow-600">{t('booking:confirmation.returnNotSelected')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Contact Information */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">{t('booking:confirmation.contactInfo')}</p>
              <p className="text-sm text-gray-600">
                {booking.contactFirstName} {booking.contactLastName}
              </p>
              <p className="text-sm text-gray-600">{booking.contactEmail}</p>
              {booking.contactPhone && !booking.contactPhone.includes('@') && (
                <p className="text-sm text-gray-600">{booking.contactPhone}</p>
              )}
            </div>

            {/* Passengers */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">
                {t('booking:confirmation.passengers')} ({booking.totalPassengers})
              </p>
              <div className="space-y-2">
                {booking.passengers?.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-start">
                    <div>
                      <span className="font-medium text-gray-900">{p.firstName || p.first_name} {p.lastName || p.last_name}</span>
                      <span className="text-sm text-gray-500 ml-2">({p.passengerType || p.passenger_type})</span>
                      {(p.hasPet || p.has_pet) && (
                        <div className="text-sm text-gray-500 mt-1">
                          <span className="mr-1">{p.petType === 'cat' ? '🐱' : '🐕'}</span>
                          {t('booking:confirmation.travelingWithPet', 'Traveling with pet')}
                          {p.petName && <span className="ml-1">({p.petName || p.pet_name})</span>}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {(booking.isRoundTrip || booking.is_round_trip) ? (
                        <div className="space-y-1">
                          <div className="text-sm text-gray-600">
                            €{(p.finalPrice || p.final_price || 0).toFixed(2)} × 2
                          </div>
                          <div className="font-medium text-gray-900">
                            €{((p.finalPrice || p.final_price || 0) * 2).toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <span className="font-medium text-gray-900">€{(p.finalPrice || p.final_price || 0).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vehicles */}
            {booking.totalVehicles > 0 && (
              <div className="mb-4 pb-4 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  {t('booking:confirmation.vehicles')} ({booking.totalVehicles})
                </p>
                <div className="space-y-2">
                  {booking.vehicles?.map((v: any, i: number) => (
                    <div key={i} className="flex justify-between items-start">
                      <div>
                        <span className="font-medium text-gray-900">{v.vehicleType || v.vehicle_type}</span>
                        <div className="text-sm text-gray-500">
                          {t('booking:confirmation.licensePlate', 'License Plate')}: {v.licensePlate || v.license_plate}
                        </div>
                        {(v.lengthCm || v.length_cm) && (
                          <div className="text-sm text-gray-500">
                            {t('booking:confirmation.dimensions', 'Dimensions')}: {((v.lengthCm || v.length_cm) / 100).toFixed(1)}m × {((v.widthCm || v.width_cm) / 100).toFixed(1)}m × {((v.heightCm || v.height_cm) / 100).toFixed(1)}m
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        {(booking.isRoundTrip || booking.is_round_trip) ? (
                          <div className="space-y-1">
                            <div className="text-sm text-gray-600">
                              €{(v.finalPrice || v.final_price || 0).toFixed(2)} × 2
                            </div>
                            <div className="font-medium text-gray-900">
                              €{((v.finalPrice || v.final_price || 0) * 2).toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <span className="font-medium text-gray-900">€{(v.finalPrice || v.final_price || 0).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cabin */}
            {(booking.cabinSupplement || booking.cabin_supplement) > 0 && (
              <div className="mb-4 pb-4 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">{t('booking:confirmation.cabin')}</p>
                <div className="text-sm text-gray-600">
                  {t('booking:confirmation.cabinUpgrade')} - €{(booking.cabinSupplement || booking.cabin_supplement)?.toFixed(2)}
                </div>
              </div>
            )}

            {/* Meals */}
            {booking.meals && booking.meals.length > 0 && (
              <div className="mb-4 pb-4 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  {t('booking:confirmation.meals')} ({booking.meals.length})
                </p>
                <div className="space-y-1">
                  {booking.meals.map((meal: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm text-gray-600">
                      <span>
                        {meal.quantity}x {t('booking:confirmation.meal')}
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
                  <span className="text-gray-600">{t('booking:confirmation.subtotal')}</span>
                  <span>€{booking.subtotal?.toFixed(2)}</span>
                </div>
                {(booking.cabinSupplement || booking.cabin_supplement) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {booking.isRoundTrip || booking.is_round_trip
                        ? t('booking:confirmation.cabinOutbound', 'Cabin (Outbound)')
                        : t('booking:confirmation.cabinSupplement')}
                    </span>
                    <span>€{(booking.cabinSupplement || booking.cabin_supplement)?.toFixed(2)}</span>
                  </div>
                )}
                {(booking.returnCabinSupplement || booking.return_cabin_supplement) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('booking:confirmation.cabinReturn', 'Cabin (Return)')}</span>
                    <span>€{(booking.returnCabinSupplement || booking.return_cabin_supplement)?.toFixed(2)}</span>
                  </div>
                )}
                {booking.meals && booking.meals.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('booking:confirmation.mealsTotal')}</span>
                    <span>€{booking.meals.reduce((sum: number, m: any) => sum + (m.totalPrice || m.total_price || 0), 0).toFixed(2)}</span>
                  </div>
                )}
                {(booking.discountAmount || booking.discount_amount) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>{t('booking:confirmation.promoDiscount')} {booking.promoCode || booking.promo_code ? `(${booking.promoCode || booking.promo_code})` : ''}</span>
                    <span>-€{(booking.discountAmount || booking.discount_amount)?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('booking:confirmation.tax')}</span>
                  <span>€{booking.taxAmount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                  <span>{t('booking:confirmation.total')}</span>
                  <span className="text-green-600">€{booking.totalAmount?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Operator References */}
            {(booking.operatorBookingReference || booking.returnOperatorBookingReference) && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
                {booking.operatorBookingReference && (
                  <p className="text-gray-600">
                    {booking.isRoundTrip && booking.returnOperatorBookingReference ? `${t('booking:confirmation.outbound')} ` : ''}{t('booking:confirmation.operatorReference')}: <span className="font-semibold">{booking.operatorBookingReference}</span>
                  </p>
                )}
                {booking.returnOperatorBookingReference && (
                  <p className="text-gray-600">
                    {t('booking:confirmation.returnOperatorReference')}: <span className="font-semibold">{booking.returnOperatorBookingReference}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Important Information */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
            <h3 className="font-semibold text-yellow-900 mb-2">{t('booking:confirmation.importantInfo')}</h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• {t('booking:confirmation.emailConfirmation')} {booking.contactEmail}</li>
              <li>• {t('booking:confirmation.arriveEarly')}</li>
              <li>• {t('booking:confirmation.bringId')}</li>
              <li>• {t('booking:confirmation.vehicleDocs')}</li>
            </ul>
          </div>

          {/* Create Account CTA for Guest Users */}
          {!user && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{t('booking:confirmation.manageBooking')}</h3>
                  <p className="text-sm text-gray-600">
                    {t('booking:confirmation.createAccountDesc')}
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateAccountModal(true)}
                  className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 whitespace-nowrap"
                >
                  {t('booking:confirmation.createAccount')}
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
              {t('booking:confirmation.viewMyBookings')}
            </button>
            <button
              onClick={handleNewBooking}
              className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50"
            >
              {t('booking:confirmation.makeAnotherBooking')}
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
