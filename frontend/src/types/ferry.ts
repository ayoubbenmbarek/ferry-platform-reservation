/**
 * TypeScript type definitions for ferry booking system
 */

export enum VehicleType {
  CAR = 'car',
  SUV = 'suv',
  VAN = 'van',
  MOTORCYCLE = 'motorcycle',
  CAMPER = 'camper',
  CARAVAN = 'caravan',
  TRUCK = 'truck',
}

export enum PassengerType {
  ADULT = 'adult',
  CHILD = 'child',
  INFANT = 'infant',
}

export enum CabinType {
  INTERIOR = 'interior',
  EXTERIOR = 'exterior',
  SUITE = 'suite',
  DECK = 'deck',
}

export enum PetType {
  CAT = 'CAT',
  SMALL_ANIMAL = 'SMALL_ANIMAL',
  DOG = 'DOG',
}

export interface VehicleInfo {
  id: string;
  type: VehicleType;
  length: number;
  width: number;
  height: number;
  weight?: number;
  registration?: string;
  make?: string;
  model?: string;
}

export interface PassengerInfo {
  id: string;
  type: PassengerType;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  nationality?: string;
  passportNumber?: string;
  documentExpiry?: string;
  specialNeeds?: string;
  // Pet information
  hasPet?: boolean;
  petType?: PetType;
  petName?: string;
  petWeightKg?: number;
  petCarrierProvided?: boolean;
}

export interface CabinInfo {
  type: CabinType;
  name: string;
  price: number;
  available: number;
  capacity?: number;
  amenities?: string[];
}

export interface SearchParams {
  departurePort: string;
  arrivalPort: string;
  departureDate: string;
  returnDate?: string;
  // Return route can be different from outbound (reversed by default)
  returnDeparturePort?: string;
  returnArrivalPort?: string;
  passengers: {
    adults: number;
    children: number;
    infants: number;
  };
  vehicles: VehicleInfo[];
  operators?: string[];
}

export interface FerryResult {
  sailingId: string;
  operator: string;
  departurePort: string;
  arrivalPort: string;
  departureTime: string;
  arrivalTime: string;
  vesselName: string;
  duration?: string;
  prices: {
    [key: string]: number;
  };
  cabinTypes?: CabinInfo[];
  availableSpaces?: {
    [key: string]: number;
  };
  routeInfo?: any;
}

export interface FerrySearchResponse {
  results: FerryResult[];
  totalResults: number;
  searchParams: any;
  operatorsSearched: string[];
  searchTimeMs?: number;
}

// Port definitions
export interface Port {
  code: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
}

// Vehicle size presets
export const VEHICLE_PRESETS: Record<VehicleType, { length: number; width: number; height: number; label: string; icon: string }> = {
  [VehicleType.CAR]: {
    length: 4.5,
    width: 1.8,
    height: 1.5,
    label: 'Standard Car',
    icon: '🚗',
  },
  [VehicleType.SUV]: {
    length: 5.0,
    width: 2.0,
    height: 1.8,
    label: 'SUV / 4x4',
    icon: '🚙',
  },
  [VehicleType.VAN]: {
    length: 5.5,
    width: 2.0,
    height: 2.2,
    label: 'Van / Minibus',
    icon: '🚐',
  },
  [VehicleType.MOTORCYCLE]: {
    length: 2.2,
    width: 0.8,
    height: 1.2,
    label: 'Motorcycle',
    icon: '🏍️',
  },
  [VehicleType.CAMPER]: {
    length: 7.0,
    width: 2.3,
    height: 3.0,
    label: 'Motorhome / Camper',
    icon: '🚚',
  },
  [VehicleType.CARAVAN]: {
    length: 6.5,
    width: 2.3,
    height: 2.5,
    label: 'Caravan / Trailer',
    icon: '🚐',
  },
  [VehicleType.TRUCK]: {
    length: 8.0,
    width: 2.5,
    height: 3.5,
    label: 'Truck / Lorry',
    icon: '🚛',
  },
};

// Available ports
export const PORTS: Port[] = [
  // Italy
  { code: 'genoa', name: 'Genoa', city: 'Genoa', country: 'Italy', countryCode: 'IT' },
  { code: 'civitavecchia', name: 'Civitavecchia', city: 'Civitavecchia', country: 'Italy', countryCode: 'IT' },
  { code: 'palermo', name: 'Palermo', city: 'Palermo', country: 'Italy', countryCode: 'IT' },
  { code: 'salerno', name: 'Salerno', city: 'Salerno', country: 'Italy', countryCode: 'IT' },
  { code: 'trapani', name: 'Trapani', city: 'Trapani', country: 'Italy', countryCode: 'IT' },

  // France
  { code: 'marseille', name: 'Marseille', city: 'Marseille', country: 'France', countryCode: 'FR' },
  { code: 'nice', name: 'Nice', city: 'Nice', country: 'France', countryCode: 'FR' },
  { code: 'toulon', name: 'Toulon', city: 'Toulon', country: 'France', countryCode: 'FR' },

  // Tunisia
  { code: 'tunis', name: 'La Goulette (Tunis)', city: 'Tunis', country: 'Tunisia', countryCode: 'TN' },
  { code: 'sfax', name: 'Sfax', city: 'Sfax', country: 'Tunisia', countryCode: 'TN' },
  { code: 'zarzis', name: 'Zarzis', city: 'Zarzis', country: 'Tunisia', countryCode: 'TN' },
];

// Passenger age limits
export const PASSENGER_AGE_LIMITS = {
  INFANT_MAX_AGE: 2,
  CHILD_MAX_AGE: 12,
  ADULT_MIN_AGE: 13,
};
