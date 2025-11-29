import React, { useState } from 'react';
import api from '../services/api';

interface SearchCriteria {
  departurePort: string;
  arrivalPort: string;
  departureDate: string;
  isRoundTrip?: boolean;
  returnDate?: string;
  adults: number;
  children?: number;
  infants?: number;
  vehicle?: {
    type: string;
    length?: number;
  };
  cabin?: {
    type: string;
    count: number;
  };
}

interface AvailabilityAlertButtonProps {
  searchCriteria: SearchCriteria;
  alertType: 'vehicle' | 'cabin' | 'passenger';
  onSuccess?: () => void;
  className?: string;
}

const AvailabilityAlertButton: React.FC<AvailabilityAlertButtonProps> = ({
  searchCriteria,
  alertType,
  onSuccess,
  className = ''
}) => {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCreateAlert = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const alertData = {
        alert_type: alertType,
        email: email,
        departure_port: searchCriteria.departurePort,
        arrival_port: searchCriteria.arrivalPort,
        departure_date: searchCriteria.departureDate,
        is_round_trip: searchCriteria.isRoundTrip || false,
        return_date: searchCriteria.returnDate || null,
        num_adults: searchCriteria.adults,
        num_children: searchCriteria.children || 0,
        num_infants: searchCriteria.infants || 0,
        alert_duration_days: 30,
      };

      // Add type-specific fields
      if (alertType === 'vehicle' && searchCriteria.vehicle) {
        Object.assign(alertData, {
          vehicle_type: searchCriteria.vehicle.type,
          vehicle_length_cm: searchCriteria.vehicle.length || 450,
        });
      } else if (alertType === 'cabin' && searchCriteria.cabin) {
        Object.assign(alertData, {
          cabin_type: searchCriteria.cabin.type,
          num_cabins: searchCriteria.cabin.count || 1,
        });
      }

      await api.post('/availability-alerts', alertData);

      setSuccess(true);
      setTimeout(() => {
        setShowModal(false);
        setSuccess(false);
        setEmail('');
        onSuccess?.();
      }, 2000);

    } catch (err: any) {
      console.error('Failed to create availability alert:', err);
      // Handle both 'detail' (FastAPI default) and 'message' (custom error format)
      const errorMsg = err.response?.data?.detail || err.response?.data?.message || 'Failed to create alert. Please try again.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const getAlertTypeLabel = () => {
    switch (alertType) {
      case 'vehicle':
        return '🚗 Vehicle Space';
      case 'cabin':
        return '🛏️ Cabin Availability';
      case 'passenger':
        return '👤 Passenger Seats';
      default:
        return 'Availability';
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setShowModal(true)}
        className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${className}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        Notify Me When Available
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">
                Get Availability Alert
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
                  Alert created successfully!
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
                We'll check every few hours and email you when <strong>{getAlertTypeLabel()}</strong> becomes available for your route.
              </p>

              {/* Route Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Route:</span>
                    <span className="font-medium capitalize">
                      {searchCriteria.departurePort} → {searchCriteria.arrivalPort}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium">{searchCriteria.departureDate}</span>
                  </div>
                  {searchCriteria.isRoundTrip && searchCriteria.returnDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Return:</span>
                      <span className="font-medium">{searchCriteria.returnDate}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Passengers:</span>
                    <span className="font-medium">
                      {searchCriteria.adults} Adult{searchCriteria.adults > 1 ? 's' : ''}
                      {searchCriteria.children ? `, ${searchCriteria.children} Child${searchCriteria.children > 1 ? 'ren' : ''}` : ''}
                    </span>
                  </div>
                  {alertType === 'vehicle' && searchCriteria.vehicle && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Vehicle:</span>
                      <span className="font-medium capitalize">{searchCriteria.vehicle.type}</span>
                    </div>
                  )}
                  {alertType === 'cabin' && searchCriteria.cabin && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cabin:</span>
                      <span className="font-medium capitalize">{searchCriteria.cabin.type}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Email Input */}
              <div>
                <label htmlFor="alert-email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="alert-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading || success}
                />
              </div>

              {/* Alert Duration Note */}
              <p className="text-xs text-gray-500 mt-3">
                ℹ️ Alert will be active for 30 days from your departure date
              </p>
            </div>

            {/* Footer Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAlert}
                disabled={loading || !email || success}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating...
                  </>
                ) : (
                  '🔔 Create Alert'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AvailabilityAlertButton;
