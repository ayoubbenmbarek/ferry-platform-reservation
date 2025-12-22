import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api, { bookingAPI } from '../services/api';

interface Cabin {
  uid: string;   // Unique identifier (code_price_index)
  code: string;  // FerryHopper accommodation code
  name: string;
  cabin_type: string;
  description?: string;
  max_occupancy: number;
  price: number;  // Real price from FerryHopper
  has_bathroom: boolean;
  has_tv: boolean;
  has_wifi: boolean;
  has_air_conditioning: boolean;
  is_accessible: boolean;
  available: number;
}

// Track quantity per cabin uid (unique identifier)
interface CabinSelection {
  cabin: Cabin;
  quantity: number;
}

interface BookingDetails {
  id: number;
  bookingReference: string;
  status: string;
  departurePort: string;
  arrivalPort: string;
  departureTime: string;
  operator: string;
  totalPassengers: number;
  cabinId?: number;
  cabinSupplement?: number;
  totalAmount: number;
  currency: string;
  isRoundTrip?: boolean;
}

const AddCabinPage: React.FC = () => {
  const { t } = useTranslation(['booking', 'common']);
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const alertId = searchParams.get('alertId');
  const journeyType = searchParams.get('journey') || 'outbound';

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [baseFarePrice, setBaseFarePrice] = useState<number>(0); // Base deck/seat price
  // Multi-cabin selection: track quantity per cabin uid (unique identifier)
  const [cabinQuantities, setCabinQuantities] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if a cabin type is base fare (deck/seat - already included in route price)
  const isBaseFareType = (cabinType: string, cabinName?: string): boolean => {
    const type = cabinType?.toLowerCase() || '';
    const name = cabinName?.toLowerCase() || '';

    // Check type first
    if (['deck', 'seat', 'deck_seat', 'standard_seat', 'reclining_seat'].includes(type)) {
      return true;
    }

    // Also check name for keywords indicating base fare
    // But only if the cabin doesn't have luxury features (bathroom, etc.)
    const baseFareKeywords = ['deck', 'passage', 'pont', 'fauteuil', 'poltrona'];
    return baseFareKeywords.some(kw => name.includes(kw));
  };

  // Calculate supplement for a cabin (upgrade cost over base fare)
  const getCabinSupplement = (cabin: Cabin): number => {
    return Math.max(0, cabin.price - baseFarePrice);
  };

  // Calculate total cabins and total supplement
  const getSelections = (): CabinSelection[] => {
    return Object.entries(cabinQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([cabinUid, qty]) => ({
        cabin: cabins.find(c => c.uid === cabinUid)!,
        quantity: qty
      }))
      .filter(s => s.cabin); // Filter out any undefined cabins
  };

  const totalCabins = Object.values(cabinQuantities).reduce((sum, qty) => sum + qty, 0);
  // Use supplement (upgrade cost) instead of full price
  const totalPrice = getSelections().reduce((sum, s) => sum + (getCabinSupplement(s.cabin) * s.quantity), 0);

  const handleQuantityChange = (cabinUid: string, delta: number) => {
    setCabinQuantities(prev => {
      const currentQty = prev[cabinUid] || 0;
      const cabin = cabins.find(c => c.uid === cabinUid);
      const maxQty = cabin?.available || 10;
      const newQty = Math.max(0, Math.min(maxQty, currentQty + delta));
      return { ...prev, [cabinUid]: newQty };
    });
  };

  const handleClearAll = () => {
    setCabinQuantities({});
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!bookingId) return;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch booking details
        const bookingData = await bookingAPI.getById(parseInt(bookingId));
        setBooking(bookingData as unknown as BookingDetails);

        // Fetch available cabins from FerryHopper via new endpoint
        const cabinsResponse = await api.get(`/bookings/${bookingId}/available-cabins`, {
          params: {
            journey_type: journeyType
          }
        });

        const allCabins = cabinsResponse.data.cabins || [];

        // Find the base fare price (deck/seat price - already included in route)
        const baseFareCabin = allCabins.find((c: any) =>
          isBaseFareType(c.cabin_type, c.name)
        );
        const basePrice = baseFareCabin?.price || 0;
        setBaseFarePrice(basePrice);

        // Filter out deck/seat types (user already has deck passage) and sort by price
        const rawCabins = allCabins
          .filter((c: any) => !isBaseFareType(c.cabin_type, c.name))
          .sort((a: any, b: any) => b.price - a.price);  // Sort by price (highest first)

        // Generate unique UIDs to avoid key collisions when cabins share the same code
        const availableCabins: Cabin[] = rawCabins.map((c: any, index: number) => ({
          ...c,
          uid: `${c.code}_${c.price}_${index}` // Unique identifier
        }));

        setCabins(availableCabins);

        if (availableCabins.length === 0) {
          setError(t('booking:cabinAlert.noCabinsAvailable', 'No cabins available for this sailing. The cache may have expired - please try again later.'));
        }

      } catch (err: any) {
        console.error('Failed to load data:', err);
        setError(err.response?.data?.detail || 'Failed to load booking details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [bookingId, journeyType, t]);

  const handleAddCabin = async () => {
    const selections = getSelections();
    if (selections.length === 0 || !booking) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Build cabin selections string: "cabinCode:qty:supplement:name,cabinCode:qty:supplement:name"
      // Use supplement (upgrade cost) not full price
      const cabinSelectionsStr = selections
        .map(s => `${s.cabin.code}:${s.quantity}:${getCabinSupplement(s.cabin)}:${encodeURIComponent(s.cabin.name)}`)
        .join(',');

      // Redirect to payment page with cabin upgrade details
      // The payment page will handle adding the cabin after successful payment
      const params = new URLSearchParams({
        type: 'cabin_upgrade',
        cabin_selections: cabinSelectionsStr,
        total_cabins: totalCabins.toString(),
        journey_type: journeyType,
        amount: totalPrice.toFixed(2),
        ...(alertId && { alert_id: alertId })
      });

      navigate(`/payment/${booking.id}?${params.toString()}`);

    } catch (err: any) {
      console.error('Failed to process cabin upgrade:', err);
      setError(err.response?.data?.detail || 'Failed to process cabin upgrade');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCabinIcon = (cabinType: string) => {
    switch (cabinType?.toLowerCase()) {
      case 'inside':
      case 'interior':
        return '🛏️';
      case 'outside':
      case 'exterior':
        return '🪟';
      case 'balcony':
        return '🌅';
      case 'suite':
        return '👑';
      case 'shared':
      case 'berth':
      case 'dorm':
      case 'couchette':
        return '🛌';
      case 'pet':
        return '🐾';
      default:
        return '🛏️';
    }
  };

  const getCabinTypeLabel = (cabinType: string) => {
    switch (cabinType?.toLowerCase()) {
      case 'inside':
      case 'interior':
        return t('booking:cabinAlert.cabinTypes.inside', 'Inside Cabin');
      case 'outside':
      case 'exterior':
        return t('booking:cabinAlert.cabinTypes.outside', 'Outside Cabin');
      case 'balcony':
        return t('booking:cabinAlert.cabinTypes.balcony', 'Balcony Cabin');
      case 'suite':
        return t('booking:cabinAlert.cabinTypes.suite', 'Suite');
      case 'shared':
      case 'berth':
      case 'dorm':
      case 'couchette':
        return t('booking:cabinAlert.cabinTypes.shared', 'Bed in Shared Cabin');
      case 'pet':
        return t('booking:cabinAlert.cabinTypes.pet', 'Pet-Friendly Cabin');
      default:
        return cabinType;
    }
  };

  // Check if cabin type allows pets
  const isPetCabinType = (cabinType: string): boolean => {
    return cabinType?.toLowerCase() === 'pet';
  };

  // Check if cabin type is a shared bed (not private cabin)
  const isSharedCabinType = (cabinType: string): boolean => {
    const type = cabinType?.toLowerCase() || '';
    return ['shared', 'berth', 'dorm', 'couchette', 'dormitory'].includes(type);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common:common.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('booking:errors.loadingFailed', 'Error')}</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('common:common.goBack', 'Go Back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🛏️ {t('booking:addCabin.title', 'Add Cabin to Your Booking')}
          </h1>
          <p className="text-gray-600">
            {t('booking:addCabin.subtitle', 'Select a cabin to add to your existing booking')}
          </p>
        </div>

        {/* Booking Summary */}
        {booking && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t('booking:addCabin.bookingSummary', 'Booking Summary')}
            </h2>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">{t('booking:confirmation.bookingReferenceLabel', 'Booking Reference')}</span>
                <span className="font-bold text-blue-600">{booking.bookingReference}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">{t('booking:summary.route', 'Route')}</span>
                <span className="font-medium capitalize">{booking.departurePort} → {booking.arrivalPort}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">{t('booking:summary.departure', 'Departure')}</span>
                <span className="font-medium">{formatDate(booking.departureTime)} at {formatTime(booking.departureTime)}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">{t('booking:confirmation.operator', 'Operator')}</span>
                <span className="font-medium">{booking.operator}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('booking:summary.passengers', 'Passengers')}</span>
                <span className="font-medium">{booking.totalPassengers}</span>
              </div>
            </div>

            {journeyType === 'return' && (
              <div className="mt-3 px-3 py-2 bg-purple-100 rounded-lg">
                <span className="text-purple-800 text-sm font-medium">
                  🔄 {t('booking:addCabin.forReturnJourney', 'Adding cabin for return journey')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Available Cabins */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {t('booking:addCabin.availableCabins', 'Available Cabins')}
            </h2>
            {totalCabins > 0 && (
              <button
                onClick={handleClearAll}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {t('booking:addCabin.clearAll', 'Clear All')}
              </button>
            )}
          </div>

          <p className="text-sm text-gray-600 mb-4">
            {t('booking:addCabin.selectMultiple', 'Select the cabin types and quantities you want to add to your booking.')}
          </p>

          {cabins.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>{t('booking:addCabin.noCabins', 'No cabins available at the moment')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cabins.map((cabin) => {
                const quantity = cabinQuantities[cabin.uid] || 0;
                const supplement = getCabinSupplement(cabin);
                const supplementTotal = supplement * quantity;

                return (
                  <div
                    key={cabin.uid}
                    className={`border-2 rounded-lg p-4 transition-all ${
                      quantity > 0
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      {/* Cabin Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-3xl">{getCabinIcon(cabin.cabin_type)}</span>
                          <div>
                            <h3 className="font-semibold text-gray-900">{cabin.name}</h3>
                            <p className="text-sm text-gray-500">{getCabinTypeLabel(cabin.cabin_type)}</p>
                          </div>
                          {quantity > 0 && (
                            <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-medium">
                              {quantity} selected
                            </span>
                          )}
                        </div>

                        {cabin.description && (
                          <p className="text-sm text-gray-600 mb-2 ml-12">{cabin.description}</p>
                        )}

                        {/* Shared cabin note */}
                        {isSharedCabinType(cabin.cabin_type) && (
                          <p className="text-xs text-blue-600 mb-2 ml-12 flex items-center gap-1">
                            <span>👥</span>
                            <span>{t('booking:cabinAlert.sharedNote', "You'll share with other passengers of the same sex")}</span>
                          </p>
                        )}

                        {/* Pet cabin note */}
                        {isPetCabinType(cabin.cabin_type) && (
                          <p className="text-xs text-green-600 mb-2 ml-12 flex items-center gap-1">
                            <span>🐾</span>
                            <span>{t('booking:cabinAlert.petNote', 'This cabin allows pets - required if traveling with a pet')}</span>
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2 ml-12">
                          {cabin.has_bathroom && (
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">🚿 Bathroom</span>
                          )}
                          {cabin.has_tv && (
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">📺 TV</span>
                          )}
                          {cabin.has_wifi && (
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">📶 WiFi</span>
                          )}
                          {cabin.has_air_conditioning && (
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">❄️ A/C</span>
                          )}
                          {cabin.is_accessible && (
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">♿ Accessible</span>
                          )}
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            👥 Max {cabin.max_occupancy}
                          </span>
                        </div>
                      </div>

                      {/* Price and Quantity Controls */}
                      <div className="text-right ml-4">
                        <div className="text-lg font-bold text-blue-600 mb-2">
                          +€{supplement.toFixed(2)}
                          <span className="text-xs text-gray-500 font-normal block">
                            {isSharedCabinType(cabin.cabin_type) ? 'upgrade per bed' : 'upgrade per cabin'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleQuantityChange(cabin.uid, -1)}
                            disabled={quantity === 0}
                            className="w-9 h-9 rounded-full border-2 border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-semibold text-lg">{quantity}</span>
                          <button
                            onClick={() => handleQuantityChange(cabin.uid, 1)}
                            disabled={quantity >= 10}
                            className="w-9 h-9 rounded-full border-2 border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
                          >
                            +
                          </button>
                        </div>

                        {quantity > 0 && (
                          <p className="text-sm text-green-700 font-medium mt-2">
                            Upgrade: +€{supplementTotal.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Order Summary */}
        {totalCabins > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t('booking:addCabin.orderSummary', 'Order Summary')}
            </h2>

            <div className="space-y-3 border-b pb-4 mb-4">
              {getSelections().map((selection) => {
                const supplement = getCabinSupplement(selection.cabin);
                return (
                  <div key={selection.cabin.uid} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getCabinIcon(selection.cabin.cabin_type)}</span>
                      <span className="text-gray-700">
                        {selection.cabin.name} × {selection.quantity}
                      </span>
                    </div>
                    <span className="font-medium">+€{(supplement * selection.quantity).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-lg font-bold">{t('booking:pricing.upgradeTotal', 'Upgrade Total')}</span>
                <span className="text-sm text-gray-500 block">{totalCabins} cabin{totalCabins > 1 ? 's' : ''}</span>
              </div>
              <span className="text-2xl font-bold text-blue-600">+€{totalPrice.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
          >
            {t('common:common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleAddCabin}
            disabled={totalCabins === 0 || isProcessing}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                {t('common:common.processing', 'Processing...')}
              </>
            ) : totalCabins === 0 ? (
              <>
                🛏️ {t('booking:addCabin.selectCabins', 'Select Cabins')}
              </>
            ) : (
              <>
                🛏️ {t('booking:addCabin.addCabins', 'Add')} {totalCabins} {totalCabins === 1 ? 'Cabin' : 'Cabins'} - +€{totalPrice.toFixed(2)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCabinPage;
