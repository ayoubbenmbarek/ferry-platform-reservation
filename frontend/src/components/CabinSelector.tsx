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

    // Debug: Log received cabin data
    console.log('[CabinSelector] Raw cabin data received:', cabinData?.length || 0, 'cabins');
    if (cabinData?.length > 0) {
      console.log('[CabinSelector] First 3 cabins:', cabinData.slice(0, 3).map((c: any) => ({
        type: c.type,
        name: c.name,
        capacity: c.capacity,
        original_type: c.original_type
      })));
    }

    if (!cabinData || cabinData.length === 0) {
      return [];
    }

    // Keep ALL cabins - no filtering, just ensure unique codes
    const seenCodes = new Set<string>();
    const result = cabinData.map((cabin: FerryCabin, index: number) => {
      // Generate unique code if empty or duplicate
      let uniqueCode = cabin.code;
      if (!uniqueCode || seenCodes.has(uniqueCode)) {
        uniqueCode = `${cabin.type}_${cabin.name}_${index}`;
      }
      seenCodes.add(uniqueCode);
      return { ...cabin, code: uniqueCode };
    });

    console.log('[CabinSelector] Processed cabins:', result.length);
    return result;
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

  // Restore cabin selections when cabin availability data becomes available
  // This handles the case when initialSelections are provided but cabin data wasn't ready during useState initialization
  useEffect(() => {
    // Skip if no initial selections or no cabin data
    if (initialOutboundSelections.length === 0 || !ferryCabinAvailability?.length) {
      return;
    }

    // Use functional update to check current state and restore if empty
    setOutboundCabinQuantities(current => {
      const currentHasSelections = Object.values(current).some(q => q > 0);

      // Only restore if current state is empty
      if (!currentHasSelections) {
        const restored: Record<string, number> = {};
        initialOutboundSelections.forEach(s => {
          const matchingCabin = ferryCabinAvailability.find((c: FerryCabin) => c?.code && codeToId(c.code) === s.cabinId);
          if (matchingCabin?.code && s.quantity > 0) {
            restored[matchingCabin.code] = s.quantity;
          }
        });
        if (Object.keys(restored).length > 0) {
          console.log('[CabinSelector] Restored outbound selections:', restored);
          return restored;
        }
      }
      return current; // No change needed
    });
  }, [initialOutboundSelections, ferryCabinAvailability]);

  useEffect(() => {
    // Skip if no initial selections or no cabin data
    if (initialReturnSelections.length === 0 || !returnFerryCabinAvailability?.length) {
      return;
    }

    // Use functional update to check current state and restore if empty
    setReturnCabinQuantities(current => {
      const currentHasSelections = Object.values(current).some(q => q > 0);

      // Only restore if current state is empty
      if (!currentHasSelections) {
        const restored: Record<string, number> = {};
        initialReturnSelections.forEach(s => {
          const matchingCabin = returnFerryCabinAvailability.find((c: FerryCabin) => c?.code && codeToId(c.code) === s.cabinId);
          if (matchingCabin?.code && s.quantity > 0) {
            restored[matchingCabin.code] = s.quantity;
          }
        });
        if (Object.keys(restored).length > 0) {
          console.log('[CabinSelector] Restored return selections:', restored);
          return restored;
        }
      }
      return current; // No change needed
    });
  }, [initialReturnSelections, returnFerryCabinAvailability]);

  // Get category for grouping cabins
  const getCabinCategory = (cabinType: string, originalType?: string): string => {
    const type = cabinType.toLowerCase();
    const original = (originalType || '').toUpperCase();

    if (type === 'deck' || type === 'seat' || original.includes('SEAT') || original.includes('LOUNGE')) {
      return 'seats';
    }
    if (type === 'suite' || original.includes('SUITE')) {
      return 'suites';
    }
    if (type === 'pet' || original.includes('PET')) {
      return 'pet_cabins';
    }
    if (type === 'exterior' || type === 'outside' || original.includes('WINDOW')) {
      return 'outside_cabins';
    }
    if (type === 'shared' || type === 'berth' || type === 'dorm' || type === 'couchette') {
      return 'shared_cabins';
    }
    // Default to inside cabins
    return 'inside_cabins';
  };

  // Category display info
  const categoryInfo: { [key: string]: { icon: string; title: string; description: string; color: string } } = {
    seats: {
      icon: '🪑',
      title: 'Seats & Deck Passage',
      description: 'Standard seating included in your fare',
      color: 'gray'
    },
    inside_cabins: {
      icon: '🛏️',
      title: 'Inside Cabins',
      description: 'Private cabins without windows',
      color: 'blue'
    },
    outside_cabins: {
      icon: '🪟',
      title: 'Outside Cabins',
      description: 'Private cabins with sea view',
      color: 'cyan'
    },
    pet_cabins: {
      icon: '🐾',
      title: 'Pet-Friendly Cabins',
      description: 'Cabins where pets are welcome',
      color: 'green'
    },
    suites: {
      icon: '👑',
      title: 'Suites',
      description: 'Premium cabins with extra amenities',
      color: 'purple'
    },
    shared_cabins: {
      icon: '🛌',
      title: 'Shared Cabins',
      description: 'Beds in shared dormitory cabins',
      color: 'orange'
    }
  };

  // Group cabins by category
  const groupedCabins = useMemo(() => {
    const groups: { [key: string]: FerryCabin[] } = {};
    const categoryOrder = ['seats', 'inside_cabins', 'outside_cabins', 'pet_cabins', 'suites', 'shared_cabins'];

    // Initialize empty groups in order
    categoryOrder.forEach(cat => { groups[cat] = []; });

    // Group cabins
    ferryCabins.forEach(cabin => {
      const category = getCabinCategory(cabin.type, cabin.original_type);
      if (!groups[category]) groups[category] = [];
      groups[category].push(cabin);
    });

    // Sort each group by capacity then price
    Object.keys(groups).forEach(cat => {
      groups[cat].sort((a, b) => {
        if (a.capacity !== b.capacity) return a.capacity - b.capacity;
        return a.price - b.price;
      });
    });

    return groups;
  }, [ferryCabins]);

  const getCabinIcon = (cabinType: string, originalType?: string) => {
    const category = getCabinCategory(cabinType, originalType);
    return categoryInfo[category]?.icon || '🛏️';
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
      shared: 'Bed in Shared Cabin',
      berth: 'Bed in Shared Cabin',
      dorm: 'Bed in Shared Cabin',
      couchette: 'Bed in Shared Cabin',
      pet: 'Pet-Friendly Cabin',
    };
    return names[type] || cabinType;
  };

  // Check if cabin type allows pets
  const isPetCabinType = (cabinType: string): boolean => {
    return cabinType?.toLowerCase() === 'pet';
  };

  // Check if cabin type is a shared bed (not private cabin)
  const isSharedCabinType = (cabinType: string): boolean => {
    const type = cabinType.toLowerCase();
    return ['shared', 'berth', 'dorm', 'couchette', 'dormitory'].includes(type);
  };

  // Get current journey's cabin quantities
  const cabinQuantities = selectedJourney === 'outbound' ? outboundCabinQuantities : returnCabinQuantities;
  const setCabinQuantities = selectedJourney === 'outbound' ? setOutboundCabinQuantities : setReturnCabinQuantities;

  // Check if a cabin type is a base fare type (already included in route price)
  const isBaseFareType = (cabinType: string): boolean => {
    const type = cabinType.toLowerCase();
    return ['deck', 'seat', 'deck_seat', 'standard_seat', 'reclining_seat'].includes(type);
  };

  // Get the base deck/seat price (the fare already included in route price)
  const getBaseFarePrice = (): number => {
    const baseFareCabin = ferryCabins.find(c => isBaseFareType(c.type));
    return baseFareCabin?.price || 0;
  };

  // Calculate supplement for a cabin (upgrade cost over base fare)
  const getCabinSupplement = (cabin: FerryCabin): number => {
    // Base fare types (deck/seat) have no supplement - already included in route price
    if (isBaseFareType(cabin.type)) {
      return 0;
    }
    // For actual cabins, the supplement is the difference from base fare
    const baseFare = getBaseFarePrice();
    return Math.max(0, cabin.price - baseFare);
  };

  // Calculate total cabins and total supplement for current journey
  const getTotalCabinsAndPrice = () => {
    let totalCabins = 0;
    let totalPrice = 0;

    Object.entries(cabinQuantities).forEach(([cabinCode, qty]) => {
      if (qty > 0) {
        const cabin = ferryCabins.find(c => c.code === cabinCode);
        if (cabin) {
          totalCabins += qty;
          // Use supplement (upgrade cost) not full price
          totalPrice += getCabinSupplement(cabin) * qty;
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
          const supplement = getCabinSupplement(cabin);
          selections.push({
            cabinId: codeToId(cabin.code),  // Generate numeric ID for backward compatibility
            cabinCode: cabin.code,
            cabinName: cabin.name,
            cabinType: cabin.type,
            quantity: qty,
            pricePerCabin: supplement,  // Use supplement, not full price
            totalPrice: supplement * qty,
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

      {/* Grouped Cabin Display */}
      <div className="space-y-6">
        {Object.entries(groupedCabins).map(([category, cabins]) => {
          if (cabins.length === 0) return null;
          const info = categoryInfo[category];

          return (
            <div key={category} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Category Header */}
              <div className={`px-4 py-3 bg-gradient-to-r ${
                category === 'seats' ? 'from-gray-50 to-gray-100' :
                category === 'inside_cabins' ? 'from-blue-50 to-blue-100' :
                category === 'outside_cabins' ? 'from-cyan-50 to-cyan-100' :
                category === 'pet_cabins' ? 'from-green-50 to-green-100' :
                category === 'suites' ? 'from-purple-50 to-purple-100' :
                'from-orange-50 to-orange-100'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{info.icon}</span>
                  <div>
                    <h4 className="font-semibold text-gray-900">{info.title}</h4>
                    <p className="text-xs text-gray-600">{info.description}</p>
                  </div>
                  <span className="ml-auto text-sm text-gray-500 bg-white/50 px-2 py-1 rounded">
                    {cabins.length} option{cabins.length > 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Cabin Cards Grid */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {cabins.map((cabin) => {
                  const quantity = cabinQuantities[cabin.code] || 0;
                  const supplement = getCabinSupplement(cabin);
                  const cabinTotalSupplement = supplement * quantity;
                  const isBaseFare = isBaseFareType(cabin.type);
                  const isUnavailable = cabin.available === 0;
                  const maxAvailable = Math.min(cabin.available, 10);

                  return (
                    <div
                      key={cabin.code}
                      className={`border-2 rounded-lg overflow-hidden transition-all flex flex-col ${
                        isUnavailable
                          ? 'border-gray-200 bg-gray-50 opacity-60'
                          : quantity > 0
                          ? 'border-green-500 bg-green-50 shadow-md'
                          : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                      }`}
                    >
                      {/* Cabin Image */}
                      {cabin.image_url && (
                        <div className="relative h-28 bg-gray-100">
                          <img
                            src={cabin.image_url}
                            alt={cabin.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          {quantity > 0 && (
                            <div className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                              {quantity}×
                            </div>
                          )}
                        </div>
                      )}

                      <div className="p-3 flex-1 flex flex-col">
                        {/* Capacity Badge */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                            category === 'seats' ? 'bg-gray-100 text-gray-700' :
                            category === 'suites' ? 'bg-purple-100 text-purple-700' :
                            category === 'pet_cabins' ? 'bg-green-100 text-green-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            👤 {cabin.capacity} {cabin.capacity === 1 ? 'person' : 'people'}
                          </span>
                          {cabin.available > 0 && cabin.available <= 3 && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
                              {cabin.available} left!
                            </span>
                          )}
                        </div>

                        {/* Cabin Name */}
                        <h5 className="font-medium text-sm text-gray-900 line-clamp-2 mb-1">
                          {cabin.name}
                        </h5>

                        {/* Price */}
                        <div className="mt-auto pt-2">
                          {isBaseFare ? (
                            <div className="text-green-600 font-semibold text-sm">
                              ✓ Included in fare
                            </div>
                          ) : (
                            <div className="text-blue-600 font-bold">
                              +€{supplement.toFixed(0)}
                              <span className="text-xs font-normal text-gray-500 ml-1">
                                {isSharedCabinType(cabin.type) ? '/bed' : '/cabin'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Quantity Selector */}
                        <div className="mt-3 pt-2 border-t border-gray-100">
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => handleQuantityChange(cabin.code, Math.max(0, quantity - 1))}
                              disabled={isUnavailable || quantity === 0}
                              className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-gray-600"
                            >
                              −
                            </button>
                            <span className={`text-lg font-bold ${quantity > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                              {quantity}
                            </span>
                            <button
                              onClick={() => handleQuantityChange(cabin.code, Math.min(maxAvailable, quantity + 1))}
                              disabled={isUnavailable || quantity >= maxAvailable}
                              className="w-8 h-8 rounded-full border-2 border-blue-500 bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed font-bold"
                            >
                              +
                            </button>
                          </div>
                          {quantity > 0 && cabinTotalSupplement > 0 && (
                            <div className="mt-1 text-center text-xs text-green-700 font-medium">
                              +€{cabinTotalSupplement.toFixed(2)} total
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
