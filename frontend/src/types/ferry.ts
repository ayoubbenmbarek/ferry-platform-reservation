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
  TRAILER = 'trailer',
  JETSKI = 'jetski',
  BOAT_TRAILER = 'boat_trailer',
  BICYCLE = 'bicycle',
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
  SHARED = 'shared',  // Bed in shared cabin (with same-sex passengers)
  BALCONY = 'balcony',
  PET = 'pet',  // Pet-friendly cabin (allows pets)
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
  owner?: string;
  hasTrailer?: boolean;
  hasCaravan?: boolean;
  hasRoofBox?: boolean;
  hasBikeRack?: boolean;
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

export interface PetInfo {
  id: string;
  type: PetType;
  name?: string;
  weightKg?: number;
  carrierProvided?: boolean;
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
  pets?: PetInfo[];  // Optional pet info for search
  operators?: string[];
}

export interface AvailableVehicle {
  code: string;
  type: string;
  description: string;
  detailed_description?: string;
  price: number;
  currency: string;
  min_length?: number;
  max_length?: number;
  min_height?: number;
  max_height?: number;
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
  availableVehicles?: AvailableVehicle[];
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
  [VehicleType.TRAILER]: {
    length: 5.0,
    width: 2.0,
    height: 2.0,
    label: 'Trailer',
    icon: '🚚',
  },
  [VehicleType.JETSKI]: {
    length: 3.0,
    width: 1.2,
    height: 1.0,
    label: 'Jet Ski',
    icon: '🚤',
  },
  [VehicleType.BOAT_TRAILER]: {
    length: 6.0,
    width: 2.2,
    height: 2.0,
    label: 'Boat Trailer',
    icon: '🚤',
  },
  [VehicleType.BICYCLE]: {
    length: 1.8,
    width: 0.5,
    height: 1.0,
    label: 'Bicycle',
    icon: '🚲',
  },
};

// Available ports - Official FerryHopper codes (lowercase for frontend use)
// Note: Ports are fetched from API, this is just a fallback
export const PORTS: Port[] = [
  // Tunisia - Official FerryHopper codes
  { code: 'tun', name: 'Tunis (La Goulette)', city: 'Tunis', country: 'Tunisia', countryCode: 'TN' },
  { code: 'tnzrz', name: 'Zarzis', city: 'Zarzis', country: 'Tunisia', countryCode: 'TN' },

  // Italy - Official FerryHopper codes
  { code: 'goa', name: 'Genoa', city: 'Genoa', country: 'Italy', countryCode: 'IT' },
  { code: 'civ', name: 'Civitavecchia (Rome)', city: 'Rome', country: 'Italy', countryCode: 'IT' },
  { code: 'ple', name: 'Palermo', city: 'Palermo', country: 'Italy', countryCode: 'IT' },
  { code: 'tps', name: 'Trapani', city: 'Trapani', country: 'Italy', countryCode: 'IT' },
  { code: 'sal', name: 'Salerno', city: 'Salerno', country: 'Italy', countryCode: 'IT' },
  { code: 'nap', name: 'Naples', city: 'Naples', country: 'Italy', countryCode: 'IT' },
  { code: 'liv', name: 'Livorno', city: 'Livorno', country: 'Italy', countryCode: 'IT' },
  { code: 'anc', name: 'Ancona', city: 'Ancona', country: 'Italy', countryCode: 'IT' },
  { code: 'bar', name: 'Bari', city: 'Bari', country: 'Italy', countryCode: 'IT' },
  { code: 'mlz', name: 'Milazzo', city: 'Milazzo', country: 'Italy', countryCode: 'IT' },
  { code: 'msn', name: 'Messina', city: 'Messina', country: 'Italy', countryCode: 'IT' },

  // France - Official FerryHopper codes
  { code: 'mrs', name: 'Marseille', city: 'Marseille', country: 'France', countryCode: 'FR' },
  { code: 'nce', name: 'Nice', city: 'Nice', country: 'France', countryCode: 'FR' },
  { code: 'tln', name: 'Toulon', city: 'Toulon', country: 'France', countryCode: 'FR' },
  { code: 'aja', name: 'Ajaccio', city: 'Ajaccio', country: 'France', countryCode: 'FR' },
  { code: 'bia', name: 'Bastia', city: 'Bastia', country: 'France', countryCode: 'FR' },

  // Morocco - Official FerryHopper codes
  { code: 'tng', name: 'Tanger Med', city: 'Tangier', country: 'Morocco', countryCode: 'MA' },

  // Spain - Official FerryHopper codes
  { code: 'brc', name: 'Barcelona', city: 'Barcelona', country: 'Spain', countryCode: 'ES' },
  { code: 'alg', name: 'Algeciras', city: 'Algeciras', country: 'Spain', countryCode: 'ES' },

  // Algeria - Official FerryHopper codes
  { code: 'dzalg', name: 'Algiers', city: 'Algiers', country: 'Algeria', countryCode: 'DZ' },
];

// Passenger age limits
export const PASSENGER_AGE_LIMITS = {
  INFANT_MAX_AGE: 2,
  CHILD_MAX_AGE: 12,
  ADULT_MIN_AGE: 13,
};
