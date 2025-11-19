import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { SearchParams, FerryResult, VehicleInfo, PassengerInfo } from '../../types/ferry';
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
  selectedMeals: any[];
  contactInfo: ContactInfo | null;

  // Passenger and vehicle management
  passengers: PassengerInfo[];
  vehicles: VehicleInfo[];

  // Booking state
  currentBooking: any | null;
  isCreatingBooking: boolean;
  bookingError: string | null;

  // Round trip state
  isRoundTrip: boolean;

  // UI state
  isLoading: boolean;
  error: string | null;
}

const initialState: FerryState = {
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
  selectedMeals: [],
  contactInfo: null,
  passengers: [],
  vehicles: [],
  currentBooking: null,
  isCreatingBooking: false,
  bookingError: null,
  isRoundTrip: false,
  isLoading: false,
  error: null,
};

// Async thunks
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
        vehicles: searchParams.vehicles?.length || 0,
        operator: searchParams.operators?.[0],
      });

      // Convert snake_case response to camelCase
      return snakeToCamel(response);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || error.message || 'Failed to search ferries');
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
        selectedMeals,
        contactInfo,
        isRoundTrip,
        searchParams
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
          type: v.type,
          length: v.length,
          width: v.width,
          height: v.height,
          weight: v.weight,
          registration: v.registration,
          make: v.make,
          model: v.model,
        })) : undefined,
        cabinId: selectedCabinId,
        returnCabinId: selectedReturnCabinId,
        meals: selectedMeals && selectedMeals.length > 0 ? selectedMeals : undefined,
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

    setReturnFerry: (state, action: PayloadAction<FerryResult | null>) => {
      state.selectedReturnFerry = action.payload;
    },

    setIsRoundTrip: (state, action: PayloadAction<boolean>) => {
      state.isRoundTrip = action.payload;
    },

    setMeals: (state, action: PayloadAction<any[]>) => {
      state.selectedMeals = action.payload;
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

    // Reset actions
    resetBooking: (state) => {
      state.currentStep = 1;
      state.selectedFerry = null;
      state.selectedCabin = null;
      state.passengers = [];
      state.vehicles = [];
      state.searchResults = [];
      state.searchError = null;
    },

    clearError: (state) => {
      state.error = null;
      state.searchError = null;
    },

    resetSearchState: (state) => {
      state.isSearching = false;
      state.searchError = null;
    },

    // Start a new search - resets booking state but keeps step at 2 for search results
    startNewSearch: (state) => {
      state.currentStep = 2;  // Set to ferry selection step
      state.selectedFerry = null;
      state.selectedReturnFerry = null;
      state.selectedCabin = null;
      state.selectedCabinId = null;
      state.selectedReturnCabinId = null;
      state.selectedMeals = [];
      state.contactInfo = null;
      state.passengers = [];
      state.vehicles = [];
      state.searchResults = [];
      state.searchError = null;
      state.currentBooking = null;
      state.isCreatingBooking = false;
      state.bookingError = null;
    },

    // Reset all ferry state (used on logout)
    resetAllState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Listen for auth logout to clear ferry state
      .addCase('auth/logout', () => initialState)
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
  setReturnFerry,
  setIsRoundTrip,
  setMeals,
  setContactInfo,
  addPassenger,
  updatePassenger,
  removePassenger,
  clearPassengers,
  addVehicle,
  updateVehicle,
  removeVehicle,
  clearVehicles,
  resetBooking,
  startNewSearch,
  clearError,
  resetSearchState,
  resetAllState,
} = ferrySlice.actions;

export default ferrySlice.reducer;