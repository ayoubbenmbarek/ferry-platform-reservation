import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import { RootState } from '../store';

// FerryHopper cabin type from search results
interface FerryCabin {
  type: string;
  code: string;
  name: string;
  price: number;
  currency: string;
  available: number;
  capacity: number;
  refund_type?: string;
  image_url?: string;
  original_type?: string;
}

// Selection for a single cabin type with quantity
export interface CabinTypeSelection {
  cabinId: number;  // Keep for backward compatibility (use hash of code)
  cabinCode: string;  // FerryHopper cabin code
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
  const [selectedJourney, setSelectedJourney] = useState<'outbound' | 'return'>('outbound');

  // Notify me states
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);
  const [alertCreated, setAlertCreated] = useState(false);
  const [alertEmail, setAlertEmail] = useState(user?.email || '');

  // Helper to generate a numeric ID from cabin code (for backward compatibility)
  const codeToId = (code: string | undefined): number => {
    if (!code) return 0;
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };

  // Get ferry cabins for current journey - use FerryHopper cabin types directly
  // Memoize to ensure stable codes across renders
  const ferryCabins = useMemo((): FerryCabin[] => {
    const cabinData = selectedJourney === 'outbound' ? ferryCabinAvailability : returnFerryCabinAvailability;
    if (!cabinData || cabinData.length === 0) {
      return [];
    }
    // Filter to only show actual cabins (not deck seats) with availability
    // Also ensure each cabin has a unique code
    const seenCodes = new Set<string>();
    return cabinData
      .filter((cabin: FerryCabin) => cabin.available > 0 || cabin.type !== 'deck')
      .map((cabin: FerryCabin, index: number) => {
        // Generate unique code if empty or duplicate
        let uniqueCode = cabin.code;
        if (!uniqueCode || seenCodes.has(uniqueCode)) {
          uniqueCode = `${cabin.type}_${cabin.name}_${index}`;
        }
        seenCodes.add(uniqueCode);
        return { ...cabin, code: uniqueCode };
      });
  }, [selectedJourney, ferryCabinAvailability, returnFerryCabinAvailability]);

  // Track quantity per cabin code for each journey - initialize from props
  const [outboundCabinQuantities, setOutboundCabinQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    if (!ferryCabinAvailability || !Array.isArray(ferryCabinAvailability)) return initial;
    initialOutboundSelections.forEach(s => {
      // Try to match by cabinId (hash of code)
      const matchingCabin = ferryCabinAvailability.find((c: FerryCabin) => c?.code && codeToId(c.code) === s.cabinId);
      if (matchingCabin?.code && s.quantity > 0) {
        initial[matchingCabin.code] = s.quantity;
      }
    });
    return initial;
  });
  const [returnCabinQuantities, setReturnCabinQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    if (!returnFerryCabinAvailability || !Array.isArray(returnFerryCabinAvailability)) return initial;
    initialReturnSelections.forEach(s => {
      const matchingCabin = returnFerryCabinAvailability.find((c: FerryCabin) => c?.code && codeToId(c.code) === s.cabinId);
      if (matchingCabin?.code && s.quantity > 0) {
        initial[matchingCabin.code] = s.quantity;
      }
    });
    return initial;
  });

  const getCabinIcon = (cabinType: string) => {
    const type = cabinType.toLowerCase();
    switch (type) {
      case 'deck':
      case 'seat':
        return '🪑';
      case 'interior':
      case 'inside':
        return '🛏️';
      case 'exterior':
      case 'outside':
        return '🪟';
      case 'balcony':
        return '🌊';
      case 'suite':
        return '👑';
      default:
        return '🛏️';
    }
  };

  const getCabinTypeName = (cabinType: string) => {
    const type = cabinType.toLowerCase();
    const names: { [key: string]: string } = {
      deck: 'Deck Passage',
      seat: 'Reclining Seat',
      interior: 'Inside Cabin',
      inside: 'Inside Cabin',
      exterior: 'Outside Cabin',
      outside: 'Outside Cabin',
      balcony: 'Balcony Cabin',
      suite: 'Suite',
    };
    return names[type] || cabinType;
  };

  // Get current journey's cabin quantities
  const cabinQuantities = selectedJourney === 'outbound' ? outboundCabinQuantities : returnCabinQuantities;
  const setCabinQuantities = selectedJourney === 'outbound' ? setOutboundCabinQuantities : setReturnCabinQuantities;

  // Calculate total cabins and total price for current journey using FerryHopper cabin data
  const getTotalCabinsAndPrice = () => {
    let totalCabins = 0;
    let totalPrice = 0;

    Object.entries(cabinQuantities).forEach(([cabinCode, qty]) => {
      if (qty > 0) {
        const cabin = ferryCabins.find(c => c.code === cabinCode);
        if (cabin) {
          totalCabins += qty;
          totalPrice += cabin.price * qty;
        }
      }
    });

    return { totalCabins, totalPrice };
  };

  // Get selections for multi-cabin callback using FerryHopper cabin data
  const getSelections = (): CabinTypeSelection[] => {
    const selections: CabinTypeSelection[] = [];
    Object.entries(cabinQuantities).forEach(([cabinCode, qty]) => {
      if (qty > 0) {
        const cabin = ferryCabins.find(c => c.code === cabinCode);
        if (cabin) {
          selections.push({
            cabinId: codeToId(cabin.code),  // Generate numeric ID for backward compatibility
            cabinCode: cabin.code,
            cabinName: cabin.name,
            cabinType: cabin.type,
            quantity: qty,
            pricePerCabin: cabin.price,
            totalPrice: cabin.price * qty,
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

  const handleQuantityChange = (cabinCode: string, quantity: number) => {
    setCabinQuantities(prev => {
      const newQuantities = {
        ...prev,
        [cabinCode]: quantity
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

  // After quantity change, notify parent
  // Note: Only depend on quantities and journey - ferryCabins is derived and would cause infinite loop
  useEffect(() => {
    notifyParent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outboundCabinQuantities, returnCabinQuantities, selectedJourney]);

  const { totalCabins, totalPrice } = getTotalCabinsAndPrice();

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
        {/* Cabin Options - Using FerryHopper cabin types directly */}
        {ferryCabins.map((cabin) => {
          const quantity = cabinQuantities[cabin.code] || 0;
          const cabinTotalPrice = cabin.price * quantity;
          const isUnavailable = cabin.available === 0;
          const maxAvailable = Math.min(cabin.available, 10); // Cap at 10 per type

          return (
            <div
              key={cabin.code}
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
                  <span className="text-2xl">{getCabinIcon(cabin.type)}</span>
                  {isUnavailable && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">
                      Unavailable
                    </span>
                  )}
                  {cabin.available > 0 && cabin.available <= 5 && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-medium">
                      {cabin.available} left
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
                    €{cabin.price.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-500 block">per cabin</span>
                </div>
              </div>

              {/* Content area - grows to fill space */}
              <div className="flex-1">
                <h4 className="font-semibold">{cabin.name}</h4>
                <p className="text-xs text-gray-500 mt-1">
                  {getCabinTypeName(cabin.type)} • Max {cabin.capacity} person{cabin.capacity > 1 ? 's' : ''}
                </p>

                {/* Refund type badge */}
                {cabin.refund_type && (
                  <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${
                    cabin.refund_type === 'REFUNDABLE'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {cabin.refund_type === 'REFUNDABLE' ? '✓ Refundable' : 'Non-refundable'}
                  </span>
                )}
              </div>

              {/* Quantity Selector - Always at bottom */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Quantity:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleQuantityChange(cabin.code, Math.max(0, quantity - 1))}
                      disabled={isUnavailable || quantity === 0}
                      className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-semibold text-lg">{quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(cabin.code, Math.min(maxAvailable, quantity + 1))}
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

      {/* Show Notify Me when no cabins available on the ferry */}
      {ferryCabins.length === 0 && (
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
