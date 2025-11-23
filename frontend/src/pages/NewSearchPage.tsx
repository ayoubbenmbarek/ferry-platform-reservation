import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import {
  searchFerries,
  selectFerry,
  setReturnFerry,
  setSearchParams,
  setIsRoundTrip,
  startNewSearch,
  setCurrentStep,
} from '../store/slices/ferrySlice';
import { ferryAPI } from '../services/api';
import { FerryResult, SearchParams, PORTS } from '../types/ferry';

// Search Form Component
interface SearchFormProps {
  onSearch: (params: SearchParams) => void;
  isEditMode?: boolean;
}

const SearchFormComponent: React.FC<SearchFormProps> = ({ onSearch, isEditMode = false }) => {
  const { t } = useTranslation(['search', 'common']);
  const dispatch = useDispatch<AppDispatch>();
  const existingParams = useSelector((state: RootState) => state.ferry.searchParams);

  const [form, setForm] = useState({
    departurePort: existingParams.departurePort || '',
    arrivalPort: existingParams.arrivalPort || '',
    departureDate: existingParams.departureDate || '',
    returnDate: existingParams.returnDate || '',
    // Different return route is enabled if returnDeparturePort was explicitly set
    differentReturnRoute: !!existingParams.returnDeparturePort,
    returnDeparturePort: existingParams.returnDeparturePort || '',
    returnArrivalPort: existingParams.returnArrivalPort || '',
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
    // Validate different return route if enabled
    if (form.returnDate && form.differentReturnRoute) {
      if (!form.returnDeparturePort) newErrors.returnDeparturePort = 'Please select return departure port';
      if (!form.returnArrivalPort) newErrors.returnArrivalPort = 'Please select return arrival port';
      if (form.returnDeparturePort === form.returnArrivalPort) {
        newErrors.returnArrivalPort = 'Return arrival port must be different';
      }
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
      // Include different return route if enabled
      returnDeparturePort: form.differentReturnRoute ? form.returnDeparturePort : undefined,
      returnArrivalPort: form.differentReturnRoute ? form.returnArrivalPort : undefined,
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

                {/* Different return route option */}
                {form.returnDate && (
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.differentReturnRoute}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setForm({
                            ...form,
                            differentReturnRoute: checked,
                            // Default to reversed route if not enabled
                            returnDeparturePort: checked ? form.returnDeparturePort || form.arrivalPort : '',
                            returnArrivalPort: checked ? form.returnArrivalPort || form.departurePort : '',
                          });
                        }}
                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Different return route (e.g., return from a different port)
                      </span>
                    </label>

                    {form.differentReturnRoute && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">🔄 Return From</label>
                          <select
                            value={form.returnDeparturePort}
                            onChange={(e) => setForm({ ...form, returnDeparturePort: e.target.value })}
                            className={`w-full px-4 py-3 border-2 rounded-lg ${errors.returnDeparturePort ? 'border-red-500' : 'border-gray-300'}`}
                          >
                            <option value="">Select return departure port</option>
                            {PORTS.map(port => (
                              <option key={port.code} value={port.code}>{port.name}</option>
                            ))}
                          </select>
                          {errors.returnDeparturePort && <p className="text-red-500 text-sm mt-1">{errors.returnDeparturePort}</p>}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">🏁 Return To</label>
                          <select
                            value={form.returnArrivalPort}
                            onChange={(e) => setForm({ ...form, returnArrivalPort: e.target.value })}
                            className={`w-full px-4 py-3 border-2 rounded-lg ${errors.returnArrivalPort ? 'border-red-500' : 'border-gray-300'}`}
                          >
                            <option value="">Select return arrival port</option>
                            {PORTS.map(port => (
                              <option key={port.code} value={port.code}>{port.name}</option>
                            ))}
                          </select>
                          {errors.returnArrivalPort && <p className="text-red-500 text-sm mt-1">{errors.returnArrivalPort}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">👥 Passengers</label>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="text-sm text-gray-600 mb-2 block">{t('search:passengers.adults')} ({t('search:passengers.adultsDesc')})</label>
                      <div className="flex items-center justify-between">
                        <button type="button" onClick={() => form.adults > 1 && setForm({ ...form, adults: form.adults - 1 })} className="w-8 h-8 rounded-full bg-blue-600 text-white">-</button>
                        <span className="font-semibold">{form.adults}</span>
                        <button type="button" onClick={() => setForm({ ...form, adults: form.adults + 1 })} className="w-8 h-8 rounded-full bg-blue-600 text-white">+</button>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="text-sm text-gray-600 mb-2 block">{t('search:passengers.children')} ({t('search:passengers.childrenDesc')})</label>
                      <div className="flex items-center justify-between">
                        <button type="button" onClick={() => form.children > 0 && setForm({ ...form, children: form.children - 1 })} className="w-8 h-8 rounded-full bg-blue-600 text-white">-</button>
                        <span className="font-semibold">{form.children}</span>
                        <button type="button" onClick={() => setForm({ ...form, children: form.children + 1 })} className="w-8 h-8 rounded-full bg-blue-600 text-white">+</button>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="text-sm text-gray-600 mb-2 block">{t('search:passengers.infants')} ({t('search:passengers.infantsDesc')})</label>
                      <div className="flex items-center justify-between">
                        <button type="button" onClick={() => form.infants > 0 && setForm({ ...form, infants: form.infants - 1 })} className="w-8 h-8 rounded-full bg-blue-600 text-white">-</button>
                        <span className="font-semibold">{form.infants}</span>
                        <button type="button" onClick={() => setForm({ ...form, infants: form.infants + 1 })} className="w-8 h-8 rounded-full bg-blue-600 text-white">+</button>
                      </div>
                    </div>
                  </div>
                </div>

                <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 rounded-lg text-lg font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all">
                  {isEditMode ? `🔄 ${t('search:form.updateSearch')}` : `🔍 ${t('search:searchButton')}`}
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
  const { t } = useTranslation(['search', 'common']);
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const {
    searchParams,
    searchResults,
    isSearching,
    searchError,
    currentStep,
    passengers,
    selectedFerry,
    isRoundTrip,
  } = useSelector((state: RootState) => state.ferry);

  const [hasSearchParams, setHasSearchParams] = useState(true);
  const [isEditingRoute, setIsEditingRoute] = useState(false);

  // Return ferry selection state
  const [isSelectingReturn, setIsSelectingReturn] = useState(false);
  const [returnFerryResults, setReturnFerryResults] = useState<FerryResult[]>([]);
  const [isSearchingReturn, setIsSearchingReturn] = useState(false);

  // Track if we've already searched for these params to prevent duplicates
  const searchedParamsRef = React.useRef<string>('');

  // Reset to ferry selection step when mounting the page
  useEffect(() => {
    // If we have search params and results, show ferry selection (step 2)
    if (searchParams.departurePort && searchParams.arrivalPort && searchParams.departureDate) {
      if (currentStep !== 1 && currentStep !== 2) {
        dispatch(setCurrentStep(2));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  useEffect(() => {
    // Check if we have search params
    if (!searchParams.departurePort || !searchParams.arrivalPort || !searchParams.departureDate) {
      setHasSearchParams(false);
      return;
    }

    setHasSearchParams(true);

    // Create a unique key for current search params
    const paramsKey = `${searchParams.departurePort}-${searchParams.arrivalPort}-${searchParams.departureDate}`;

    // Only search if params changed and we don't have results for these params
    if (searchResults.length === 0 && !isSearching && searchedParamsRef.current !== paramsKey) {
      searchedParamsRef.current = paramsKey;
      dispatch(searchFerries(searchParams as any));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.departurePort, searchParams.arrivalPort, searchParams.departureDate, searchResults.length, isSearching, dispatch]);

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

  const handleSelectFerry = async (ferry: FerryResult) => {
    if (isSelectingReturn) {
      // Selecting return ferry
      dispatch(setReturnFerry(ferry));
      setIsSelectingReturn(false);
      // Navigate directly to booking page
      navigate('/booking');
    } else {
      // Selecting outbound ferry
      dispatch(selectFerry(ferry));

      if (isRoundTrip && searchParams.returnDate) {
        // Search for return ferries
        setIsSearchingReturn(true);
        setIsSelectingReturn(true);

        try {
          // Determine return route (can be different from outbound)
          const returnDeparture = searchParams.returnDeparturePort || searchParams.arrivalPort;
          const returnArrival = searchParams.returnArrivalPort || searchParams.departurePort;

          const response = await ferryAPI.search({
            departurePort: returnDeparture || '',
            arrivalPort: returnArrival || '',
            departureDate: searchParams.returnDate,
            passengers: (searchParams.passengers?.adults || 1) +
                       (searchParams.passengers?.children || 0) +
                       (searchParams.passengers?.infants || 0),
          });

          // Convert snake_case to camelCase
          const results = response.results?.map((r: any) => ({
            sailingId: r.sailing_id,
            operator: r.operator,
            departurePort: r.departure_port,
            arrivalPort: r.arrival_port,
            departureTime: r.departure_time,
            arrivalTime: r.arrival_time,
            vesselName: r.vessel_name,
            duration: r.duration,
            prices: r.prices,
          })) || [];

          setReturnFerryResults(results);
        } catch (error) {
          console.error('Failed to search return ferries:', error);
          setReturnFerryResults([]);
        } finally {
          setIsSearchingReturn(false);
        }
      } else {
        // Not a round trip, navigate directly to booking
        navigate('/booking');
      }
    }
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

  // Step 2: Select ferry (previously was Step 1: Passenger details - now removed)
  if (currentStep === 2 || currentStep === 1) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-600">
                {passengers.length > 0 ? 'Step 2 of 3' : 'Step 1 of 3'}
              </span>
              <span className="text-sm font-medium text-gray-600">{t('search:selectFerry')}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: passengers.length > 0 ? '66%' : '33%' }}></div>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            {isSelectingReturn ? t('search:selectReturnFerry') : t('search:selectOutboundFerry')}
          </h1>

          {/* Show selected outbound ferry when selecting return */}
          {isSelectingReturn && selectedFerry && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-green-800 mb-2">✓ Outbound Ferry Selected</p>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">{selectedFerry.operator} - {selectedFerry.vesselName}</p>
                  <p className="text-sm text-gray-600">
                    {formatDate(selectedFerry.departureTime)} at {formatTime(selectedFerry.departureTime)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedFerry.departurePort} → {selectedFerry.arrivalPort}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {(isSearching || isSearchingReturn) && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">
                {isSelectingReturn ? t('search:searchingReturn') : t('search:searchingFerries')}
              </p>
            </div>
          )}

          {/* Error State */}
          {searchError && !isSelectingReturn && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <p className="text-red-800 font-medium">{t('common:error')}: {searchError}</p>
            </div>
          )}

          {/* Results - show return results or outbound results */}
          {!isSearching && !isSearchingReturn && (isSelectingReturn ? returnFerryResults : searchResults).length > 0 && (
            <div className="space-y-4 mb-6">
              {(isSelectingReturn ? returnFerryResults : searchResults).map((ferry) => (
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
                          <p className="text-gray-600 text-sm">{t('search:results.departure')}</p>
                          <p className="font-bold text-lg">{formatTime(ferry.departureTime)}</p>
                          <p className="text-gray-600 text-sm">{formatDate(ferry.departureTime)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-600 text-sm">{t('search:results.duration')}</p>
                          <p className="font-semibold">{calculateDuration(ferry.departureTime, ferry.arrivalTime)}</p>
                          <div className="flex items-center justify-center mt-1">
                            <div className="h-px bg-gray-300 flex-1"></div>
                            <span className="mx-2 text-gray-400">→</span>
                            <div className="h-px bg-gray-300 flex-1"></div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-600 text-sm">{t('search:results.arrival')}</p>
                          <p className="font-bold text-lg">{formatTime(ferry.arrivalTime)}</p>
                          <p className="text-gray-600 text-sm">{formatDate(ferry.arrivalTime)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 md:mt-0 md:ml-6 md:text-right">
                      <p className="text-gray-600 text-sm mb-1">{t('search:results.from')}</p>
                      <p className="text-3xl font-bold text-blue-600 mb-2">
                        €{(ferry.prices?.adult || Object.values(ferry.prices)[0] || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 mb-2">{t('search:results.perAdult')}</p>
                      <button
                        onClick={() => handleSelectFerry(ferry)}
                        className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        {t('search:results.select')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Results */}
          {!isSearching && !isSearchingReturn && (isSelectingReturn ? returnFerryResults : searchResults).length === 0 && !searchError && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <p className="text-yellow-800 font-medium mb-2">
                {isSelectingReturn ? t('search:noReturnResults') : t('search:noResults')}
              </p>
              <p className="text-yellow-700 text-sm">{t('search:tryAdjusting')}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center bg-white rounded-lg shadow-md p-6">
            <button
              onClick={() => {
                if (isSelectingReturn) {
                  // Go back to outbound selection
                  setIsSelectingReturn(false);
                  setReturnFerryResults([]);
                  dispatch(selectFerry(null as any));
                } else {
                  // Go back to home/search page
                  navigate('/');
                }
              }}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
            >
              ← {isSelectingReturn ? 'Change Outbound' : 'Back to Search'}
            </button>

            {/* Skip return selection button */}
            {isSelectingReturn && (
              <button
                onClick={() => {
                  // Skip return ferry selection and proceed to booking
                  setIsSelectingReturn(false);
                  navigate('/booking');
                }}
                className="px-6 py-2 text-blue-600 hover:text-blue-800 font-medium"
              >
                Skip for now →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback: Show search form if somehow we reach here
  // This prevents blank pages in edge cases
  return <SearchFormComponent
    isEditMode={false}
    onSearch={(params) => {
      dispatch(startNewSearch());
      dispatch(searchFerries(params as any));
      setHasSearchParams(true);
    }}
  />;
};

export default NewSearchPage;