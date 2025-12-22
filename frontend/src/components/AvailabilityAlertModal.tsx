import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import api from '../services/api';

interface FerryInfo {
  sailingId: string;
  operator: string;
  departureTime: string;
}

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  ferry: FerryInfo | null;
  alertType: 'passenger' | 'vehicle' | 'cabin';
  searchParams: {
    departurePort?: string;
    arrivalPort?: string;
    departureDate?: string;
    returnDate?: string;
    returnDeparturePort?: string;
    returnArrivalPort?: string;
    passengers?: {
      adults?: number;
      children?: number;
      infants?: number;
    };
    vehicles?: Array<{
      type?: string;
      length?: number;
    }>;
  };
  isSelectingReturn: boolean;
  onSuccess?: (message: string) => void;
}

const AvailabilityAlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  ferry,
  alertType,
  searchParams,
  isSelectingReturn,
  onSuccess,
}) => {
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedCabinType, setSelectedCabinType] = useState<string>('any');

  // Available cabin types for alerts
  const cabinTypeOptions = [
    { value: 'any', label: 'Any cabin type', icon: '🛏️' },
    { value: 'shared', label: 'Bed in shared cabin', icon: '🛌', note: 'Share with same-sex passengers' },
    { value: 'interior', label: 'Inside cabin (private)', icon: '🛏️' },
    { value: 'exterior', label: 'Outside cabin (private)', icon: '🪟' },
    { value: 'pet', label: 'Pet-friendly cabin', icon: '🐾', note: 'Required if traveling with a pet' },
    { value: 'balcony', label: 'Balcony cabin', icon: '🌊' },
    { value: 'suite', label: 'Suite', icon: '👑' },
  ];

  // Auto-fill email if user is logged in
  useEffect(() => {
    if (isAuthenticated && user?.email) {
      setEmail(user.email);
    }
  }, [isAuthenticated, user]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setSuccess(false);
      setSelectedCabinType('any');
      if (!isAuthenticated) {
        setEmail('');
      }
    }
  }, [isOpen, isAuthenticated]);

  if (!isOpen || !ferry) return null;

  const handleCreateAlert = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Extract sailing time from ferry departure time (HH:MM format)
      const sailingTime = ferry.departureTime
        ? new Date(ferry.departureTime).toTimeString().slice(0, 5)  // "HH:MM"
        : undefined;

      const alertData: any = {
        alert_type: alertType,
        email: email,
        departure_port: isSelectingReturn
          ? (searchParams.returnDeparturePort || searchParams.arrivalPort || '')
          : (searchParams.departurePort || ''),
        arrival_port: isSelectingReturn
          ? (searchParams.returnArrivalPort || searchParams.departurePort || '')
          : (searchParams.arrivalPort || ''),
        departure_date: isSelectingReturn
          ? (searchParams.returnDate || searchParams.departureDate || '')
          : (searchParams.departureDate || ''),
        is_round_trip: !!searchParams.returnDate && !isSelectingReturn,
        return_date: !isSelectingReturn ? searchParams.returnDate : null,
        operator: ferry.operator,
        sailing_time: sailingTime,
        num_adults: searchParams.passengers?.adults || 1,
        num_children: searchParams.passengers?.children || 0,
        num_infants: searchParams.passengers?.infants || 0,
        alert_duration_days: 30,
      };

      // Add type-specific fields
      if (alertType === 'vehicle' && searchParams.vehicles && searchParams.vehicles.length > 0) {
        alertData.vehicle_type = searchParams.vehicles[0].type || 'car';
        alertData.vehicle_length_cm = searchParams.vehicles[0].length || 450;
      } else if (alertType === 'cabin') {
        // Use selected cabin type, or null for "any"
        alertData.cabin_type = selectedCabinType === 'any' ? null : selectedCabinType;
        alertData.num_cabins = 1;
      }

      await api.post('/availability-alerts', alertData);

      setSuccess(true);
      const typeLabel = alertType === 'vehicle' ? 'vehicle space' : alertType === 'cabin' ? 'cabins' : 'seats';
      const timeLabel = sailingTime ? ` at ${sailingTime}` : '';

      setTimeout(() => {
        onSuccess?.(`✅ Alert created for ${ferry.operator}${timeLabel}! We'll notify you when ${typeLabel} become available.`);
        onClose();
        setSuccess(false);
        if (!isAuthenticated) {
          setEmail('');
        }
      }, 1500);

    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.response?.data?.message || 'Failed to create alert';
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

  const departurePort = isSelectingReturn
    ? (searchParams.returnDeparturePort || searchParams.arrivalPort || '')
    : (searchParams.departurePort || '');
  const arrivalPort = isSelectingReturn
    ? (searchParams.returnArrivalPort || searchParams.departurePort || '')
    : (searchParams.arrivalPort || '');
  const departureDate = isSelectingReturn
    ? (searchParams.returnDate || searchParams.departureDate || '')
    : (searchParams.departureDate || '');
  const sailingTime = ferry.departureTime
    ? new Date(ferry.departureTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">🔔</span>
            Get Availability Alert
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg animate-slideDown">
            <div className="flex items-center text-green-800">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Alert created successfully!</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg animate-slideDown">
            <div className="text-red-800 text-sm">{error}</div>
          </div>
        )}

        {/* Content */}
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            We'll check every few hours and email you when <strong>{getAlertTypeLabel()}</strong> becomes available for this specific ferry.
          </p>

          {/* Ferry & Route Summary */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 mb-4 border border-blue-100">
            <div className="text-sm space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-blue-200">
                <span className="text-gray-600 font-medium">Ferry Operator:</span>
                <span className="font-bold text-blue-700">{ferry.operator}</span>
              </div>
              {sailingTime && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Sailing Time:</span>
                  <span className="font-semibold text-gray-900">{sailingTime}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Route:</span>
                <span className="font-medium capitalize">
                  {departurePort} → {arrivalPort}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium">{departureDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Passengers:</span>
                <span className="font-medium">
                  {searchParams.passengers?.adults || 1} Adult{(searchParams.passengers?.adults || 1) > 1 ? 's' : ''}
                  {searchParams.passengers?.children ? `, ${searchParams.passengers.children} Child${searchParams.passengers.children > 1 ? 'ren' : ''}` : ''}
                </span>
              </div>
              {alertType === 'vehicle' && searchParams.vehicles && searchParams.vehicles.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Vehicle:</span>
                  <span className="font-medium capitalize">{searchParams.vehicles[0].type || 'Car'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Cabin Type Selector - only for cabin alerts */}
          {alertType === 'cabin' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Cabin Type
              </label>
              <div className="space-y-2">
                {cabinTypeOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedCabinType === option.value
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cabinType"
                      value={option.value}
                      checked={selectedCabinType === option.value}
                      onChange={(e) => setSelectedCabinType(e.target.value)}
                      className="sr-only"
                      disabled={loading || success}
                    />
                    <span className="text-lg mr-2">{option.icon}</span>
                    <div className="flex-1">
                      <span className={`font-medium ${selectedCabinType === option.value ? 'text-blue-700' : 'text-gray-900'}`}>
                        {option.label}
                      </span>
                      {option.note && (
                        <p className="text-xs text-gray-500 mt-0.5">{option.note}</p>
                      )}
                    </div>
                    {selectedCabinType === option.value && (
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Email Input */}
          <div>
            <label htmlFor="alert-email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address {isAuthenticated && <span className="text-green-600 text-xs">(from your account)</span>}
            </label>
            <input
              id="alert-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              readOnly={isAuthenticated}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isAuthenticated ? 'bg-gray-50 text-gray-700 cursor-not-allowed' : 'border-gray-300'
              }`}
              disabled={loading || success}
            />
            {!isAuthenticated && (
              <p className="text-xs text-gray-500 mt-1">
                💡 Tip: Sign in to automatically use your account email
              </p>
            )}
          </div>

          {/* Alert Duration Note */}
          <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
            <span>ℹ️</span>
            <span>Alert will be active for 30 days from your departure date</span>
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleCreateAlert}
            disabled={loading || !email || success}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </>
            ) : success ? (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Created!
              </>
            ) : (
              '🔔 Create Alert'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityAlertModal;
