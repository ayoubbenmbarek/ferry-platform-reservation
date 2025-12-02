import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { searchFerries, selectFerry } from '../store/slices/ferrySlice';
import DatePriceSelector from '../components/DatePriceSelector';
import AvailabilityAlertButton from '../components/AvailabilityAlertButton';
import SaveRouteButton from '../components/SaveRouteButton';

interface SearchForm {
  departurePort: string;
  arrivalPort: string;
  departureDate: string;
  returnDate: string;
  passengers: number;
  vehicles: number;
}

const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { searchResults, isSearching, searchError } = useSelector((state: RootState) => state.ferry);

  const [searchForm, setSearchForm] = useState<SearchForm>({
    departurePort: '',
    arrivalPort: '',
    departureDate: '',
    returnDate: '',
    passengers: 1,
    vehicles: 0,
  });

  // Initialize form from URL query parameters or navigation state
  useEffect(() => {
    // First, try to read from URL query parameters (from email links)
    const urlParams = new URLSearchParams(location.search);
    const fromUrl = urlParams.get('from');
    const toUrl = urlParams.get('to');
    const dateUrl = urlParams.get('date');

    console.log('🔍 SearchPage URL params:', { fromUrl, toUrl, dateUrl, search: location.search });

    if (fromUrl && toUrl && dateUrl) {
      console.log('✅ URL params found, auto-searching...');
      // URL parameters found - use these (from email notification link)
      const urlSearchForm = {
        departurePort: fromUrl.toUpperCase(),
        arrivalPort: toUrl.toUpperCase(),
        departureDate: dateUrl,
        returnDate: urlParams.get('returnDate') || '',
        passengers: parseInt(urlParams.get('adults') || '1'),
        vehicles: 0,
      };

      setSearchForm(urlSearchForm);

      // Build vehicles array if vehicle info is provided
      const vehicleType = urlParams.get('vehicleType');
      const vehicleLength = urlParams.get('vehicleLength');
      const vehicles: any[] = vehicleType ? [{
        id: 'url-vehicle-1',
        type: vehicleType.toUpperCase(),
        length: vehicleLength ? parseInt(vehicleLength) : 450,
        width: 180,
        height: 150,
      }] : [];

      // Auto-search with URL parameters
      dispatch(searchFerries({
        departurePort: urlSearchForm.departurePort,
        arrivalPort: urlSearchForm.arrivalPort,
        departureDate: urlSearchForm.departureDate,
        returnDate: urlSearchForm.returnDate || undefined,
        passengers: {
          adults: parseInt(urlParams.get('adults') || '1'),
          children: parseInt(urlParams.get('children') || '0'),
          infants: parseInt(urlParams.get('infants') || '0'),
        },
        vehicles: vehicles,
      }));
    } else if (location.state?.searchParams) {
      // Fallback to navigation state if no URL params
      const params = location.state.searchParams;
      setSearchForm(params);
      // Auto-search if params are provided
      dispatch(searchFerries({
        departurePort: params.departurePort,
        arrivalPort: params.arrivalPort,
        departureDate: params.departureDate,
        returnDate: params.returnDate || undefined,
        passengers: {
          adults: params.passengers,
          children: 0,
          infants: 0,
        },
        vehicles: [],
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSearchForm(prev => ({
      ...prev,
      [name]: name === 'passengers' || name === 'vehicles' ? parseInt(value) : value
    }));
  };

  const handleSearch = async (e: React.FormEvent | null, params?: SearchForm) => {
    if (e) e.preventDefault();

    const searchParams = params || searchForm;

    try {
      await dispatch(searchFerries({
        departurePort: searchParams.departurePort,
        arrivalPort: searchParams.arrivalPort,
        departureDate: searchParams.departureDate,
        returnDate: searchParams.returnDate || undefined,
        passengers: {
          adults: searchParams.passengers,
          children: 0,
          infants: 0,
        },
        vehicles: [],
      })).unwrap();
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleSelectFerry = (ferry: any) => {
    dispatch(selectFerry(ferry));
    navigate('/passengers');
  };

  const handleDateSelect = (newDate: string) => {
    // Update the form with the new date
    const updatedForm = { ...searchForm, departureDate: newDate };
    setSearchForm(updatedForm);
    // Trigger a new search with the updated date
    handleSearch(null, updatedForm);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search Form Section */}
      <div className="bg-gradient-to-br from-maritime-600 to-maritime-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-white mb-6">Search Ferries</h1>

          <div className="bg-white rounded-2xl shadow-strong p-6">
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Departure Port */}
                <div>
                  <label className="label">From</label>
                  <select
                    name="departurePort"
                    value={searchForm.departurePort}
                    onChange={handleInputChange}
                    className="input"
                    required
                  >
                    <option value="">Select departure port</option>
                    <option value="genoa">Genoa, Italy</option>
                    <option value="civitavecchia">Civitavecchia, Italy</option>
                    <option value="palermo">Palermo, Italy</option>
                    <option value="salerno">Salerno, Italy</option>
                    <option value="marseille">Marseille, France</option>
                    <option value="nice">Nice, France</option>
                  </select>
                </div>

                {/* Arrival Port */}
                <div>
                  <label className="label">To</label>
                  <select
                    name="arrivalPort"
                    value={searchForm.arrivalPort}
                    onChange={handleInputChange}
                    className="input"
                    required
                  >
                    <option value="">Select arrival port</option>
                    <option value="tunis">Tunis, Tunisia</option>
                  </select>
                </div>

                {/* Departure Date */}
                <div>
                  <label className="label">Departure Date</label>
                  <input
                    type="date"
                    name="departureDate"
                    value={searchForm.departureDate}
                    onChange={handleInputChange}
                    className="input"
                    required
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {/* Return Date */}
                <div>
                  <label className="label">Return Date (Optional)</label>
                  <input
                    type="date"
                    name="returnDate"
                    value={searchForm.returnDate}
                    onChange={handleInputChange}
                    className="input"
                    min={searchForm.departureDate || new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Passengers */}
                <div>
                  <label className="label">Passengers</label>
                  <select
                    name="passengers"
                    value={searchForm.passengers}
                    onChange={handleInputChange}
                    className="input"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <option key={num} value={num}>{num} passenger{num > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Vehicles */}
                <div>
                  <label className="label">Vehicles</label>
                  <select
                    name="vehicles"
                    value={searchForm.vehicles}
                    onChange={handleInputChange}
                    className="input"
                  >
                    {[0, 1, 2, 3, 4, 5].map(num => (
                      <option key={num} value={num}>{num} vehicle{num > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Search Button */}
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="btn-primary w-full btn-lg"
                    disabled={isSearching}
                  >
                    {isSearching ? 'Searching...' : 'Search Ferries'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Search Results Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Date Price Selector - Show after search is performed */}
        {searchForm.departurePort && searchForm.arrivalPort && searchForm.departureDate && !isSearching && (
          <div className="mb-8 bg-white rounded-lg shadow-md p-6">
            <DatePriceSelector
              departurePort={searchForm.departurePort}
              arrivalPort={searchForm.arrivalPort}
              selectedDate={searchForm.departureDate}
              adults={searchForm.passengers}
              onDateSelect={handleDateSelect}
            />
          </div>
        )}

        {/* Loading State */}
        {isSearching && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-maritime-600 mb-4"></div>
            <p className="text-gray-600">Searching for available ferries...</p>
          </div>
        )}

        {/* Error State */}
        {searchError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <p className="text-red-800 font-medium">{searchError}</p>
          </div>
        )}

        {/* No Results State */}
        {!isSearching && !searchError && searchResults.length === 0 && searchForm.departurePort && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No ferries found</h3>
            <p className="text-gray-600 mb-6">
              No ferries match your search criteria. Try adjusting your search parameters.
            </p>

            {/* Availability Alert Button */}
            <div className="mt-6">
              <AvailabilityAlertButton
                searchCriteria={{
                  departurePort: searchForm.departurePort,
                  arrivalPort: searchForm.arrivalPort,
                  departureDate: searchForm.departureDate,
                  isRoundTrip: !!searchForm.returnDate,
                  returnDate: searchForm.returnDate || undefined,
                  adults: searchForm.passengers,
                  children: 0,
                  infants: 0,
                  vehicle: searchForm.vehicles > 0 ? { type: 'car', length: 450 } : undefined,
                }}
                alertType={searchForm.vehicles > 0 ? 'vehicle' : 'passenger'}
              />
              <p className="text-sm text-gray-500 mt-3">
                Get notified when ferries become available for this route
              </p>
            </div>
          </div>
        )}

        {/* Results List */}
        {!isSearching && !searchError && searchResults.length > 0 && (
          <>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Available Ferries ({searchResults.length} found)
                </h2>
                <p className="text-gray-600">
                  {searchForm.departurePort} → {searchForm.arrivalPort} on {formatDate(searchForm.departureDate)}
                </p>
              </div>
              <SaveRouteButton
                departurePort={searchForm.departurePort}
                arrivalPort={searchForm.arrivalPort}
                price={searchResults[0]?.prices?.adult}
                variant="compact"
                onSaveSuccess={() => {
                  // Could show a toast notification here
                }}
              />
            </div>

            <div className="space-y-4">
              {searchResults.map((ferry: any, index: number) => (
                <div
                  key={index}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-4">
                        <div className="bg-maritime-100 text-maritime-800 px-3 py-1 rounded-full text-sm font-semibold">
                          {ferry.operator}
                        </div>
                        {ferry.vesselName && (
                          <span className="ml-3 text-gray-600 text-sm">{ferry.vesselName}</span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Departure</p>
                          <p className="font-semibold text-gray-900">{ferry.departurePort}</p>
                          <p className="text-sm text-gray-600">
                            {formatDate(ferry.departureTime)} at {formatTime(ferry.departureTime)}
                          </p>
                        </div>

                        <div className="flex items-center justify-center">
                          <div className="text-center">
                            <svg className="h-6 w-6 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            <p className="text-xs text-gray-500">{ferry.duration || 'Direct'}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm text-gray-600">Arrival</p>
                          <p className="font-semibold text-gray-900">{ferry.arrivalPort}</p>
                          <p className="text-sm text-gray-600">
                            {formatDate(ferry.arrivalTime)} at {formatTime(ferry.arrivalTime)}
                          </p>
                        </div>
                      </div>

                      {ferry.amenities && ferry.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {ferry.amenities.map((amenity: string, i: number) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                              {amenity}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="lg:ml-6 lg:text-right mt-4 lg:mt-0">
                      <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-1">From</p>
                        <p className="text-3xl font-bold text-maritime-600">
                          €{ferry.prices?.adult || '85'}
                        </p>
                        <p className="text-xs text-gray-500">per adult</p>
                      </div>

                      {/* Fare Policy Badge */}
                      <div className="mb-3">
                        <span className="inline-flex items-center text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-200">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Basic fare • Non-refundable
                        </span>
                      </div>

                      <button
                        onClick={() => handleSelectFerry(ferry)}
                        className="btn-primary w-full lg:w-auto"
                      >
                        Select Ferry
                      </button>

                      {ferry.availableSpaces?.passengers && (
                        <p className="text-xs text-gray-500 mt-2">
                          {ferry.availableSpaces.passengers} seats available
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Initial State - No search performed yet */}
        {!isSearching && !searchError && searchResults.length === 0 && !searchForm.departurePort && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg
              className="mx-auto h-16 w-16 text-maritime-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Search for Ferries</h3>
            <p className="text-gray-600">
              Enter your travel details above to find available ferry routes and schedules.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
