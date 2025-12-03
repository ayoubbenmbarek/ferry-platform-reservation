import React, { useState, useEffect, useCallback } from 'react';
import { format, addMonths, subMonths, startOfMonth, getDaysInMonth, getDay, isSameMonth, isBefore, isToday, parseISO } from 'date-fns';
import { pricingAPI, FareCalendarData, FareCalendarDay } from '../../services/api';

interface FareCalendarProps {
  departurePort: string;
  arrivalPort: string;
  passengers?: number;
  onDateSelect?: (date: string, price: number) => void;
  selectedDate?: string;
  className?: string;
}

const FareCalendar: React.FC<FareCalendarProps> = ({
  departurePort,
  arrivalPort,
  passengers = 1,
  onDateSelect,
  selectedDate,
  className = '',
}) => {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [calendarData, setCalendarData] = useState<FareCalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendarData = useCallback(async () => {
    if (!departurePort || !arrivalPort) return;

    setLoading(true);
    setError(null);

    try {
      const yearMonth = format(currentMonth, 'yyyy-MM');
      const data = await pricingAPI.getFareCalendar({
        departurePort,
        arrivalPort,
        yearMonth,
        passengers,
      });
      setCalendarData(data);
    } catch (err: any) {
      console.error('Failed to fetch fare calendar:', err);
      setError(err.response?.data?.detail || 'Failed to load prices');
    } finally {
      setLoading(false);
    }
  }, [departurePort, arrivalPort, currentMonth, passengers]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  const handlePrevMonth = () => {
    const prevMonth = subMonths(currentMonth, 1);
    if (!isBefore(prevMonth, startOfMonth(new Date()))) {
      setCurrentMonth(prevMonth);
    }
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDateClick = (day: FareCalendarDay) => {
    if (!day.available || day.price === null) return;

    const dateStr = format(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day.day),
      'yyyy-MM-dd'
    );
    onDateSelect?.(dateStr, day.price);
  };

  const getPriceColor = (priceLevel: string): string => {
    switch (priceLevel) {
      case 'cheap':
        return 'bg-green-100 text-green-800 hover:bg-green-200 border-green-300';
      case 'expensive':
        return 'bg-red-100 text-red-800 hover:bg-red-200 border-red-300';
      default:
        return 'bg-blue-50 text-blue-800 hover:bg-blue-100 border-blue-200';
    }
  };

  const getTrendIcon = (trend: string): JSX.Element | null => {
    switch (trend) {
      case 'rising':
        return (
          <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        );
      case 'falling':
        return (
          <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        );
      default:
        return null;
    }
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDayOfMonth = getDay(startOfMonth(currentMonth));
    const today = new Date();

    // Adjust for Monday start (0 = Monday, 6 = Sunday)
    const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const days: JSX.Element[] = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 bg-gray-50"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const isPast = isBefore(dayDate, today) && !isToday(dayDate);
      const dayData = calendarData?.days.find((d) => d.day === day);
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const isSelected = selectedDate === dateStr;

      if (isPast || !dayData || !dayData.available || dayData.price === null) {
        days.push(
          <div
            key={day}
            className="h-16 bg-gray-100 p-1 flex flex-col items-center justify-center opacity-50"
          >
            <span className="text-xs text-gray-400">{day}</span>
            {dayData && !isPast && (
              <span className="text-xs text-gray-400">N/A</span>
            )}
          </div>
        );
      } else {
        days.push(
          <button
            key={day}
            onClick={() => handleDateClick(dayData)}
            className={`h-16 p-1 flex flex-col items-center justify-center transition-all border
              ${getPriceColor(dayData.priceLevel)}
              ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
              cursor-pointer
            `}
          >
            <div className="flex items-center gap-0.5">
              <span className="text-xs font-medium">{day}</span>
              {getTrendIcon(dayData.trend)}
            </div>
            <span className="text-sm font-bold">{dayData.price}</span>
            <span className="text-xs opacity-70">{dayData.ferries} ferries</span>
          </button>
        );
      }
    }

    return days;
  };

  const isPrevDisabled = isBefore(subMonths(currentMonth, 1), startOfMonth(new Date()));

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevMonth}
            disabled={isPrevDisabled}
            className={`p-2 rounded-full transition-colors ${
              isPrevDisabled
                ? 'text-blue-300 cursor-not-allowed'
                : 'text-white hover:bg-blue-500'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <h3 className="text-lg font-semibold text-white">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <p className="text-xs text-blue-200">
              {departurePort.charAt(0).toUpperCase() + departurePort.slice(1)} to{' '}
              {arrivalPort.charAt(0).toUpperCase() + arrivalPort.slice(1)}
            </p>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-2 rounded-full text-white hover:bg-blue-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 py-2 px-4 bg-gray-50 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-200 border border-green-400"></div>
          <span>Cheap</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></div>
          <span>Normal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-200 border border-red-400"></div>
          <span>Expensive</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-2">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        {loading ? (
          <div className="grid grid-cols-7 gap-1">
            {[...Array(35)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 animate-pulse rounded"></div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-500 text-sm">{error}</p>
            <button
              onClick={fetchCalendarData}
              className="mt-2 text-blue-600 hover:underline text-sm"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {renderCalendarDays()}
          </div>
        )}
      </div>

      {/* Summary */}
      {calendarData && !loading && !error && (
        <div className="bg-gray-50 px-4 py-3 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">Lowest</p>
              <p className="text-lg font-bold text-green-600">
                {calendarData.summary.lowest_price}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Average</p>
              <p className="text-lg font-bold text-blue-600">
                {calendarData.summary.average_price}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Highest</p>
              <p className="text-lg font-bold text-red-600">
                {calendarData.summary.highest_price}
              </p>
            </div>
          </div>
          {calendarData.summary.cheapest_date && (
            <p className="text-center text-xs text-gray-500 mt-2">
              Cheapest date: <span className="font-medium text-green-600">{calendarData.summary.cheapest_date}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default FareCalendar;
