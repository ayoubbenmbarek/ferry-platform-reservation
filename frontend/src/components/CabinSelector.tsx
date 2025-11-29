import React, { useState, useEffect } from 'react';
import axios from 'axios';

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

interface CabinSelectorProps {
  selectedCabinId: number | null;
  selectedReturnCabinId?: number | null;
  onCabinSelect: (cabinId: number | null, price: number, quantity: number, journey?: 'outbound' | 'return') => void;
  passengerCount: number;
  isRoundTrip?: boolean;
  ferryCabinAvailability?: any[];  // Cabin availability from selected ferry
  returnFerryCabinAvailability?: any[];  // Cabin availability from return ferry
}

const CabinSelector: React.FC<CabinSelectorProps> = ({
  selectedCabinId,
  selectedReturnCabinId,
  onCabinSelect,
  passengerCount,
  isRoundTrip = false,
  ferryCabinAvailability = [],
  returnFerryCabinAvailability = [],
}) => {
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<'outbound' | 'return'>('outbound');
  const [cabinQuantities, setCabinQuantities] = useState<Record<number, number>>({}); // Track quantity per cabin ID

  useEffect(() => {
    fetchCabins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passengerCount]);

  const fetchCabins = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/v1/cabins', {
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

  const currentSelectedCabin = selectedJourney === 'outbound' ? selectedCabinId : selectedReturnCabinId;

  const handleCabinSelect = (cabinId: number | null, price: number) => {
    const quantity = cabinId === null ? 0 : (cabinQuantities[cabinId] || 1);
    onCabinSelect(cabinId, price, quantity, selectedJourney);
  };

  const handleQuantityChange = (cabinId: number, quantity: number) => {
    setCabinQuantities(prev => ({
      ...prev,
      [cabinId]: quantity
    }));
  };

  // Calculate maximum cabins allowed based on passenger count
  // Assuming average 2 passengers per cabin, round up
  const maxCabinsAllowed = Math.min(3, Math.ceil(passengerCount / 2));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Select Cabin (Optional)</h3>
        {currentSelectedCabin && (
          <button
            onClick={() => handleCabinSelect(null, 0)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear Selection
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

      {/* Info about cabin limits */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-amber-900">
          <span className="font-semibold">👥 {passengerCount} passenger(s)</span> — You can book up to{' '}
          <span className="font-semibold">{maxCabinsAllowed} cabin(s)</span> based on your party size.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
        {/* No Cabin Option */}
        <div
          onClick={() => handleCabinSelect(null, 0)}
          className={`border-2 rounded-lg p-4 cursor-pointer transition-all flex flex-col ${
            currentSelectedCabin === null
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">🎫</span>
            <span className="text-lg font-bold text-green-600">€0.00</span>
          </div>
          <h4 className="font-semibold">No Cabin</h4>
          <p className="text-sm text-gray-600 mt-1 flex-1">Deck seating included with ticket</p>
        </div>

        {/* Cabin Options */}
        {cabins.map((cabin) => {
          const quantity = cabinQuantities[cabin.id] || 1;
          const totalPrice = cabin.base_price * quantity;
          const isSelected = currentSelectedCabin === cabin.id;
          const availability = getCabinAvailability(cabin.cabin_type);
          const isUnavailable = !availability.available;

          return (
            <div
              key={cabin.id}
              className={`border-2 rounded-lg p-4 transition-all flex flex-col ${
                isUnavailable
                  ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                  : isSelected
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-300'
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
                </div>
                <div className="text-right">
                  {quantity > 1 ? (
                    <>
                      <div className="text-xs text-gray-500 line-through">
                        €{cabin.base_price.toFixed(2)}
                      </div>
                      <div className="text-lg font-bold text-blue-600">
                        €{totalPrice.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-600">
                        ({quantity} × €{cabin.base_price.toFixed(2)})
                      </div>
                    </>
                  ) : (
                    <span className="text-lg font-bold text-blue-600">
                      €{cabin.base_price.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* Content area - grows to fill space */}
              <div className="flex-1">
                <h4 className="font-semibold">{cabin.name}</h4>
                <p className="text-xs text-gray-500 mt-1">
                  {getCabinTypeName(cabin.cabin_type)} • {cabin.bed_type.toLowerCase()} • Max{' '}
                  {cabin.max_occupancy}
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

              {/* Quantity Selector and Select Button - Always at bottom */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <label className={`text-sm font-medium ${isUnavailable ? 'text-gray-400' : 'text-gray-700'}`}>
                    Qty:
                  </label>
                  <select
                    value={quantity}
                    onChange={(e) => handleQuantityChange(cabin.id, Number(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                    disabled={isUnavailable}
                    className="px-2 py-2 border-2 border-gray-300 rounded-lg text-sm font-semibold focus:outline-none focus:border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {[...Array(maxCabinsAllowed)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => !isUnavailable && handleCabinSelect(cabin.id, cabin.base_price)}
                    disabled={isUnavailable}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors text-center ${
                      isUnavailable
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : isSelected
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isSelected ? '✓ Selected' : 'Select'}
                  </button>
                </div>
              </div>
            </div>
        );
      })}
      </div>

      {cabins.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No cabins available for your party size.</p>
        </div>
      )}
    </div>
  );
};

export default CabinSelector;
