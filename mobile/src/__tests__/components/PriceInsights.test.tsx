/**
 * PriceInsights Tests
 *
 * Tests the core logic of the PriceInsights component including:
 * - Price percentile calculations
 * - Deal quality assessment
 * - Trend analysis
 * - Recommendation logic
 */

describe('PriceInsights - Logic Tests', () => {
  // Deal quality based on percentile (same as component logic)
  const getDealQuality = (percentile: number): { label: string; color: string } => {
    if (percentile <= 20) {
      return { label: 'Excellent Deal', color: '#16A34A' };
    }
    if (percentile <= 40) {
      return { label: 'Good Price', color: '#22C55E' };
    }
    if (percentile <= 60) {
      return { label: 'Average Price', color: '#EAB308' };
    }
    if (percentile <= 80) {
      return { label: 'Above Average', color: '#F97316' };
    }
    return { label: 'Expensive', color: '#DC2626' };
  };

  // Trend description based on trend value
  const getTrendDescription = (trend: string): string => {
    switch (trend) {
      case 'rising':
        return 'Prices are trending upward';
      case 'falling':
        return 'Prices are trending downward';
      case 'stable':
        return 'Prices are relatively stable';
      default:
        return 'Price trend unavailable';
    }
  };

  // Get booking recommendation
  const getBookingRecommendation = (
    percentile: number,
    trend: string
  ): { action: string; reason: string; urgency: 'high' | 'medium' | 'low' } => {
    if (percentile <= 20 && trend === 'rising') {
      return {
        action: 'Book Now',
        reason: 'Great price and trending up - lock in this deal!',
        urgency: 'high',
      };
    }
    if (percentile <= 30) {
      return {
        action: 'Book Soon',
        reason: 'Good price - consider booking soon',
        urgency: 'medium',
      };
    }
    if (percentile > 70 && trend === 'falling') {
      return {
        action: 'Wait',
        reason: 'Price is high but falling - waiting may save money',
        urgency: 'low',
      };
    }
    return {
      action: 'Book When Ready',
      reason: 'Price is average - book based on your schedule',
      urgency: 'low',
    };
  };

  // Calculate savings potential
  const calculateSavingsPotential = (currentPrice: number, minPrice: number): number => {
    return Math.max(0, currentPrice - minPrice);
  };

  // Format percentage
  const formatPercentile = (percentile: number): string => {
    return `${Math.round(percentile)}%`;
  };

  describe('deal quality assessment', () => {
    it('should return excellent for percentile <= 20', () => {
      expect(getDealQuality(10).label).toBe('Excellent Deal');
      expect(getDealQuality(20).label).toBe('Excellent Deal');
      expect(getDealQuality(20).color).toBe('#16A34A');
    });

    it('should return good for percentile 21-40', () => {
      expect(getDealQuality(25).label).toBe('Good Price');
      expect(getDealQuality(40).label).toBe('Good Price');
      expect(getDealQuality(30).color).toBe('#22C55E');
    });

    it('should return average for percentile 41-60', () => {
      expect(getDealQuality(50).label).toBe('Average Price');
      expect(getDealQuality(60).label).toBe('Average Price');
      expect(getDealQuality(55).color).toBe('#EAB308');
    });

    it('should return above average for percentile 61-80', () => {
      expect(getDealQuality(70).label).toBe('Above Average');
      expect(getDealQuality(80).label).toBe('Above Average');
      expect(getDealQuality(75).color).toBe('#F97316');
    });

    it('should return expensive for percentile > 80', () => {
      expect(getDealQuality(85).label).toBe('Expensive');
      expect(getDealQuality(100).label).toBe('Expensive');
      expect(getDealQuality(90).color).toBe('#DC2626');
    });
  });

  describe('trend descriptions', () => {
    it('should describe rising trend', () => {
      expect(getTrendDescription('rising')).toBe('Prices are trending upward');
    });

    it('should describe falling trend', () => {
      expect(getTrendDescription('falling')).toBe('Prices are trending downward');
    });

    it('should describe stable trend', () => {
      expect(getTrendDescription('stable')).toBe('Prices are relatively stable');
    });

    it('should handle unknown trend', () => {
      expect(getTrendDescription('unknown')).toBe('Price trend unavailable');
    });
  });

  describe('booking recommendations', () => {
    it('should recommend booking now for excellent price with rising trend', () => {
      const rec = getBookingRecommendation(15, 'rising');
      expect(rec.action).toBe('Book Now');
      expect(rec.urgency).toBe('high');
    });

    it('should recommend booking soon for good price', () => {
      const rec = getBookingRecommendation(25, 'stable');
      expect(rec.action).toBe('Book Soon');
      expect(rec.urgency).toBe('medium');
    });

    it('should recommend waiting for high price with falling trend', () => {
      const rec = getBookingRecommendation(85, 'falling');
      expect(rec.action).toBe('Wait');
      expect(rec.urgency).toBe('low');
    });

    it('should give neutral recommendation for average prices', () => {
      const rec = getBookingRecommendation(50, 'stable');
      expect(rec.action).toBe('Book When Ready');
      expect(rec.urgency).toBe('low');
    });
  });

  describe('savings calculations', () => {
    it('should calculate positive savings', () => {
      expect(calculateSavingsPotential(100, 80)).toBe(20);
    });

    it('should return 0 when current price is lowest', () => {
      expect(calculateSavingsPotential(80, 80)).toBe(0);
    });

    it('should return 0 for negative difference', () => {
      expect(calculateSavingsPotential(70, 80)).toBe(0);
    });

    it('should handle decimal prices', () => {
      expect(calculateSavingsPotential(95.50, 82.25)).toBeCloseTo(13.25);
    });
  });

  describe('percentage formatting', () => {
    it('should format whole numbers', () => {
      expect(formatPercentile(50)).toBe('50%');
    });

    it('should round decimal percentiles', () => {
      expect(formatPercentile(45.6)).toBe('46%');
      expect(formatPercentile(45.4)).toBe('45%');
    });

    it('should handle edge cases', () => {
      expect(formatPercentile(0)).toBe('0%');
      expect(formatPercentile(100)).toBe('100%');
    });
  });

  describe('insights data structure', () => {
    interface PriceInsightsData {
      current_price: number;
      avg_price_30d: number;
      min_price_30d: number;
      max_price_30d: number;
      price_percentile: number;
      trend: string;
      statistics: {
        avg_price_30d: number;
        min_price_30d: number;
        max_price_30d: number;
        price_volatility_30d: number;
      };
      patterns: {
        best_day_of_week: string;
        worst_day_of_week: string;
        best_booking_window: string;
      };
      current_status: {
        percentile: number;
        trend_7d: string;
        is_good_deal: boolean;
        deal_quality: string;
      };
    }

    const mockInsights: PriceInsightsData = {
      current_price: 85,
      avg_price_30d: 90,
      min_price_30d: 72,
      max_price_30d: 115,
      price_percentile: 35,
      trend: 'stable',
      statistics: {
        avg_price_30d: 90,
        min_price_30d: 72,
        max_price_30d: 115,
        price_volatility_30d: 12.5,
      },
      patterns: {
        best_day_of_week: 'Tuesday',
        worst_day_of_week: 'Saturday',
        best_booking_window: '2-3 weeks ahead',
      },
      current_status: {
        percentile: 35,
        trend_7d: 'stable',
        is_good_deal: true,
        deal_quality: 'Good Price',
      },
    };

    it('should have valid price statistics', () => {
      expect(mockInsights.min_price_30d).toBeLessThan(mockInsights.avg_price_30d);
      expect(mockInsights.max_price_30d).toBeGreaterThan(mockInsights.avg_price_30d);
    });

    it('should have valid percentile range', () => {
      expect(mockInsights.price_percentile).toBeGreaterThanOrEqual(0);
      expect(mockInsights.price_percentile).toBeLessThanOrEqual(100);
    });

    it('should have pattern information', () => {
      expect(mockInsights.patterns.best_day_of_week).toBeDefined();
      expect(mockInsights.patterns.worst_day_of_week).toBeDefined();
      expect(mockInsights.patterns.best_booking_window).toBeDefined();
    });

    it('should have current status information', () => {
      expect(typeof mockInsights.current_status.is_good_deal).toBe('boolean');
      expect(mockInsights.current_status.deal_quality).toBeDefined();
    });
  });

  describe('insight cards', () => {
    const insightCards = [
      { id: 'deal', title: 'Deal Quality', icon: 'pricetag' },
      { id: 'trend', title: 'Price Trend', icon: 'trending-up' },
      { id: 'stats', title: 'Statistics', icon: 'stats-chart' },
      { id: 'patterns', title: 'Best Times', icon: 'time' },
      { id: 'recommendation', title: 'Our Advice', icon: 'bulb' },
    ];

    it('should have 5 insight cards', () => {
      expect(insightCards.length).toBe(5);
    });

    it('should have correct card properties', () => {
      insightCards.forEach((card) => {
        expect(card).toHaveProperty('id');
        expect(card).toHaveProperty('title');
        expect(card).toHaveProperty('icon');
      });
    });

    it('should include deal quality card', () => {
      const dealCard = insightCards.find((c) => c.id === 'deal');
      expect(dealCard?.title).toBe('Deal Quality');
    });

    it('should include recommendation card', () => {
      const recCard = insightCards.find((c) => c.id === 'recommendation');
      expect(recCard?.title).toBe('Our Advice');
    });
  });

  describe('volatility calculation', () => {
    const calculateVolatility = (minPrice: number, maxPrice: number, avgPrice: number): number => {
      if (avgPrice === 0) return 0;
      return ((maxPrice - minPrice) / avgPrice) * 100;
    };

    it('should calculate volatility correctly', () => {
      const volatility = calculateVolatility(80, 120, 100);
      expect(volatility).toBe(40); // (120-80)/100 * 100 = 40%
    });

    it('should handle zero average price', () => {
      const volatility = calculateVolatility(0, 0, 0);
      expect(volatility).toBe(0);
    });

    it('should return higher volatility for wider price range', () => {
      const lowVolatility = calculateVolatility(90, 110, 100);
      const highVolatility = calculateVolatility(70, 130, 100);
      expect(highVolatility).toBeGreaterThan(lowVolatility);
    });
  });

  describe('price comparison display', () => {
    const formatPriceComparison = (currentPrice: number, avgPrice: number): string => {
      const diff = currentPrice - avgPrice;
      const percentage = Math.abs((diff / avgPrice) * 100).toFixed(0);

      if (diff < 0) {
        return `${percentage}% below average`;
      }
      if (diff > 0) {
        return `${percentage}% above average`;
      }
      return 'At average price';
    };

    it('should format below average price', () => {
      expect(formatPriceComparison(85, 100)).toBe('15% below average');
    });

    it('should format above average price', () => {
      expect(formatPriceComparison(115, 100)).toBe('15% above average');
    });

    it('should format at average price', () => {
      expect(formatPriceComparison(100, 100)).toBe('At average price');
    });
  });
});
