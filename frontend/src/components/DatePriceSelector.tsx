import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

interface DatePrice {
  date: string;
  dayOfWeek: string;
  dayOfMonth: number;
  month: string;
  lowestPrice: number | null;
  available: boolean;
  numFerries: number;
  isCenterDate: boolean;
}

interface DatePriceSelectorProps {
  departurePort: string;
  arrivalPort: string;
  selectedDate: string;
  centerDate?: string; // Optional: date to center the calendar on (defaults to selectedDate)
  minDate?: string; // Optional: minimum allowed date (e.g., for return after departure)
  returnDate?: string; // Optional: return date for round-trip context pricing
  adults?: number;
  children?: number;
  infants?: number;
  onDateSelect: (date: string) => void;
  className?: string;
  currentResults?: any[]; // Optional: current ferry results to sync prices
}

const DatePriceSelector: React.FC<DatePriceSelectorProps> = ({
  departurePort,
  arrivalPort,
  selectedDate,
  centerDate,
  minDate,
  returnDate,
  adults = 1,
  children = 0,
  infants = 0,
  onDateSelect,
  className = '',
  currentResults: _currentResults, // Unused: prices stay static for better UX
}) => {
  const { t } = useTranslation(['search']);
  const [datePrices, setDatePrices] = useState<DatePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullMonth, setShowFullMonth] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Use provided centerDate or fall back to selectedDate - memoized to prevent re-renders
  const fetchCenterDate = useMemo(() => centerDate || selectedDate, [centerDate, selectedDate]);

  // Track if we've already fetched for this combination to prevent duplicate fetches
  const lastFetchKey = useRef<string>('');

  // Fetch date prices when route, passengers, or return date changes
  // Note: selectedDate and showFullMonth are NOT in dependencies!
  // - selectedDate: clicking dates won't refetch
  // - showFullMonth: toggling week/month won't refetch (just filters display)
  useEffect(() => {
    const fetchKey = `${departurePort}-${arrivalPort}-${fetchCenterDate}-${returnDate || 'oneway'}-${adults}-${children}-${infants}`;

    // Only fetch if this is a new combination
    if (lastFetchKey.current === fetchKey) {
      console.log('⏭️  Skipping duplicate fetch');
      return;
    }

    const tripType = returnDate ? `round-trip (return: ${returnDate})` : 'one-way';
    console.log(`🔄 Fetching prices centered on: ${fetchCenterDate} (${tripType})`);
    lastFetchKey.current = fetchKey;
    fetchDatePrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departurePort, arrivalPort, adults, children, infants, returnDate, fetchCenterDate]);

  // DISABLED: Keep calendar prices static - don't update when clicking
  // Users found it confusing when prices changed after selection
  // The real-time price is shown in the ferry list below the calendar
  // useEffect(() => {
  //   if (currentResults && currentResults.length > 0 && datePrices.length > 0) {
  //     // Calculate actual lowest price from current results
  //     let lowestPrice: number | null = null;
  //     currentResults.forEach((ferry: any) => {
  //       const adultPrice = ferry.prices?.adult || 0;
  //       if (adultPrice > 0 && (lowestPrice === null || adultPrice < lowestPrice)) {
  //         lowestPrice = adultPrice;
  //       }
  //     });
  //
  //     // Check if price actually changed
  //     const currentDatePrice = datePrices.find(dp => dp.date === selectedDate);
  //     const priceChanged = currentDatePrice && currentDatePrice.lowestPrice !== lowestPrice;
  //
  //     if (priceChanged) {
  //       console.log(`💰 Price updated for ${selectedDate}: €${currentDatePrice.lowestPrice} → €${lowestPrice}`);
  //       setUpdatingPrice(true);
  //       setTimeout(() => setUpdatingPrice(false), 1500);
  //     }
  //
  //     // Update the price for the selected date
  //     setDatePrices(prevPrices =>
  //       prevPrices.map(dp =>
  //         dp.date === selectedDate
  //           ? { ...dp, lowestPrice: lowestPrice ? Math.round(lowestPrice * 100) / 100 : null, numFerries: currentResults.length }
  //           : dp
  //       )
  //     );
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [currentResults, selectedDate, datePrices.length]);

  // Scroll to selected date when it changes (but don't refetch prices)
  useEffect(() => {
    if (datePrices.length > 0) {
      setTimeout(() => {
        scrollToSelectedDate();
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const fetchDatePrices = async () => {
    try {
      setLoading(true);
      setError(null);

      // Always fetch full month (±15 days) to avoid refetching when toggling view
      // The display will be filtered based on showFullMonth state
      const daysBefore = 15;
      const daysAfter = 15;

      // Use fetchCenterDate so prices don't change when user clicks different dates
      // Include returnDate for round-trip pricing context
      const params: any = {
        departure_port: departurePort,
        arrival_port: arrivalPort,
        center_date: fetchCenterDate,
        days_before: daysBefore,
        days_after: daysAfter,
        adults,
        children,
        infants,
      };

      // Add return_date if this is a round-trip search
      if (returnDate) {
        params.return_date = returnDate;
      }

      const response = await axios.get('/api/v1/ferries/date-prices', { params });

      // Convert snake_case to camelCase
      const convertedData = response.data.date_prices.map((dp: any) => ({
        date: dp.date,
        dayOfWeek: dp.day_of_week,
        dayOfMonth: dp.day_of_month,
        month: dp.month,
        lowestPrice: dp.lowest_price,
        available: dp.available,
        numFerries: dp.num_ferries,
        isCenterDate: dp.is_center_date,
      }));

      setDatePrices(convertedData);

      // Scroll to selected date after render
      setTimeout(() => {
        scrollToSelectedDate();
      }, 100);
    } catch (err: any) {
      console.error('Error fetching date prices:', err);
      setError('Failed to load price calendar');
    } finally {
      setLoading(false);
    }
  };

  const scrollToSelectedDate = () => {
    if (!scrollContainerRef.current) return;

    const selectedCard = scrollContainerRef.current.querySelector('[data-selected="true"]');
    if (selectedCard) {
      const container = scrollContainerRef.current;
      const cardLeft = (selectedCard as HTMLElement).offsetLeft;
      const cardWidth = (selectedCard as HTMLElement).offsetWidth;
      const containerWidth = container.offsetWidth;

      // Center the selected card
      container.scrollTo({
        left: cardLeft - containerWidth / 2 + cardWidth / 2,
        behavior: 'smooth',
      });
    }
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollAmount = 300;

    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleDateClick = (date: string) => {
    const selectedDateObj = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Prevent selecting dates in the past
    if (selectedDateObj < today) {
      console.warn('⚠️ Cannot select past date:', date);
      return;
    }

    // Prevent selecting dates before minDate (e.g., return before departure)
    if (minDate) {
      const minDateObj = new Date(minDate);
      minDateObj.setHours(0, 0, 0, 0);

      if (selectedDateObj <= minDateObj) {
        console.warn('⚠️ Cannot select date before minimum date:', date, 'minDate:', minDate);
        return;
      }
    }

    console.log('📅 DatePriceSelector: Date clicked:', date);
    onDateSelect(date);
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return null;
    return `€${price.toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maritime-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4 text-sm text-gray-500">
        {error}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t('search:datePriceSelector.title', 'Select a different date')}
          </h3>
          <p className="text-sm text-gray-600">
            {t('search:datePriceSelector.subtitle', 'Compare prices for nearby dates')}
          </p>
          <div className="flex items-start gap-1.5 mt-1.5">
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-amber-700 font-medium">
              {t('search:datePriceSelector.priceNote', 'Prices shown are approximate. Final price will be displayed after selection.')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowFullMonth(!showFullMonth)}
          className="px-4 py-2 text-sm font-medium text-maritime-600 hover:text-maritime-700 hover:bg-maritime-50 rounded-lg transition-colors"
        >
          {showFullMonth ? '📅 Show Week' : '📅 View Month'}
        </button>
      </div>

      {/* Carousel Container */}
      <div className="relative group">
        {/* Left Arrow - Always visible on desktop */}
        <button
          onClick={() => handleScroll('left')}
          type="button"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white rounded-full shadow-lg p-2 hover:bg-gray-100 transition-all hidden md:block"
          aria-label="Scroll left"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Scrollable Date Cards */}
        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth px-1 py-2"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {datePrices
            .filter((datePrice) => {
              // In week view, only show dates within ±3 days of selected date
              if (!showFullMonth) {
                const dpDate = new Date(datePrice.date);
                const selDate = new Date(selectedDate);
                const daysDiff = Math.abs((dpDate.getTime() - selDate.getTime()) / (1000 * 60 * 60 * 24));
                return daysDiff <= 3;
              }
              // In month view, show all fetched dates
              return true;
            })
            .map((datePrice) => {
              const isSelected = datePrice.date === selectedDate;
              const isPast = new Date(datePrice.date) < new Date(new Date().setHours(0, 0, 0, 0));

              // Check if date is before minimum allowed date
              const isBeforeMin = minDate && new Date(datePrice.date) <= new Date(minDate);

              const isAvailable = datePrice.available && !isPast && !isBeforeMin;

            return (
              <button
                key={datePrice.date}
                type="button"
                data-selected={isSelected}
                onClick={() => isAvailable && handleDateClick(datePrice.date)}
                disabled={!isAvailable}
                className={`
                  flex-shrink-0 min-w-[100px] p-3 rounded-lg border-2 transition-all
                  ${
                    isSelected
                      ? 'border-maritime-600 bg-maritime-50 shadow-md scale-105'
                      : isAvailable
                      ? 'border-gray-200 bg-white hover:border-maritime-400 hover:shadow-md cursor-pointer'
                      : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                  }
                `}
              >
                {/* Day of Week */}
                <div
                  className={`text-xs font-medium uppercase tracking-wide mb-1 ${
                    isSelected
                      ? 'text-maritime-700'
                      : isAvailable
                      ? 'text-gray-600'
                      : 'text-gray-400'
                  }`}
                >
                  {datePrice.dayOfWeek}
                </div>

                {/* Date */}
                <div
                  className={`text-2xl font-bold mb-1 ${
                    isSelected
                      ? 'text-maritime-900'
                      : isAvailable
                      ? 'text-gray-900'
                      : 'text-gray-400'
                  }`}
                >
                  {datePrice.dayOfMonth}
                </div>

                {/* Month */}
                <div
                  className={`text-xs font-medium mb-2 ${
                    isSelected
                      ? 'text-maritime-600'
                      : isAvailable
                      ? 'text-gray-600'
                      : 'text-gray-400'
                  }`}
                >
                  {datePrice.month}
                </div>

                {/* Price or Status */}
                {isAvailable && datePrice.lowestPrice ? (
                  <div>
                    <div
                      className={`text-sm font-bold ${
                        isSelected ? 'text-maritime-700' : 'text-maritime-600'
                      }`}
                    >
                      {formatPrice(datePrice.lowestPrice)}
                    </div>
                    <div className="text-xs text-gray-500">per adult</div>
                    <div className="text-xs text-gray-500">
                      {datePrice.numFerries} {datePrice.numFerries === 1 ? 'ferry' : 'ferries'}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">
                    {t('search:datePriceSelector.unavailable', 'N/A')}
                  </div>
                )}

                {/* Selected Indicator */}
                {isSelected && (
                  <div className="mt-2 pt-2 border-t border-maritime-200">
                    <div className="text-xs font-medium text-maritime-700">
                      {t('search:datePriceSelector.selected', 'Selected')}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Arrow - Always visible on desktop */}
        <button
          onClick={() => handleScroll('right')}
          type="button"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white rounded-full shadow-lg p-2 hover:bg-gray-100 transition-all hidden md:block"
          aria-label="Scroll right"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Mobile Scroll Hint */}
      <div className="md:hidden text-center mt-2">
        <p className="text-xs text-gray-500">
          {t('search:datePriceSelector.scrollHint', 'Swipe to see more dates')}
        </p>
      </div>

      {/* Hide scrollbar CSS */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default DatePriceSelector;
