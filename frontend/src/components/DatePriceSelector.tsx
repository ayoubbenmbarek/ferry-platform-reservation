import React, { useState, useEffect, useRef } from 'react';
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
  adults?: number;
  children?: number;
  infants?: number;
  onDateSelect: (date: string) => void;
  className?: string;
}

const DatePriceSelector: React.FC<DatePriceSelectorProps> = ({
  departurePort,
  arrivalPort,
  selectedDate,
  adults = 1,
  children = 0,
  infants = 0,
  onDateSelect,
  className = '',
}) => {
  const { t } = useTranslation(['search']);
  const [datePrices, setDatePrices] = useState<DatePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDatePrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departurePort, arrivalPort, selectedDate, adults, children, infants]);

  const fetchDatePrices = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get('/api/v1/ferries/date-prices', {
        params: {
          departure_port: departurePort,
          arrival_port: arrivalPort,
          center_date: selectedDate,
          days_before: 3,
          days_after: 3,
          adults,
          children,
          infants,
        },
      });

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

      // Scroll to center date after render
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
        </div>
      </div>

      {/* Carousel Container */}
      <div className="relative group">
        {/* Left Arrow */}
        <button
          onClick={() => handleScroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full shadow-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50 hidden md:block"
          aria-label="Scroll left"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          {datePrices.map((datePrice) => {
            const isSelected = datePrice.date === selectedDate;
            const isAvailable = datePrice.available;

            return (
              <button
                key={datePrice.date}
                data-selected={isSelected}
                onClick={() => isAvailable && handleDateClick(datePrice.date)}
                disabled={!isAvailable}
                className={`
                  flex-shrink-0 min-w-[100px] p-3 rounded-lg border-2 transition-all
                  ${
                    isSelected
                      ? 'border-maritime-600 bg-maritime-50 shadow-md scale-105'
                      : isAvailable
                      ? 'border-gray-200 bg-white hover:border-maritime-400 hover:shadow-md'
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

        {/* Right Arrow */}
        <button
          onClick={() => handleScroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full shadow-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50 hidden md:block"
          aria-label="Scroll right"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
