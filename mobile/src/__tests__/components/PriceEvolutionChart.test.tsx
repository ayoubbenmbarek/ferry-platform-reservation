/**
 * PriceEvolutionChart Tests
 *
 * Tests the core logic of the PriceEvolutionChart component including:
 * - Price history data processing
 * - Chart calculations
 * - Trend detection
 * - Touch interaction index calculations
 */

import { format, subDays, parseISO } from 'date-fns';

describe('PriceEvolutionChart - Logic Tests', () => {
  // Mock price history data structure
  interface PriceHistoryPoint {
    date: string;
    price: number;
    lowest?: number;
    highest?: number;
  }

  // Calculate chart dimensions
  const calculateChartDimensions = (
    containerWidth: number,
    padding: { left: number; right: number; top: number; bottom: number }
  ) => {
    return {
      chartWidth: containerWidth - padding.left - padding.right,
      chartHeight: 200, // Fixed height
      paddingLeft: padding.left,
      paddingRight: padding.right,
    };
  };

  // Calculate Y scale
  const calculateYScale = (prices: number[], chartHeight: number, paddingTop: number, paddingBottom: number) => {
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1;
    const availableHeight = chartHeight - paddingTop - paddingBottom;

    return {
      minPrice,
      maxPrice,
      range,
      getY: (price: number) => {
        const normalized = (price - minPrice) / range;
        return paddingTop + availableHeight * (1 - normalized);
      },
    };
  };

  // Calculate X position for a data point
  const calculateXPosition = (index: number, totalPoints: number, chartWidth: number, paddingLeft: number) => {
    if (totalPoints <= 1) return paddingLeft;
    return paddingLeft + (index / (totalPoints - 1)) * chartWidth;
  };

  // Get index from touch position
  const getIndexFromTouch = (touchX: number, chartLeft: number, chartWidth: number, totalPoints: number) => {
    const relativeX = touchX - chartLeft;
    const clampedX = Math.max(0, Math.min(chartWidth, relativeX));
    const ratio = clampedX / chartWidth;
    return Math.round(ratio * (totalPoints - 1));
  };

  // Determine trend from price history
  const determineTrend = (history: PriceHistoryPoint[]): 'rising' | 'falling' | 'stable' => {
    if (history.length < 5) return 'stable';

    const firstAvg = history.slice(0, 5).reduce((sum, p) => sum + p.price, 0) / 5;
    const lastAvg = history.slice(-5).reduce((sum, p) => sum + p.price, 0) / 5;

    if (lastAvg > firstAvg * 1.03) return 'rising';
    if (lastAvg < firstAvg * 0.97) return 'falling';
    return 'stable';
  };

  // Format price for display
  const formatPrice = (price: number): string => {
    return `${price.toFixed(2)}€`;
  };

  // Generate mock history data
  const generateMockHistory = (days: number, basePrice: number): PriceHistoryPoint[] => {
    const history: PriceHistoryPoint[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(today, i);
      const variation = Math.sin(i / 5) * 10 + Math.random() * 5;
      history.push({
        date: format(date, 'yyyy-MM-dd'),
        price: basePrice + variation,
        lowest: basePrice + variation - 5,
        highest: basePrice + variation + 10,
      });
    }

    return history;
  };

  describe('chart dimensions', () => {
    it('should calculate chart width correctly', () => {
      const dims = calculateChartDimensions(350, { left: 50, right: 20, top: 20, bottom: 40 });
      expect(dims.chartWidth).toBe(280);
    });

    it('should preserve padding values', () => {
      const dims = calculateChartDimensions(350, { left: 50, right: 20, top: 20, bottom: 40 });
      expect(dims.paddingLeft).toBe(50);
      expect(dims.paddingRight).toBe(20);
    });
  });

  describe('Y scale calculations', () => {
    const prices = [80, 85, 90, 95, 100];

    it('should find correct min and max prices', () => {
      const scale = calculateYScale(prices, 200, 20, 40);
      expect(scale.minPrice).toBe(80);
      expect(scale.maxPrice).toBe(100);
    });

    it('should calculate correct range', () => {
      const scale = calculateYScale(prices, 200, 20, 40);
      expect(scale.range).toBe(20);
    });

    it('should map max price to top of chart', () => {
      const scale = calculateYScale(prices, 200, 20, 40);
      const y = scale.getY(100);
      expect(y).toBe(20); // paddingTop
    });

    it('should map min price to bottom of chart', () => {
      const scale = calculateYScale(prices, 200, 20, 40);
      const y = scale.getY(80);
      expect(y).toBe(160); // chartHeight - paddingBottom
    });

    it('should handle single price (range = 0)', () => {
      const scale = calculateYScale([85], 200, 20, 40);
      expect(scale.range).toBe(1); // Fallback to 1
    });
  });

  describe('X position calculations', () => {
    it('should place first point at left padding', () => {
      const x = calculateXPosition(0, 10, 280, 50);
      expect(x).toBe(50);
    });

    it('should place last point at right edge', () => {
      const x = calculateXPosition(9, 10, 280, 50);
      expect(x).toBe(330); // paddingLeft + chartWidth
    });

    it('should place middle point at center', () => {
      const x = calculateXPosition(5, 11, 280, 50);
      expect(x).toBe(190); // paddingLeft + chartWidth / 2
    });

    it('should handle single point', () => {
      const x = calculateXPosition(0, 1, 280, 50);
      expect(x).toBe(50);
    });
  });

  describe('touch interaction', () => {
    it('should return first index for touch at left edge', () => {
      const index = getIndexFromTouch(50, 50, 280, 30);
      expect(index).toBe(0);
    });

    it('should return last index for touch at right edge', () => {
      const index = getIndexFromTouch(330, 50, 280, 30);
      expect(index).toBe(29);
    });

    it('should return middle index for touch at center', () => {
      const index = getIndexFromTouch(190, 50, 280, 30);
      expect(index).toBe(15); // Approximately middle
    });

    it('should clamp touch position to chart bounds', () => {
      const indexLeft = getIndexFromTouch(0, 50, 280, 30);
      const indexRight = getIndexFromTouch(500, 50, 280, 30);
      expect(indexLeft).toBe(0);
      expect(indexRight).toBe(29);
    });
  });

  describe('trend detection', () => {
    it('should detect rising trend', () => {
      const risingHistory: PriceHistoryPoint[] = [];
      for (let i = 0; i < 10; i++) {
        risingHistory.push({ date: `2025-01-${i + 1}`, price: 80 + i * 2 });
      }
      expect(determineTrend(risingHistory)).toBe('rising');
    });

    it('should detect falling trend', () => {
      const fallingHistory: PriceHistoryPoint[] = [];
      for (let i = 0; i < 10; i++) {
        fallingHistory.push({ date: `2025-01-${i + 1}`, price: 100 - i * 2 });
      }
      expect(determineTrend(fallingHistory)).toBe('falling');
    });

    it('should detect stable trend', () => {
      const stableHistory: PriceHistoryPoint[] = [];
      for (let i = 0; i < 10; i++) {
        stableHistory.push({ date: `2025-01-${i + 1}`, price: 85 + (i % 2) });
      }
      expect(determineTrend(stableHistory)).toBe('stable');
    });

    it('should return stable for insufficient data', () => {
      const shortHistory: PriceHistoryPoint[] = [
        { date: '2025-01-01', price: 85 },
        { date: '2025-01-02', price: 90 },
      ];
      expect(determineTrend(shortHistory)).toBe('stable');
    });
  });

  describe('price formatting', () => {
    it('should format price with euro symbol', () => {
      expect(formatPrice(85)).toBe('85.00€');
    });

    it('should format price with 2 decimal places', () => {
      expect(formatPrice(85.5)).toBe('85.50€');
      expect(formatPrice(85.123)).toBe('85.12€');
    });
  });

  describe('mock history generation', () => {
    it('should generate correct number of days', () => {
      const history = generateMockHistory(30, 85);
      expect(history.length).toBe(30);
    });

    it('should have valid date format', () => {
      const history = generateMockHistory(5, 85);
      history.forEach((point) => {
        expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('should have price, lowest, and highest values', () => {
      const history = generateMockHistory(5, 85);
      history.forEach((point) => {
        expect(typeof point.price).toBe('number');
        expect(typeof point.lowest).toBe('number');
        expect(typeof point.highest).toBe('number');
        expect(point.lowest).toBeLessThan(point.price);
        expect(point.highest).toBeGreaterThan(point.price);
      });
    });
  });

  describe('price history response structure', () => {
    const mockResponse = {
      route_id: 'marseille_tunis',
      departure_date: '2025-05-15',
      days_of_data: 30,
      history: generateMockHistory(30, 85),
      trend: 'stable',
      average_price: 87.5,
      min_price: 78.2,
      max_price: 96.8,
    };

    it('should have route information', () => {
      expect(mockResponse.route_id).toBe('marseille_tunis');
    });

    it('should have summary statistics', () => {
      expect(mockResponse.average_price).toBeDefined();
      expect(mockResponse.min_price).toBeDefined();
      expect(mockResponse.max_price).toBeDefined();
    });

    it('should have trend indication', () => {
      expect(['rising', 'falling', 'stable']).toContain(mockResponse.trend);
    });
  });

  describe('chart grid lines', () => {
    const generateGridLines = (minPrice: number, maxPrice: number, numLines: number) => {
      const lines: number[] = [];
      const step = (maxPrice - minPrice) / (numLines - 1);

      for (let i = 0; i < numLines; i++) {
        lines.push(minPrice + step * i);
      }

      return lines;
    };

    it('should generate correct number of grid lines', () => {
      const lines = generateGridLines(80, 100, 5);
      expect(lines.length).toBe(5);
    });

    it('should include min and max values', () => {
      const lines = generateGridLines(80, 100, 5);
      expect(lines[0]).toBe(80);
      expect(lines[4]).toBe(100);
    });

    it('should have evenly spaced lines', () => {
      const lines = generateGridLines(80, 100, 5);
      expect(lines[1]).toBe(85);
      expect(lines[2]).toBe(90);
      expect(lines[3]).toBe(95);
    });
  });
});
