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
  timeout: 30000, // 30 second timeout to prevent hanging requests
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
      localStorage.removeItem('token');
      // Store the current path to redirect back after login
      const currentPath = window.location.pathname + window.location.search;
      // Redirect to login with return URL
      window.location.href = `/login?returnTo=${encodeURIComponent(currentPath)}`;
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
    });
    return response.data;
  },

  getRoutes: async (): Promise<any[]> => {
    const response: AxiosResponse<any[]> = await api.get('/ferries/routes');
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

export default api; 