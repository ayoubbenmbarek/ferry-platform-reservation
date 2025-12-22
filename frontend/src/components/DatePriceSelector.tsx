import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

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

// Number of days to load at a time (initial + lazy load)
const DAYS_TO_LOAD = 3;

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
  const [loadingMore, setLoadingMore] = useState<'left' | 'right' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Track the date range we've loaded
  const loadedRange = useRef<{ earliest: string; latest: string } | null>(null);

  // Use provided centerDate or fall back to selectedDate - memoized to prevent re-renders
  const fetchCenterDate = useMemo(() => centerDate || selectedDate, [centerDate, selectedDate]);

  // Track if we've already fetched for this combination to prevent duplicate fetches
  const lastFetchKey = useRef<string>('');

  // Fetch date prices when route, passengers, or return date changes
  useEffect(() => {
    // Block Tunisia-to-Tunisia searches (no domestic ferry routes)
    const TUNISIA_PORTS = ['TN00', 'TUN', 'TNZRZ'];
    const fromTunisia = TUNISIA_PORTS.includes(departurePort?.toUpperCase() || '');
    const toTunisia = TUNISIA_PORTS.includes(arrivalPort?.toUpperCase() || '');
    if (fromTunisia && toTunisia) {
      console.warn('⚠️ Skipping date prices fetch for Tunisia-to-Tunisia route');
      return;
    }

    const fetchKey = `${departurePort}-${arrivalPort}-${fetchCenterDate}-${returnDate || 'oneway'}-${adults}-${children}-${infants}`;

    // Only fetch if this is a new combination
    if (lastFetchKey.current === fetchKey) {
      console.log('⏭️  Skipping duplicate fetch');
      return;
    }

    const tripType = returnDate ? `round-trip (return: ${returnDate})` : 'one-way';
    console.log(`🔄 Fetching initial ${DAYS_TO_LOAD} days centered on: ${fetchCenterDate} (${tripType})`);
    lastFetchKey.current = fetchKey;
    loadedRange.current = null; // Reset range for new search
    fetchDatePrices(Math.floor(DAYS_TO_LOAD / 2), Math.floor(DAYS_TO_LOAD / 2), false);
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

  const fetchDatePrices = async (daysBefore: number, daysAfter: number, isLazyLoad: boolean, direction?: 'left' | 'right') => {
    try {
      if (isLazyLoad) {
        setLoadingMore(direction || null);
      } else {
        setLoading(true);
      }
      setError(null);

      // Determine the center date for the fetch
      let fetchCenter = fetchCenterDate;
      if (isLazyLoad && loadedRange.current) {
        // For lazy loading, fetch from the edge of current range
        if (direction === 'left') {
          // Fetch earlier dates - use earliest loaded date as reference
          const earliest = new Date(loadedRange.current.earliest);
          earliest.setDate(earliest.getDate() - 1); // Day before earliest
          fetchCenter = earliest.toISOString().split('T')[0];
          daysBefore = DAYS_TO_LOAD - 1;
          daysAfter = 0;
        } else if (direction === 'right') {
          // Fetch later dates - use latest loaded date as reference
          const latest = new Date(loadedRange.current.latest);
          latest.setDate(latest.getDate() + 1); // Day after latest
          fetchCenter = latest.toISOString().split('T')[0];
          daysBefore = 0;
          daysAfter = DAYS_TO_LOAD - 1;
        }
      }

      const params: any = {
        departure_port: departurePort,
        arrival_port: arrivalPort,
        center_date: fetchCenter,
        days_before: daysBefore,
        days_after: daysAfter,
        adults,
        children,
        infants,
      };

      if (returnDate) {
        params.return_date = returnDate;
      }

      console.log(`📅 Fetching ${daysBefore + daysAfter + 1} days centered on ${fetchCenter}`);
      const response = await api.get('/ferries/date-prices', { params, timeout: 60000 });

      // Convert snake_case to camelCase
      const newData: DatePrice[] = response.data.date_prices.map((dp: any) => ({
        date: dp.date,
        dayOfWeek: dp.day_of_week,
        dayOfMonth: dp.day_of_month,
        month: dp.month,
        lowestPrice: dp.lowest_price,
        available: dp.available,
        numFerries: dp.num_ferries,
        isCenterDate: dp.is_center_date,
      }));

      if (isLazyLoad && datePrices.length > 0) {
        // Merge new data with existing, avoiding duplicates
        const existingDates = new Set(datePrices.map(dp => dp.date));
        const uniqueNewData = newData.filter(dp => !existingDates.has(dp.date));

        // Combine and sort by date
        const combined = [...datePrices, ...uniqueNewData].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        setDatePrices(combined);

        // Update loaded range
        if (combined.length > 0) {
          loadedRange.current = {
            earliest: combined[0].date,
            latest: combined[combined.length - 1].date,
          };
        }
      } else {
        setDatePrices(newData);
        // Set initial loaded range
        if (newData.length > 0) {
          loadedRange.current = {
            earliest: newData[0].date,
            latest: newData[newData.length - 1].date,
          };
        }
        // Scroll to selected date after initial render
        setTimeout(() => {
          scrollToSelectedDate();
        }, 100);
      }
    } catch (err: any) {
      console.error('Error fetching date prices:', err);
      if (!isLazyLoad) {
        setError('Failed to load price calendar');
      }
    } finally {
      setLoading(false);
      setLoadingMore(null);
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
    if (!scrollContainerRef.current || loadingMore) return;

    // Lazy load more dates when scrolling
    fetchDatePrices(DAYS_TO_LOAD, DAYS_TO_LOAD, true, direction);

    // Also scroll the container
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
    <div className={`relative w-fit max-w-full mx-auto ${className}`}>
      {/* Header - compact */}
      <div className="mb-2 text-center">
        <span className="text-sm font-medium text-gray-700">
          {t('search:datePriceSelector.title', 'Select a different date')}
        </span>
      </div>

      {/* Carousel Container - sized to fit content */}
      <div className="relative group">
        {/* Left Arrow - Load earlier dates */}
        <button
          onClick={() => handleScroll('left')}
          type="button"
          disabled={loadingMore === 'left'}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white rounded-full shadow-lg p-2 hover:bg-gray-100 transition-all hidden md:flex items-center justify-center disabled:opacity-50"
          aria-label="Load earlier dates"
        >
          {loadingMore === 'left' ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-maritime-600 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          )}
        </button>

        {/* Scrollable Date Cards */}
        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth px-8 py-1 justify-center"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {datePrices.map((datePrice) => {
              const isSelected = datePrice.date === selectedDate;
              const isPast = new Date(datePrice.date) < new Date(new Date().setHours(0, 0, 0, 0));

              // Check if date is before minimum allowed date
              const isBeforeMin = minDate && new Date(datePrice.date) <= new Date(minDate);

              const isAvailable = datePrice.available && !isPast && !isBeforeMin;

              // Past dates can show prices but are not selectable
              const hasPrice = datePrice.lowestPrice !== null;

            return (
              <button
                key={datePrice.date}
                type="button"
                data-selected={isSelected}
                onClick={() => isAvailable && handleDateClick(datePrice.date)}
                disabled={!isAvailable}
                className={`
                  flex-shrink-0 min-w-[80px] p-2 rounded-lg border transition-all relative
                  ${
                    isSelected
                      ? 'border-maritime-600 bg-maritime-50 shadow-sm'
                      : isAvailable
                      ? 'border-gray-200 bg-white hover:border-maritime-400 hover:shadow-sm cursor-pointer'
                      : isPast
                      ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed grayscale'
                      : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                  }
                `}
              >
                {/* Past date indicator */}
                {isPast && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}

                {/* Day of Week */}
                <div
                  className={`text-[10px] font-medium uppercase tracking-wide ${
                    isSelected
                      ? 'text-maritime-700'
                      : isAvailable
                      ? 'text-gray-500'
                      : 'text-gray-400'
                  }`}
                >
                  {datePrice.dayOfWeek.slice(0, 3)}
                </div>

                {/* Date */}
                <div
                  className={`text-lg font-bold ${
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
                  className={`text-[10px] font-medium mb-1 ${
                    isSelected
                      ? 'text-maritime-600'
                      : isAvailable
                      ? 'text-gray-500'
                      : 'text-gray-400'
                  }`}
                >
                  {datePrice.month.slice(0, 3)}
                </div>

                {/* Price or Status - show prices for past dates too (greyed) */}
                {hasPrice ? (
                  <div
                    className={`text-xs font-bold ${
                      isSelected
                        ? 'text-maritime-700'
                        : isAvailable
                        ? 'text-maritime-600'
                        : isPast
                        ? 'text-gray-400 line-through'
                        : 'text-gray-400'
                    }`}
                  >
                    {formatPrice(datePrice.lowestPrice)}
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-400">
                    {isPast ? t('search:datePriceSelector.past', 'Past') : t('search:datePriceSelector.unavailable', 'N/A')}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Arrow - Load later dates */}
        <button
          onClick={() => handleScroll('right')}
          type="button"
          disabled={loadingMore === 'right'}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white rounded-full shadow-lg p-2 hover:bg-gray-100 transition-all hidden md:flex items-center justify-center disabled:opacity-50"
          aria-label="Load later dates"
        >
          {loadingMore === 'right' ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-maritime-600 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile: Tap buttons to load more */}
      <div className="md:hidden flex justify-center gap-3 mt-2">
        <button
          onClick={() => handleScroll('left')}
          disabled={loadingMore === 'left'}
          className="flex items-center gap-1 px-3 py-1 text-xs text-maritime-600 bg-maritime-50 rounded hover:bg-maritime-100 disabled:opacity-50"
        >
          {loadingMore === 'left' ? (
            <div className="w-3 h-3 border-2 border-maritime-300 border-t-maritime-600 rounded-full animate-spin" />
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          )}
          Earlier
        </button>
        <button
          onClick={() => handleScroll('right')}
          disabled={loadingMore === 'right'}
          className="flex items-center gap-1 px-3 py-1 text-xs text-maritime-600 bg-maritime-50 rounded hover:bg-maritime-100 disabled:opacity-50"
        >
          Later
          {loadingMore === 'right' ? (
            <div className="w-3 h-3 border-2 border-maritime-300 border-t-maritime-600 rounded-full animate-spin" />
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>
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
