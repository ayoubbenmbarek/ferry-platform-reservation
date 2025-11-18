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
  setSearchParams,
  setIsRoundTrip,
  startNewSearch,
  setCurrentStep,
} from '../store/slices/ferrySlice';
import { PassengerForm } from '../components/PassengerForm';
import { VehicleCard } from '../components/VehicleCard';
import { PassengerInfo, PassengerType, VehicleInfo, FerryResult, SearchParams, PORTS } from '../types/ferry';

// Search Form Component
interface SearchFormProps {
  onSearch: (params: SearchParams) => void;
  isEditMode?: boolean;
}

const SearchFormComponent: React.FC<SearchFormProps> = ({ onSearch, isEditMode = false }) => {
  const dispatch = useDispatch<AppDispatch>();
  const existingParams = useSelector((state: RootState) => state.ferry.searchParams);

  const [form, setForm] = useState({
    departurePort: existingParams.departurePort || '',
    arrivalPort: existingParams.arrivalPort || '',
    departureDate: existingParams.departureDate || '',
    returnDate: existingParams.returnDate || '',
    adults: existingParams.passengers?.adults || 1,
    children: existingParams.passengers?.children || 0,
    infants: existingParams.passengers?.infants || 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.departurePort) newErrors.departurePort = 'Please select departure port';
    if (!form.arrivalPort) newErrors.arrivalPort = 'Please select arrival port';
    if (!form.departureDate) newErrors.departureDate = 'Please select departure date';
    if (form.departurePort === form.arrivalPort) {
      newErrors.arrivalPort = 'Arrival port must be different';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const isRoundTrip = !!form.returnDate;

    const searchParams: SearchParams = {
      departurePort: form.departurePort,
      arrivalPort: form.arrivalPort,
      departureDate: form.departureDate,
      returnDate: form.returnDate || undefined,
      passengers: {
        adults: form.adults,
        children: form.children,
        infants: form.infants,
      },
      vehicles: [],
    };

    dispatch(setSearchParams(searchParams));
    dispatch(setIsRoundTrip(isRoundTrip));
    onSearch(searchParams);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              {isEditMode ? '✏️ Edit Your Search' : '⚓ Ferry to Tunisia'}
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto">
              {isEditMode
                ? 'Update your route and dates. Your passenger and vehicle details will be preserved.'
                : 'Book your Mediterranean crossing from Italy & France to Tunisia'}
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8">
              <form onSubmit={handleSearch} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">🛳️ From</label>
                    <select
                      value={form.departurePort}
                      onChange={(e) => setForm({ ...form, departurePort: e.target.value })}
                      className={`w-full px-4 py-3 border-2 rounded-lg ${errors.departurePort ? 'border-red-500' : 'border-gray-300'}`}
                    >
                      <option value="">Select departure port</option>
                      {PORTS.filter(p => p.countryCode !== 'TN').map(port => (
                        <option key={port.code} value={port.code}>{port.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">🏁 To</label>
                    <select
                      value={form.arrivalPort}
                      onChange={(e) => setForm({ ...form, arrivalPort: e.target.value })}
                      className={`w-full px-4 py-3 border-2 rounded-lg ${errors.arrivalPort ? 'border-red-500' : 'border-gray-300'}`}
                    >
                      <option value="">Select arrival port</option>
                      {PORTS.filter(p => p.countryCode === 'TN').map(port => (
                        <option key={port.code} value={port.code}>{port.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">📅 Departure Date</label>
                    <input
                      type="date"
                      value={form.departureDate}
                      onChange={(e) => setForm({ ...form, departureDate: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className={`w-full px-4 py-3 border-2 rounded-lg ${errors.departureDate ? 'border-red-500' : 'border-gray-300'}`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Return Date (Optional)</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={form.returnDate}
                        onChange={(e) => {
                          setForm({ ...form, returnDate: e.target.value });
                          // Update Redux state immediately when return date changes
                          dispatch(setIsRoundTrip(!!e.target.value));
                        }}
                        min={form.departureDate || new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg"
                      />
                      {form.returnDate && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setForm({ ...form, returnDate: '' });
                            // Clear round-trip flag in Redux immediately
                            dispatch(setIsRoundTrip(false));
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-red-600 bg-white px-1.5 py-0.5 rounded-full hover:bg-red-50 font-bold text-lg z-10 cursor-pointer"
                          title="Clear return date"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">👥 Passengers</label>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="text-sm text-gray-600 mb-2 block">Adults (12+)</label>
                      <div className="flex items-center justify-between">
                        <button type="button" onClick={() => form.adults > 1 && setForm({ ...form, adults: form.adults - 1 })} className="w-8 h-8 rounded-full bg-blue-600 text-white">-</button>
                        <span className="font-semibold">{form.adults}</span>
                        <button type="button" onClick={() => setForm({ ...form, adults: form.adults + 1 })} className="w-8 h-8 rounded-full bg-blue-600 text-white">+</button>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="text-sm text-gray-600 mb-2 block">Children (4-11)</label>
                      <div className="flex items-center justify-between">
                        <button type="button" onClick={() => form.children > 0 && setForm({ ...form, children: form.children - 1 })} className="w-8 h-8 rounded-full bg-blue-600 text-white">-</button>
                        <span className="font-semibold">{form.children}</span>
                        <button type="button" onClick={() => setForm({ ...form, children: form.children + 1 })} className="w-8 h-8 rounded-full bg-blue-600 text-white">+</button>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="text-sm text-gray-600 mb-2 block">Infants (0-3)</label>
                      <div className="flex items-center justify-between">
                        <button type="button" onClick={() => form.infants > 0 && setForm({ ...form, infants: form.infants - 1 })} className="w-8 h-8 rounded-full bg-blue-600 text-white">-</button>
                        <span className="font-semibold">{form.infants}</span>
                        <button type="button" onClick={() => setForm({ ...form, infants: form.infants + 1 })} className="w-8 h-8 rounded-full bg-blue-600 text-white">+</button>
                      </div>
                    </div>
                  </div>
                </div>

                <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 rounded-lg text-lg font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all">
                  {isEditMode ? '🔄 Update Search' : '🔍 Search Ferries'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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

  const [hasSearchParams, setHasSearchParams] = useState(true);
  const [isEditingRoute, setIsEditingRoute] = useState(false);

  useEffect(() => {
    // Check if we have search params
    if (!searchParams.departurePort || !searchParams.arrivalPort || !searchParams.departureDate) {
      setHasSearchParams(false);
      return;
    }

    setHasSearchParams(true);

    // Perform search if we don't have results
    if (searchResults.length === 0 && !isSearching) {
      dispatch(searchFerries(searchParams as any));
    }
  }, [searchParams, searchResults.length, isSearching, dispatch]);

  // Warn user before leaving if they have an active booking in progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only warn if user has selected a ferry or added passengers (booking in progress)
      if (selectedFerry || passengers.length > 0) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
        return ''; // Some browsers show this message
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [selectedFerry, passengers.length]);

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
    // Move to step 1 (passenger details) after selecting ferry
    dispatch(setCurrentStep(1));
  };

  const totalPassengers = (searchParams.passengers?.adults || 0) +
                         (searchParams.passengers?.children || 0) +
                         (searchParams.passengers?.infants || 0);

  // Calculate the default passenger type for the next passenger
  const getNextPassengerType = (): PassengerType => {
    const adultsNeeded = searchParams.passengers?.adults || 0;
    const childrenNeeded = searchParams.passengers?.children || 0;
    const infantsNeeded = searchParams.passengers?.infants || 0;

    const currentAdults = passengers.filter(p => p.type === PassengerType.ADULT).length;
    const currentChildren = passengers.filter(p => p.type === PassengerType.CHILD).length;
    const currentInfants = passengers.filter(p => p.type === PassengerType.INFANT).length;

    // Fill adults first, then children, then infants
    if (currentAdults < adultsNeeded) {
      return PassengerType.ADULT;
    } else if (currentChildren < childrenNeeded) {
      return PassengerType.CHILD;
    } else if (currentInfants < infantsNeeded) {
      return PassengerType.INFANT;
    }

    // Default to adult if somehow we're over
    return PassengerType.ADULT;
  };

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

  // Show message if no search params
  // Show search form if no search params
  if (!hasSearchParams) {
    return <SearchFormComponent
      isEditMode={isEditingRoute}
      onSearch={(params) => {
        if (isEditingRoute) {
          // When editing route, just update search params and search
          // Don't clear passengers/vehicles
          dispatch(setSearchParams(params));
          dispatch(setIsRoundTrip(!!params.returnDate));
          dispatch(searchFerries(params as any));
          setIsEditingRoute(false);
          // Go to ferry selection step
          dispatch(setCurrentStep(2));
        } else {
          // New search - reset everything
          dispatch(startNewSearch());
          dispatch(searchFerries(params as any));
        }
        setHasSearchParams(true);
      }}
    />;
  }

  // Step 1: Enter passenger details
  if (currentStep === 1) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-600">
                {selectedFerry ? 'Step 2 of 3' : 'Step 1 of 3'}
              </span>
              <span className="text-sm font-medium text-gray-600">Passenger Details</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: selectedFerry ? '66%' : '33%' }}></div>
            </div>
          </div>

          {/* Header */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Passenger Information</h1>

            {/* Show selected ferry if available */}
            {selectedFerry && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800 font-medium mb-2">Selected Ferry</p>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-900">{selectedFerry.operator} - {selectedFerry.vesselName}</p>
                    <p className="text-sm text-gray-600">
                      {formatDate(selectedFerry.departureTime)} at {formatTime(selectedFerry.departureTime)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">from</p>
                    <p className="text-xl font-bold text-blue-600">
                      €{(selectedFerry.prices?.adult || Object.values(selectedFerry.prices)[0] || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Route</p>
                <p className="font-semibold">{searchParams.departurePort} → {searchParams.arrivalPort}</p>
              </div>
              <div>
                <p className="text-gray-600">Departure</p>
                <p className="font-semibold">{searchParams.departureDate && formatDate(searchParams.departureDate)}</p>
              </div>
              {searchParams.returnDate && (
                <div>
                  <p className="text-gray-600">Return</p>
                  <p className="font-semibold">{formatDate(searchParams.returnDate)}</p>
                </div>
              )}
              <div>
                <p className="text-gray-600">Passengers</p>
                <p className="font-semibold">{totalPassengers} passenger{totalPassengers !== 1 ? 's' : ''}</p>
              </div>
              <div>
                <p className="text-gray-600">Vehicles</p>
                <p className="font-semibold">{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Edit Route Button */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  // Clear selected ferry since route will change
                  dispatch(selectFerry(null as any));
                  // Set edit mode (to preserve passengers/vehicles)
                  setIsEditingRoute(true);
                  // Show search form
                  setHasSearchParams(false);
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
              >
                <span className="mr-1">✏️</span> Edit Route & Dates
              </button>
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
                defaultType={getNextPassengerType()}
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
              onClick={() => {
                // If ferry already selected, go back to ferry selection (step 2)
                if (selectedFerry) {
                  dispatch(setCurrentStep(2));
                } else {
                  navigate('/');
                }
              }}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
            >
              ← Back to Search
            </button>
            <button
              onClick={() => {
                if (passengers.length === totalPassengers) {
                  // If ferry is selected, go to review (step 3)
                  // Otherwise go to ferry selection (step 2)
                  if (selectedFerry) {
                    dispatch(setCurrentStep(3));
                  } else {
                    dispatch(nextStep());
                  }
                } else {
                  alert(`Please add details for all ${totalPassengers} passengers`);
                }
              }}
              disabled={passengers.length < totalPassengers}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selectedFerry ? 'Continue to Review →' : 'Continue to Ferry Selection →'}
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
              <span className="text-sm font-medium text-blue-600">
                {passengers.length > 0 ? 'Step 2 of 3' : 'Step 1 of 3'}
              </span>
              <span className="text-sm font-medium text-gray-600">Select Ferry</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: passengers.length > 0 ? '66%' : '33%' }}></div>
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
                      <p className="text-gray-600 text-sm mb-1">From</p>
                      <p className="text-3xl font-bold text-blue-600 mb-2">
                        €{(ferry.prices?.adult || Object.values(ferry.prices)[0] || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 mb-2">per adult</p>
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
                <p className="text-sm text-gray-600">
                  {searchParams.departurePort} → {searchParams.arrivalPort}
                </p>
              </div>
            </div>
          </div>

          {/* Passengers Summary */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Passengers ({passengers.length})</h2>
            <div className="space-y-2">
              {passengers.map((p, i) => {
                const price = p.type === 'adult'
                  ? (selectedFerry.prices?.adult || 0)
                  : p.type === 'child'
                  ? (selectedFerry.prices?.child || 0)
                  : 0;
                return (
                  <div key={p.id} className="flex justify-between py-2 border-b border-gray-200">
                    <div>
                      <span>{i + 1}. {p.firstName} {p.lastName}</span>
                      <span className="text-gray-500 text-sm ml-2">({p.type})</span>
                      {p.hasPet && (
                        <span className="ml-2 text-blue-600 text-sm">
                          + {p.petType === 'DOG' ? '🐕' : p.petType === 'CAT' ? '🐱' : '🐹'} {p.petName || 'Pet'}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-medium">€{price.toFixed(2)}</span>
                      {p.hasPet && <span className="text-blue-600 text-sm ml-1">+€15.00</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vehicles Summary */}
          {vehicles.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Vehicles ({vehicles.length})</h2>
              <div className="space-y-2">
                {vehicles.map((v, i) => {
                  const vehiclePrice = selectedFerry.prices?.vehicle || 50;
                  return (
                    <div key={v.id} className="flex justify-between py-2 border-b border-gray-200">
                      <div>
                        <span>{i + 1}. {v.type}</span>
                        <span className="text-gray-500 text-sm ml-2">({v.length}m × {v.width}m × {v.height}m)</span>
                      </div>
                      <span className="font-medium">€{vehiclePrice.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Price Summary */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Price Summary</h2>
            <div className="space-y-3">
              {/* Passengers breakdown */}
              {(() => {
                const adultCount = passengers.filter(p => p.type === 'adult').length;
                const childCount = passengers.filter(p => p.type === 'child').length;
                const infantCount = passengers.filter(p => p.type === 'infant').length;
                const petCount = passengers.filter(p => p.hasPet).length;

                const adultPrice = selectedFerry.prices?.adult || 0;
                const childPrice = selectedFerry.prices?.child || 0;
                const vehiclePrice = selectedFerry.prices?.vehicle || 50;
                const petPrice = 15;

                const adultTotal = adultCount * adultPrice;
                const childTotal = childCount * childPrice;
                const vehicleTotal = vehicles.length * vehiclePrice;
                const petTotal = petCount * petPrice;
                const subtotal = adultTotal + childTotal + vehicleTotal + petTotal;
                const tax = subtotal * 0.1;
                const total = subtotal + tax;

                return (
                  <>
                    {adultCount > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>{adultCount} Adult{adultCount > 1 ? 's' : ''} × €{adultPrice.toFixed(2)}</span>
                        <span>€{adultTotal.toFixed(2)}</span>
                      </div>
                    )}
                    {childCount > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>{childCount} Child{childCount > 1 ? 'ren' : ''} × €{childPrice.toFixed(2)}</span>
                        <span>€{childTotal.toFixed(2)}</span>
                      </div>
                    )}
                    {infantCount > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>{infantCount} Infant{infantCount > 1 ? 's' : ''}</span>
                        <span>Free</span>
                      </div>
                    )}
                    {vehicles.length > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>{vehicles.length} Vehicle{vehicles.length > 1 ? 's' : ''} × €{vehiclePrice.toFixed(2)}</span>
                        <span>€{vehicleTotal.toFixed(2)}</span>
                      </div>
                    )}
                    {petCount > 0 && (
                      <div className="flex justify-between text-blue-600">
                        <span>{petCount} Pet{petCount > 1 ? 's' : ''} × €{petPrice.toFixed(2)}</span>
                        <span>€{petTotal.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span>€{subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Tax (10%)</span>
                        <span>€{tax.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <div className="flex justify-between text-xl font-bold">
                        <span>Total</span>
                        <span className="text-blue-600">€{total.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center bg-white rounded-lg shadow-md p-6">
            <button
              onClick={() => dispatch(previousStep())}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
            >
              ← Back
            </button>
            <button
              onClick={() => {
                if (!selectedFerry) {
                  alert('Error: No ferry selected. Please select a ferry first.');
                  return;
                }
                if (passengers.length === 0) {
                  alert('Error: No passengers added. Please add passenger details first.');
                  return;
                }
                navigate('/booking');
              }}
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