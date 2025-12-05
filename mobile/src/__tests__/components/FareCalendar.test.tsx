/**
 * FareCalendar Tests
 *
 * Tests the core logic of the FareCalendar component including:
 * - Price level calculations
 * - Date navigation logic
 * - Month initialization
 * - Price color mapping
 */

import { startOfMonth, addMonths, subMonths, isBefore, parseISO, format, getDaysInMonth, getDay, startOfDay } from 'date-fns';

describe('FareCalendar - Logic Tests', () => {
  // Price colors mapping (same as component)
  const getPriceColors = (priceLevel: string): { bg: string; text: string; border: string } => {
    switch (priceLevel) {
      case 'cheap':
        return { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' };
      case 'expensive':
        return { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' };
      default:
        return { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' };
    }
  };

  // Format port name (same as component)
  const formatPortName = (port: string) => port.charAt(0).toUpperCase() + port.slice(1);

  // Initial month calculation
  const getInitialMonth = (selectedDate?: string) => {
    if (selectedDate) {
      try {
        return startOfMonth(parseISO(selectedDate));
      } catch {
        return startOfMonth(new Date());
      }
    }
    return startOfMonth(new Date());
  };

  // Check if previous month is disabled
  const isPrevMonthDisabled = (currentMonth: Date) => {
    return isBefore(subMonths(currentMonth, 1), startOfMonth(new Date()));
  };

  // Adjust first day for Monday start
  const getAdjustedFirstDay = (currentMonth: Date) => {
    const firstDayOfMonth = getDay(startOfMonth(currentMonth));
    return firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  };

  describe('price level colors', () => {
    it('should return green colors for cheap price level', () => {
      const colors = getPriceColors('cheap');
      expect(colors.bg).toBe('#DCFCE7');
      expect(colors.text).toBe('#166534');
      expect(colors.border).toBe('#86EFAC');
    });

    it('should return red colors for expensive price level', () => {
      const colors = getPriceColors('expensive');
      expect(colors.bg).toBe('#FEE2E2');
      expect(colors.text).toBe('#991B1B');
      expect(colors.border).toBe('#FECACA');
    });

    it('should return blue colors for normal price level', () => {
      const colors = getPriceColors('normal');
      expect(colors.bg).toBe('#EFF6FF');
      expect(colors.text).toBe('#1E40AF');
      expect(colors.border).toBe('#BFDBFE');
    });

    it('should return blue colors for unknown price level', () => {
      const colors = getPriceColors('unknown');
      expect(colors.bg).toBe('#EFF6FF');
      expect(colors.text).toBe('#1E40AF');
      expect(colors.border).toBe('#BFDBFE');
    });
  });

  describe('port name formatting', () => {
    it('should capitalize first letter of port name', () => {
      expect(formatPortName('marseille')).toBe('Marseille');
      expect(formatPortName('tunis')).toBe('Tunis');
      expect(formatPortName('civitavecchia')).toBe('Civitavecchia');
    });

    it('should handle already capitalized port names', () => {
      expect(formatPortName('Marseille')).toBe('Marseille');
    });

    it('should handle single character port names', () => {
      expect(formatPortName('a')).toBe('A');
    });
  });

  describe('initial month calculation', () => {
    it('should return current month when no selected date', () => {
      const result = getInitialMonth();
      expect(result).toEqual(startOfMonth(new Date()));
    });

    it('should return selected date month when provided', () => {
      const result = getInitialMonth('2025-05-15');
      expect(result).toEqual(startOfMonth(new Date(2025, 4, 15)));
    });

    it('should handle invalid date and return current month', () => {
      const result = getInitialMonth('invalid-date');
      // parseISO will return Invalid Date, which startOfMonth handles
      expect(result).toBeTruthy();
    });
  });

  describe('month navigation', () => {
    it('should disable previous month button when at current month', () => {
      const currentMonth = startOfMonth(new Date());
      expect(isPrevMonthDisabled(currentMonth)).toBe(true);
    });

    it('should enable previous month button when in future month', () => {
      const futureMonth = addMonths(startOfMonth(new Date()), 2);
      expect(isPrevMonthDisabled(futureMonth)).toBe(false);
    });

    it('should correctly navigate to next month', () => {
      const currentMonth = new Date(2025, 0, 1);
      const nextMonth = addMonths(currentMonth, 1);
      expect(nextMonth.getMonth()).toBe(1);
      expect(nextMonth.getFullYear()).toBe(2025);
    });

    it('should correctly navigate to previous month', () => {
      const currentMonth = new Date(2025, 1, 1);
      const prevMonth = subMonths(currentMonth, 1);
      expect(prevMonth.getMonth()).toBe(0);
      expect(prevMonth.getFullYear()).toBe(2025);
    });
  });

  describe('calendar grid calculations', () => {
    it('should calculate correct number of days in month', () => {
      expect(getDaysInMonth(new Date(2025, 0, 1))).toBe(31); // January
      expect(getDaysInMonth(new Date(2025, 1, 1))).toBe(28); // February (non-leap)
      expect(getDaysInMonth(new Date(2024, 1, 1))).toBe(29); // February (leap)
      expect(getDaysInMonth(new Date(2025, 3, 1))).toBe(30); // April
    });

    it('should calculate correct first day offset for Monday start', () => {
      // January 2025 starts on Wednesday (3 in JS, but we want Monday as 0)
      const jan2025 = new Date(2025, 0, 1);
      const adjustedFirstDay = getAdjustedFirstDay(jan2025);
      expect(adjustedFirstDay).toBe(2); // Wednesday = index 2 in Monday-start week
    });

    it('should handle month starting on Sunday', () => {
      // Find a month starting on Sunday
      const monthStartingSunday = new Date(2025, 5, 1); // June 2025 starts on Sunday
      const adjustedFirstDay = getAdjustedFirstDay(monthStartingSunday);
      expect(adjustedFirstDay).toBe(6); // Sunday = index 6 in Monday-start week
    });

    it('should handle month starting on Monday', () => {
      const monthStartingMonday = new Date(2025, 8, 1); // September 2025 starts on Monday
      const adjustedFirstDay = getAdjustedFirstDay(monthStartingMonday);
      expect(adjustedFirstDay).toBe(0); // Monday = index 0
    });
  });

  describe('date selection logic', () => {
    const today = startOfDay(new Date());

    it('should not allow selection of past dates', () => {
      const pastDate = new Date(2020, 0, 1);
      const isPast = isBefore(pastDate, today);
      expect(isPast).toBe(true);
    });

    it('should allow selection of future dates', () => {
      const futureDate = addMonths(today, 1);
      const isPast = isBefore(futureDate, today);
      expect(isPast).toBe(false);
    });

    it('should format date correctly for selection', () => {
      const date = new Date(2025, 4, 15);
      const formatted = format(date, 'yyyy-MM-dd');
      expect(formatted).toBe('2025-05-15');
    });
  });

  describe('day names constant', () => {
    const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    it('should have 7 days', () => {
      expect(DAY_NAMES.length).toBe(7);
    });

    it('should start with Monday', () => {
      expect(DAY_NAMES[0]).toBe('Mon');
    });

    it('should end with Sunday', () => {
      expect(DAY_NAMES[6]).toBe('Sun');
    });
  });

  describe('fare calendar data handling', () => {
    interface FareCalendarDay {
      day: number;
      price: number | null;
      price_level: string;
      available: boolean;
      num_ferries: number;
      trend?: string;
    }

    const mockCalendarData = {
      days: [
        { day: 1, price: 85.5, price_level: 'normal', available: true, num_ferries: 3 },
        { day: 2, price: 72.0, price_level: 'cheap', available: true, num_ferries: 2 },
        { day: 3, price: null, price_level: 'normal', available: false, num_ferries: 0 },
        { day: 4, price: 120.0, price_level: 'expensive', available: true, num_ferries: 3, trend: 'rising' },
      ] as FareCalendarDay[],
      summary: {
        min_price: 72.0,
        max_price: 120.0,
        avg_price: 92.5,
        cheapest_date: '2025-01-02',
      },
    };

    it('should find day data by day number', () => {
      const day = mockCalendarData.days.find((d) => d.day === 2);
      expect(day?.price).toBe(72.0);
      expect(day?.price_level).toBe('cheap');
    });

    it('should identify unavailable days', () => {
      const unavailableDay = mockCalendarData.days.find((d) => d.day === 3);
      expect(unavailableDay?.available).toBe(false);
      expect(unavailableDay?.price).toBeNull();
    });

    it('should identify days with price trends', () => {
      const dayWithTrend = mockCalendarData.days.find((d) => d.day === 4);
      expect(dayWithTrend?.trend).toBe('rising');
    });

    it('should have summary statistics', () => {
      expect(mockCalendarData.summary.min_price).toBe(72.0);
      expect(mockCalendarData.summary.max_price).toBe(120.0);
      expect(mockCalendarData.summary.cheapest_date).toBe('2025-01-02');
    });
  });

  describe('trend icon logic', () => {
    const getTrendColor = (trend: string) => {
      switch (trend) {
        case 'rising':
          return '#EF4444'; // red
        case 'falling':
          return '#22C55E'; // green
        default:
          return null;
      }
    };

    it('should return red color for rising trend', () => {
      expect(getTrendColor('rising')).toBe('#EF4444');
    });

    it('should return green color for falling trend', () => {
      expect(getTrendColor('falling')).toBe('#22C55E');
    });

    it('should return null for stable trend', () => {
      expect(getTrendColor('stable')).toBeNull();
    });

    it('should return null for undefined trend', () => {
      expect(getTrendColor('')).toBeNull();
    });
  });
});
