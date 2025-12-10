import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import { RootState } from '../store';

interface Cabin {
  id: number;
  name: string;
  description: string;
  cabin_type: string;
  bed_type: string;
  max_occupancy: number;
  has_private_bathroom: boolean;
  has_tv: boolean;
  has_minibar: boolean;
  has_air_conditioning: boolean;
  has_wifi: boolean;
  is_accessible: boolean;
  base_price: number;
  currency: string;
  is_available: boolean;
}

// Selection for a single cabin type with quantity
export interface CabinTypeSelection {
  cabinId: number;
  cabinName: string;
  cabinType: string;
  quantity: number;
  pricePerCabin: number;
  totalPrice: number;
}

interface CabinSelectorProps {
  selectedCabinId: number | null;
  selectedReturnCabinId?: number | null;
  onCabinSelect: (cabinId: number | null, price: number, quantity: number, journey?: 'outbound' | 'return') => void;
  // New prop for multi-cabin selection
  onMultiCabinSelect?: (selections: CabinTypeSelection[], journey: 'outbound' | 'return') => void;
  passengerCount: number;
  isRoundTrip?: boolean;
  ferryCabinAvailability?: any[];  // Cabin availability from selected ferry
  returnFerryCabinAvailability?: any[];  // Cabin availability from return ferry
  // Initial cabin selections from Redux (for persistence across navigation)
  initialOutboundSelections?: { cabinId: number; quantity: number; price: number }[];
  initialReturnSelections?: { cabinId: number; quantity: number; price: number }[];
  // For notify me feature
  departurePort?: string;
  arrivalPort?: string;
  departureDate?: string;
  operator?: string;
}

const CabinSelector: React.FC<CabinSelectorProps> = ({
  selectedCabinId,
  selectedReturnCabinId,
  onCabinSelect,
  onMultiCabinSelect,
  passengerCount,
  isRoundTrip = false,
  ferryCabinAvailability = [],
  returnFerryCabinAvailability = [],
  initialOutboundSelections = [],
  initialReturnSelections = [],
  departurePort,
  arrivalPort,
  departureDate,
  operator,
}) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<'outbound' | 'return'>('outbound');

  // Notify me states
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);
  const [alertCreated, setAlertCreated] = useState(false);
  const [alertEmail, setAlertEmail] = useState(user?.email || '');

  // Track quantity per cabin ID for each journey - initialize from props
  const [outboundCabinQuantities, setOutboundCabinQuantities] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {};
    initialOutboundSelections.forEach(s => {
      if (s.cabinId && s.quantity > 0) {
        initial[s.cabinId] = s.quantity;
      }
    });
    return initial;
  });
  const [returnCabinQuantities, setReturnCabinQuantities] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {};
    initialReturnSelections.forEach(s => {
      if (s.cabinId && s.quantity > 0) {
        initial[s.cabinId] = s.quantity;
      }
    });
    return initial;
  });

  useEffect(() => {
    fetchCabins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passengerCount]);

  const fetchCabins = async () => {
    try {
      setLoading(true);
      const response = await api.get('/cabins', {
        params: {
          is_available: true,
          min_occupancy: Math.min(passengerCount, 1),
        },
      });
      setCabins(response.data);
    } catch (err: any) {
      setError('Failed to load cabin options');
      console.error('Error fetching cabins:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCabinIcon = (cabinType: string) => {
    switch (cabinType) {
      case 'SEAT':
        return '🪑';
      case 'INSIDE':
        return '🛏️';
      case 'OUTSIDE':
        return '🪟';
      case 'BALCONY':
        return '🌊';
      case 'SUITE':
        return '👑';
      default:
        return '🏠';
    }
  };

  const getCabinTypeName = (cabinType: string) => {
    const names: { [key: string]: string } = {
      SEAT: 'Reclining Seat',
      INSIDE: 'Inside Cabin',
      OUTSIDE: 'Outside Cabin',
      BALCONY: 'Balcony Cabin',
      SUITE: 'Suite',
    };
    return names[cabinType] || cabinType;
  };

  // Get current journey's cabin quantities
  const cabinQuantities = selectedJourney === 'outbound' ? outboundCabinQuantities : returnCabinQuantities;
  const setCabinQuantities = selectedJourney === 'outbound' ? setOutboundCabinQuantities : setReturnCabinQuantities;

  // Check if a cabin type is available on the selected ferry
  const getCabinAvailability = (cabinType: string) => {
    const availabilityData = selectedJourney === 'outbound' ? ferryCabinAvailability : returnFerryCabinAvailability;

    // If no availability data provided, assume all cabins are available (backward compatibility)
    if (!availabilityData || availabilityData.length === 0) {
      return { available: true, count: 999 };
    }

    // Map cabin types to ferry API types
    const typeMapping: { [key: string]: string } = {
      'INSIDE': 'interior',
      'OUTSIDE': 'exterior',
      'BALCONY': 'balcony',
      'SUITE': 'suite',
      'SEAT': 'deck',
    };

    const ferryType = typeMapping[cabinType];
    if (!ferryType) return { available: false, count: 0 }; // Unknown type, treat as unavailable

    const cabinInfo = availabilityData.find((c: any) => c.type === ferryType);
    if (!cabinInfo) return { available: false, count: 0 }; // Not found in ferry data = unavailable

    return {
      available: cabinInfo.available > 0,
      count: cabinInfo.available || 0
    };
  };

  // Calculate total cabins and total price for current journey
  const getTotalCabinsAndPrice = () => {
    let totalCabins = 0;
    let totalPrice = 0;

    Object.entries(cabinQuantities).forEach(([cabinId, qty]) => {
      if (qty > 0) {
        const cabin = cabins.find(c => c.id === Number(cabinId));
        if (cabin) {
          totalCabins += qty;
          totalPrice += cabin.base_price * qty;
        }
      }
    });

    return { totalCabins, totalPrice };
  };

  // Get selections for multi-cabin callback
  const getSelections = (): CabinTypeSelection[] => {
    const selections: CabinTypeSelection[] = [];
    Object.entries(cabinQuantities).forEach(([cabinId, qty]) => {
      if (qty > 0) {
        const cabin = cabins.find(c => c.id === Number(cabinId));
        if (cabin) {
          selections.push({
            cabinId: cabin.id,
            cabinName: cabin.name,
            cabinType: cabin.cabin_type,
            quantity: qty,
            pricePerCabin: cabin.base_price,
            totalPrice: cabin.base_price * qty,
          });
        }
      }
    });
    return selections;
  };

  // Notify parent of changes
  const notifyParent = () => {
    const { totalPrice: tp, totalCabins: tc } = getTotalCabinsAndPrice();
    const selections = getSelections();

    if (onMultiCabinSelect) {
      onMultiCabinSelect(selections, selectedJourney);
    }

    // For backward compatibility, also call onCabinSelect with the first selected cabin
    if (selections.length > 0) {
      onCabinSelect(selections[0].cabinId, tp, tc, selectedJourney);
    } else {
      onCabinSelect(null, 0, 0, selectedJourney);
    }
  };

  const handleQuantityChange = (cabinId: number, quantity: number) => {
    setCabinQuantities(prev => {
      const newQuantities = {
        ...prev,
        [cabinId]: quantity
      };
      return newQuantities;
    });
  };

  const handleClearAll = () => {
    setCabinQuantities({});
  };

  // Handle creating cabin availability alert
  const handleCreateCabinAlert = async () => {
    if (!alertEmail) {
      window.alert('Please enter your email to receive notifications.');
      return;
    }

    if (!departurePort || !arrivalPort || !departureDate) {
      window.alert('Missing journey details for creating alert.');
      return;
    }

    setIsCreatingAlert(true);
    try {
      await api.post('/availability-alerts', {
        alert_type: 'cabin',
        email: alertEmail,
        departure_port: departurePort.toLowerCase(),
        arrival_port: arrivalPort.toLowerCase(),
        departure_date: departureDate,
        is_round_trip: false,
        operator: operator || undefined,
        num_adults: passengerCount,
        num_children: 0,
        num_infants: 0,
        alert_duration_days: 30,
      });
      setAlertCreated(true);
    } catch (err: any) {
      window.alert(err.response?.data?.detail || 'Failed to create alert. Please try again.');
    } finally {
      setIsCreatingAlert(false);
    }
  };

  // After quantity change, notify parent - MUST be before early returns
  useEffect(() => {
    if (!loading && cabins.length > 0) {
      notifyParent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outboundCabinQuantities, returnCabinQuantities, cabins]);

  const { totalCabins, totalPrice } = getTotalCabinsAndPrice();

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading cabin options...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Select Cabins (Optional)</h3>
        {totalCabins > 0 && (
          <button
            onClick={handleClearAll}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Journey Tabs for Round Trip */}
      {isRoundTrip && (
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setSelectedJourney('outbound')}
            className={`px-4 py-2 font-medium transition-colors ${
              selectedJourney === 'outbound'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🚢 Outbound (Aller)
          </button>
          <button
            onClick={() => setSelectedJourney('return')}
            className={`px-4 py-2 font-medium transition-colors ${
              selectedJourney === 'return'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🔙 Return (Retour)
          </button>
        </div>
      )}

      {/* Info about cabin selection */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">👥 {passengerCount} passenger(s)</span> — Select as many cabins as you need. You can choose different cabin types.
        </p>
      </div>

      {/* Selection Summary */}
      {totalCabins > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-900">
                {selectedJourney === 'outbound' ? '🚢 Outbound' : '🔙 Return'} Cabin Selection
              </p>
              <div className="text-sm text-green-800 mt-1">
                {getSelections().map((sel, i) => (
                  <span key={sel.cabinId}>
                    {i > 0 && ' + '}
                    {sel.quantity}× {sel.cabinName}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-green-700">{totalCabins} cabin(s)</p>
              <p className="text-xl font-bold text-green-700">€{totalPrice.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
        {/* Cabin Options */}
        {cabins.map((cabin) => {
          const quantity = cabinQuantities[cabin.id] || 0;
          const cabinTotalPrice = cabin.base_price * quantity;
          const availability = getCabinAvailability(cabin.cabin_type);
          const isUnavailable = !availability.available;
          const maxAvailable = Math.min(availability.count, 10); // Cap at 10 per type

          return (
            <div
              key={cabin.id}
              className={`border-2 rounded-lg p-4 transition-all flex flex-col ${
                isUnavailable
                  ? 'border-gray-200 bg-gray-50 opacity-60'
                  : quantity > 0
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-blue-300'
              }`}
            >
              {/* Header with icon and price */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getCabinIcon(cabin.cabin_type)}</span>
                  {isUnavailable && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">
                      Unavailable
                    </span>
                  )}
                  {quantity > 0 && (
                    <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-medium">
                      {quantity} selected
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-blue-600">
                    €{cabin.base_price.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-500 block">per cabin</span>
                </div>
              </div>

              {/* Content area - grows to fill space */}
              <div className="flex-1">
                <h4 className="font-semibold">{cabin.name}</h4>
                <p className="text-xs text-gray-500 mt-1">
                  {getCabinTypeName(cabin.cabin_type)} • {cabin.bed_type.toLowerCase()} • Max{' '}
                  {cabin.max_occupancy} persons
                </p>

                {cabin.description && (
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{cabin.description}</p>
                )}

                {/* Amenities */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {cabin.has_private_bathroom && (
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">🚿</span>
                  )}
                  {cabin.has_wifi && (
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">📶</span>
                  )}
                  {cabin.has_tv && (
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">📺</span>
                  )}
                  {cabin.has_minibar && (
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">🍾</span>
                  )}
                  {cabin.is_accessible && (
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">♿</span>
                  )}
                </div>
              </div>

              {/* Quantity Selector - Always at bottom */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Quantity:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleQuantityChange(cabin.id, Math.max(0, quantity - 1))}
                      disabled={isUnavailable || quantity === 0}
                      className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-semibold text-lg">{quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(cabin.id, Math.min(maxAvailable, quantity + 1))}
                      disabled={isUnavailable || quantity >= maxAvailable}
                      className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
                {quantity > 0 && (
                  <div className="mt-2 text-right text-sm text-green-700 font-medium">
                    Subtotal: €{cabinTotalPrice.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Show Notify Me when no cabins in DB OR when all cabins are unavailable on ferry */}
      {(cabins.length === 0 || (cabins.length > 0 && cabins.every(cabin => !getCabinAvailability(cabin.cabin_type).available))) && (
        <div className="text-center py-8">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">No cabins available at the moment</h4>
            <p className="text-sm text-gray-600 mb-4">
              Cabins may become available as the departure date approaches. Get notified when a cabin is available.
            </p>

            {alertCreated ? (
              <div className="flex items-center justify-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Alert created! We'll notify you.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {!user && (
                  <input
                    type="email"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                )}
                <button
                  onClick={handleCreateCabinAlert}
                  disabled={isCreatingAlert || !departurePort || !arrivalPort || !departureDate}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingAlert ? (
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      Notify Me When Available
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CabinSelector;
