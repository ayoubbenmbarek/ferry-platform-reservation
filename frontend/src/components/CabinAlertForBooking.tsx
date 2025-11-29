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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedCabinType, setSelectedCabinType] = useState<string>('any');
  const [numCabins, setNumCabins] = useState(1);

  const cabinTypes = [
    { value: 'any', label: t('booking:cabinAlert.cabinTypes.any', 'Any Cabin (All Types)') },
    { value: 'inside', label: t('booking:cabinAlert.cabinTypes.inside', 'Inside Cabin') },
    { value: 'outside', label: t('booking:cabinAlert.cabinTypes.outside', 'Outside Cabin') },
    { value: 'balcony', label: t('booking:cabinAlert.cabinTypes.balcony', 'Balcony Cabin') },
    { value: 'suite', label: t('booking:cabinAlert.cabinTypes.suite', 'Suite') },
  ];

  const handleCreateAlert = async () => {
    setLoading(true);
    setError(null);

    try {
      // Extract departure date from departure time
      const departureDate = new Date(booking.departureTime).toISOString().split('T')[0];
      const sailingTime = new Date(booking.departureTime).toTimeString().slice(0, 5);

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
        cabin_type: selectedCabinType === 'any' ? null : selectedCabinType,
        num_cabins: numCabins,
        booking_id: booking.id,  // Link alert to existing booking
        journey_type: journeyType,  // 'outbound' or 'return'
        alert_duration_days: 30,
      };

      await api.post('/availability-alerts', alertData);

      setSuccess(true);
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
        onClick={() => setShowModal(true)}
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

            {/* Content */}
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

              {/* Cabin Type Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('booking:cabinAlert.selectCabinType', 'Preferred Cabin Type')}
                </label>
                <select
                  value={selectedCabinType}
                  onChange={(e) => setSelectedCabinType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  disabled={loading || success}
                >
                  {cabinTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Number of Cabins */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('booking:cabinAlert.numCabins', 'Number of Cabins')}
                </label>
                <select
                  value={numCabins}
                  onChange={(e) => setNumCabins(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  disabled={loading || success}
                >
                  {[1, 2, 3, 4].map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? t('booking:cabinAlert.cabin', 'Cabin') : t('booking:cabinAlert.cabins', 'Cabins')}
                    </option>
                  ))}
                </select>
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

            {/* Footer Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                {t('common:common.cancel', 'Cancel')}
              </button>
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
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CabinAlertForBooking;
