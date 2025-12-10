import React, { useState, useRef, useEffect } from 'react';

interface DatePickerInputProps {
  value: string;
  onChange: (date: string) => void;
  min?: string;
  label?: string;
  error?: string;
  className?: string;
  placeholder?: string;
}

const DatePickerInput: React.FC<DatePickerInputProps> = ({
  value,
  onChange,
  min,
  label,
  error,
  className = '',
  placeholder = 'Select date',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) return new Date(value);
    if (min) return new Date(min);
    return new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Parse min date
  const minDate = min ? new Date(min) : new Date();
  minDate.setHours(0, 0, 0, 0);

  // Get days in month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Sunday

    const days: (number | null)[] = [];

    // Add empty cells for days before the 1st
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const isDateDisabled = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    return date < minDate;
  };

  const isDateSelected = (day: number) => {
    if (!value) return false;
    const selectedDate = new Date(value);
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === currentMonth.getMonth() &&
      selectedDate.getFullYear() === currentMonth.getFullYear()
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === currentMonth.getMonth() &&
      today.getFullYear() === currentMonth.getFullYear()
    );
  };

  const handleDateSelect = (day: number) => {
    if (isDateDisabled(day)) return;

    const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dateStr = selectedDate.toISOString().split('T')[0];
    onChange(dateStr);
    setIsOpen(false);
  };

  const navigateMonth = (delta: number) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(newMonth.getMonth() + delta);
      return newMonth;
    });
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const monthYear = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const days = getDaysInMonth(currentMonth);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Check if we can go to previous month (at least one day must be selectable)
  const canGoPrev = () => {
    const prevMonth = new Date(currentMonth);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const lastDayOfPrevMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0);
    return lastDayOfPrevMonth >= minDate;
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label}
        </label>
      )}

      {/* Input field */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 border-2 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${className}`}
      >
        {value ? (
          <span className="text-gray-900">{formatDisplayDate(value)}</span>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

      {/* Calendar dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-lg shadow-xl border border-gray-200 p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              disabled={!canGoPrev()}
              className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-semibold text-gray-900">{monthYear}</span>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="h-10" />;
              }

              const disabled = isDateDisabled(day);
              const selected = isDateSelected(day);
              const today = isToday(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  disabled={disabled}
                  className={`
                    h-10 w-full rounded-lg text-sm font-medium transition-all
                    ${disabled
                      ? 'text-gray-300 cursor-not-allowed bg-gray-50'
                      : selected
                      ? 'bg-blue-600 text-white'
                      : today
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today button */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                if (today >= minDate) {
                  const dateStr = today.toISOString().split('T')[0];
                  onChange(dateStr);
                  setIsOpen(false);
                }
              }}
              disabled={new Date() < minDate}
              className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePickerInput;
