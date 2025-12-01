import api, { getErrorMessage } from './api';
import { Booking, PassengerType, Passenger, Vehicle, PaymentIntent } from '../types';

// API passenger format (backend expects 'type' instead of 'passenger_type')
interface APIPassenger {
  type: PassengerType;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  passport_number?: string;
  document_expiry?: string;
  has_pet?: boolean;
  pet_type?: string;
}

// API vehicle format (backend expects 'type' instead of 'vehicle_type', 'registration' instead of 'license_plate')
interface APIVehicle {
  type: string;
  registration?: string;
  make?: string;
  model?: string;
  length?: number;
  width?: number;
  height?: number;
}

interface ContactInfo {
  email: string;
  phone?: string;
  first_name: string;
  last_name: string;
}

interface CabinSelectionItem {
  cabin_id: number;
  quantity: number;
  price: number;
}

// Ferry price structure (matches backend expectation)
interface FerryPrices {
  adult: number;
  child: number;
  infant: number;
  vehicle: number;
}

interface CreateBookingData {
  sailing_id: string;
  operator: string;
  departure_port?: string;
  arrival_port?: string;
  departure_time?: string;
  arrival_time?: string;
  vessel_name?: string;
  is_round_trip?: boolean;
  return_sailing_id?: string;
  return_operator?: string;
  return_departure_port?: string;
  return_arrival_port?: string;
  return_departure_time?: string;
  return_arrival_time?: string;
  return_vessel_name?: string;
  // Ferry prices for backend price calculation (same format as frontend web)
  ferry_prices?: FerryPrices;
  return_ferry_prices?: FerryPrices;
  contact_info: ContactInfo;
  passengers: APIPassenger[];
  vehicles?: APIVehicle[];
  cabin_id?: string;
  return_cabin_id?: string;
  // Multi-cabin selection
  cabin_selections?: CabinSelectionItem[];
  return_cabin_selections?: CabinSelectionItem[];
  total_cabin_price?: number;
  total_return_cabin_price?: number;
  meals?: { meal_id: string; quantity: number; journey: 'outbound' | 'return' }[];
  promo_code?: string;
  has_cancellation_protection?: boolean;
  special_requests?: string;
  // Passenger counts
  total_adults?: number;
  total_children?: number;
  total_infants?: number;
  total_vehicles?: number;
  // Price breakdown (calculated on frontend)
  outbound_fare?: number;
  return_fare?: number;
  vehicle_cost?: number;
  cabin_cost?: number;
  meal_cost?: number;
  cancellation_protection_cost?: number;
  // Totals
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
}

interface BookingListResponse {
  bookings: Booking[];
  total: number;
  page: number;
  limit: number;
}

interface CancellationData {
  reason?: string;
  refund_requested?: boolean;
}

export const bookingService = {
  // Create booking
  async createBooking(data: CreateBookingData): Promise<Booking> {
    try {
      console.log('[BookingService] Creating booking with data:', JSON.stringify(data, null, 2));
      const response = await api.post<Booking>('/bookings/', data);
      console.log('[BookingService] Booking created:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[BookingService] Error creating booking:', error.response?.data || error.message);
      throw new Error(getErrorMessage(error));
    }
  },

  // Get booking by ID
  async getBooking(bookingId: number): Promise<Booking> {
    try {
      const response = await api.get<Booking>(`/bookings/${bookingId}`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Get booking by reference
  async getBookingByReference(reference: string, email: string): Promise<Booking> {
    try {
      const response = await api.get<Booking>(`/bookings/lookup/${reference}`, {
        params: { email },
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // List user bookings
  async listBookings(page: number = 1, limit: number = 10): Promise<BookingListResponse> {
    try {
      const response = await api.get<BookingListResponse>('/bookings/', {
        params: { page, limit },
      });
      console.log('[BookingService] Bookings list response:', JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Cancel booking
  async cancelBooking(bookingId: number, data: CancellationData = {}): Promise<Booking> {
    try {
      const response = await api.post<Booking>(`/bookings/${bookingId}/cancel`, data);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Get booking status
  async getBookingStatus(bookingId: number): Promise<{ status: string; message: string }> {
    try {
      const response = await api.get(`/bookings/${bookingId}/status`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Update booking (quick update - passenger names, vehicle details)
  async quickUpdateBooking(
    bookingId: number,
    data: { passengers?: Passenger[]; vehicles?: Vehicle[] }
  ): Promise<Booking> {
    try {
      const response = await api.put<Booking>(`/bookings/${bookingId}/quick-update`, data);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Get invoice PDF
  async getInvoice(bookingId: number): Promise<Blob> {
    try {
      const response = await api.get(`/bookings/${bookingId}/invoice`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Apply promo code
  async applyPromoCode(
    bookingId: number,
    promoCode: string
  ): Promise<{ discount: number; new_total: number }> {
    try {
      const response = await api.post(`/bookings/${bookingId}/apply-promo`, {
        promo_code: promoCode,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Create payment intent
  async createPaymentIntent(bookingId: number, amount: number, currency: string = 'EUR'): Promise<PaymentIntent> {
    try {
      console.log('[PaymentService] Creating payment intent for booking:', bookingId, 'amount:', amount);
      const response = await api.post<PaymentIntent>(`/payments/create-intent`, {
        booking_id: bookingId,
        amount: amount,
        currency: currency,
        payment_method: 'credit_card',
      });
      console.log('[PaymentService] Payment intent created:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[PaymentService] Error creating payment intent:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      throw new Error(getErrorMessage(error));
    }
  },

  // Confirm payment
  async confirmPayment(
    bookingId: number,
    paymentIntentId: string
  ): Promise<{ success: boolean; booking: Booking }> {
    try {
      console.log('[PaymentService] Confirming payment:', paymentIntentId);
      // Backend expects payment_intent_id in URL path
      const response = await api.post(`/payments/confirm/${paymentIntentId}`);
      console.log('[PaymentService] Payment confirmed:', response.data);
      return { success: true, booking: response.data };
    } catch (error: any) {
      console.error('[PaymentService] Error confirming payment:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      throw new Error(getErrorMessage(error));
    }
  },
};
