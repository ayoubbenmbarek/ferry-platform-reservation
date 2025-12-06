// User Types
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  is_admin: boolean;
  is_verified: boolean;
  preferred_language?: string;
  preferred_currency?: string;
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
  available_vehicle_space?: number;
  available_cabins?: number;
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
  id?: string | number;
  vehicle_type: VehicleType;
  make?: string;
  model?: string;
  owner?: string;
  license_plate: string;
  length_meters?: number;
  length_cm?: number;
  width_cm?: number;
  height_meters?: number;
  height_cm?: number;
  has_trailer?: boolean;
  has_caravan?: boolean;
  has_roof_box?: boolean;
  has_bike_rack?: boolean;
  base_price?: number;
  final_price?: number;
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

// Booking Meal type for meals associated with a booking
export interface BookingMeal {
  id: number;
  booking_id: number;
  meal_id: number;
  meal_name?: string;
  meal_type?: string;
  journey_type: 'OUTBOUND' | 'RETURN';
  quantity: number;
  unit_price: number;
  total_price: number;
  dietary_type?: string;
  special_requests?: string;
  created_at: string;
}

// Booking Types
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'expired';

// Booking Cabin type for cabin upgrades
export interface BookingCabin {
  id: number;
  booking_id: number;
  cabin_id: number;
  cabin_name?: string;
  cabin_type?: string;
  journey_type: 'OUTBOUND' | 'RETURN';
  quantity: number;
  unit_price: number;
  total_price: number;
  is_paid: boolean;
  created_at: string;
}

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
  // Original cabin selection (from initial booking)
  cabin_id?: number;
  cabin_supplement?: number;
  cabin_name?: string;
  cabin_type?: string;
  return_cabin_id?: number;
  return_cabin_supplement?: number;
  return_cabin_name?: string;
  return_cabin_type?: string;
  extra_data?: {
    has_cancellation_protection?: boolean;
  };
  passengers?: Passenger[];
  vehicles?: Vehicle[];
  meals?: BookingMeal[];  // Booked meals
  booking_cabins?: BookingCabin[];  // Upgraded cabins
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

// Cabin Upgrade Types
export interface CabinUpgradeParams {
  bookingId: number;
  alertId?: number;
  alertType?: 'cabin' | 'vehicle' | 'passenger';
  journeyType?: 'outbound' | 'return';
}

// Navigation Types
export type RootStackParamList = {
  Main: undefined;
  MainTabs: undefined;
  Auth: undefined;
  Search: undefined;
  SearchResults: { params: SearchParams };
  FerryDetails: { schedule: FerrySchedule };
  Booking: { schedule: FerrySchedule; returnSchedule?: FerrySchedule };
  Payment: { bookingId: number; cabinUpgrade?: CabinUpgradePaymentParams };
  BookingConfirmation: { bookingReference: string };
  BookingDetails: { bookingId: number };
  ETicket: { booking: Booking };
  MyBookings: undefined;
  MyAlerts: undefined;
  SavedRoutes: undefined;
  AddCabin: CabinUpgradeParams;
  Profile: undefined;
  Settings: undefined;
  NotificationSettings: undefined;
  PersonalInfo: undefined;
  ChangePassword: undefined;
  LanguageSettings: undefined;
  CurrencySettings: undefined;
  PaymentMethods: undefined;
  Contact: undefined;
};

// Cabin Upgrade Payment Params
export interface CabinUpgradePaymentParams {
  cabinSelections: Array<{ cabinId: number; quantity: number; unitPrice: number }>;
  totalAmount: number;
  journeyType: 'outbound' | 'return';
  alertId?: number;
}

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type SearchScreenParams = {
  prefillDeparture?: string;
  prefillArrival?: string;
  prefillDate?: string;
  autoSearch?: boolean;
};

export type MainTabParamList = {
  Home: undefined;
  Search: SearchScreenParams | undefined;
  Bookings: undefined;
  Profile: undefined;
};
