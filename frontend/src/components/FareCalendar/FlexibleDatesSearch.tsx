import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { pricingAPI, FlexibleSearchResult, FlexibleDateOption } from '../../services/api';

interface FlexibleDatesSearchProps {
  departurePort: string;
  arrivalPort: string;
  departureDate: string;
  passengers?: number;
  onDateSelect?: (date: string, price: number) => void;
  className?: string;
}

const FlexibleDatesSearch: React.FC<FlexibleDatesSearchProps> = ({
  departurePort,
  arrivalPort,
  departureDate,
  passengers = 1,
  onDateSelect,
  className = '',
}) => {
  const [searchResult, setSearchResult] = useState<FlexibleSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flexibility, setFlexibility] = useState(3);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!departurePort || !arrivalPort || !departureDate) return;

    setLoading(true);
    setError(null);

    try {
      const data = await pricingAPI.getFlexibleSearch({
        departurePort,
        arrivalPort,
        departureDate,
        flexibilityDays: flexibility,
        passengers,
      });
      setSearchResult(data);
    } catch (err: any) {
      console.error('Failed to fetch flexible dates:', err);
      setError(err.response?.data?.detail || 'Failed to load flexible dates');
    } finally {
      setLoading(false);
    }
  }, [departurePort, arrivalPort, departureDate, flexibility, passengers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDateSelect = (option: FlexibleDateOption) => {
    setSelectedDate(option.date);
    onDateSelect?.(option.date, option.price);
  };

  const formatDate = (dateStr: string): string => {
    return format(parseISO(dateStr), 'EEE, MMM dd');
  };

  const getPriceChangeColor = (diff: number): string => {
    if (diff < 0) return 'text-green-600';
    if (diff > 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getTrendBadge = (trend: string): JSX.Element | null => {
    if (trend === 'falling') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Dropping
        </span>
      );
    }
    if (trend === 'rising') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
          <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          Rising
        </span>
      );
    }
    return null;
  };

  if (!departureDate) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 text-center ${className}`}>
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-500">Select a departure date first</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 rounded w-1/3"></div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <p className="text-red-500">{error}</p>
        <button onClick={fetchData} className="mt-2 text-blue-600 hover:underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Flexible Dates</h3>
            <p className="text-xs text-gray-500">Compare prices around your selected date</p>
          </div>

          {/* Flexibility selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">+/-</span>
            <select
              value={flexibility}
              onChange={(e) => setFlexibility(Number(e.target.value))}
              className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={1}>1 day</option>
              <option value={2}>2 days</option>
              <option value={3}>3 days</option>
              <option value={5}>5 days</option>
              <option value={7}>7 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Savings Banner */}
      {searchResult && searchResult.potential_savings > 0 && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-100">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-green-700">
              Save up to <span className="font-bold">{searchResult.potential_savings}</span> by choosing a different date!
            </p>
          </div>
        </div>
      )}

      {/* Options List */}
      {searchResult && (
        <div className="divide-y divide-gray-100">
          {searchResult.options.map((option) => (
            <button
              key={option.date}
              onClick={() => handleDateSelect(option)}
              className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                selectedDate === option.date ? 'bg-blue-50' : ''
              } ${option.is_cheapest ? 'ring-1 ring-inset ring-green-300 bg-green-50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{formatDate(option.date)}</span>
                    {option.is_cheapest && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Cheapest
                      </span>
                    )}
                    {getTrendBadge(option.trend)}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {option.available_ferries} ferries available
                  </p>
                </div>

                <div className="text-right">
                  <p className={`text-lg font-bold ${option.is_cheapest ? 'text-green-600' : 'text-gray-900'}`}>
                    {option.price}
                  </p>
                  {option.price_difference !== 0 && (
                    <p className={`text-xs ${getPriceChangeColor(option.price_difference)}`}>
                      {option.price_difference > 0 ? '+' : ''}
                      {option.price_difference} ({option.price_difference_percent > 0 ? '+' : ''}
                      {option.price_difference_percent.toFixed(0)}%)
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Footer with base info */}
      {searchResult && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          Base price on {formatDate(searchResult.base_date)}: {searchResult.base_price}
        </div>
      )}
    </div>
  );
};

export default FlexibleDatesSearch;
