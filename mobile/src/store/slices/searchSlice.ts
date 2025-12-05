import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ferryService } from '../../services/ferryService';
import { FerrySchedule, SearchParams, Port, VehicleType } from '../../types';

// Vehicle selection with type for each vehicle
export interface VehicleSelection {
  id: string;
  type: VehicleType;
}

interface SearchState {
  // Search parameters
  departurePort: string;
  arrivalPort: string;
  departureDate: string;
  returnDate: string | null;
  // Return ports (can be different from outbound)
  returnDeparturePort: string;
  returnArrivalPort: string;
  sameReturnRoute: boolean;
  passengers: number;  // Total passengers (computed)
  adults: number;
  children: number;
  infants: number;
  vehicles: number;
  vehicleType: string;  // Legacy - default type for new vehicles
  vehicleSelections: VehicleSelection[];  // Each vehicle with its type
  isRoundTrip: boolean;

  // Results
  outboundResults: FerrySchedule[];
  returnResults: FerrySchedule[];
  isSearching: boolean;
  searchError: string | null;

  // Selected schedules
  selectedOutbound: FerrySchedule | null;
  selectedReturn: FerrySchedule | null;

  // Ports data
  ports: Port[];
  routes: { [departure: string]: string[] };
  isLoadingPorts: boolean;
}

// Fallback mock data for development
const mockPorts: Port[] = [
  { code: 'TUN', name: 'Tunis', country: 'Tunisia' },
  { code: 'MRS', name: 'Marseille', country: 'France' },
  { code: 'GEN', name: 'Genoa', country: 'Italy' },
  { code: 'ALG', name: 'Algiers', country: 'Algeria' },
  { code: 'PAL', name: 'Palermo', country: 'Italy' },
  { code: 'NAP', name: 'Naples', country: 'Italy' },
  { code: 'BAR', name: 'Barcelona', country: 'Spain' },
  { code: 'CIV', name: 'Civitavecchia', country: 'Italy' },
  { code: 'LIV', name: 'Livorno', country: 'Italy' },
  { code: 'SAL', name: 'Salerno', country: 'Italy' },
];

const mockRoutes: { [departure: string]: string[] } = {
  'TUN': ['MRS', 'GEN', 'PAL', 'NAP', 'CIV', 'LIV', 'SAL'],
  'MRS': ['TUN', 'ALG'],
  'GEN': ['TUN', 'PAL'],
  'ALG': ['MRS', 'BAR'],
  'PAL': ['TUN', 'GEN', 'NAP'],
  'NAP': ['TUN', 'PAL'],
  'BAR': ['ALG'],
  'CIV': ['TUN'],
  'LIV': ['TUN'],
  'SAL': ['TUN'],
};

const initialState: SearchState = {
  departurePort: '',
  arrivalPort: '',
  departureDate: '',
  returnDate: null,
  returnDeparturePort: '',
  returnArrivalPort: '',
  sameReturnRoute: true,
  passengers: 1,
  adults: 1,
  children: 0,
  infants: 0,
  vehicles: 0,
  vehicleType: 'car',
  vehicleSelections: [],
  isRoundTrip: false,

  outboundResults: [],
  returnResults: [],
  isSearching: false,
  searchError: null,

  selectedOutbound: null,
  selectedReturn: null,

  ports: [],
  routes: {},
  isLoadingPorts: false,
};

// Fetch ports
export const fetchPorts = createAsyncThunk('search/fetchPorts', async (_, { rejectWithValue }) => {
  try {
    const ports = await ferryService.getPorts();
    return ports;
  } catch (error) {
    // Return mock data if API fails
    console.warn('Failed to fetch ports from API, using mock data');
    return mockPorts;
  }
});

// Fetch routes
export const fetchRoutes = createAsyncThunk('search/fetchRoutes', async (_, { rejectWithValue }) => {
  try {
    const routes = await ferryService.getRoutes();
    return routes;
  } catch (error) {
    // Return mock data if API fails
    console.warn('Failed to fetch routes from API, using mock data');
    return mockRoutes;
  }
});

// Search ferries
export const searchFerries = createAsyncThunk(
  'search/searchFerries',
  async (params: SearchParams, { rejectWithValue }) => {
    try {
      const results = await ferryService.searchFerries(params);
      return results;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    setDeparturePort: (state, action: PayloadAction<string>) => {
      state.departurePort = action.payload;
    },
    setArrivalPort: (state, action: PayloadAction<string>) => {
      state.arrivalPort = action.payload;
    },
    setDepartureDate: (state, action: PayloadAction<string>) => {
      state.departureDate = action.payload;
    },
    setReturnDate: (state, action: PayloadAction<string | null>) => {
      state.returnDate = action.payload;
      state.isRoundTrip = action.payload !== null;
    },
    setPassengers: (state, action: PayloadAction<number>) => {
      state.passengers = Math.max(1, Math.min(9, action.payload));
    },
    setAdults: (state, action: PayloadAction<number>) => {
      state.adults = Math.max(1, Math.min(9, action.payload));
      state.passengers = state.adults + state.children + state.infants;
    },
    setChildren: (state, action: PayloadAction<number>) => {
      state.children = Math.max(0, Math.min(8, action.payload));
      state.passengers = state.adults + state.children + state.infants;
    },
    setInfants: (state, action: PayloadAction<number>) => {
      // Infants must be <= adults (one infant per adult)
      state.infants = Math.max(0, Math.min(state.adults, action.payload));
      state.passengers = state.adults + state.children + state.infants;
    },
    setVehicles: (state, action: PayloadAction<number>) => {
      const newCount = Math.max(0, Math.min(3, action.payload));
      const currentCount = state.vehicles;

      if (newCount > currentCount) {
        // Add new vehicles with default type
        for (let i = currentCount; i < newCount; i++) {
          state.vehicleSelections.push({
            id: `vehicle-${Date.now()}-${i}`,
            type: state.vehicleType as VehicleType,
          });
        }
      } else if (newCount < currentCount) {
        // Remove vehicles from the end
        state.vehicleSelections = state.vehicleSelections.slice(0, newCount);
      }

      state.vehicles = newCount;
    },
    setVehicleType: (state, action: PayloadAction<string>) => {
      state.vehicleType = action.payload;
    },
    updateVehicleSelection: (state, action: PayloadAction<{ index: number; type: VehicleType }>) => {
      const { index, type } = action.payload;
      if (index >= 0 && index < state.vehicleSelections.length) {
        state.vehicleSelections[index].type = type;
      }
    },
    setVehicleSelections: (state, action: PayloadAction<VehicleSelection[]>) => {
      state.vehicleSelections = action.payload;
      state.vehicles = action.payload.length;
    },
    setIsRoundTrip: (state, action: PayloadAction<boolean>) => {
      state.isRoundTrip = action.payload;
      if (!action.payload) {
        state.returnDate = null;
        state.selectedReturn = null;
      }
    },
    swapPorts: (state) => {
      const temp = state.departurePort;
      state.departurePort = state.arrivalPort;
      state.arrivalPort = temp;
    },
    setReturnDeparturePort: (state, action: PayloadAction<string>) => {
      state.returnDeparturePort = action.payload;
    },
    setReturnArrivalPort: (state, action: PayloadAction<string>) => {
      state.returnArrivalPort = action.payload;
    },
    setSameReturnRoute: (state, action: PayloadAction<boolean>) => {
      state.sameReturnRoute = action.payload;
      if (action.payload) {
        // If same route, set return ports to reversed outbound ports
        state.returnDeparturePort = state.arrivalPort;
        state.returnArrivalPort = state.departurePort;
      }
    },
    selectOutbound: (state, action: PayloadAction<FerrySchedule>) => {
      state.selectedOutbound = action.payload;
    },
    selectReturn: (state, action: PayloadAction<FerrySchedule | null>) => {
      state.selectedReturn = action.payload;
    },
    clearSelection: (state) => {
      state.selectedOutbound = null;
      state.selectedReturn = null;
    },
    clearResults: (state) => {
      state.outboundResults = [];
      state.returnResults = [];
      state.selectedOutbound = null;
      state.selectedReturn = null;
      state.searchError = null;
    },
    resetSearch: () => initialState,
  },
  extraReducers: (builder) => {
    // Fetch ports
    builder
      .addCase(fetchPorts.pending, (state) => {
        state.isLoadingPorts = true;
      })
      .addCase(fetchPorts.fulfilled, (state, action) => {
        state.isLoadingPorts = false;
        state.ports = action.payload;
      })
      .addCase(fetchPorts.rejected, (state) => {
        state.isLoadingPorts = false;
      });

    // Fetch routes
    builder.addCase(fetchRoutes.fulfilled, (state, action) => {
      state.routes = action.payload;
    });

    // Search ferries
    builder
      .addCase(searchFerries.pending, (state) => {
        state.isSearching = true;
        state.searchError = null;
      })
      .addCase(searchFerries.fulfilled, (state, action) => {
        state.isSearching = false;
        state.outboundResults = action.payload.outbound;
        state.returnResults = action.payload.return || [];
      })
      .addCase(searchFerries.rejected, (state, action) => {
        state.isSearching = false;
        state.searchError = action.payload as string;
      });
  },
});

export const {
  setDeparturePort,
  setArrivalPort,
  setDepartureDate,
  setReturnDate,
  setReturnDeparturePort,
  setReturnArrivalPort,
  setSameReturnRoute,
  setPassengers,
  setAdults,
  setChildren,
  setInfants,
  setVehicles,
  setVehicleType,
  updateVehicleSelection,
  setVehicleSelections,
  setIsRoundTrip,
  swapPorts,
  selectOutbound,
  selectReturn,
  clearSelection,
  clearResults,
  resetSearch,
} = searchSlice.actions;

export default searchSlice.reducer;
