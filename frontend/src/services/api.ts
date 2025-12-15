import axios, { AxiosResponse } from 'axios';

// API base URL - Using relative path because of proxy in package.json
// The proxy setting redirects all relative API calls to http://localhost:8010
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 second timeout to handle slower network/server responses
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect if we're on auth pages or making auth requests
      const isAuthPage = window.location.pathname.startsWith('/login') ||
                         window.location.pathname.startsWith('/register') ||
                         window.location.pathname.startsWith('/forgot-password');
      const isAuthRequest = error.config?.url?.includes('/auth/');

      if (!isAuthPage && !isAuthRequest) {
        localStorage.removeItem('token');
        // Store the current path to redirect back after login
        const currentPath = window.location.pathname + window.location.search;
        // Redirect to login with return URL
        window.location.href = `/login?returnTo=${encodeURIComponent(currentPath)}`;
      }
    }
    return Promise.reject(error);
  }
);

// Types
export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  preferredLanguage: string;
  preferredCurrency: string;
  isVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  preferredLanguage?: string;
  preferredCurrency?: string;
}

export interface SearchParams {
  departurePort: string;
  arrivalPort: string;
  departureDate: string;
  returnDate?: string;
  // Different return route support
  returnDeparturePort?: string;
  returnArrivalPort?: string;
  passengers: number;
  vehicles?: number;
  operator?: string;
}

export interface Ferry {
  id: string;
  operator: string;
  departurePort: string;
  arrivalPort: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  price: number;
  currency: string;
  availableSeats: number;
  shipName: string;
  amenities: string[];
}

export interface Passenger {
  type: 'adult' | 'child' | 'infant';
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  passportNumber?: string;
  specialNeeds?: string;
}

export interface Vehicle {
  id?: number;
  type: 'car' | 'motorcycle' | 'camper' | 'truck' | 'suv' | 'van' | 'caravan';
  make?: string;
  model?: string;
  owner?: string;
  registration?: string;
  licensePlate?: string;
  license_plate?: string;
  length?: number;
  lengthCm?: number;
  width?: number;
  widthCm?: number;
  height?: number;
  heightCm?: number;
  hasTrailer?: boolean;
  has_trailer?: boolean;
  hasCaravan?: boolean;
  has_caravan?: boolean;
  hasRoofBox?: boolean;
  has_roof_box?: boolean;
  hasBikeRack?: boolean;
  has_bike_rack?: boolean;
}

export interface CabinSelection {
  type: string;
  supplementPrice?: number;
}

export interface ContactInfo {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
}

export interface BookingData {
  sailingId: string;
  operator: string;
  passengers: Passenger[];
  vehicles?: Vehicle[];
  cabinSelection?: CabinSelection;
  contactInfo: ContactInfo;
  specialRequests?: string;
}

export interface Booking {
  id: number;
  bookingReference: string;
  status: string;
  operator: string;
  departurePort: string;
  arrivalPort: string;
  departureTime: string;
  arrivalTime: string;
  totalPassengers: number;
  totalVehicles: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  contactEmail: string;
  contactPhone: string;
  contactFirstName: string;
  contactLastName: string;
  passengers: Passenger[];
  vehicles?: Vehicle[];
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;  // When pending booking expires
}

// Authentication API
export const authAPI = {
  login: async (credentials: { email: string; password: string }): Promise<LoginResponse> => {
    const response: AxiosResponse<LoginResponse> = await api.post('/auth/login-email', credentials);
    return response.data;
  },

  register: async (userData: RegisterData): Promise<User> => {
    // Convert camelCase to snake_case for backend
    const response: AxiosResponse<any> = await api.post('/auth/register', {
      email: userData.email,
      password: userData.password,
      first_name: userData.firstName,
      last_name: userData.lastName,
      phone: userData.phone,
      preferred_language: userData.preferredLanguage || 'en',
      preferred_currency: userData.preferredCurrency || 'EUR'
    });
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response: AxiosResponse<User> = await api.get('/auth/me');
    return response.data;
  },

  updateUser: async (userData: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    preferredLanguage?: string;
    preferredCurrency?: string;
  }): Promise<User> => {
    // Convert camelCase to snake_case for backend
    const response: AxiosResponse<any> = await api.put('/auth/me', {
      first_name: userData.firstName,
      last_name: userData.lastName,
      phone: userData.phone,
      preferred_language: userData.preferredLanguage,
      preferred_currency: userData.preferredCurrency,
    });
    return response.data;
  },

  changePassword: async (passwordData: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> => {
    await api.post('/auth/change-password', {
      current_password: passwordData.currentPassword,
      new_password: passwordData.newPassword,
    });
  },

  forgotPassword: async (email: string): Promise<void> => {
    await api.post('/auth/forgot-password', { email });
  },

  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    await api.post('/auth/reset-password', { token, newPassword });
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },
};

// Ferry search API
export const ferryAPI = {
  search: async (params: SearchParams): Promise<any> => {
    // Backend expects POST with body, not GET with query params
    // Use longer timeout for search as it may query multiple operators
    const response: AxiosResponse<any> = await api.post('/ferries/search', {
      departure_port: params.departurePort,
      arrival_port: params.arrivalPort,
      departure_date: params.departureDate,
      return_date: params.returnDate,
      // Different return route support
      return_departure_port: params.returnDeparturePort,
      return_arrival_port: params.returnArrivalPort,
      adults: params.passengers || 1,
      children: 0,
      infants: 0,
      operators: params.operator ? [params.operator] : undefined
    }, {
      timeout: 60000, // 60 second timeout for search (queries multiple operators)
    });
    return response.data;
  },

  getRoutes: async (): Promise<any[]> => {
    const response: AxiosResponse<any[]> = await api.get('/ferries/routes');
    return response.data;
  },

  getPorts: async (): Promise<any[]> => {
    const response: AxiosResponse<any[]> = await api.get('/ferries/ports');
    return response.data;
  },

  getOperators: async (): Promise<any[]> => {
    const response: AxiosResponse<any[]> = await api.get('/ferries/operators');
    return response.data;
  },

  getSchedule: async (sailingId: string): Promise<any> => {
    const response: AxiosResponse<any> = await api.get(`/ferries/schedule/${sailingId}`);
    return response.data;
  },
};

// Booking API
export const bookingAPI = {
  create: async (bookingData: BookingData): Promise<Booking> => {
    const response: AxiosResponse<Booking> = await api.post('/bookings', bookingData);
    return response.data;
  },

  getAll: async (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    operator?: string;
  }): Promise<{
    bookings: Booking[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> => {
    const response = await api.get('/bookings/', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Booking> => {
    const response: AxiosResponse<any> = await api.get(`/bookings/${id}`);
    // Convert snake_case to camelCase for the entire booking object including nested arrays
    const snakeToCamel = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(snakeToCamel);
      return Object.keys(obj).reduce((acc: any, key: string) => {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        acc[camelKey] = snakeToCamel(obj[key]);
        return acc;
      }, {});
    };
    return snakeToCamel(response.data);
  },

  getByReference: async (reference: string, email: string): Promise<Booking> => {
    const response: AxiosResponse<any> = await api.get(`/bookings/reference/${reference}`, {
      params: { email },
    });
    // Convert snake_case to camelCase for the entire booking object including nested arrays
    const snakeToCamel = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(snakeToCamel);
      return Object.keys(obj).reduce((acc: any, key: string) => {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        acc[camelKey] = snakeToCamel(obj[key]);
        return acc;
      }, {});
    };
    return snakeToCamel(response.data);
  },

  update: async (id: number, updateData: Partial<BookingData>): Promise<Booking> => {
    const response: AxiosResponse<Booking> = await api.put(`/bookings/${id}`, updateData);
    return response.data;
  },

  cancel: async (id: number, reason: string): Promise<void> => {
    await api.post(`/bookings/${id}/cancel`, { reason });
  },

  getStatus: async (id: number): Promise<any> => {
    const response = await api.get(`/bookings/${id}/status`);
    return response.data;
  },

  canModify: async (id: number): Promise<{
    can_modify: boolean;
    modification_type_allowed: string;
    restrictions: string[];
  }> => {
    const response = await api.get(`/bookings/${id}/can-modify`);
    return response.data;
  },

  quickUpdate: async (id: number, updateData: {
    passenger_updates?: any[];
    vehicle_updates?: any[];
  }): Promise<any> => {
    const response = await api.patch(`/bookings/${id}/quick-update`, updateData);
    return response.data;
  },

  downloadETicket: async (id: number): Promise<Blob> => {
    const response = await api.get(`/bookings/${id}/eticket`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

// Payment API
export const paymentAPI = {
  createPaymentIntent: async (paymentData: {
    booking_id: number;
    amount: number;
    currency?: string;
    payment_method: string;
  }): Promise<any> => {
    const response = await api.post('/payments/create-intent', paymentData);
    return response.data;
  },

  confirmPayment: async (paymentIntentId: string): Promise<any> => {
    const response = await api.post(`/payments/confirm/${paymentIntentId}`);
    return response.data;
  },

  getPaymentMethods: async (): Promise<any[]> => {
    const response = await api.get('/payments/methods');
    return response.data;
  },

  getStripeConfig: async (): Promise<{ publishableKey: string; currency: string }> => {
    const response = await api.get('/payments/config');
    return response.data;
  },

  getBookingPayment: async (bookingId: number): Promise<any> => {
    const response = await api.get(`/payments/booking/${bookingId}`);
    return response.data;
  },
};

// Promo Code API
export const promoCodeAPI = {
  validate: async (params: {
    code: string;
    booking_amount: number;
    email: string;
    operator?: string;
  }): Promise<{
    is_valid: boolean;
    code: string;
    message: string;
    discount_type?: string;
    discount_value?: number;
    discount_amount?: number;
    final_amount?: number;
  }> => {
    const response = await api.post('/promo-codes/validate', null, {
      params: {
        code: params.code,
        booking_amount: params.booking_amount,
        email: params.email,
        operator: params.operator,
      },
    });
    return response.data;
  },
};

// Price Alert Types
export interface PriceAlert {
  id: number;
  email: string;
  departure_port: string;
  arrival_port: string;
  date_from?: string;
  date_to?: string;
  initial_price?: number;
  current_price?: number;
  lowest_price?: number;
  highest_price?: number;
  target_price?: number;
  notify_on_drop: boolean;
  notify_on_increase: boolean;
  notify_any_change: boolean;
  price_threshold_percent: number;
  status: 'active' | 'triggered' | 'paused' | 'expired' | 'cancelled';
  last_checked_at?: string;
  last_notified_at?: string;
  notification_count: number;
  expires_at?: string;
  created_at: string;
  price_change_percent?: number;
  price_change_amount?: number;
}

export interface PriceAlertListResponse {
  routes: PriceAlert[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface CreatePriceAlertData {
  email?: string;
  departure_port: string;
  arrival_port: string;
  date_from?: string;
  date_to?: string;
  target_price?: number;
  notify_on_drop?: boolean;
  notify_on_increase?: boolean;
  notify_any_change?: boolean;
  price_threshold_percent?: number;
  initial_price?: number;
  expiration_days?: number;
}

// Price Alert API
export const priceAlertAPI = {
  create: async (data: CreatePriceAlertData): Promise<PriceAlert> => {
    const response = await api.post('/price-alerts', {
      ...data,
      notify_on_drop: data.notify_on_drop ?? true,
      notify_on_increase: data.notify_on_increase ?? false,
      notify_any_change: data.notify_any_change ?? false,
      price_threshold_percent: data.price_threshold_percent ?? 5.0,
    });
    return response.data;
  },

  getAll: async (params?: {
    email?: string;
    status?: string;
    page?: number;
    per_page?: number;
  }): Promise<PriceAlertListResponse> => {
    const response = await api.get('/price-alerts', { params });
    return response.data;
  },

  getMyRoutes: async (params?: {
    status?: string;
    page?: number;
    per_page?: number;
  }): Promise<PriceAlertListResponse> => {
    const response = await api.get('/price-alerts/my-routes', { params });
    return response.data;
  },

  getById: async (id: number): Promise<PriceAlert> => {
    const response = await api.get(`/price-alerts/${id}`);
    return response.data;
  },

  update: async (
    id: number,
    data: Partial<{
      notify_on_drop: boolean;
      notify_on_increase: boolean;
      notify_any_change: boolean;
      price_threshold_percent: number;
      target_price: number;
      status: 'active' | 'paused' | 'cancelled';
    }>,
    email?: string
  ): Promise<PriceAlert> => {
    const params = email ? { email } : {};
    const response = await api.patch(`/price-alerts/${id}`, data, { params });
    return response.data;
  },

  delete: async (id: number, email?: string): Promise<void> => {
    const params = email ? { email } : {};
    await api.delete(`/price-alerts/${id}`, { params });
  },

  pause: async (id: number): Promise<PriceAlert> => {
    const response = await api.post(`/price-alerts/${id}/pause`);
    return response.data;
  },

  resume: async (id: number): Promise<PriceAlert> => {
    const response = await api.post(`/price-alerts/${id}/resume`);
    return response.data;
  },

  checkRouteSaved: async (
    departurePort: string,
    arrivalPort: string,
    email?: string
  ): Promise<{ is_saved: boolean; alert_id: number | null; status: string | null }> => {
    const params = email ? { email } : {};
    const response = await api.get(
      `/price-alerts/check/${encodeURIComponent(departurePort)}/${encodeURIComponent(arrivalPort)}`,
      { params }
    );
    return response.data;
  },

  getStats: async (): Promise<{
    total_alerts: number;
    active_alerts: number;
    paused_alerts: number;
    triggered_alerts: number;
    routes_with_price_drops: number;
  }> => {
    const response = await api.get('/price-alerts/stats/summary');
    return response.data;
  },
};

// Fare Calendar Types
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

// Pricing API
// Availability Alerts Types
export type AlertType = 'vehicle' | 'cabin' | 'passenger';
export type AlertStatus = 'active' | 'notified' | 'expired' | 'cancelled' | 'fulfilled';

export interface AvailabilityAlert {
  id: number;
  user_id?: number;
  email: string;
  alert_type: AlertType;
  departure_port: string;
  arrival_port: string;
  departure_date: string;
  is_round_trip: boolean;
  return_date?: string;
  operator?: string;
  sailing_time?: string;
  num_adults: number;
  num_children: number;
  num_infants: number;
  vehicle_type?: string;
  vehicle_length_cm?: number;
  cabin_type?: string;
  num_cabins?: number;
  booking_id?: number;
  journey_type?: 'outbound' | 'return';
  status: AlertStatus;
  last_checked_at?: string;
  notified_at?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// Availability Alerts API
export const availabilityAlertAPI = {
  getAlerts: async (params?: { email?: string; status?: AlertStatus }): Promise<AvailabilityAlert[]> => {
    const queryParams = new URLSearchParams();
    if (params?.email) queryParams.append('email', params.email);
    if (params?.status) queryParams.append('status', params.status);

    const queryString = queryParams.toString();
    const url = queryString ? `/availability-alerts?${queryString}` : '/availability-alerts';

    const response = await api.get(url);
    return response.data;
  },

  getAlert: async (alertId: number): Promise<AvailabilityAlert> => {
    const response = await api.get(`/availability-alerts/${alertId}`);
    return response.data;
  },

  cancelAlert: async (alertId: number, email?: string): Promise<void> => {
    const queryParams = email ? `?email=${encodeURIComponent(email)}` : '';
    await api.delete(`/availability-alerts/${alertId}${queryParams}`);
  },

  markAsFulfilled: async (alertId: number, email?: string): Promise<AvailabilityAlert> => {
    const queryParams = email ? `?email=${encodeURIComponent(email)}` : '';
    const response = await api.patch(`/availability-alerts/${alertId}${queryParams}`, { status: 'fulfilled' });
    return response.data;
  },
};

export const pricingAPI = {
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

export default api; 