// User Types
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  is_admin: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Ferry Types
export interface Port {
  code: string;
  name: string;
  country: string;
}

export interface FerrySchedule {
  id: string;
  sailing_id: string;
  operator: string;
  departure_port: string;
  arrival_port: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  vessel_name: string;
  base_price: number;
  currency: string;
  available_capacity: number;
  vehicle_capacity: number;
  amenities: string[];
}

export interface SearchParams {
  departure_port: string;
  arrival_port: string;
  departure_date: string;
  return_date?: string;
  return_departure_port?: string;
  return_arrival_port?: string;
  passengers: number;
  adults: number;
  children: number;
  infants: number;
  vehicles: number;
  vehicle_type?: string;
}

// Passenger Types
export type PassengerType = 'adult' | 'child' | 'infant';

export interface Passenger {
  id?: string;
  passenger_type: PassengerType;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  passport_number?: string;
  passport_expiry?: string;
  has_pet?: boolean;
  pet_type?: string;
}

// Vehicle Types
export type VehicleType = 'car' | 'suv' | 'van' | 'motorcycle' | 'camper' | 'caravan' | 'truck' | 'trailer' | 'jetski' | 'boat_trailer' | 'bicycle';

export interface Vehicle {
  id?: string;
  vehicle_type: VehicleType;
  make?: string;
  model?: string;
  license_plate: string;
  length_meters?: number;
  height_meters?: number;
}

// Cabin Types
export interface Cabin {
  id: string;
  name: string;
  type: string;
  capacity: number;
  price: number;
  available: number;
  amenities: string[];
}

// Meal Types
export interface Meal {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
}

// Booking Types
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'expired';

export interface Booking {
  id: number;
  user_id?: number;
  booking_reference: string;
  sailing_id: string;
  operator: string;
  departure_port: string;
  arrival_port: string;
  departure_time: string;
  arrival_time: string;
  vessel_name: string;
  is_round_trip: boolean;
  return_sailing_id?: string;
  return_operator?: string;
  return_departure_port?: string;
  return_arrival_port?: string;
  return_departure_time?: string;
  return_arrival_time?: string;
  return_vessel_name?: string;
  contact_email: string;
  contact_phone: string;
  contact_first_name: string;
  contact_last_name: string;
  total_passengers: number;
  total_vehicles: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: BookingStatus;
  extra_data?: {
    has_cancellation_protection?: boolean;
  };
  passengers?: Passenger[];
  vehicles?: Vehicle[];
  created_at: string;
  expires_at?: string;
}

// Payment Types
export interface PaymentIntent {
  client_secret: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
}

// Navigation Types
export type RootStackParamList = {
  Main: undefined;
  Auth: undefined;
  Search: undefined;
  SearchResults: { params: SearchParams };
  FerryDetails: { schedule: FerrySchedule };
  Booking: { schedule: FerrySchedule; returnSchedule?: FerrySchedule };
  Payment: { bookingId: number };
  BookingConfirmation: { bookingReference: string };
  BookingDetails: { bookingId: number };
  MyBookings: undefined;
  Profile: undefined;
  Settings: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Bookings: undefined;
  Profile: undefined;
};
