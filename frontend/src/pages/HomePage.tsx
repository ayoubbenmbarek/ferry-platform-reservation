import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setSearchParams, setIsRoundTrip, startNewSearch, searchFerries } from '../store/slices/ferrySlice';
import { AppDispatch } from '../store';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const [searchForm, setSearchForm] = useState({
    departurePort: '',
    arrivalPort: '',
    departureDate: '',
    returnDate: '',
    passengers: 1,
    vehicles: 0,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSearchForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset any existing booking state and set step to 2 for search results
    dispatch(startNewSearch());

    // Set search params in Redux store
    const searchParams = {
      departurePort: searchForm.departurePort,
      arrivalPort: searchForm.arrivalPort,
      departureDate: searchForm.departureDate,
      returnDate: searchForm.returnDate || undefined,
      passengers: {
        adults: searchForm.passengers,
        children: 0,
        infants: 0,
      },
      vehicles: [],
    };

    dispatch(setSearchParams(searchParams));
    dispatch(setIsRoundTrip(!!searchForm.returnDate));

    // Trigger search immediately to avoid issues with stale state
    dispatch(searchFerries(searchParams as any));

    // Navigate to search page
    navigate('/search');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="hero-section hero-pattern">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 text-shadow-lg">
              Ferry Bookings to Tunisia
            </h1>
            <p className="text-xl md:text-2xl text-maritime-100 mb-8 max-w-3xl mx-auto">
              Book your ferry journey from Italy and France to Tunisia with the best operators
            </p>
          </div>

          {/* Search Form */}
          <div className="max-w-4xl mx-auto mt-12">
            <div className="bg-white rounded-2xl shadow-strong p-6 md:p-8">
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
                    >
                      Search Ferries
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Choose Our Ferry Booking Service?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We make ferry travel to Tunisia simple, reliable, and affordable
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Best Prices</h3>
              <p className="text-gray-600">
                Compare prices from multiple ferry operators to find the best deals for your journey.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Secure Booking</h3>
              <p className="text-gray-600">
                Your booking and payment information is protected with industry-standard security.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">24/7 Support</h3>
              <p className="text-gray-600">
                Our customer support team is available around the clock to assist you.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Popular Routes Section */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Popular Ferry Routes to Tunisia
            </h2>
            <p className="text-lg text-gray-600">
              Discover the most popular ferry connections to Tunisia
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { from: 'Genoa', fromCode: 'genoa', to: 'Tunis', toCode: 'tunis', duration: '24h', price: '€85' },
              { from: 'Civitavecchia', fromCode: 'civitavecchia', to: 'Tunis', toCode: 'tunis', duration: '22h', price: '€92' },
              { from: 'Palermo', fromCode: 'palermo', to: 'Tunis', toCode: 'tunis', duration: '11h', price: '€78' },
              { from: 'Marseille', fromCode: 'marseille', to: 'Tunis', toCode: 'tunis', duration: '21h', price: '€95' },
              { from: 'Salerno', fromCode: 'salerno', to: 'Tunis', toCode: 'tunis', duration: '16h', price: '€88' },
              { from: 'Nice', fromCode: 'nice', to: 'Tunis', toCode: 'tunis', duration: '19h', price: '€98' },
            ].map((route, index) => {
              const handleRouteClick = () => {
                // Set the default departure date to tomorrow
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const departureDate = tomorrow.toISOString().split('T')[0];

                dispatch(startNewSearch());
                dispatch(setSearchParams({
                  departurePort: route.fromCode,
                  arrivalPort: route.toCode,
                  departureDate: departureDate,
                  passengers: { adults: 1, children: 0, infants: 0 },
                  vehicles: [],
                }));
                dispatch(searchFerries({
                  departurePort: route.fromCode,
                  arrivalPort: route.toCode,
                  departureDate: departureDate,
                  passengers: { adults: 1, children: 0, infants: 0 },
                  vehicles: [],
                } as any));
                navigate('/search');
              };

              return (
                <div key={index} className="card hover:shadow-medium transition-shadow duration-200">
                  <div className="card-body">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {route.from} → {route.to}
                        </h3>
                        <p className="text-gray-600">Duration: {route.duration}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary-600">{route.price}</p>
                        <p className="text-sm text-gray-500">from</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRouteClick}
                      className="btn-outline w-full hover:bg-primary-50"
                    >
                      View Schedules
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage; 