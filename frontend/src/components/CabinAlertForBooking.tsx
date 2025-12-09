import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { format, parseISO } from 'date-fns';
import { RootState } from '../store';
import api, { availabilityAlertAPI, AvailabilityAlert } from '../services/api';

interface Booking {
  id: number;
  bookingReference?: string;
  departurePort: string;
  arrivalPort: string;
  departureTime: string;
  returnDeparturePort?: string;
  returnArrivalPort?: string;
  returnDepartureTime?: string;
  isRoundTrip?: boolean;
  operator: string;
  returnOperator?: string;
  totalPassengers: number;
  contactEmail: string;
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
  const { user } = useSelector((state: RootState) => state.auth);

  const [existingAlert, setExistingAlert] = useState<AvailabilityAlert | null>(null);
  const [isCheckingAlert, setIsCheckingAlert] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Determine journey details based on type
  const isReturn = journeyType === 'return';
  const departurePort = isReturn
    ? booking.returnDeparturePort || booking.arrivalPort
    : booking.departurePort;
  const arrivalPort = isReturn
    ? booking.returnArrivalPort || booking.departurePort
    : booking.arrivalPort;
  const departureTime = isReturn ? booking.returnDepartureTime : booking.departureTime;
  const operator = isReturn ? booking.returnOperator || booking.operator : booking.operator;

  const email = user?.email || booking.contactEmail;

  // Check for existing alert on mount
  useEffect(() => {
    const checkExistingAlert = async () => {
      if (!email) {
        setIsCheckingAlert(false);
        return;
      }

      try {
        const alerts = await availabilityAlertAPI.getAlerts({ email, status: 'active' });
        const existing = alerts.find(
          (alert) =>
            alert.booking_id === booking.id &&
            alert.journey_type === journeyType &&
            alert.alert_type === 'cabin'
        );
        setExistingAlert(existing || null);
      } catch (err) {
        console.log('Error checking existing alert:', err);
      } finally {
        setIsCheckingAlert(false);
      }
    };

    checkExistingAlert();
  }, [email, booking.id, journeyType]);

  const handleCreateAlert = async () => {
    if (!email) {
      window.alert('Please log in or provide an email to receive notifications.');
      return;
    }

    if (!departureTime) {
      window.alert('Unable to create alert - missing departure time.');
      return;
    }

    setIsCreating(true);
    try {
      const departureDateTime = parseISO(departureTime);
      const sailingTime = format(departureDateTime, 'HH:mm');
      const departureDateStr = format(departureDateTime, 'yyyy-MM-dd');

      const alertData = {
        alert_type: 'cabin' as const,
        email,
        departure_port: departurePort.toLowerCase(),
        arrival_port: arrivalPort.toLowerCase(),
        departure_date: departureDateStr,
        is_round_trip: false,
        operator,
        sailing_time: sailingTime,
        num_adults: booking.totalPassengers,
        num_children: 0,
        num_infants: 0,
        alert_duration_days: 30,
        booking_id: booking.id,
        journey_type: journeyType,
      };

      const response = await api.post('/availability-alerts', alertData);
      setExistingAlert(response.data);
      onSuccess?.();
    } catch (err: any) {
      window.alert(err.response?.data?.detail || 'Failed to create alert. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelAlert = async () => {
    if (!existingAlert) return;

    if (!window.confirm('Are you sure you want to cancel this cabin availability alert?')) {
      return;
    }

    setIsCancelling(true);
    try {
      await availabilityAlertAPI.cancelAlert(existingAlert.id, email);
      setExistingAlert(null);
    } catch (err: any) {
      window.alert(err.response?.data?.detail || 'Failed to cancel alert.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Only render for return if it's a round trip with return details
  if (isReturn && (!booking.isRoundTrip || !booking.returnDepartureTime)) {
    return null;
  }

  // Loading state
  if (isCheckingAlert) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-center py-2">
          <svg className="animate-spin h-5 w-5 text-purple-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      </div>
    );
  }

  const formattedDate = departureTime
    ? format(parseISO(departureTime), 'EEE, MMM d')
    : '';

  const journeyLabel = isReturn ? 'Return' : 'Outbound';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Cabin Availability Alert</h3>
          <p className="text-sm text-gray-500">
            {journeyLabel} • {formattedDate}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-4">
        {existingAlert
          ? `You'll be notified at ${email} when a cabin becomes available for this sailing.`
          : 'Get notified when a cabin becomes available for this sailing.'}
      </p>

      {/* Action */}
      {existingAlert ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1.5 rounded-full">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">Alert Active</span>
          </div>
          <button
            onClick={handleCancelAlert}
            disabled={isCancelling}
            className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-50 px-2 py-1"
          >
            {isCancelling ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={handleCreateAlert}
          disabled={isCreating}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {isCreating ? (
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Notify Me
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default CabinAlertForBooking;
