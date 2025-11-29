import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api, { bookingAPI } from '../services/api';

interface Cabin {
  id: number;
  name: string;
  cabin_type: string;
  description?: string;
  max_occupancy: number;
  base_price: number;
  has_private_bathroom: boolean;
  has_tv: boolean;
  has_minibar: boolean;
  has_air_conditioning: boolean;
  has_wifi: boolean;
  is_accessible: boolean;
  available?: number;
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
  const [selectedCabin, setSelectedCabin] = useState<Cabin | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!bookingId) return;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch booking details
        const bookingData = await bookingAPI.getById(parseInt(bookingId));
        setBooking(bookingData as unknown as BookingDetails);

        // Fetch available cabins for this route/operator
        const cabinsResponse = await api.get('/cabins', {
          params: {
            operator: bookingData.operator,
            available: true
          }
        });

        // Filter out deck/seat types
        const realCabins = (cabinsResponse.data || []).filter(
          (c: Cabin) => !['seat', 'deck', 'reclining_seat'].includes(c.cabin_type?.toLowerCase())
        );
        setCabins(realCabins);

      } catch (err: any) {
        console.error('Failed to load data:', err);
        setError(err.response?.data?.detail || 'Failed to load booking details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [bookingId]);

  const handleAddCabin = async () => {
    if (!selectedCabin || !booking) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Call API to add cabin to booking
      await api.post(`/bookings/${booking.id}/add-cabin`, {
        cabin_id: selectedCabin.id,
        quantity: quantity,
        journey_type: journeyType
      });

      // If we came from an alert notification, mark it as fulfilled
      if (alertId) {
        try {
          await api.patch(`/availability-alerts/${alertId}`, {
            status: 'fulfilled'
          });
        } catch (alertErr) {
          // Non-critical - just log if we can't update the alert
          console.warn('Could not mark alert as fulfilled:', alertErr);
        }
      }

      setSuccess(true);

      // Redirect to payment or booking details after a short delay
      setTimeout(() => {
        navigate(`/booking/${booking.id}`);
      }, 2000);

    } catch (err: any) {
      console.error('Failed to add cabin:', err);
      setError(err.response?.data?.detail || 'Failed to add cabin to booking');
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
      default:
        return cabinType;
    }
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

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-green-500 text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {t('booking:addCabin.success', 'Cabin Added Successfully!')}
          </h2>
          <p className="text-gray-600 mb-4">
            {t('booking:addCabin.successMessage', 'Your cabin has been added to your booking. Redirecting...')}
          </p>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('booking:addCabin.availableCabins', 'Available Cabins')}
          </h2>

          {cabins.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>{t('booking:addCabin.noCabins', 'No cabins available at the moment')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cabins.map((cabin) => (
                <div
                  key={cabin.id}
                  onClick={() => setSelectedCabin(cabin)}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedCabin?.id === cabin.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getCabinIcon(cabin.cabin_type)}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900">{cabin.name}</h3>
                        <p className="text-sm text-gray-500">{getCabinTypeLabel(cabin.cabin_type)}</p>
                      </div>
                    </div>
                    {selectedCabin?.id === cabin.id && (
                      <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs">
                        ✓ {t('common:common.selected', 'Selected')}
                      </span>
                    )}
                  </div>

                  {cabin.description && (
                    <p className="text-sm text-gray-600 mb-3">{cabin.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mb-3">
                    {cabin.has_private_bathroom && (
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
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {t('booking:addCabin.maxOccupancy', 'Max')}: {cabin.max_occupancy} {cabin.max_occupancy > 1 ? 'persons' : 'person'}
                    </span>
                    <span className="text-lg font-bold text-blue-600">
                      €{cabin.base_price.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quantity and Total */}
        {selectedCabin && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t('booking:addCabin.orderSummary', 'Order Summary')}
            </h2>

            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-600">{t('booking:addCabin.quantity', 'Number of Cabins')}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                  disabled={quantity <= 1}
                >
                  -
                </button>
                <span className="font-semibold text-lg">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(4, quantity + 1))}
                  className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                  disabled={quantity >= 4}
                >
                  +
                </button>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">{selectedCabin.name} x {quantity}</span>
                <span>€{(selectedCabin.base_price * quantity).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-lg font-bold">
                <span>{t('booking:pricing.total', 'Total')}</span>
                <span className="text-blue-600">€{(selectedCabin.base_price * quantity).toFixed(2)}</span>
              </div>
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
            disabled={!selectedCabin || isProcessing}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                {t('common:common.processing', 'Processing...')}
              </>
            ) : (
              <>
                🛏️ {t('booking:addCabin.addCabin', 'Add Cabin')} - €{selectedCabin ? (selectedCabin.base_price * quantity).toFixed(2) : '0.00'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCabinPage;
