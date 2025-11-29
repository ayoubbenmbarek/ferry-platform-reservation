import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { bookingAPI } from '../services/api';
import BookingExpirationTimer from '../components/BookingExpirationTimer';
import CabinAlertForBooking from '../components/CabinAlertForBooking';

// Helper to convert snake_case to camelCase
const snakeToCamel = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  return Object.keys(obj).reduce((acc: any, key: string) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    acc[camelKey] = snakeToCamel(obj[key]);
    return acc;
  }, {});
};

const BookingDetailsPage: React.FC = () => {
  const { t } = useTranslation(['booking', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [booking, setBooking] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  useEffect(() => {
    const fetchBooking = async () => {
      if (!id) {
        navigate(isAuthenticated ? '/my-bookings' : '/');
        return;
      }

      // If booking data was passed from FindBookingPage, use it
      const locationState = location.state as any;
      if (locationState?.booking) {
        setBooking(snakeToCamel(locationState.booking));
        setIsLoading(false);
        return;
      }

      // Otherwise, fetch from API
      try {
        setIsLoading(true);
        const response = await bookingAPI.getById(parseInt(id));
        // Convert snake_case to camelCase
        setBooking(snakeToCamel(response));
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load booking');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooking();
  }, [id, navigate, location.state, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800">{error || 'Booking not found'}</p>
            <button
              onClick={() => navigate(isAuthenticated ? '/my-bookings' : '/')}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {isAuthenticated ? 'Back to My Bookings' : 'Back to Home'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'confirmed') return 'bg-green-100 text-green-800';
    if (s === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (s === 'cancelled') return 'bg-red-100 text-red-800';
    if (s === 'completed') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const handleCancelBooking = async () => {
    if (!cancelReason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }

    setIsCancelling(true);
    try {
      await bookingAPI.cancel(parseInt(id!), cancelReason);
      // Refresh booking data
      const response = await bookingAPI.getById(parseInt(id!));
      setBooking(snakeToCamel(response));
      setShowCancelModal(false);
      setCancelReason('');
      // Show success message
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to cancel booking');
    } finally {
      setIsCancelling(false);
    }
  };

  const canCancelBooking = () => {
    if (!booking) return false;
    const status = booking.status.toLowerCase();
    return status === 'confirmed' || status === 'pending';
  };

  const canDownloadInvoice = () => {
    if (!booking) return false;
    const status = booking.status.toLowerCase();
    return status === 'confirmed' || status === 'completed';
  };

  const handleDownloadInvoice = async () => {
    if (!id) return;

    setIsDownloadingInvoice(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/bookings/${id}/invoice`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to download invoice');
      }

      // Get the blob and create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${booking.bookingReference}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Failed to download invoice');
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate(isAuthenticated ? '/my-bookings' : '/')}
            className="text-blue-600 hover:text-blue-700 flex items-center"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {isAuthenticated ? 'Back to My Bookings' : 'Back to Home'}
          </button>
        </div>

        {/* Booking Details Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          {/* Booking Reference */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('booking:details.title')}</h1>
              <p className="text-sm text-gray-600">
                Reference: <span className="font-semibold text-blue-600">{booking.bookingReference}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Booked on {new Date(booking.createdAt).toLocaleString()}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(booking.status)}`}>
              {booking.status}
            </span>
          </div>

          {/* Expiration Timer for Pending Bookings */}
          {booking.status === 'PENDING' && booking.expiresAt && new Date(booking.expiresAt) > new Date() && (
            <div className="mb-6">
              <BookingExpirationTimer
                expiresAt={booking.expiresAt}
                onExpired={() => {
                  // Reload the page to show expired status
                  window.location.reload();
                }}
              />
            </div>
          )}

          {/* Ferry Information */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold mb-3">Ferry Information</h2>

            {/* Outbound Journey */}
            <div className="mb-4">
              {booking.isRoundTrip && (
                <p className="text-sm font-medium text-blue-600 mb-2">Outbound Journey</p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Operator</p>
                  <p className="font-semibold">{booking.operator}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Sailing ID</p>
                  <p className="font-semibold">{booking.sailingId}</p>
                </div>
                {booking.departurePort && (
                  <div>
                    <p className="text-sm text-gray-600">Route</p>
                    <p className="font-semibold">{booking.departurePort} → {booking.arrivalPort}</p>
                  </div>
                )}
                {booking.departureTime && (
                  <div>
                    <p className="text-sm text-gray-600">Departure</p>
                    <p className="font-semibold">{new Date(booking.departureTime).toLocaleString()}</p>
                  </div>
                )}
              </div>
              {booking.operatorBookingReference && (
                <div className="mt-3">
                  <p className="text-sm text-gray-600">{booking.isRoundTrip && booking.returnOperatorBookingReference ? 'Outbound Operator Reference' : 'Operator Reference'}</p>
                  <p className="font-semibold">{booking.operatorBookingReference}</p>
                </div>
              )}
            </div>

            {/* Return Journey */}
            {booking.isRoundTrip && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-blue-600 mb-2">Return Journey</p>
                <div className="grid grid-cols-2 gap-4">
                  {/* Only show operator/vessel if a return ferry was actually selected */}
                  {booking.returnSailingId && booking.returnOperator && (
                    <div>
                      <p className="text-sm text-gray-600">Operator</p>
                      <p className="font-semibold">{booking.returnOperator}</p>
                    </div>
                  )}
                  {booking.returnSailingId && (
                    <div>
                      <p className="text-sm text-gray-600">Sailing ID</p>
                      <p className="font-semibold">{booking.returnSailingId}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Route</p>
                    <p className="font-semibold">
                      {booking.returnDeparturePort || booking.arrivalPort} → {booking.returnArrivalPort || booking.departurePort}
                    </p>
                  </div>
                  {booking.returnSailingId && booking.returnDepartureTime ? (
                    <div>
                      <p className="text-sm text-gray-600">Departure</p>
                      <p className="font-semibold">{new Date(booking.returnDepartureTime).toLocaleString()}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <p className="font-semibold text-yellow-600">Return ferry not yet selected</p>
                    </div>
                  )}
                </div>
                {booking.returnOperatorBookingReference && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600">Return Operator Reference</p>
                    <p className="font-semibold">{booking.returnOperatorBookingReference}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contact Information */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold mb-3">Contact Information</h2>
            <div className="space-y-2">
              <p className="text-gray-700">
                {booking.contactFirstName} {booking.contactLastName}
              </p>
              <p className="text-gray-600 text-sm">{booking.contactEmail}</p>
              {booking.contactPhone && (
                <p className="text-gray-600 text-sm">{booking.contactPhone}</p>
              )}
            </div>
          </div>

          {/* Passengers */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold mb-3">
              Passengers ({booking.totalPassengers})
            </h2>
            <div className="space-y-3">
              {booking.passengers.map((p: any) => (
                <div key={p.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">
                        {p.firstName} {p.lastName}
                      </p>
                      <p className="text-sm text-gray-600 capitalize">{p.passengerType}</p>
                      {p.dateOfBirth && (
                        <p className="text-xs text-gray-500 mt-1">
                          DOB: {new Date(p.dateOfBirth).toLocaleDateString()}
                        </p>
                      )}
                      {p.nationality && (
                        <p className="text-xs text-gray-500">Nationality: {p.nationality}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">€{p.finalPrice?.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                  {p.specialNeeds && (
                    <p className="text-sm text-gray-600 mt-2">
                      Special needs: {p.specialNeeds}
                    </p>
                  )}
                  {p.hasPet && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm font-medium text-blue-700 flex items-center">
                        {p.petType === 'CAT' && '🐱'}
                        {p.petType === 'SMALL_ANIMAL' && '🐹'}
                        {p.petType === 'DOG' && '🐕'}
                        <span className="ml-1">Traveling with pet</span>
                      </p>
                      <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                        {p.petName && <p>Name: {p.petName}</p>}
                        {p.petWeightKg && <p>Weight: {p.petWeightKg} kg</p>}
                        <p>Carrier provided: {p.petCarrierProvided ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Vehicles */}
          {booking.totalVehicles > 0 && (
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold mb-3">
                Vehicles ({booking.totalVehicles})
              </h2>
              <div className="space-y-3">
                {booking.vehicles.map((v: any) => (
                  <div key={v.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold capitalize">{v.vehicleType}</p>
                        <p className="text-sm text-gray-600">
                          License Plate: {v.licensePlate}
                        </p>
                        {v.make && v.model && (
                          <p className="text-sm text-gray-600">
                            {v.make} {v.model}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Dimensions: {((v.lengthCm || 0) / 100).toFixed(1)}m × {((v.widthCm || 0) / 100).toFixed(1)}m × {((v.heightCm || 0) / 100).toFixed(1)}m
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">€{v.finalPrice?.toFixed(2) || '0.00'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Special Requests */}
          {booking.specialRequests && (
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold mb-3">Special Requests</h2>
              <p className="text-gray-700">{booking.specialRequests}</p>
            </div>
          )}

          {/* Cancellation Info */}
          {booking.status?.toLowerCase() === 'cancelled' && (
            <div className="mb-6 pb-6 border-b border-gray-200">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-red-900 mb-2">{t('booking:cancellation.cancelled')}</h2>
                {booking.cancelledAt && (
                  <p className="text-sm text-red-800 mb-2">
                    Cancelled on {new Date(booking.cancelledAt).toLocaleDateString()} at {new Date(booking.cancelledAt).toLocaleTimeString()}
                  </p>
                )}
                {booking.cancellationReason && (
                  <div>
                    <p className="text-sm font-medium text-red-900 mb-1">Reason:</p>
                    <p className="text-sm text-red-800">{booking.cancellationReason}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Price Summary */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Price Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>€{(booking.subtotal || 0).toFixed(2)}</span>
              </div>
              {booking.cabinSupplement > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cabin Supplement</span>
                  <span>€{(booking.cabinSupplement || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span>€{(booking.taxAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                <span>Total</span>
                <span className="text-blue-600">€{(booking.totalAmount || 0).toFixed(2)} {booking.currency || 'EUR'}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 border-t border-gray-200 pt-6 space-y-3">
            {/* Pay Now Button for Pending Bookings */}
            {booking.status?.toLowerCase() === 'pending' && (
              <div className="mb-4">
                <button
                  onClick={() => navigate(`/payment/${booking.id}`)}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors mb-2"
                >
                  Pay Now - €{(booking.totalAmount || 0).toFixed(2)}
                </button>
                {booking.expiresAt && (
                  <p className="text-sm text-orange-600 text-center">
                    Payment due by {new Date(booking.expiresAt).toLocaleDateString()} at {new Date(booking.expiresAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            )}

            {/* Download Invoice Button for Paid Bookings */}
            {canDownloadInvoice() && (
              <button
                onClick={handleDownloadInvoice}
                disabled={isDownloadingInvoice}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {isDownloadingInvoice ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('common:common.loading')}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Invoice
                  </>
                )}
              </button>
            )}

            {/* Cabin Alert Button for outbound - show for all confirmed/pending bookings with future departure */}
            {['confirmed', 'pending'].includes(booking.status?.toLowerCase()) && booking.departureTime && new Date(booking.departureTime) >= new Date(new Date().setHours(0,0,0,0)) && (
              <CabinAlertForBooking
                booking={{
                  id: booking.id,
                  bookingReference: booking.bookingReference,
                  departurePort: booking.departurePort,
                  arrivalPort: booking.arrivalPort,
                  departureTime: booking.departureTime,
                  operator: booking.operator,
                  totalPassengers: booking.totalPassengers,
                  contactEmail: booking.contactEmail,
                  isRoundTrip: false,
                }}
                journeyType="outbound"
              />
            )}

            {/* Cabin Alert Button for return - for round trip bookings with future return */}
            {['confirmed', 'pending'].includes(booking.status?.toLowerCase()) && booking.isRoundTrip && booking.returnDepartureTime && new Date(booking.returnDepartureTime) >= new Date(new Date().setHours(0,0,0,0)) && (
              <CabinAlertForBooking
                booking={{
                  id: booking.id,
                  bookingReference: booking.bookingReference,
                  departurePort: booking.returnDeparturePort || booking.arrivalPort,
                  arrivalPort: booking.returnArrivalPort || booking.departurePort,
                  departureTime: booking.returnDepartureTime,
                  operator: booking.returnOperator || booking.operator,
                  totalPassengers: booking.totalPassengers,
                  contactEmail: booking.contactEmail,
                  isRoundTrip: false,
                }}
                journeyType="return"
              />
            )}

            {/* Cancel Booking Button */}
            {canCancelBooking() && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="w-full bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
              >
                Cancel Booking
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('booking:cancellation.title')}</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel this booking? This action cannot be undone.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Cancellation
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={4}
                placeholder="Please provide a reason for cancelling..."
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                disabled={isCancelling}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={isCancelling}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingDetailsPage;