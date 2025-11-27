import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { bookingAPI, Booking } from '../services/api';

const ModifyBookingPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(['common', 'booking']);

  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canModify, setCanModify] = useState<boolean>(false);
  const [modificationType, setModificationType] = useState<string>('none');
  const [restrictions, setRestrictions] = useState<string[]>([]);

  // Form state for quick updates
  const [passengerUpdates, setPassengerUpdates] = useState<any[]>([]);
  const [vehicleUpdates, setVehicleUpdates] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchBookingAndEligibility = async () => {
      if (!bookingId) return;

      try {
        setIsLoading(true);
        setError(null);

        // Fetch booking details
        const bookingResponse = await bookingAPI.getById(parseInt(bookingId));
        setBooking(bookingResponse);

        // Initialize passenger updates from booking
        if (bookingResponse.passengers) {
          setPassengerUpdates(
            bookingResponse.passengers.map((p: any) => ({
              passenger_id: p.id,
              first_name: p.firstName || p.first_name,
              last_name: p.lastName || p.last_name,
              date_of_birth: p.dateOfBirth || p.date_of_birth,
              nationality: p.nationality,
              passport_number: p.passportNumber || p.passport_number,
            }))
          );
        }

        // Initialize vehicle updates from booking
        if (bookingResponse.vehicles) {
          setVehicleUpdates(
            bookingResponse.vehicles.map((v: any) => ({
              vehicle_id: v.id,
              type: v.type || 'car',
              registration: v.licensePlate || v.license_plate,
              make: v.make,
              model: v.model,
              owner: v.owner,
              length: v.length || v.lengthCm || 500,
              width: v.width || v.widthCm || 200,
              height: v.height || v.heightCm || 200,
              hasTrailer: v.hasTrailer || v.has_trailer || false,
              hasCaravan: v.hasCaravan || v.has_caravan || false,
              hasRoofBox: v.hasRoofBox || v.has_roof_box || false,
              hasBikeRack: v.hasBikeRack || v.has_bike_rack || false,
            }))
          );
        }

        // Check modification eligibility
        const eligibilityResponse = await fetch(
          `/api/v1/bookings/${bookingId}/can-modify`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (eligibilityResponse.ok) {
          const eligibility = await eligibilityResponse.json();
          setCanModify(eligibility.can_modify);
          setModificationType(eligibility.modification_type_allowed);
          setRestrictions(eligibility.restrictions || []);
        }
      } catch (err: any) {
        console.error('Error loading booking:', err);
        setError(err.message || 'Failed to load booking');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookingAndEligibility();
  }, [bookingId]);

  const handlePassengerChange = (index: number, field: string, value: string) => {
    const updated = [...passengerUpdates];
    updated[index] = { ...updated[index], [field]: value };
    setPassengerUpdates(updated);
  };

  const handleVehicleChange = (index: number, field: string, value: string | number | boolean) => {
    const updated = [...vehicleUpdates];
    updated[index] = { ...updated[index], [field]: value };
    setVehicleUpdates(updated);
  };

  const handleSaveChanges = async () => {
    if (!bookingId) return;

    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/v1/bookings/${bookingId}/quick-update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          passenger_updates: passengerUpdates,
          vehicle_updates: vehicleUpdates,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update booking');
      }

      await response.json();
      setSuccessMessage(t('booking:modify.success'));

      // Refresh booking data
      setTimeout(() => {
        navigate(`/booking/${bookingId}`);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">{t('booking:modify.loading')}</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{t('booking:modify.notFound')}</p>
          <button
            onClick={() => navigate('/my-bookings')}
            className="text-blue-600 hover:underline"
          >
            {t('booking:modify.backToBookings')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/my-bookings')}
            className="text-blue-600 hover:underline mb-2 flex items-center"
          >
            ← {t('booking:modify.backToBookings')}
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{t('booking:modify.title')}</h1>
          <p className="text-gray-600 mt-1">
            {t('booking:modify.bookingReference')}: {booking.bookingReference}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Cannot Modify Notice */}
        {!canModify && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              {t('booking:modify.notAvailableTitle')}
            </h3>
            <p className="text-yellow-800 mb-4">
              {t('booking:modify.notAvailableMessage')}
            </p>
            {restrictions.length > 0 && (
              <ul className="list-disc list-inside text-yellow-700 space-y-1">
                {restrictions.map((restriction, idx) => (
                  <li key={idx}>{restriction}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Quick Update Form */}
        {canModify && modificationType !== 'none' && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {t('booking:modify.updateTitle')}
                </h2>
                <span className="text-sm text-green-600 font-medium">
                  ✓ {t('booking:modify.noAdditionalFees')}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                {t('booking:modify.updateDescription')}
              </p>
              <p className="text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
                ⚠️ {t('booking:modify.feeWarning')}
              </p>
            </div>

            {/* Passenger Updates */}
            {passengerUpdates.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('booking:modify.passengers')}</h3>
                <div className="space-y-4">
                  {passengerUpdates.map((passenger, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">
                        {t('booking:modify.passenger')} {index + 1}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('booking:modify.firstName')}
                          </label>
                          <input
                            type="text"
                            value={passenger.first_name || ''}
                            onChange={(e) =>
                              handlePassengerChange(index, 'first_name', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('booking:modify.lastName')}
                          </label>
                          <input
                            type="text"
                            value={passenger.last_name || ''}
                            onChange={(e) =>
                              handlePassengerChange(index, 'last_name', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vehicle Updates */}
            {vehicleUpdates.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('booking:modify.vehicles')}</h3>
                <div className="space-y-4">
                  {vehicleUpdates.map((vehicle, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">
                        {t('booking:modify.vehicle')} {index + 1}
                      </h4>
                      {/* Vehicle Type */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('booking:modify.vehicleType')}
                        </label>
                        <select
                          value={vehicle.type || 'car'}
                          onChange={(e) =>
                            handleVehicleChange(index, 'type', e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="car">🚗 Car</option>
                          <option value="suv">🚙 SUV / 4x4</option>
                          <option value="van">🚐 Van / Utility</option>
                          <option value="motorcycle">🏍️ Motorcycle</option>
                          <option value="camper">🚌 Camper</option>
                          <option value="caravan">🏕️ Caravan</option>
                          <option value="truck">🚚 Truck</option>
                        </select>
                      </div>

                      {/* Registration & Details */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('booking:modify.registrationNumber')}
                          </label>
                          <input
                            type="text"
                            value={vehicle.registration || ''}
                            onChange={(e) =>
                              handleVehicleChange(index, 'registration', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('booking:modify.make')}
                          </label>
                          <input
                            type="text"
                            value={vehicle.make || ''}
                            onChange={(e) =>
                              handleVehicleChange(index, 'make', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('booking:modify.model')}
                          </label>
                          <input
                            type="text"
                            value={vehicle.model || ''}
                            onChange={(e) =>
                              handleVehicleChange(index, 'model', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* Dimensions */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('booking:modify.dimensionsCm')}
                        </label>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              {t('booking:modify.length')}
                            </label>
                            <input
                              type="number"
                              value={vehicle.length || 500}
                              onChange={(e) =>
                                handleVehicleChange(index, 'length', parseInt(e.target.value))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              {t('booking:modify.width')}
                            </label>
                            <input
                              type="number"
                              value={vehicle.width || 200}
                              onChange={(e) =>
                                handleVehicleChange(index, 'width', parseInt(e.target.value))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              {t('booking:modify.height')}
                            </label>
                            <input
                              type="number"
                              value={vehicle.height || 200}
                              onChange={(e) =>
                                handleVehicleChange(index, 'height', parseInt(e.target.value))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Accessories */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('booking:modify.accessories')}
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={vehicle.hasTrailer || false}
                              onChange={(e) =>
                                handleVehicleChange(index, 'hasTrailer', e.target.checked)
                              }
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">{t('booking:modify.trailer')}</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={vehicle.hasCaravan || false}
                              onChange={(e) =>
                                handleVehicleChange(index, 'hasCaravan', e.target.checked)
                              }
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">{t('booking:modify.caravan')}</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={vehicle.hasRoofBox || false}
                              onChange={(e) =>
                                handleVehicleChange(index, 'hasRoofBox', e.target.checked)
                              }
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">{t('booking:modify.roofBox')}</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={vehicle.hasBikeRack || false}
                              onChange={(e) =>
                                handleVehicleChange(index, 'hasBikeRack', e.target.checked)
                              }
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">{t('booking:modify.bikeRack')}</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => navigate('/my-bookings')}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
              >
                {t('booking:modify.cancel')}
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSaving ? t('booking:modify.saving') : t('booking:modify.saveChanges')}
              </button>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">ℹ️ {t('booking:modify.needMoreChangesTitle')}</h4>
          <p className="text-sm text-blue-800">
            {t('booking:modify.needMoreChangesMessage')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModifyBookingPage;
