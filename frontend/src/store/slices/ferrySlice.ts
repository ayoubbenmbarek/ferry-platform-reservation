import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { SearchParams, FerryResult, VehicleInfo, PassengerInfo, PetInfo, Port, PORTS } from '../../types/ferry';
import api, { ferryAPI } from '../../services/api';

// ContactInfo type (using snake_case for backend compatibility)
export interface ContactInfo {
  email: string;
  phone?: string;
  first_name: string;
  last_name: string;
}

// Helper function to convert snake_case to camelCase
const snakeToCamel = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);

  return Object.keys(obj).reduce((acc: any, key: string) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    acc[camelKey] = snakeToCamel(obj[key]);
    return acc;
  }, {});
};

// Helper function to convert camelCase to snake_case
const camelToSnake = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);

  return Object.keys(obj).reduce((acc: any, key: string) => {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    acc[snakeKey] = camelToSnake(obj[key]);
    return acc;
  }, {});
};

interface FerryState {
  // Ports and routes
  ports: Port[];
  routes: { [departure: string]: string[] };
  isLoadingPorts: boolean;

  // Search state
  searchParams: Partial<SearchParams>;
  searchResults: FerryResult[];
  isSearching: boolean;
  searchError: string | null;

  // Booking flow state
  currentStep: number;
  selectedFerry: FerryResult | null;
  selectedReturnFerry: FerryResult | null;  // For return journey
  selectedCabin: string | null;
  selectedCabinId: number | null;
  selectedReturnCabinId: number | null;  // For return journey cabin
  // Multi-cabin selection support
  cabinSelections: { cabinId: number; quantity: number; price: number }[];
  returnCabinSelections: { cabinId: number; quantity: number; price: number }[];
  totalCabinPrice: number;
  totalReturnCabinPrice: number;
  selectedMeals: any[];
  contactInfo: ContactInfo | null;

  // Passenger, vehicle, and pet management
  passengers: PassengerInfo[];
  vehicles: VehicleInfo[];
  pets: PetInfo[];

  // Booking state
  currentBooking: any | null;
  isCreatingBooking: boolean;
  bookingError: string | null;

  // Round trip state
  isRoundTrip: boolean;

  // Promo code state
  promoCode: string | null;
  promoDiscount: number | null;
  promoValidationMessage: string | null;

  // Cancellation protection
  hasCancellationProtection: boolean;

  // UI state
  isLoading: boolean;
  error: string | null;
}

const initialState: FerryState = {
  // Ports and routes - start with static data as fallback
  ports: PORTS,
  routes: {},
  isLoadingPorts: false,

  searchParams: {
    passengers: {
      adults: 1,
      children: 0,
      infants: 0,
    },
    vehicles: [],
  },
  searchResults: [],
  isSearching: false,
  searchError: null,
  currentStep: 1,
  selectedFerry: null,
  selectedReturnFerry: null,
  selectedCabin: null,
  selectedCabinId: null,
  selectedReturnCabinId: null,
  // Multi-cabin selection support
  cabinSelections: [],
  returnCabinSelections: [],
  totalCabinPrice: 0,
  totalReturnCabinPrice: 0,
  selectedMeals: [],
  contactInfo: null,
  passengers: [],
  vehicles: [],
  pets: [],
  currentBooking: null,
  isCreatingBooking: false,
  bookingError: null,
  isRoundTrip: false,
  promoCode: null,
  promoDiscount: null,
  promoValidationMessage: null,
  hasCancellationProtection: false,
  isLoading: false,
  error: null,
};

// Async thunks
export const fetchPorts = createAsyncThunk(
  'ferry/fetchPorts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await ferryAPI.getPorts();
      // Known port code prefixes for country detection
      const TUNISIA_PORTS = ['TN00', 'TUN', 'TNZRZ'];
      const getCountryFromCode = (code: string): string => {
        const upperCode = code.toUpperCase();
        if (TUNISIA_PORTS.includes(upperCode) || upperCode.startsWith('TN')) return 'TN';
        if (upperCode.startsWith('IT') || ['GOA', 'CIV', 'PLE', 'TPS', 'SAL', 'NAP', 'LIV', 'ANC', 'BAR', 'MLZ', 'MSN', 'AEL00'].includes(upperCode)) return 'IT';
        if (upperCode.startsWith('FR') || ['MRS', 'NCE', 'TLN', 'AJA', 'BIA', 'COR00'].includes(upperCode)) return 'FR';
        if (['BRC', 'ALG'].includes(upperCode)) return 'ES';
        if (['TNG'].includes(upperCode)) return 'MA';
        if (['DZALG'].includes(upperCode)) return 'DZ';
        return 'XX';
      };
      // Transform API response to match Port type
      return response.map((port: any) => ({
        code: port.code.toLowerCase(),
        name: port.name,
        city: port.name,
        country: port.country,
        // Use country_code from API, fallback to code-based detection
        countryCode: port.country_code || port.countryCode || getCountryFromCode(port.code)
      }));
    } catch (error: any) {
      console.warn('Failed to fetch ports from API, using static data');
      return rejectWithValue('Failed to fetch ports');
    }
  }
);

export const fetchRoutes = createAsyncThunk(
  'ferry/fetchRoutes',
  async (_, { rejectWithValue }) => {
    try {
      const response = await ferryAPI.getRoutes();
      // Transform API response to { departure: [arrivals] } format
      const routes: { [departure: string]: string[] } = {};
      // Response can be { routes: [...] } or just [...]
      const routesList = (response as any).routes || response;
      if (Array.isArray(routesList)) {
        for (const route of routesList) {
          const dep = route.departure_port.toLowerCase();
          const arr = route.arrival_port.toLowerCase();
          if (!routes[dep]) {
            routes[dep] = [];
          }
          if (!routes[dep].includes(arr)) {
            routes[dep].push(arr);
          }
        }
      }
      return routes;
    } catch (error: any) {
      console.warn('Failed to fetch routes from API');
      return rejectWithValue('Failed to fetch routes');
    }
  }
);

export const searchFerries = createAsyncThunk(
  'ferry/searchFerries',
  async (searchParams: SearchParams, { rejectWithValue }) => {
    try {
      // Use the ferryAPI service which handles proxy correctly
      const response = await ferryAPI.search({
        departurePort: searchParams.departurePort,
        arrivalPort: searchParams.arrivalPort,
        departureDate: searchParams.departureDate,
        returnDate: searchParams.returnDate,
        // Different return route support
        returnDeparturePort: searchParams.returnDeparturePort,
        returnArrivalPort: searchParams.returnArrivalPort,
        passengers: searchParams.passengers.adults + searchParams.passengers.children + searchParams.passengers.infants,
        // Pass actual vehicles array for FerryHopper pricing (not just count)
        // Note: Frontend stores dimensions in cm, backend expects meters
        vehicles: searchParams.vehicles?.map(v => ({
          type: v.type?.toLowerCase() || 'car',
          length: (v.length || 450) / 100,  // Convert cm to meters
          width: (v.width || 180) / 100,    // Convert cm to meters
          height: (v.height || 150) / 100,  // Convert cm to meters
        })),
        // Pass pets array for pricing (triggers /search-quote for vehicle+pet prices)
        pets: searchParams.pets?.map(p => ({
          id: p.id,
          type: p.type,
          weight_kg: 5,  // Default weight, will be updated in booking
        })),
        operator: searchParams.operators?.[0],
      });

      // Convert snake_case response to camelCase
      return snakeToCamel(response);
    } catch (error: any) {
      // Handle validation errors with user-friendly messages
      const errorDetail = error.response?.data?.detail || error.message || '';

      // Handle FerryHopper same port error
      if (errorDetail.includes('Departure port cannot be the same with arrival port') ||
          errorDetail.includes('resolve to the same location') ||
          errorDetail.includes('same port') ||
          errorDetail.includes('same destination')) {
        return rejectWithValue('Departure and arrival ports cannot be the same. Please select a different destination.');
      }

      if (error.response?.data?.details) {
        const details = error.response.data.details;
        if (Array.isArray(details) && details.length > 0) {
          const firstError = details[0];

          // Extract user-friendly message
          if (firstError.msg?.includes('Departure date cannot be in the past')) {
            return rejectWithValue('Please select a date that is today or in the future. Past dates are not available for booking.');
          }

          // Return the validation message if available
          return rejectWithValue(firstError.msg || firstError.ctx?.error || 'Invalid search parameters');
        }
      }

      return rejectWithValue(errorDetail || 'Failed to search ferries');
    }
  }
);

export const createBooking = createAsyncThunk(
  'ferry/createBooking',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const {
        selectedFerry,
        selectedReturnFerry,
        passengers,
        vehicles,
        selectedCabinId,
        selectedReturnCabinId,
        // Multi-cabin selection support
        cabinSelections,
        returnCabinSelections,
        totalCabinPrice,
        totalReturnCabinPrice,
        selectedMeals,
        contactInfo,
        isRoundTrip,
        searchParams,
        promoCode,
        hasCancellationProtection
      } = state.ferry;

      if (!selectedFerry) {
        return rejectWithValue('No ferry selected');
      }

      if (!contactInfo) {
        return rejectWithValue('Contact information is required');
      }

      // Transform frontend data to API format (using snake_case for backend)
      const bookingData = camelToSnake({
        sailingId: selectedFerry.sailingId,
        operator: selectedFerry.operator,
        // Ferry schedule details (outbound)
        departurePort: selectedFerry.departurePort,
        arrivalPort: selectedFerry.arrivalPort,
        departureTime: selectedFerry.departureTime,
        arrivalTime: selectedFerry.arrivalTime,
        vesselName: selectedFerry.vesselName,
        // Ferry prices from selected ferry (important for accurate pricing!)
        ferryPrices: selectedFerry.prices,
        // Round trip information (can be different route/operator)
        isRoundTrip: isRoundTrip,
        returnSailingId: selectedReturnFerry?.sailingId,
        returnOperator: selectedReturnFerry?.operator,
        // Return ferry prices (important for round trip total calculation!)
        returnFerryPrices: selectedReturnFerry?.prices,
        // Use selectedReturnFerry route if available, otherwise use searchParams (for different return route)
        returnDeparturePort: selectedReturnFerry?.departurePort || searchParams?.returnDeparturePort,
        returnArrivalPort: selectedReturnFerry?.arrivalPort || searchParams?.returnArrivalPort,
        returnDepartureTime: selectedReturnFerry?.departureTime,
        returnArrivalTime: selectedReturnFerry?.arrivalTime,
        returnVesselName: selectedReturnFerry?.vesselName,
        contactInfo: {
          email: contactInfo.email,
          phone: contactInfo.phone || '',
          firstName: contactInfo.first_name || contactInfo.firstName,
          lastName: contactInfo.last_name || contactInfo.lastName,
        },
        passengers: passengers.map((p: PassengerInfo) => ({
          type: p.type,
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: p.dateOfBirth || null,  // Send null instead of empty string
          nationality: p.nationality || null,
          passportNumber: p.passportNumber || null,
          specialNeeds: p.specialNeeds || null,
          // Pet information
          hasPet: p.hasPet || false,
          petType: p.petType || null,
          petName: p.petName || null,
          petWeightKg: p.petWeightKg || null,
          petCarrierProvided: p.petCarrierProvided || false,
        })),
        vehicles: vehicles.length > 0 ? vehicles.map((v: VehicleInfo) => ({
          type: v.type.toLowerCase(),
          length: v.length,
          width: v.width,
          height: v.height,
          weight: v.weight,
          registration: v.registration,
          make: v.make,
          model: v.model,
          owner: v.owner,
          has_trailer: v.hasTrailer || false,
          has_caravan: v.hasCaravan || false,
          has_roof_box: v.hasRoofBox || false,
          has_bike_rack: v.hasBikeRack || false,
        })) : undefined,
        // Legacy single cabin support (backward compatibility)
        cabinId: selectedCabinId,
        returnCabinId: selectedReturnCabinId,
        // Multi-cabin selection data with prices
        cabinSelections: cabinSelections && cabinSelections.length > 0 ? cabinSelections : undefined,
        returnCabinSelections: returnCabinSelections && returnCabinSelections.length > 0 ? returnCabinSelections : undefined,
        totalCabinPrice: totalCabinPrice || 0,
        totalReturnCabinPrice: totalReturnCabinPrice || 0,
        meals: selectedMeals && selectedMeals.length > 0 ? selectedMeals : undefined,
        promoCode: promoCode || undefined,
        hasCancellationProtection: hasCancellationProtection || false,
      });

      // Use axios directly to send snake_case data
      const response = await api.post('/bookings/', bookingData);
      return snakeToCamel(response.data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || error.message || 'Failed to create booking');
    }
  }
);

const ferrySlice = createSlice({
  name: 'ferry',
  initialState,
  reducers: {
    // Search params actions
    setSearchParams: (state, action: PayloadAction<Partial<SearchParams>>) => {
      state.searchParams = { ...state.searchParams, ...action.payload };
      // Sync vehicles from searchParams to main state
      if (action.payload.vehicles !== undefined) {
        state.vehicles = action.payload.vehicles;
      }
      // Sync pets from searchParams to main state
      if (action.payload.pets !== undefined) {
        state.pets = action.payload.pets;
      }
      // Clear old search results when params change
      state.searchResults = [];
      state.searchError = null;
    },

    updatePassengerCount: (state, action: PayloadAction<{ type: 'adults' | 'children' | 'infants'; count: number }>) => {
      if (state.searchParams.passengers) {
        state.searchParams.passengers[action.payload.type] = action.payload.count;
      }
    },

    // Booking flow actions
    setCurrentStep: (state, action: PayloadAction<number>) => {
      state.currentStep = action.payload;
    },

    nextStep: (state) => {
      state.currentStep += 1;
    },

    previousStep: (state) => {
      if (state.currentStep > 1) {
        state.currentStep -= 1;
      }
    },

    selectFerry: (state, action: PayloadAction<FerryResult>) => {
      state.selectedFerry = action.payload;
    },

    selectCabin: (state, action: PayloadAction<string | null>) => {
      state.selectedCabin = action.payload;
    },

    setCabinId: (state, action: PayloadAction<number | null>) => {
      state.selectedCabinId = action.payload;
    },

    setReturnCabinId: (state, action: PayloadAction<number | null>) => {
      state.selectedReturnCabinId = action.payload;
    },

    // Multi-cabin selection actions
    setCabinSelections: (state, action: PayloadAction<{ selections: { cabinId: number; quantity: number; price: number }[]; totalPrice: number }>) => {
      state.cabinSelections = action.payload.selections;
      state.totalCabinPrice = action.payload.totalPrice;
    },

    setReturnCabinSelections: (state, action: PayloadAction<{ selections: { cabinId: number; quantity: number; price: number }[]; totalPrice: number }>) => {
      state.returnCabinSelections = action.payload.selections;
      state.totalReturnCabinPrice = action.payload.totalPrice;
    },

    clearCabinSelections: (state) => {
      state.cabinSelections = [];
      state.returnCabinSelections = [];
      state.totalCabinPrice = 0;
      state.totalReturnCabinPrice = 0;
      state.selectedCabinId = null;
      state.selectedReturnCabinId = null;
    },

    setReturnFerry: (state, action: PayloadAction<FerryResult | null>) => {
      state.selectedReturnFerry = action.payload;
    },

    setIsRoundTrip: (state, action: PayloadAction<boolean>) => {
      state.isRoundTrip = action.payload;
    },

    setMeals: (state, action: PayloadAction<any[]>) => {
      state.selectedMeals = action.payload;
    },

    setPromoCode: (state, action: PayloadAction<string | null>) => {
      state.promoCode = action.payload;
    },

    setPromoDiscount: (state, action: PayloadAction<{ discount: number | null; message: string | null }>) => {
      state.promoDiscount = action.payload.discount;
      state.promoValidationMessage = action.payload.message;
    },

    clearPromoCode: (state) => {
      state.promoCode = null;
      state.promoDiscount = null;
      state.promoValidationMessage = null;
    },

    setCancellationProtection: (state, action: PayloadAction<boolean>) => {
      state.hasCancellationProtection = action.payload;
    },

    setContactInfo: (state, action: PayloadAction<ContactInfo>) => {
      state.contactInfo = action.payload;
    },

    // Passenger management
    addPassenger: (state, action: PayloadAction<PassengerInfo>) => {
      state.passengers.push(action.payload);
    },

    updatePassenger: (state, action: PayloadAction<{ id: string; data: Partial<PassengerInfo> }>) => {
      const index = state.passengers.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.passengers[index] = { ...state.passengers[index], ...action.payload.data };
      }
    },

    removePassenger: (state, action: PayloadAction<string>) => {
      state.passengers = state.passengers.filter(p => p.id !== action.payload);
    },

    clearPassengers: (state) => {
      state.passengers = [];
    },

    // Vehicle management
    addVehicle: (state, action: PayloadAction<VehicleInfo>) => {
      state.vehicles.push(action.payload);
      if (state.searchParams.vehicles) {
        state.searchParams.vehicles.push(action.payload);
      } else {
        state.searchParams.vehicles = [action.payload];
      }
    },

    updateVehicle: (state, action: PayloadAction<{ id: string; data: Partial<VehicleInfo> }>) => {
      const index = state.vehicles.findIndex(v => v.id === action.payload.id);
      if (index !== -1) {
        state.vehicles[index] = { ...state.vehicles[index], ...action.payload.data };
        if (state.searchParams.vehicles) {
          state.searchParams.vehicles[index] = state.vehicles[index];
        }
      }
    },

    removeVehicle: (state, action: PayloadAction<string>) => {
      state.vehicles = state.vehicles.filter(v => v.id !== action.payload);
      if (state.searchParams.vehicles) {
        state.searchParams.vehicles = state.searchParams.vehicles.filter(v => v.id !== action.payload);
      }
    },

    clearVehicles: (state) => {
      state.vehicles = [];
      if (state.searchParams.vehicles) {
        state.searchParams.vehicles = [];
      }
    },

    // Pet management
    addPet: (state, action: PayloadAction<PetInfo>) => {
      state.pets.push(action.payload);
      if (state.searchParams.pets) {
        state.searchParams.pets.push(action.payload);
      } else {
        state.searchParams.pets = [action.payload];
      }
    },

    updatePet: (state, action: PayloadAction<{ id: string; data: Partial<PetInfo> }>) => {
      const index = state.pets.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.pets[index] = { ...state.pets[index], ...action.payload.data };
        if (state.searchParams.pets) {
          state.searchParams.pets[index] = state.pets[index];
        }
      }
    },

    removePet: (state, action: PayloadAction<string>) => {
      state.pets = state.pets.filter(p => p.id !== action.payload);
      if (state.searchParams.pets) {
        state.searchParams.pets = state.searchParams.pets.filter(p => p.id !== action.payload);
      }
    },

    clearPets: (state) => {
      state.pets = [];
      if (state.searchParams.pets) {
        state.searchParams.pets = [];
      }
    },

    // Reset actions
    resetBooking: (state) => {
      state.currentStep = 1;
      state.selectedFerry = null;
      state.selectedCabin = null;
      state.selectedCabinId = null;
      state.selectedReturnCabinId = null;
      state.cabinSelections = [];
      state.returnCabinSelections = [];
      state.totalCabinPrice = 0;
      state.totalReturnCabinPrice = 0;
      state.passengers = [];
      state.vehicles = [];
      state.pets = [];
      state.searchResults = [];
      state.searchError = null;
      state.promoCode = null;
      state.promoDiscount = null;
      state.promoValidationMessage = null;
      state.hasCancellationProtection = false;
    },

    clearError: (state) => {
      state.error = null;
      state.searchError = null;
    },

    resetSearchState: (state) => {
      state.isSearching = false;
      state.searchError = null;
    },

    // Clear current booking (used when editing search to prevent reusing old booking)
    clearCurrentBooking: (state) => {
      state.currentBooking = null;
      state.isCreatingBooking = false;
      state.bookingError = null;
    },

    // Start a new search - resets booking state but keeps step at 2 for search results
    startNewSearch: (state) => {
      state.currentStep = 2;  // Set to ferry selection step
      state.selectedFerry = null;
      state.selectedReturnFerry = null;
      state.selectedCabin = null;
      state.selectedCabinId = null;
      state.selectedReturnCabinId = null;
      state.cabinSelections = [];
      state.returnCabinSelections = [];
      state.totalCabinPrice = 0;
      state.totalReturnCabinPrice = 0;
      state.selectedMeals = [];
      state.contactInfo = null;
      state.passengers = [];
      state.vehicles = [];
      state.pets = [];
      state.searchResults = [];
      state.searchError = null;
      state.currentBooking = null;
      state.isCreatingBooking = false;
      state.bookingError = null;
      state.hasCancellationProtection = false;
    },

    // Reset all ferry state (used on logout)
    resetAllState: () => initialState,

    // Real-time availability update from WebSocket
    updateFerryAvailability: (state, action: PayloadAction<{
      ferryId: string;
      route: string;
      availability: {
        change_type?: string;
        passengers_booked?: number;
        passengers_freed?: number;
        vehicles_booked?: number;
        vehicles_freed?: number;
        cabin_type?: string;
        cabin_quantity?: number;
        cabins_freed?: number;
      };
    }>) => {
      const { ferryId, availability } = action.payload;

      // Find and update the ferry in searchResults
      // Note: searchResults contains raw API data with sailing_id and cabin_types (snake_case)
      const ferryIndex = state.searchResults.findIndex(
        f => (f as any).sailing_id === ferryId || f.sailingId === ferryId
      );

      if (ferryIndex !== -1) {
        const ferry = state.searchResults[ferryIndex] as any; // Cast to any for raw API fields

        // Initialize available_spaces if not present
        if (!ferry.available_spaces) {
          ferry.available_spaces = {};
        }

        // Update passenger availability
        if (availability.passengers_booked) {
          const current = ferry.available_spaces.passengers || 0;
          ferry.available_spaces.passengers = Math.max(0, current - availability.passengers_booked);
        }
        if (availability.passengers_freed) {
          const current = ferry.available_spaces.passengers || 0;
          ferry.available_spaces.passengers = current + availability.passengers_freed;
        }

        // Update vehicle availability
        if (availability.vehicles_booked) {
          const current = ferry.available_spaces.vehicles || 0;
          ferry.available_spaces.vehicles = Math.max(0, current - availability.vehicles_booked);
        }
        if (availability.vehicles_freed) {
          const current = ferry.available_spaces.vehicles || 0;
          ferry.available_spaces.vehicles = current + availability.vehicles_freed;
        }

        // Update cabin availability in available_spaces (booking - decrease)
        if (availability.cabin_quantity) {
          const current = ferry.available_spaces.cabins || 0;
          ferry.available_spaces.cabins = Math.max(0, current - availability.cabin_quantity);

          // Also update cabin_types array (frontend displays from this)
          const cabinTypes = ferry.cabin_types || ferry.cabinTypes;
          if (cabinTypes && Array.isArray(cabinTypes)) {
            let remaining = availability.cabin_quantity;
            for (const cabin of cabinTypes) {
              if (remaining <= 0) break;
              // Skip deck/seat types
              if (['deck', 'seat', 'reclining_seat'].includes(cabin.type?.toLowerCase())) continue;

              const available = cabin.available || 0;
              const toSubtract = Math.min(available, remaining);
              cabin.available = Math.max(0, available - toSubtract);
              remaining -= toSubtract;
            }
          }
        }

        // Update cabin availability when booking is cancelled (cabins_freed - increase)
        if (availability.cabins_freed) {
          const current = ferry.available_spaces.cabins || 0;
          ferry.available_spaces.cabins = current + availability.cabins_freed;

          // Also update cabin_types array (frontend displays from this)
          const cabinTypes = ferry.cabin_types || ferry.cabinTypes;
          if (cabinTypes && Array.isArray(cabinTypes)) {
            let remaining = availability.cabins_freed;
            for (const cabin of cabinTypes) {
              if (remaining <= 0) break;
              // Skip deck/seat types
              if (['deck', 'seat', 'reclining_seat'].includes(cabin.type?.toLowerCase())) continue;

              // Add freed cabins back (distribute evenly for now)
              cabin.available = (cabin.available || 0) + remaining;
              remaining = 0; // For simplicity, add all to first cabin type
            }
          }
          console.log(`🔓 Cabins freed: ${availability.cabins_freed} for ferry ${ferryId}`);
        }

        console.log(`🔄 Updated availability for ferry ${ferryId}:`, ferry.available_spaces, ferry.cabin_types);
      } else {
        console.log(`⚠️ Ferry ${ferryId} not found in searchResults`);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Listen for auth logout to clear ferry state
      .addCase('auth/logout', () => initialState)
      // Fetch ports
      .addCase(fetchPorts.pending, (state) => {
        state.isLoadingPorts = true;
      })
      .addCase(fetchPorts.fulfilled, (state, action) => {
        state.isLoadingPorts = false;
        state.ports = action.payload;
      })
      .addCase(fetchPorts.rejected, (state) => {
        state.isLoadingPorts = false;
        // Keep static PORTS as fallback - already set in initialState
      })
      // Fetch routes
      .addCase(fetchRoutes.fulfilled, (state, action) => {
        state.routes = action.payload;
      })
      // Search ferries
      .addCase(searchFerries.pending, (state) => {
        state.isSearching = true;
        state.searchError = null;
      })
      .addCase(searchFerries.fulfilled, (state, action) => {
        state.isSearching = false;
        state.searchResults = action.payload.results || [];
        state.searchError = null;
      })
      .addCase(searchFerries.rejected, (state, action) => {
        state.isSearching = false;
        state.searchError = action.payload as string;
      })
      // Create booking
      .addCase(createBooking.pending, (state) => {
        state.isCreatingBooking = true;
        state.bookingError = null;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.isCreatingBooking = false;
        state.currentBooking = action.payload;
        state.bookingError = null;
        // Move to confirmation step
        state.currentStep = 5;
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.isCreatingBooking = false;
        state.bookingError = action.payload as string;
      });
  },
});

export const {
  setSearchParams,
  updatePassengerCount,
  setCurrentStep,
  nextStep,
  previousStep,
  selectFerry,
  selectCabin,
  setCabinId,
  setReturnCabinId,
  setCabinSelections,
  setReturnCabinSelections,
  clearCabinSelections,
  setReturnFerry,
  setIsRoundTrip,
  setMeals,
  setPromoCode,
  setPromoDiscount,
  clearPromoCode,
  setCancellationProtection,
  setContactInfo,
  addPassenger,
  updatePassenger,
  removePassenger,
  clearPassengers,
  addVehicle,
  updateVehicle,
  removeVehicle,
  clearVehicles,
  addPet,
  updatePet,
  removePet,
  clearPets,
  resetBooking,
  startNewSearch,
  clearCurrentBooking,
  clearError,
  resetSearchState,
  resetAllState,
  updateFerryAvailability,
} = ferrySlice.actions;

export default ferrySlice.reducer;