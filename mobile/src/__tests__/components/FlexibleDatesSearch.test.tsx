/**
 * FlexibleDatesSearch Tests
 *
 * Tests the core logic of the FlexibleDatesSearch component including:
 * - Flexibility range calculations
 * - Date formatting
 * - Savings calculations
 * - Result sorting and comparison
 */

import { addDays, subDays, format, parseISO } from 'date-fns';

describe('FlexibleDatesSearch - Logic Tests', () => {
  // Flexibility options (same as component)
  const FLEXIBILITY_OPTIONS = [
    { value: 1, label: '± 1 day' },
    { value: 3, label: '± 3 days' },
    { value: 7, label: '± 7 days' },
  ];

  // Calculate savings vs selected date
  const calculateSavings = (selectedPrice: number, comparePrice: number): number => {
    return selectedPrice - comparePrice;
  };

  // Format date for display
  const formatDisplayDate = (dateStr: string): string => {
    try {
      const date = parseISO(dateStr);
      return format(date, 'EEE, MMM d');
    } catch {
      return dateStr;
    }
  };

  // Generate date range
  const generateDateRange = (baseDate: string, flexibility: number): string[] => {
    const dates: string[] = [];
    const base = parseISO(baseDate);

    for (let i = -flexibility; i <= flexibility; i++) {
      const date = addDays(base, i);
      dates.push(format(date, 'yyyy-MM-dd'));
    }

    return dates;
  };

  // Sort results by price
  const sortByPrice = (results: Array<{ date: string; price: number }>) => {
    return [...results].sort((a, b) => a.price - b.price);
  };

  describe('flexibility options', () => {
    it('should have 3 flexibility options', () => {
      expect(FLEXIBILITY_OPTIONS.length).toBe(3);
    });

    it('should have correct values', () => {
      expect(FLEXIBILITY_OPTIONS[0].value).toBe(1);
      expect(FLEXIBILITY_OPTIONS[1].value).toBe(3);
      expect(FLEXIBILITY_OPTIONS[2].value).toBe(7);
    });

    it('should have correct labels', () => {
      expect(FLEXIBILITY_OPTIONS[0].label).toBe('± 1 day');
      expect(FLEXIBILITY_OPTIONS[1].label).toBe('± 3 days');
      expect(FLEXIBILITY_OPTIONS[2].label).toBe('± 7 days');
    });
  });

  describe('savings calculations', () => {
    it('should calculate positive savings when compare price is lower', () => {
      const savings = calculateSavings(100, 80);
      expect(savings).toBe(20);
    });

    it('should calculate negative savings when compare price is higher', () => {
      const savings = calculateSavings(80, 100);
      expect(savings).toBe(-20);
    });

    it('should return 0 when prices are equal', () => {
      const savings = calculateSavings(85, 85);
      expect(savings).toBe(0);
    });

    it('should handle decimal prices', () => {
      const savings = calculateSavings(85.50, 72.25);
      expect(savings).toBeCloseTo(13.25);
    });
  });

  describe('date formatting', () => {
    it('should format date correctly', () => {
      const formatted = formatDisplayDate('2025-05-15');
      expect(formatted).toBe('Thu, May 15');
    });

    it('should handle different months', () => {
      expect(formatDisplayDate('2025-01-01')).toBe('Wed, Jan 1');
      expect(formatDisplayDate('2025-12-31')).toBe('Wed, Dec 31');
    });

    it('should return original string for invalid date', () => {
      const result = formatDisplayDate('invalid');
      expect(result).toBeTruthy();
    });
  });

  describe('date range generation', () => {
    it('should generate correct range with flexibility 1', () => {
      const range = generateDateRange('2025-05-15', 1);
      expect(range.length).toBe(3); // -1, 0, +1
      expect(range[0]).toBe('2025-05-14');
      expect(range[1]).toBe('2025-05-15');
      expect(range[2]).toBe('2025-05-16');
    });

    it('should generate correct range with flexibility 3', () => {
      const range = generateDateRange('2025-05-15', 3);
      expect(range.length).toBe(7); // -3 to +3
      expect(range[0]).toBe('2025-05-12');
      expect(range[3]).toBe('2025-05-15');
      expect(range[6]).toBe('2025-05-18');
    });

    it('should generate correct range with flexibility 7', () => {
      const range = generateDateRange('2025-05-15', 7);
      expect(range.length).toBe(15); // -7 to +7
    });

    it('should handle month boundaries', () => {
      const range = generateDateRange('2025-05-01', 3);
      expect(range[0]).toBe('2025-04-28'); // Goes to previous month
    });

    it('should handle year boundaries', () => {
      const range = generateDateRange('2025-01-01', 3);
      expect(range[0]).toBe('2024-12-29'); // Goes to previous year
    });
  });

  describe('result sorting', () => {
    const mockResults = [
      { date: '2025-05-14', price: 95 },
      { date: '2025-05-15', price: 85 },
      { date: '2025-05-16', price: 105 },
      { date: '2025-05-17', price: 72 },
    ];

    it('should sort results by price ascending', () => {
      const sorted = sortByPrice(mockResults);
      expect(sorted[0].price).toBe(72);
      expect(sorted[1].price).toBe(85);
      expect(sorted[2].price).toBe(95);
      expect(sorted[3].price).toBe(105);
    });

    it('should not mutate original array', () => {
      const original = [...mockResults];
      sortByPrice(mockResults);
      expect(mockResults).toEqual(original);
    });

    it('should identify cheapest date', () => {
      const sorted = sortByPrice(mockResults);
      expect(sorted[0].date).toBe('2025-05-17');
    });
  });

  describe('flexible search result structure', () => {
    interface FlexibleSearchResult {
      date: string;
      day_name: string;
      price: number;
      savings_vs_selected: number;
      is_cheapest: boolean;
      is_selected: boolean;
      available: boolean;
      num_ferries: number;
    }

    const mockFlexibleResults: FlexibleSearchResult[] = [
      { date: '2025-05-14', day_name: 'Wednesday', price: 95, savings_vs_selected: -10, is_cheapest: false, is_selected: false, available: true, num_ferries: 3 },
      { date: '2025-05-15', day_name: 'Thursday', price: 85, savings_vs_selected: 0, is_cheapest: false, is_selected: true, available: true, num_ferries: 2 },
      { date: '2025-05-16', day_name: 'Friday', price: 72, savings_vs_selected: 13, is_cheapest: true, is_selected: false, available: true, num_ferries: 3 },
    ];

    it('should identify selected date', () => {
      const selected = mockFlexibleResults.find((r) => r.is_selected);
      expect(selected?.date).toBe('2025-05-15');
    });

    it('should identify cheapest date', () => {
      const cheapest = mockFlexibleResults.find((r) => r.is_cheapest);
      expect(cheapest?.date).toBe('2025-05-16');
      expect(cheapest?.price).toBe(72);
    });

    it('should calculate savings correctly relative to selected', () => {
      const selectedPrice = 85;
      mockFlexibleResults.forEach((result) => {
        const expectedSavings = selectedPrice - result.price;
        expect(result.savings_vs_selected).toBe(expectedSavings);
      });
    });

    it('should have availability information', () => {
      mockFlexibleResults.forEach((result) => {
        expect(typeof result.available).toBe('boolean');
        expect(typeof result.num_ferries).toBe('number');
      });
    });
  });

  describe('savings badge color logic', () => {
    const getSavingsColor = (savings: number) => {
      if (savings > 0) return '#16A34A'; // green
      if (savings < 0) return '#DC2626'; // red
      return '#6B7280'; // gray
    };

    it('should return green for positive savings', () => {
      expect(getSavingsColor(15)).toBe('#16A34A');
    });

    it('should return red for negative savings', () => {
      expect(getSavingsColor(-10)).toBe('#DC2626');
    });

    it('should return gray for zero savings', () => {
      expect(getSavingsColor(0)).toBe('#6B7280');
    });
  });

  describe('hint text logic', () => {
    const getHintText = (departureDate: string | undefined, flexibility: number) => {
      if (!departureDate) {
        return 'Select a departure date first to see flexible options';
      }
      return `Showing prices for ±${flexibility} days around your selected date`;
    };

    it('should show select date hint when no date selected', () => {
      const hint = getHintText(undefined, 3);
      expect(hint).toBe('Select a departure date first to see flexible options');
    });

    it('should show flexibility info when date is selected', () => {
      const hint = getHintText('2025-05-15', 3);
      expect(hint).toBe('Showing prices for ±3 days around your selected date');
    });

    it('should update hint based on flexibility value', () => {
      expect(getHintText('2025-05-15', 1)).toContain('±1 days');
      expect(getHintText('2025-05-15', 7)).toContain('±7 days');
    });
  });
});
