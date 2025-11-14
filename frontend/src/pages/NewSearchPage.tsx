import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import {
  searchFerries,
  addPassenger,
  updatePassenger,
  removePassenger,
  addVehicle,
  updateVehicle,
  removeVehicle,
  selectFerry,
  nextStep,
  previousStep,
} from '../store/slices/ferrySlice';
import { PassengerForm } from '../components/PassengerForm';
import { VehicleCard } from '../components/VehicleCard';
import { PassengerInfo, PassengerType, VehicleInfo, FerryResult } from '../types/ferry';

const NewSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const {
    searchParams,
    searchResults,
    isSearching,
    searchError,
    currentStep,
    passengers,
    vehicles,
    selectedFerry,
  } = useSelector((state: RootState) => state.ferry);

  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddPassenger, setShowAddPassenger] = useState(false);

  useEffect(() => {
    // If no search params, redirect to home
    if (!searchParams.departurePort || !searchParams.arrivalPort || !searchParams.departureDate) {
      navigate('/');
      return;
    }

    // Perform search on mount if we don't have results
    if (searchResults.length === 0 && !isSearching) {
      dispatch(searchFerries(searchParams as any));
    }
  }, []);

  const handlePassengerSave = (passenger: PassengerInfo) => {
    const existing = passengers.find(p => p.id === passenger.id);
    if (existing) {
      dispatch(updatePassenger({ id: passenger.id, data: passenger }));
    } else {
      dispatch(addPassenger(passenger));
    }
    setShowAddPassenger(false);
  };

  const handleVehicleSave = (vehicle: VehicleInfo) => {
    const existing = vehicles.find(v => v.id === vehicle.id);
    if (existing) {
      dispatch(updateVehicle({ id: vehicle.id, data: vehicle }));
    } else {
      dispatch(addVehicle(vehicle));
    }
    setShowAddVehicle(false);
  };

  const handleSelectFerry = (ferry: FerryResult) => {
    dispatch(selectFerry(ferry));
    dispatch(nextStep());
  };

  const totalPassengers = (searchParams.passengers?.adults || 0) +
                         (searchParams.passengers?.children || 0) +
                         (searchParams.passengers?.infants || 0);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const calculateDuration = (departure: string, arrival: string) => {
    const diff = new Date(arrival).getTime() - new Date(departure).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`;
  };

  // Step 1: Enter passenger details
  if (currentStep === 1) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-600">Step 1 of 3</span>
              <span className="text-sm font-medium text-gray-600">Passenger Details</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '33%' }}></div>
            </div>
          </div>

          {/* Header */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Passenger Information</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Route</p>
                <p className="font-semibold">{searchParams.departurePort} → {searchParams.arrivalPort}</p>
              </div>
              <div>
                <p className="text-gray-600">Departure</p>
                <p className="font-semibold">{searchParams.departureDate && formatDate(searchParams.departureDate)}</p>
              </div>
              <div>
                <p className="text-gray-600">Passengers</p>
                <p className="font-semibold">{totalPassengers} passenger{totalPassengers !== 1 ? 's' : ''}</p>
              </div>
              <div>
                <p className="text-gray-600">Vehicles</p>
                <p className="font-semibold">{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          {/* Passenger Forms */}
          <div className="space-y-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Add Passenger Details ({passengers.length}/{totalPassengers})
            </h2>

            {passengers.map((passenger, index) => (
              <PassengerForm
                key={passenger.id}
                passenger={passenger}
                passengerNumber={index + 1}
                onSave={handlePassengerSave}
                onRemove={(id) => dispatch(removePassenger(id))}
              />
            ))}

            {passengers.length < totalPassengers && !showAddPassenger && (
              <button
                onClick={() => setShowAddPassenger(true)}
                className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 font-medium transition-all"
              >
                + Add Passenger {passengers.length + 1}
              </button>
            )}

            {showAddPassenger && (
              <PassengerForm
                passengerNumber={passengers.length + 1}
                onSave={handlePassengerSave}
                isExpanded={true}
              />
            )}
          </div>

          {/* Vehicles Section */}
          {vehicles.length > 0 || showAddVehicle ? (
            <div className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Vehicles</h2>

              {vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  onSave={handleVehicleSave}
                  onRemove={(id) => dispatch(removeVehicle(id))}
                />
              ))}

              {!showAddVehicle && (
                <button
                  onClick={() => setShowAddVehicle(true)}
                  className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 font-medium transition-all"
                >
                  + Add Vehicle
                </button>
              )}

              {showAddVehicle && (
                <VehicleCard
                  onSave={handleVehicleSave}
                  onCancel={() => setShowAddVehicle(false)}
                />
              )}
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-900 font-medium mb-2">💡 Traveling with a vehicle?</p>
              <p className="text-blue-800 text-sm mb-3">Add your vehicle details now for accurate pricing</p>
              <button
                onClick={() => setShowAddVehicle(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Add Vehicle
              </button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center bg-white rounded-lg shadow-md p-6">
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
            >
              ← Back to Search
            </button>
            <button
              onClick={() => {
                if (passengers.length === totalPassengers) {
                  dispatch(nextStep());
                } else {
                  alert(`Please add details for all ${totalPassengers} passengers`);
                }
              }}
              disabled={passengers.length < totalPassengers}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue to Ferry Selection →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Select ferry
  if (currentStep === 2) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-600">Step 2 of 3</span>
              <span className="text-sm font-medium text-gray-600">Select Ferry</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '66%' }}></div>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-6">Available Ferries</h1>

          {/* Loading State */}
          {isSearching && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Searching all ferry operators...</p>
            </div>
          )}

          {/* Error State */}
          {searchError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <p className="text-red-800 font-medium">Error: {searchError}</p>
            </div>
          )}

          {/* Results */}
          {!isSearching && searchResults.length > 0 && (
            <div className="space-y-4 mb-6">
              {searchResults.map((ferry) => (
                <div key={ferry.sailingId} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-4">
                        <div className="bg-blue-100 px-3 py-1 rounded-full">
                          <p className="text-sm font-semibold text-blue-800">{ferry.operator}</p>
                        </div>
                        <div className="text-gray-600 text-sm">{ferry.vesselName}</div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-gray-600 text-sm">Departure</p>
                          <p className="font-bold text-lg">{formatTime(ferry.departureTime)}</p>
                          <p className="text-gray-600 text-sm">{formatDate(ferry.departureTime)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-600 text-sm">Duration</p>
                          <p className="font-semibold">{calculateDuration(ferry.departureTime, ferry.arrivalTime)}</p>
                          <div className="flex items-center justify-center mt-1">
                            <div className="h-px bg-gray-300 flex-1"></div>
                            <span className="mx-2 text-gray-400">→</span>
                            <div className="h-px bg-gray-300 flex-1"></div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-600 text-sm">Arrival</p>
                          <p className="font-bold text-lg">{formatTime(ferry.arrivalTime)}</p>
                          <p className="text-gray-600 text-sm">{formatDate(ferry.arrivalTime)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 md:mt-0 md:ml-6 md:text-right">
                      <p className="text-gray-600 text-sm mb-1">Total price</p>
                      <p className="text-3xl font-bold text-blue-600 mb-2">
                        €{Object.values(ferry.prices)[0]?.toFixed(2) || 'N/A'}
                      </p>
                      <button
                        onClick={() => handleSelectFerry(ferry)}
                        className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Results */}
          {!isSearching && searchResults.length === 0 && !searchError && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <p className="text-yellow-800 font-medium mb-2">No ferries found for your search</p>
              <p className="text-yellow-700 text-sm">Try adjusting your dates or route</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center bg-white rounded-lg shadow-md p-6">
            <button
              onClick={() => dispatch(previousStep())}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Review and confirm (placeholder)
  if (currentStep === 3 && selectedFerry) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-600">Step 3 of 3</span>
              <span className="text-sm font-medium text-gray-600">Review & Payment</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-6">Review Your Booking</h1>

          {/* Selected Ferry */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Selected Ferry</h2>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-lg">{selectedFerry.operator}</p>
                <p className="text-gray-600">{selectedFerry.vesselName}</p>
                <p className="text-sm text-gray-600 mt-2">
                  {formatDate(selectedFerry.departureTime)} at {formatTime(selectedFerry.departureTime)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-blue-600">
                  €{Object.values(selectedFerry.prices)[0]?.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Passengers Summary */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Passengers ({passengers.length})</h2>
            <div className="space-y-2">
              {passengers.map((p, i) => (
                <div key={p.id} className="flex justify-between py-2 border-b border-gray-200">
                  <span>{i + 1}. {p.firstName} {p.lastName}</span>
                  <span className="text-gray-600 text-sm">{p.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Vehicles Summary */}
          {vehicles.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Vehicles ({vehicles.length})</h2>
              <div className="space-y-2">
                {vehicles.map((v, i) => (
                  <div key={v.id} className="flex justify-between py-2 border-b border-gray-200">
                    <span>{i + 1}. {v.type}</span>
                    <span className="text-gray-600 text-sm">{v.length}m × {v.width}m × {v.height}m</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center bg-white rounded-lg shadow-md p-6">
            <button
              onClick={() => dispatch(previousStep())}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
            >
              ← Back
            </button>
            <button
              onClick={() => navigate('/booking')}
              className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
            >
              Proceed to Payment →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default NewSearchPage;