import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

interface Booking {
  id: number;
  bookingReference: string;
  departurePort: string;
  arrivalPort: string;
  departureTime: string;
  operator: string;
  totalPassengers: number;
  contactEmail: string;
  isRoundTrip?: boolean;
  returnDeparturePort?: string;
  returnArrivalPort?: string;
  returnDepartureTime?: string;
}

interface CabinAlertForBookingProps {
  booking: Booking;
  journeyType?: 'outbound' | 'return';
  onSuccess?: () => void;
}

const CabinAlertForBooking: React.FC<CabinAlertForBookingProps> = ({
  booking,
  journeyType = 'outbound',
  onSuccess
}) => {
  const { t } = useTranslation(['booking', 'common']);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [existingAlert, setExistingAlert] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check for existing alerts when modal opens
  const checkExistingAlert = async () => {
    setCheckingExisting(true);
    try {
      const response = await api.get(`/availability-alerts?email=${encodeURIComponent(booking.contactEmail)}&status=active`);
      const alerts = response.data || [];

      // Find alert matching this booking and journey type
      const existing = alerts.find((alert: any) =>
        alert.booking_id === booking.id &&
        alert.journey_type === journeyType &&
        alert.alert_type === 'cabin'
      );

      if (existing) {
        setExistingAlert(existing);
      }
    } catch (err) {
      console.error('Failed to check existing alerts:', err);
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleOpenModal = () => {
    setShowModal(true);
    setExistingAlert(null);
    setError(null);
    setSuccess(false);
    checkExistingAlert();
  };

  const handleCancelExistingAlert = async () => {
    if (!existingAlert) return;

    setLoading(true);
    try {
      await api.delete(`/availability-alerts/${existingAlert.id}?email=${encodeURIComponent(booking.contactEmail)}`);
      setExistingAlert(null);
    } catch (err: any) {
      console.error('Failed to cancel alert:', err);
      setError(err.response?.data?.detail || 'Failed to cancel existing alert');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = async () => {
    setLoading(true);
    setError(null);

    try {
      // Extract departure date and time in UTC (to match backend storage)
      const departureDateObj = new Date(booking.departureTime);
      const departureDate = departureDateObj.toISOString().split('T')[0];
      // Use UTC time to match how the backend stores departure times
      const sailingTime = departureDateObj.toISOString().split('T')[1].slice(0, 5);

      const alertData = {
        alert_type: 'cabin',
        email: booking.contactEmail,
        departure_port: booking.departurePort.toLowerCase(),
        arrival_port: booking.arrivalPort.toLowerCase(),
        departure_date: departureDate,
        is_round_trip: false, // Each alert is for one leg only
        return_date: null,
        operator: booking.operator,
        sailing_time: sailingTime,
        num_adults: booking.totalPassengers,
        num_children: 0,
        num_infants: 0,
        cabin_type: null, // User will choose cabin type when notified
        num_cabins: 1,
        booking_id: booking.id,  // Link alert to existing booking
        journey_type: journeyType,  // 'outbound' or 'return'
        alert_duration_days: 30,
      };

      await api.post('/availability-alerts', alertData);

      setSuccess(true);
      // Just call onSuccess callback without page reload
      setTimeout(() => {
        setShowModal(false);
        setSuccess(false);
        onSuccess?.();
      }, 2000);

    } catch (err: any) {
      console.error('Failed to create cabin alert:', err);
      const errorMsg = err.response?.data?.detail || err.response?.data?.message || t('booking:cabinAlert.error', 'Failed to create alert. Please try again.');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const journeyLabel = journeyType === 'return'
    ? t('booking:cabinAlert.returnJourney', 'Return')
    : t('booking:cabinAlert.outboundJourney', 'Outbound');

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpenModal}
        className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {t('booking:cabinAlert.button', 'Cabin Alert')} ({journeyLabel})
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">
                {t('booking:cabinAlert.title', 'Cabin Availability Alert')} - {journeyLabel}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Success Message */}
            {success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center text-green-800">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {t('booking:cabinAlert.success', 'Alert created! We\'ll notify you when a cabin becomes available.')}
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-red-800 text-sm">{error}</div>
              </div>
            )}

            {/* Loading State */}
            {checkingExisting && (
              <div className="mb-4 flex items-center justify-center py-4">
                <svg className="animate-spin h-6 w-6 text-purple-600 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-gray-600">{t('booking:cabinAlert.checking', 'Checking for existing alerts...')}</span>
              </div>
            )}

            {/* Existing Alert Warning */}
            {existingAlert && !checkingExisting && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-yellow-800 font-medium">
                      {t('booking:cabinAlert.existingAlert', 'You already have an active alert for this journey')}
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Alert ID: {existingAlert.id} • Created: {new Date(existingAlert.created_at).toLocaleDateString()}
                    </p>
                    <button
                      onClick={handleCancelExistingAlert}
                      disabled={loading}
                      className="mt-2 text-sm text-yellow-800 underline hover:text-yellow-900"
                    >
                      {loading ? t('common:common.loading', 'Loading...') : t('booking:cabinAlert.cancelExisting', 'Cancel existing alert to create a new one')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Content */}
            {!checkingExisting && !existingAlert && (
            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                {t('booking:cabinAlert.description', 'We\'ll check periodically and email you when a cabin becomes available for your booking.')}
              </p>

              {/* Booking Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-xs text-gray-500 mb-2">{t('booking:cabinAlert.bookingRef', 'Booking Reference')}</p>
                <p className="font-semibold text-blue-600 mb-3">{booking.bookingReference}</p>

                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('booking:cabinAlert.route', 'Route')}:</span>
                    <span className="font-medium capitalize">
                      {booking.departurePort} → {booking.arrivalPort}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('booking:cabinAlert.date', 'Date')}:</span>
                    <span className="font-medium">{formatDate(booking.departureTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('booking:cabinAlert.time', 'Time')}:</span>
                    <span className="font-medium">{formatTime(booking.departureTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('booking:cabinAlert.operator', 'Operator')}:</span>
                    <span className="font-medium">{booking.operator}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('booking:cabinAlert.passengers', 'Passengers')}:</span>
                    <span className="font-medium">{booking.totalPassengers}</span>
                  </div>
                </div>
              </div>

              {/* Email confirmation */}
              <div className="bg-blue-50 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">{t('booking:cabinAlert.emailTo', 'Notification will be sent to')}:</span>
                  <br />
                  {booking.contactEmail}
                </p>
              </div>

              {/* Alert Duration Note */}
              <p className="text-xs text-gray-500">
                {t('booking:cabinAlert.duration', 'Alert will be active for 30 days or until the departure date')}
              </p>
            </div>
            )}

            {/* Footer Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                {t('common:common.cancel', 'Cancel')}
              </button>
              {!existingAlert && !checkingExisting && (
                <button
                  onClick={handleCreateAlert}
                  disabled={loading || success}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('common:common.loading', 'Loading...')}
                    </>
                  ) : (
                    t('booking:cabinAlert.createAlert', 'Create Alert')
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CabinAlertForBooking;
