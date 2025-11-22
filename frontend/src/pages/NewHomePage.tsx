import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { setSearchParams, resetSearchState, clearVehicles, setIsRoundTrip, startNewSearch } from '../store/slices/ferrySlice';
import { RootState, AppDispatch } from '../store';
import { PORTS } from '../types/ferry';
import VoiceSearchButton from '../components/VoiceSearch/VoiceSearchButton';
import { ParsedSearchQuery } from '../utils/voiceSearchParser';

const NewHomePage: React.FC = () => {
  const { t } = useTranslation(['search', 'common']);
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { searchParams, isSearching, vehicles } = useSelector((state: RootState) => state.ferry);

  // Reset search state on mount to clear any stuck loading states
  useEffect(() => {
    dispatch(resetSearchState());
  }, [dispatch]);

  // Initialize form from Redux state or defaults
  const [form, setForm] = useState({
    departurePort: searchParams.departurePort || '',
    arrivalPort: searchParams.arrivalPort || '',
    departureDate: searchParams.departureDate || '',
    returnDate: searchParams.returnDate || '',
    // Different return route support
    differentReturnRoute: !!searchParams.returnDeparturePort,
    returnDeparturePort: searchParams.returnDeparturePort || '',
    returnArrivalPort: searchParams.returnArrivalPort || '',
    adults: searchParams.passengers?.adults || 1,
    children: searchParams.passengers?.children || 0,
    infants: searchParams.passengers?.infants || 0,
    hasVehicle: (vehicles && vehicles.length > 0) || false,
  });

  // Update form when Redux state changes (e.g., coming back from search page)
  useEffect(() => {
    if (searchParams.departurePort) {
      setForm({
        departurePort: searchParams.departurePort || '',
        arrivalPort: searchParams.arrivalPort || '',
        departureDate: searchParams.departureDate || '',
        returnDate: searchParams.returnDate || '',
        differentReturnRoute: !!searchParams.returnDeparturePort,
        returnDeparturePort: searchParams.returnDeparturePort || '',
        returnArrivalPort: searchParams.returnArrivalPort || '',
        adults: searchParams.passengers?.adults || 1,
        children: searchParams.passengers?.children || 0,
        infants: searchParams.passengers?.infants || 0,
        hasVehicle: (vehicles && vehicles.length > 0) || false,
      });
    }
  }, [searchParams, vehicles]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Handle voice search results
  const handleVoiceSearchResult = (result: ParsedSearchQuery) => {
    setVoiceError(null);

    // Map parsed port names to port codes
    const findPortCode = (portName: string | null): string => {
      if (!portName) return '';
      const normalizedName = portName.toLowerCase();
      const port = PORTS.find(p =>
        p.code.toLowerCase() === normalizedName ||
        p.name.toLowerCase().includes(normalizedName) ||
        p.city.toLowerCase().includes(normalizedName)
      );

      if (!port) {
        console.warn(`Voice search: Could not find port for "${portName}"`);
      } else {
        console.log(`Voice search: Mapped "${portName}" to ${port.code} (${port.name})`);
      }

      return port?.code || '';
    };

    const newForm = {
      ...form,
      departurePort: findPortCode(result.departurePort) || form.departurePort,
      arrivalPort: findPortCode(result.arrivalPort) || form.arrivalPort,
      departureDate: result.departureDate || form.departureDate,
      returnDate: result.returnDate || form.returnDate,
      adults: result.adults || form.adults,
      children: result.children || form.children,
      infants: result.infants || form.infants,
      hasVehicle: result.hasVehicle || form.hasVehicle,
    };

    setForm(newForm);

    // If round trip detected, set the return route
    if (result.isRoundTrip && !newForm.returnDate) {
      // Set a default return date (7 days after departure) if not specified
      if (newForm.departureDate) {
        const depDate = new Date(newForm.departureDate);
        depDate.setDate(depDate.getDate() + 7);
        newForm.returnDate = depDate.toISOString().split('T')[0];
        setForm(newForm);
      }
    }
  };

  const handleVoiceSearchError = (error: string) => {
    setVoiceError(error);
    setTimeout(() => setVoiceError(null), 5000);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.departurePort) newErrors.departurePort = t('search:validation.selectDeparturePort');
    if (!form.arrivalPort) newErrors.arrivalPort = t('search:validation.selectArrivalPort');
    if (!form.departureDate) newErrors.departureDate = t('search:validation.selectDepartureDate');

    if (form.departurePort && form.arrivalPort && form.departurePort === form.arrivalPort) {
      newErrors.arrivalPort = t('search:validation.portsMustDiffer');
    }

    if (form.returnDate && form.returnDate <= form.departureDate) {
      newErrors.returnDate = 'Return date must be after departure date';
    }

    // Validate different return route if enabled
    if (form.returnDate && form.differentReturnRoute) {
      if (!form.returnDeparturePort) newErrors.returnDeparturePort = t('search:validation.selectReturnDeparturePort');
      if (!form.returnArrivalPort) newErrors.returnArrivalPort = t('search:validation.selectReturnArrivalPort');
      if (form.returnDeparturePort === form.returnArrivalPort) {
        newErrors.returnArrivalPort = t('search:validation.returnPortsMustDiffer');
      }
    }

    if (form.adults < 1) {
      newErrors.adults = 'At least one adult passenger is required';
    }

    const today = new Date().toISOString().split('T')[0];
    if (form.departureDate < today) {
      newErrors.departureDate = 'Departure date cannot be in the past';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    // Clear any previous booking when starting a new search
    dispatch(startNewSearch());

    // Dispatch search params to Redux
    dispatch(setSearchParams({
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
    }));

    // Set round trip flag
    dispatch(setIsRoundTrip(!!form.returnDate));

    // Navigate to search page
    navigate('/search');
  };

  const incrementPassenger = (type: 'adults' | 'children' | 'infants') => {
    setForm({ ...form, [type]: form[type] + 1 });
  };

  const decrementPassenger = (type: 'adults' | 'children' | 'infants') => {
    if (type === 'adults' && form[type] <= 1) return;
    if (form[type] > 0) {
      setForm({ ...form, [type]: form[type] - 1 });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Hero Section with Search */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600">
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              ⚓ {t('search:title')}
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto">
              {t('search:subtitle')}
            </p>
            <p className="text-lg text-blue-200 mt-3">
              {t('common:features.compareOperators')}
            </p>
          </div>

          {/* Modern Search Card */}
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8">
              {/* Voice Search Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">{t('search:title')}</h2>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500 hidden sm:inline">{t('search:form.searchByVoice', 'Search by voice')}</span>
                  <VoiceSearchButton
                    onResult={handleVoiceSearchResult}
                    onError={handleVoiceSearchError}
                  />
                </div>
              </div>

              {/* Voice Error Message */}
              {voiceError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{voiceError}</p>
                </div>
              )}

              <form onSubmit={handleSearch} className="space-y-6">
                {/* Route Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      🛳️ {t('search:form.from')}
                    </label>
                    <select
                      value={form.departurePort}
                      onChange={(e) => setForm({ ...form, departurePort: e.target.value })}
                      className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                        errors.departurePort ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">{t('search:form.selectDeparturePort')}</option>
                      <optgroup label="🇮🇹 Italy">
                        {PORTS.filter(p => p.countryCode === 'IT').map(port => (
                          <option key={port.code} value={port.code}>
                            {port.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="🇫🇷 France">
                        {PORTS.filter(p => p.countryCode === 'FR').map(port => (
                          <option key={port.code} value={port.code}>
                            {port.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    {errors.departurePort && (
                      <p className="text-red-500 text-xs mt-1">{errors.departurePort}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      🏝️ {t('search:form.to')}
                    </label>
                    <select
                      value={form.arrivalPort}
                      onChange={(e) => setForm({ ...form, arrivalPort: e.target.value })}
                      className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                        errors.arrivalPort ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">{t('search:form.selectArrivalPort')}</option>
                      <optgroup label="🇹🇳 Tunisia">
                        {PORTS.filter(p => p.countryCode === 'TN').map(port => (
                          <option key={port.code} value={port.code}>
                            {port.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    {errors.arrivalPort && (
                      <p className="text-red-500 text-xs mt-1">{errors.arrivalPort}</p>
                    )}
                  </div>
                </div>

                {/* Date Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      📅 {t('search:form.departureDate')}
                    </label>
                    <input
                      type="date"
                      value={form.departureDate}
                      onChange={(e) => setForm({ ...form, departureDate: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                        errors.departureDate ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.departureDate && (
                      <p className="text-red-500 text-xs mt-1">{errors.departureDate}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      🔄 {t('search:form.returnDate')}
                    </label>
                    <input
                      type="date"
                      value={form.returnDate}
                      onChange={(e) => setForm({ ...form, returnDate: e.target.value })}
                      min={form.departureDate || new Date().toISOString().split('T')[0]}
                      className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                        errors.returnDate ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.returnDate && (
                      <p className="text-red-500 text-xs mt-1">{errors.returnDate}</p>
                    )}
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
                            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.returnDeparturePort ? 'border-red-500' : 'border-gray-300'}`}
                          >
                            <option value="">Select return departure port</option>
                            {PORTS.map(port => (
                              <option key={port.code} value={port.code}>{port.name}</option>
                            ))}
                          </select>
                          {errors.returnDeparturePort && <p className="text-red-500 text-xs mt-1">{errors.returnDeparturePort}</p>}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">🏁 Return To</label>
                          <select
                            value={form.returnArrivalPort}
                            onChange={(e) => setForm({ ...form, returnArrivalPort: e.target.value })}
                            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.returnArrivalPort ? 'border-red-500' : 'border-gray-300'}`}
                          >
                            <option value="">Select return arrival port</option>
                            {PORTS.map(port => (
                              <option key={port.code} value={port.code}>{port.name}</option>
                            ))}
                          </select>
                          {errors.returnArrivalPort && <p className="text-red-500 text-xs mt-1">{errors.returnArrivalPort}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Passengers */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    👥 {t('search:form.passengers')}
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Adults */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{t('search:passengers.adults')}</p>
                          <p className="text-xs text-gray-600">{t('search:passengers.adultsDesc')}</p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <button
                            type="button"
                            onClick={() => decrementPassenger('adults')}
                            disabled={form.adults <= 1}
                            className="w-8 h-8 rounded-full border-2 border-blue-600 text-blue-600 font-bold hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            -
                          </button>
                          <span className="font-bold text-lg w-6 text-center">{form.adults}</span>
                          <button
                            type="button"
                            onClick={() => incrementPassenger('adults')}
                            className="w-8 h-8 rounded-full border-2 border-blue-600 bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Children */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{t('search:passengers.children')}</p>
                          <p className="text-xs text-gray-600">{t('search:passengers.childrenDesc')}</p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <button
                            type="button"
                            onClick={() => decrementPassenger('children')}
                            disabled={form.children === 0}
                            className="w-8 h-8 rounded-full border-2 border-blue-600 text-blue-600 font-bold hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            -
                          </button>
                          <span className="font-bold text-lg w-6 text-center">{form.children}</span>
                          <button
                            type="button"
                            onClick={() => incrementPassenger('children')}
                            className="w-8 h-8 rounded-full border-2 border-blue-600 bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Infants */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{t('search:passengers.infants')}</p>
                          <p className="text-xs text-gray-600">{t('search:passengers.infantsDesc')}</p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <button
                            type="button"
                            onClick={() => decrementPassenger('infants')}
                            disabled={form.infants === 0}
                            className="w-8 h-8 rounded-full border-2 border-blue-600 text-blue-600 font-bold hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            -
                          </button>
                          <span className="font-bold text-lg w-6 text-center">{form.infants}</span>
                          <button
                            type="button"
                            onClick={() => incrementPassenger('infants')}
                            className="w-8 h-8 rounded-full border-2 border-blue-600 bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {errors.adults && (
                    <p className="text-red-500 text-xs mt-2">{errors.adults}</p>
                  )}
                </div>

                {/* Vehicle Toggle */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.hasVehicle}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setForm({ ...form, hasVehicle: checked });
                        // Clear vehicles from Redux when unchecked
                        if (!checked) {
                          dispatch(clearVehicles());
                        }
                      }}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-900">
                      🚗 {t('search:form.travelingWithVehicle')}
                      <span className="block text-xs text-gray-600 mt-1">
                        {t('search:form.vehicleDetailsLater', "You'll be able to add vehicle details in the next step")}
                      </span>
                    </span>
                  </label>
                </div>

                {/* Search Button */}
                <button
                  type="submit"
                  disabled={isSearching}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-cyan-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-all shadow-lg"
                >
                  {isSearching ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('common:common.loading')}
                    </span>
                  ) : (
                    `🔍 ${t('search:searchButton')}`
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              {t('common:features.whyBookTitle')}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {t('common:features.whyBookSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('common:features.bestPricesTitle')}</h3>
              <p className="text-gray-600">
                {t('common:features.bestPricesDesc')}
              </p>
            </div>

            <div className="text-center p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✅</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('common:features.instantConfirmationTitle')}</h3>
              <p className="text-gray-600">
                {t('common:features.instantConfirmationDesc')}
              </p>
            </div>

            <div className="text-center p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🛡️</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('common:features.securePaymentTitle')}</h3>
              <p className="text-gray-600">
                {t('common:features.securePaymentDesc')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* {t('common:features.popularRoutesTitle')} */}
      <div className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              {t('common:features.popularRoutesTitle')}
            </h2>
            <p className="text-lg text-gray-600">
              {t('common:features.popularRoutesSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { from: 'Genoa', to: 'Tunis', duration: '24h', price: '€85', flag: '🇮🇹' },
              { from: 'Civitavecchia', to: 'Tunis', duration: '22h', price: '€92', flag: '🇮🇹' },
              { from: 'Palermo', to: 'Tunis', duration: '11h', price: '€78', flag: '🇮🇹' },
              { from: 'Marseille', to: 'Tunis', duration: '21h', price: '€95', flag: '🇫🇷' },
              { from: 'Salerno', to: 'Tunis', duration: '16h', price: '€88', flag: '🇮🇹' },
              { from: 'Nice', to: 'Tunis', duration: '19h', price: '€98', flag: '🇫🇷' },
            ].map((route, index) => (
              <div key={index} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {route.flag} {route.from} → 🇹🇳 {route.to}
                    </h3>
                    <p className="text-sm text-gray-600">⏱️ {route.duration}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">{route.price}</p>
                    <p className="text-xs text-gray-500">from</p>
                  </div>
                </div>
                <button className="w-full py-2 px-4 border-2 border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors">
                  {t('common:features.viewSchedules')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewHomePage;