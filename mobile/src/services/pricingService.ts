import api from './api';

// Types
export interface FareCalendarDay {
  day: number;
  price: number | null;
  available: boolean;
  ferries: number;
  trend: 'rising' | 'falling' | 'stable';
  priceLevel: 'cheap' | 'normal' | 'expensive';
}

export interface FareCalendarData {
  route_id: string;
  departure_port: string;
  arrival_port: string;
  year_month: string;
  passengers: number;
  days: FareCalendarDay[];
  summary: {
    lowest_price: number;
    highest_price: number;
    average_price: number;
    cheapest_date: string;
    most_expensive_date: string;
    prices_available: number;
  };
}

export interface PriceHistoryPoint {
  date: string;
  lowest_price: number;
  highest_price: number;
  average_price: number;
  num_ferries: number;
}

export interface PriceHistoryData {
  route_id: string;
  departure_port: string;
  arrival_port: string;
  period_days: number;
  history: PriceHistoryPoint[];
  statistics: {
    current_price: number;
    period_low: number;
    period_high: number;
    period_average: number;
    price_change: number;
    price_change_percent: number;
    trend: 'rising' | 'falling' | 'stable';
  };
}

export interface PricePrediction {
  route_id: string;
  departure_port: string;
  arrival_port: string;
  departure_date: string;
  current_price: number;
  predicted_price: number;
  predicted_low: number;
  predicted_high: number;
  confidence: number;
  trend: 'rising' | 'falling' | 'stable';
  trend_strength: number;
  recommendation: 'book_now' | 'wait' | 'neutral' | 'great_deal';
  recommendation_reason: string;
  potential_savings: number;
  factors: {
    seasonality: number;
    days_to_departure: number;
    trend_momentum: number;
    day_of_week: number;
    demand: number;
  };
  booking_window: {
    optimal_days_before: number;
    expected_savings: number;
    risk_level: 'low' | 'medium' | 'high';
  };
}

export interface FlexibleDateOption {
  date: string;
  day_of_week: string;
  price: number;
  price_difference: number;
  price_difference_percent: number;
  is_cheapest: boolean;
  trend: 'rising' | 'falling' | 'stable';
  available_ferries: number;
}

export interface FlexibleSearchResult {
  route_id: string;
  departure_port: string;
  arrival_port: string;
  base_date: string;
  flexibility_days: number;
  base_price: number;
  options: FlexibleDateOption[];
  cheapest_option: FlexibleDateOption;
  potential_savings: number;
}

export interface RouteInsights {
  route_id: string;
  departure_port: string;
  arrival_port: string;
  statistics: {
    avg_price_30d: number;
    min_price_30d: number;
    max_price_30d: number;
    price_volatility_30d: number;
    avg_price_90d: number;
    all_time_low: number;
    all_time_high: number;
  };
  patterns: {
    best_day_of_week: string;
    worst_day_of_week: string;
    best_booking_window: string;
    weekday_vs_weekend: number;
  };
  current_status: {
    current_price: number;
    percentile: number;
    trend_7d: 'rising' | 'falling' | 'stable';
    is_good_deal: boolean;
    deal_quality: string;
  };
}

// API Functions
export const pricingService = {
  getFareCalendar: async (params: {
    departurePort: string;
    arrivalPort: string;
    yearMonth: string;
    passengers?: number;
  }): Promise<FareCalendarData> => {
    const response = await api.get('/prices/calendar', {
      params: {
        departure_port: params.departurePort,
        arrival_port: params.arrivalPort,
        year_month: params.yearMonth,
        passengers: params.passengers || 1,
      },
    });
    return response.data;
  },

  getPriceHistory: async (params: {
    departurePort: string;
    arrivalPort: string;
    days?: number;
  }): Promise<PriceHistoryData> => {
    const response = await api.get('/prices/history', {
      params: {
        departure_port: params.departurePort,
        arrival_port: params.arrivalPort,
        days: params.days || 30,
      },
    });
    return response.data;
  },

  getPrediction: async (params: {
    departurePort: string;
    arrivalPort: string;
    departureDate: string;
    passengers?: number;
  }): Promise<PricePrediction> => {
    const response = await api.get('/prices/prediction', {
      params: {
        departure_port: params.departurePort,
        arrival_port: params.arrivalPort,
        departure_date: params.departureDate,
        passengers: params.passengers || 1,
      },
    });
    return response.data;
  },

  getFlexibleSearch: async (params: {
    departurePort: string;
    arrivalPort: string;
    departureDate: string;
    flexibilityDays?: number;
    passengers?: number;
  }): Promise<FlexibleSearchResult> => {
    const response = await api.get('/prices/flexible-search', {
      params: {
        departure_port: params.departurePort,
        arrival_port: params.arrivalPort,
        departure_date: params.departureDate,
        flexibility_days: params.flexibilityDays || 3,
        passengers: params.passengers || 1,
      },
    });
    return response.data;
  },

  getRouteInsights: async (params: {
    departurePort: string;
    arrivalPort: string;
  }): Promise<RouteInsights> => {
    const response = await api.get('/prices/insights', {
      params: {
        departure_port: params.departurePort,
        arrival_port: params.arrivalPort,
      },
    });
    return response.data;
  },

  getCheapestInMonth: async (params: {
    departurePort: string;
    arrivalPort: string;
    yearMonth: string;
    passengers?: number;
    topN?: number;
  }): Promise<{ dates: FlexibleDateOption[] }> => {
    const response = await api.get('/prices/cheapest-in-month', {
      params: {
        departure_port: params.departurePort,
        arrival_port: params.arrivalPort,
        year_month: params.yearMonth,
        passengers: params.passengers || 1,
        top_n: params.topN || 5,
      },
    });
    return response.data;
  },
};

export default pricingService;
