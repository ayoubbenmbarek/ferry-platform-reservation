import api from './api';

// Types
export interface FareCalendarDay {
  day: number;
  date: string;
  price: number | null;
  lowest_price: number | null;
  highest_price: number | null;
  available: boolean;
  num_ferries: number;
  trend: 'rising' | 'falling' | 'stable' | null;
  is_cheapest: boolean;
  is_weekend: boolean;
  price_level: 'cheap' | 'normal' | 'expensive';
}

export interface FareCalendarData {
  route_id: string;
  departure_port: string;
  arrival_port: string;
  year: number;
  month: number;
  month_name: string;
  passengers: number;
  days: FareCalendarDay[];
  summary: {
    min_price: number | null;
    max_price: number | null;
    avg_price: number | null;
    cheapest_date: string | null;
    available_days: number;
  };
}

export interface PriceHistoryPoint {
  date: string;
  price: number;
  lowest: number | null;
  highest: number | null;
  available: number | null;
}

export interface PriceHistoryData {
  route_id: string;
  departure_date: string | null;
  days_of_data: number;
  history: PriceHistoryPoint[];
  trend: 'rising' | 'falling' | 'stable';
  average_price: number;
  min_price: number;
  max_price: number;
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
  day_name: string;
  price: number;
  savings_vs_selected: number;
  is_cheapest: boolean;
  is_selected: boolean;
  available: boolean;
  num_ferries: number;
}

export interface FlexibleSearchResult {
  route_id: string;
  base_date: string;
  flexibility_days: number;
  passengers: number;
  results: FlexibleDateOption[];
  cheapest_date: string;
  cheapest_price: number;
  selected_price: number | null;
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
        base_date: params.departureDate,
        flexibility: params.flexibilityDays || 3,
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
