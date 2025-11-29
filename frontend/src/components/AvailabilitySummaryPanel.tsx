import React, { useState } from 'react';
import api from '../services/api';

interface AvailabilityStatus {
  type: 'passenger' | 'vehicle' | 'cabin';
  status: 'available' | 'limited' | 'unavailable';
  count: number;
  emoji: string;
  label: string;
}

interface AvailabilitySummaryPanelProps {
  searchResults: any[];
  searchCriteria: {
    departurePort: string;
    arrivalPort: string;
    departureDate: string;
    isRoundTrip?: boolean;
    returnDate?: string;
    adults: number;
    children?: number;
    infants?: number;
    vehicles?: any[];
  };
  userEmail?: string; // If user is logged in
  onAlertCreated?: () => void;
}

const AvailabilitySummaryPanel: React.FC<AvailabilitySummaryPanelProps> = ({
  searchResults,
  searchCriteria,
  userEmail,
  onAlertCreated
}) => {
  const [email, setEmail] = useState(userEmail || '');
  const [showEmailInput, setShowEmailInput] = useState<string | null>(null); // Which alert type is showing email input
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Analyze search results to determine availability
  const analyzeAvailability = (): AvailabilityStatus[] => {
    const statuses: AvailabilityStatus[] = [];

    if (searchResults.length === 0) {
      return [];
    }

    // Analyze passenger availability
    const totalPassengers = searchCriteria.adults + (searchCriteria.children || 0) + (searchCriteria.infants || 0);
    let passengersAvailable = 0;
    let maxPassengerSpaces = 0;

    searchResults.forEach((ferry: any) => {
      const spaces = ferry.available_spaces?.passengers || ferry.availableSpaces?.passengers || 0;
      maxPassengerSpaces = Math.max(maxPassengerSpaces, spaces);
      if (spaces >= totalPassengers) {
        passengersAvailable++;
      }
    });

    if (passengersAvailable === 0) {
      statuses.push({
        type: 'passenger',
        status: 'unavailable',
        count: 0,
        emoji: '🔔',
        label: `No seats for ${totalPassengers} passenger${totalPassengers > 1 ? 's' : ''}`
      });
    } else if (maxPassengerSpaces <= 10) {
      statuses.push({
        type: 'passenger',
        status: 'limited',
        count: maxPassengerSpaces,
        emoji: '⚠️',
        label: `Limited seats (only ${maxPassengerSpaces} left)`
      });
    }

    // Analyze vehicle availability (only if user searched with vehicles)
    if (searchCriteria.vehicles && searchCriteria.vehicles.length > 0) {
      let vehiclesAvailable = 0;
      let maxVehicleSpaces = 0;

      searchResults.forEach((ferry: any) => {
        const spaces = ferry.available_spaces?.vehicles || ferry.availableSpaces?.vehicles || 0;
        maxVehicleSpaces = Math.max(maxVehicleSpaces, spaces);
        if (spaces >= searchCriteria.vehicles!.length) {
          vehiclesAvailable++;
        }
      });

      if (vehiclesAvailable === 0) {
        statuses.push({
          type: 'vehicle',
          status: 'unavailable',
          count: 0,
          emoji: '🔔',
          label: `No vehicle spaces`
        });
      } else if (maxVehicleSpaces <= 5) {
        statuses.push({
          type: 'vehicle',
          status: 'limited',
          count: maxVehicleSpaces,
          emoji: '⚠️',
          label: `Limited vehicle spaces (only ${maxVehicleSpaces} left)`
        });
      }
    }

    // Analyze cabin availability
    // Check if any ferry has cabins available (excluding deck seats)
    let cabinsAvailable = 0;
    let maxCabinCount = 0;

    searchResults.forEach((ferry: any) => {
      const cabinTypes = ferry.cabin_types || ferry.cabinTypes || [];
      // Filter out deck seats, only count actual cabins
      const actualCabins = cabinTypes.filter((cabin: any) =>
        cabin.type !== 'deck' && cabin.type !== 'deck_seat'
      );

      if (actualCabins.length > 0) {
        const totalAvailableCabins = actualCabins.reduce((sum: number, cabin: any) =>
          sum + (cabin.available || 0), 0
        );
        maxCabinCount = Math.max(maxCabinCount, totalAvailableCabins);
        if (totalAvailableCabins > 0) {
          cabinsAvailable++;
        }
      }
    });

    // Show cabin status if user might want cabins (for overnight/long routes)
    // You can make this smarter by checking route duration or user preferences
    if (searchResults.length > 0) {
      if (cabinsAvailable === 0 && maxCabinCount === 0) {
        statuses.push({
          type: 'cabin',
          status: 'unavailable',
          count: 0,
          emoji: '🔔',
          label: `No cabins available`
        });
      } else if (maxCabinCount > 0 && maxCabinCount <= 2) {
        statuses.push({
          type: 'cabin',
          status: 'limited',
          count: maxCabinCount,
          emoji: '⚠️',
          label: `Limited cabins (only ${maxCabinCount} left)`
        });
      }
    }

    return statuses;
  };

  const handleQuickAlert = async (alertType: 'passenger' | 'vehicle' | 'cabin') => {
    // If logged in (has email), create alert immediately
    if (userEmail) {
      await createAlert(alertType, userEmail);
    } else {
      // Show email input for this alert type
      setShowEmailInput(alertType);
    }
  };

  const handleEmailSubmit = async (alertType: 'passenger' | 'vehicle' | 'cabin') => {
    if (!email) {
      showToast('Please enter your email address', 'error');
      return;
    }
    await createAlert(alertType, email);
    setShowEmailInput(null);
  };

  const createAlert = async (alertType: 'passenger' | 'vehicle' | 'cabin', emailAddress: string) => {
    setLoading(true);
    try {
      const alertData: any = {
        alert_type: alertType,
        email: emailAddress,
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
      if (alertType === 'vehicle' && searchCriteria.vehicles && searchCriteria.vehicles.length > 0) {
        alertData.vehicle_type = searchCriteria.vehicles[0].type || 'car';
        alertData.vehicle_length_cm = searchCriteria.vehicles[0].length || 450;
      } else if (alertType === 'cabin') {
        alertData.cabin_type = 'inside';
        alertData.num_cabins = 1;
      }

      await api.post('/availability-alerts', alertData);

      const typeLabel = alertType === 'vehicle' ? 'vehicles' : alertType === 'cabin' ? 'cabins' : 'seats';
      showToast(`✅ We'll notify you when ${typeLabel} become available!`, 'success');
      onAlertCreated?.();
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.response?.data?.message || 'Failed to create alert';
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const availability = analyzeAvailability();

  // Don't show panel if everything is available
  if (availability.length === 0) {
    return null;
  }

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className={`rounded-lg shadow-lg p-4 ${
            toastMessage.startsWith('✅') ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`font-medium ${
              toastMessage.startsWith('✅') ? 'text-green-800' : 'text-red-800'
            }`}>
              {toastMessage}
            </p>
          </div>
        </div>
      )}

      {/* Availability Summary Panel */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Not finding what you need?
            </h3>

            <div className="space-y-2">
              {availability.map((item) => (
                <div key={item.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{item.emoji}</span>
                    <span className={`text-sm ${
                      item.status === 'unavailable' ? 'text-red-700 font-medium' : 'text-yellow-700 font-medium'
                    }`}>
                      {item.label}
                    </span>
                  </div>

                  {showEmailInput === item.type ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading}
                      />
                      <button
                        onClick={() => handleEmailSubmit(item.type)}
                        disabled={loading || !email}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      >
                        {loading ? '...' : 'Notify'}
                      </button>
                      <button
                        onClick={() => setShowEmailInput(null)}
                        className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleQuickAlert(item.type)}
                      disabled={loading}
                      className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      Notify me
                    </button>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-600 mt-3">
              We'll check every few hours and email you when availability opens up
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default AvailabilitySummaryPanel;
