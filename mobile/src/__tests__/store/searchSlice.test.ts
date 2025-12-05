import { configureStore } from '@reduxjs/toolkit';
import searchReducer, {
  setDeparturePort,
  setArrivalPort,
  setDepartureDate,
  setReturnDate,
  setAdults,
  setChildren,
  setInfants,
  setVehicles,
  setVehicleType,
  updateVehicleSelection,
  setIsRoundTrip,
  swapPorts,
  selectOutbound,
  selectReturn,
  clearSelection,
  clearResults,
  resetSearch,
  fetchPorts,
  fetchRoutes,
  searchFerries,
  setSameReturnRoute,
  setReturnDeparturePort,
  setReturnArrivalPort,
} from '../../store/slices/searchSlice';
import { ferryService } from '../../services/ferryService';
import { createMockFerrySchedule, createMockPort } from '../../test-utils/testUtils';

// Mock the ferry service
jest.mock('../../services/ferryService');
const mockedFerryService = ferryService as jest.Mocked<typeof ferryService>;

describe('searchSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: { search: searchReducer },
    });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().search;
      expect(state.departurePort).toBe('');
      expect(state.arrivalPort).toBe('');
      expect(state.adults).toBe(1);
      expect(state.children).toBe(0);
      expect(state.infants).toBe(0);
      expect(state.vehicles).toBe(0);
      expect(state.isRoundTrip).toBe(false);
      expect(state.vehicleSelections).toEqual([]);
    });
  });

  describe('port actions', () => {
    it('should set departure port', () => {
      store.dispatch(setDeparturePort('TUN'));
      expect(store.getState().search.departurePort).toBe('TUN');
    });

    it('should set arrival port', () => {
      store.dispatch(setArrivalPort('MRS'));
      expect(store.getState().search.arrivalPort).toBe('MRS');
    });

    it('should swap ports', () => {
      store.dispatch(setDeparturePort('TUN'));
      store.dispatch(setArrivalPort('MRS'));
      store.dispatch(swapPorts());

      const state = store.getState().search;
      expect(state.departurePort).toBe('MRS');
      expect(state.arrivalPort).toBe('TUN');
    });

    it('should set return ports', () => {
      store.dispatch(setReturnDeparturePort('MRS'));
      store.dispatch(setReturnArrivalPort('TUN'));

      const state = store.getState().search;
      expect(state.returnDeparturePort).toBe('MRS');
      expect(state.returnArrivalPort).toBe('TUN');
    });

    it('should sync return ports when same route is set', () => {
      store.dispatch(setDeparturePort('TUN'));
      store.dispatch(setArrivalPort('MRS'));
      store.dispatch(setSameReturnRoute(true));

      const state = store.getState().search;
      expect(state.returnDeparturePort).toBe('MRS');
      expect(state.returnArrivalPort).toBe('TUN');
    });
  });

  describe('date actions', () => {
    it('should set departure date', () => {
      store.dispatch(setDepartureDate('2024-06-15'));
      expect(store.getState().search.departureDate).toBe('2024-06-15');
    });

    it('should set return date and enable round trip', () => {
      store.dispatch(setReturnDate('2024-06-20'));
      const state = store.getState().search;
      expect(state.returnDate).toBe('2024-06-20');
      expect(state.isRoundTrip).toBe(true);
    });

    it('should clear return date and disable round trip', () => {
      store.dispatch(setReturnDate('2024-06-20'));
      store.dispatch(setReturnDate(null));

      const state = store.getState().search;
      expect(state.returnDate).toBeNull();
      expect(state.isRoundTrip).toBe(false);
    });
  });

  describe('passenger actions', () => {
    it('should set adults with min constraint', () => {
      store.dispatch(setAdults(0));
      expect(store.getState().search.adults).toBe(1); // Min is 1
    });

    it('should set adults with max constraint', () => {
      store.dispatch(setAdults(15));
      expect(store.getState().search.adults).toBe(9); // Max is 9
    });

    it('should set children with min constraint', () => {
      store.dispatch(setChildren(-1));
      expect(store.getState().search.children).toBe(0);
    });

    it('should set children with max constraint', () => {
      store.dispatch(setChildren(10));
      expect(store.getState().search.children).toBe(8); // Max is 8
    });

    it('should limit infants to number of adults', () => {
      store.dispatch(setAdults(2));
      store.dispatch(setInfants(5)); // Try to set more than adults
      expect(store.getState().search.infants).toBe(2); // Should be capped at adults
    });

    it('should calculate total passengers correctly', () => {
      store.dispatch(setAdults(2));
      store.dispatch(setChildren(3));
      store.dispatch(setInfants(1));

      const state = store.getState().search;
      expect(state.passengers).toBe(6); // 2 + 3 + 1
    });
  });

  describe('vehicle actions', () => {
    it('should set vehicles and create vehicle selections', () => {
      store.dispatch(setVehicles(2));

      const state = store.getState().search;
      expect(state.vehicles).toBe(2);
      expect(state.vehicleSelections).toHaveLength(2);
    });

    it('should not exceed max vehicles', () => {
      store.dispatch(setVehicles(5));
      expect(store.getState().search.vehicles).toBe(3); // Max is 3
    });

    it('should set vehicle type', () => {
      store.dispatch(setVehicleType('suv'));
      expect(store.getState().search.vehicleType).toBe('suv');
    });

    it('should update individual vehicle selection', () => {
      store.dispatch(setVehicles(2));
      store.dispatch(updateVehicleSelection({ index: 0, type: 'motorcycle' }));

      const state = store.getState().search;
      expect(state.vehicleSelections[0].type).toBe('motorcycle');
    });

    it('should remove vehicles when count decreases', () => {
      store.dispatch(setVehicles(3));
      store.dispatch(setVehicles(1));

      const state = store.getState().search;
      expect(state.vehicles).toBe(1);
      expect(state.vehicleSelections).toHaveLength(1);
    });
  });

  describe('round trip actions', () => {
    it('should set round trip', () => {
      store.dispatch(setIsRoundTrip(true));
      expect(store.getState().search.isRoundTrip).toBe(true);
    });

    it('should clear return when disabling round trip', () => {
      store.dispatch(setReturnDate('2024-06-20'));
      store.dispatch(selectReturn(createMockFerrySchedule()));
      store.dispatch(setIsRoundTrip(false));

      const state = store.getState().search;
      expect(state.isRoundTrip).toBe(false);
      expect(state.returnDate).toBeNull();
      expect(state.selectedReturn).toBeNull();
    });
  });

  describe('selection actions', () => {
    it('should select outbound schedule', () => {
      const schedule = createMockFerrySchedule();
      store.dispatch(selectOutbound(schedule));
      expect(store.getState().search.selectedOutbound).toEqual(schedule);
    });

    it('should select return schedule', () => {
      const schedule = createMockFerrySchedule();
      store.dispatch(selectReturn(schedule));
      expect(store.getState().search.selectedReturn).toEqual(schedule);
    });

    it('should clear selection', () => {
      store.dispatch(selectOutbound(createMockFerrySchedule()));
      store.dispatch(selectReturn(createMockFerrySchedule()));
      store.dispatch(clearSelection());

      const state = store.getState().search;
      expect(state.selectedOutbound).toBeNull();
      expect(state.selectedReturn).toBeNull();
    });

    it('should clear results', () => {
      // First set some results
      store = configureStore({
        reducer: { search: searchReducer },
        preloadedState: {
          search: {
            ...store.getState().search,
            outboundResults: [createMockFerrySchedule()],
            returnResults: [createMockFerrySchedule()],
            selectedOutbound: createMockFerrySchedule(),
            searchError: 'Some error',
          },
        },
      });

      store.dispatch(clearResults());

      const state = store.getState().search;
      expect(state.outboundResults).toEqual([]);
      expect(state.returnResults).toEqual([]);
      expect(state.selectedOutbound).toBeNull();
      expect(state.searchError).toBeNull();
    });
  });

  describe('reset action', () => {
    it('should reset to initial state', () => {
      store.dispatch(setDeparturePort('TUN'));
      store.dispatch(setArrivalPort('MRS'));
      store.dispatch(setAdults(3));
      store.dispatch(setVehicles(2));
      store.dispatch(resetSearch());

      const state = store.getState().search;
      expect(state.departurePort).toBe('');
      expect(state.arrivalPort).toBe('');
      expect(state.adults).toBe(1);
      expect(state.vehicles).toBe(0);
    });
  });

  describe('fetchPorts thunk', () => {
    it('should fetch ports successfully', async () => {
      const mockPorts = [
        createMockPort({ code: 'TUN', name: 'Tunis' }),
        createMockPort({ code: 'MRS', name: 'Marseille' }),
      ];
      mockedFerryService.getPorts.mockResolvedValueOnce(mockPorts);

      await store.dispatch(fetchPorts());

      const state = store.getState().search;
      expect(state.ports).toEqual(mockPorts);
      expect(state.isLoadingPorts).toBe(false);
    });

    it('should use mock data when API fails', async () => {
      mockedFerryService.getPorts.mockRejectedValueOnce(new Error('API Error'));

      await store.dispatch(fetchPorts());

      const state = store.getState().search;
      expect(state.ports.length).toBeGreaterThan(0); // Mock data loaded
      expect(state.isLoadingPorts).toBe(false);
    });

    it('should set loading state while fetching', async () => {
      mockedFerryService.getPorts.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      const promise = store.dispatch(fetchPorts());
      expect(store.getState().search.isLoadingPorts).toBe(true);

      await promise;
      expect(store.getState().search.isLoadingPorts).toBe(false);
    });
  });

  describe('fetchRoutes thunk', () => {
    it('should fetch routes successfully', async () => {
      const mockRoutes = { TUN: ['MRS', 'GEN'] };
      mockedFerryService.getRoutes.mockResolvedValueOnce(mockRoutes);

      await store.dispatch(fetchRoutes());

      expect(store.getState().search.routes).toEqual(mockRoutes);
    });

    it('should use mock data when API fails', async () => {
      mockedFerryService.getRoutes.mockRejectedValueOnce(new Error('API Error'));

      await store.dispatch(fetchRoutes());

      const routes = store.getState().search.routes;
      expect(Object.keys(routes).length).toBeGreaterThan(0); // Mock data loaded
    });
  });

  describe('searchFerries thunk', () => {
    const searchParams = {
      departure_port: 'TUN',
      arrival_port: 'MRS',
      departure_date: '2024-06-15',
      adults: 2,
      children: 1,
      infants: 0,
      vehicles: 0,
    };

    it('should search ferries successfully', async () => {
      const mockResults = {
        outbound: [createMockFerrySchedule()],
        return: [],
      };
      mockedFerryService.searchFerries.mockResolvedValueOnce(mockResults);

      await store.dispatch(searchFerries(searchParams));

      const state = store.getState().search;
      expect(state.outboundResults).toEqual(mockResults.outbound);
      expect(state.isSearching).toBe(false);
      expect(state.searchError).toBeNull();
    });

    it('should handle search with return results', async () => {
      const mockResults = {
        outbound: [createMockFerrySchedule()],
        return: [createMockFerrySchedule({ sailing_id: 'return-123' })],
      };
      mockedFerryService.searchFerries.mockResolvedValueOnce(mockResults);

      await store.dispatch(searchFerries({ ...searchParams, return_date: '2024-06-20' }));

      const state = store.getState().search;
      expect(state.outboundResults).toHaveLength(1);
      expect(state.returnResults).toHaveLength(1);
    });

    it('should handle search error', async () => {
      const errorMessage = 'No ferries available';
      mockedFerryService.searchFerries.mockRejectedValueOnce(new Error(errorMessage));

      await store.dispatch(searchFerries(searchParams));

      const state = store.getState().search;
      expect(state.searchError).toBe(errorMessage);
      expect(state.isSearching).toBe(false);
    });

    it('should set loading state during search', async () => {
      mockedFerryService.searchFerries.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve({ outbound: [], return: [] }), 100))
      );

      const promise = store.dispatch(searchFerries(searchParams));
      expect(store.getState().search.isSearching).toBe(true);

      await promise;
      expect(store.getState().search.isSearching).toBe(false);
    });
  });
});
