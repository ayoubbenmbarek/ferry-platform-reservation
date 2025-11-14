/**
 * Booking Service - API calls for ferry bookings
 */

import axios from 'axios';
import { PassengerInfo, VehicleInfo } from '../types/ferry';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8010';

export interface ContactInfo {
  email: string;
  phone?: string;
  first_name: string;
  last_name: string;
}

export interface CabinSelection {
  type: string;
  supplement_price?: number;
}

export interface CreateBookingRequest {
  sailing_id: string;
  operator: string;
  contact_info: ContactInfo;
  passengers: {
    type: string;
    first_name: string;
    last_name: string;
    date_of_birth?: string;
    nationality?: string;
    passport_number?: string;
    special_needs?: string;
  }[];
  vehicles?: {
    type: string;
    length: number;
    width: number;
    height: number;
    weight?: number;
    registration?: string;
    make?: string;
    model?: string;
  }[];
  cabin_selection?: CabinSelection;
  special_requests?: string;
}

export interface BookingResponse {
  id: number;
  booking_reference: string;
  operator_booking_reference?: string;
  status: string;
  contact_email: string;
  contact_first_name: string;
  contact_last_name: string;
  sailing_id: string;
  operator: string;
  total_passengers: number;
  total_vehicles: number;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  passengers: any[];
  vehicles: any[];
  created_at: string;
  updated_at: string;
}

export const bookingService = {
  /**
   * Create a new ferry booking
   */
  async createBooking(bookingData: CreateBookingRequest): Promise<BookingResponse> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/bookings/`,
        bookingData
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to create booking'
      );
    }
  },

  /**
   * Get booking by ID
   */
  async getBooking(bookingId: number): Promise<BookingResponse> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/bookings/${bookingId}`
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.detail ||
        'Failed to fetch booking'
      );
    }
  },

  /**
   * Get booking by reference and email (for guests)
   */
  async getBookingByReference(
    bookingReference: string,
    email: string
  ): Promise<BookingResponse> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/bookings/reference/${bookingReference}`,
        { params: { email } }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.detail ||
        'Failed to fetch booking'
      );
    }
  },

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: number, reason: string): Promise<void> {
    try {
      await axios.post(
        `${API_BASE_URL}/api/v1/bookings/${bookingId}/cancel`,
        { reason }
      );
    } catch (error: any) {
      throw new Error(
        error.response?.data?.detail ||
        'Failed to cancel booking'
      );
    }
  },

  /**
   * Get booking status
   */
  async getBookingStatus(bookingId: number): Promise<any> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/bookings/${bookingId}/status`
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.detail ||
        'Failed to fetch booking status'
      );
    }
  },
};
