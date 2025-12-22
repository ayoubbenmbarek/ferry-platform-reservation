/**
 * Tests for ferrySlice real-time availability updates
 *
 * Tests the updateFerryAvailability action that handles:
 * - Booking updates (decrease availability)
 * - Cancellation updates (increase availability)
 * - Cabin, passenger, and vehicle availability
 */

import ferryReducer, {
  updateFerryAvailability,
} from '../../store/slices/ferrySlice';

// Helper to create a mock ferry result (API returns snake_case but reducer handles both)
const createMockFerry = (overrides = {}): any => ({
  // Include both snake_case (API) and camelCase (frontend) for compatibility
  sailing_id: 'CTN-001',
  sailingId: 'CTN-001',
  operator: 'CTN',
  vesselName: 'Carthage',
  vessel_name: 'Carthage',
  departurePort: 'TUNIS',
  departure_port: 'TUNIS',
  arrivalPort: 'CIVITAVECCHIA',
  arrival_port: 'CIVITAVECCHIA',
  departureTime: '2025-12-16T19:00:00',
  departure_time: '2025-12-16T19:00:00',
  arrivalTime: '2025-12-17T07:00:00',
  arrival_time: '2025-12-17T07:00:00',
  duration: '12h',
  prices: { adult: 150, child: 75 },
  base_price: 150,
  available_spaces: {
    passengers: 100,
    vehicles: 20,
    cabins: 18,
  },
  cabin_types: [
    { type: 'inside_twin', name: 'Inside Twin', available: 10, price: 80 },
    { type: 'outside_twin', name: 'Outside Twin', available: 5, price: 120 },
    { type: 'suite', name: 'Suite', available: 3, price: 200 },
    { type: 'deck', name: 'Deck Passage', available: 50, price: 0 },
    { type: 'seat', name: 'Seat', available: 30, price: 15 },
  ],
  cabinTypes: [
    { type: 'inside_twin', name: 'Inside Twin', available: 10, price: 80 },
    { type: 'outside_twin', name: 'Outside Twin', available: 5, price: 120 },
    { type: 'suite', name: 'Suite', available: 3, price: 200 },
    { type: 'deck', name: 'Deck Passage', available: 50, price: 0 },
    { type: 'seat', name: 'Seat', available: 30, price: 15 },
  ],
  ...overrides,
});

// Helper to create initial state with search results
const createStateWithResults = (ferries = [createMockFerry()]): any => ({
  searchParams: {
    departurePort: '',
    arrivalPort: '',
    departureDate: '',
    returnDate: undefined,
    passengers: { adults: 1, children: 0, infants: 0 },
    vehicles: [],
  },
  searchResults: ferries,
  isSearching: false,
  searchError: null,
  selectedFerry: null,
  selectedReturnFerry: null,
  selectedCabin: null,
  selectedCabinId: null,
  selectedReturnCabinId: null,
  cabinSelections: [],
  returnCabinSelections: [],
  totalCabinPrice: 0,
  totalReturnCabinPrice: 0,
  isRoundTrip: false,
  currentStep: 1,
  currentBooking: null,
  isCreatingBooking: false,
  bookingError: null,
  selectedMeals: [],
  promoCode: null,
  promoDiscount: null,
  promoValidationMessage: null,
  contactInfo: null,
  passengers: [],
  vehicles: [],
  pets: [],
  ports: [],
  routes: {},
  isLoadingPorts: false,
  hasCancellationProtection: false,
  isLoading: false,
  error: null,
});

describe('ferrySlice - updateFerryAvailability', () => {
  describe('Booking Updates (Decrease Availability)', () => {
    it('decreases passenger availability when passengers_booked is set', () => {
      const initialState = createStateWithResults();
      const action = updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: {
          change_type: 'booking_created',
          passengers_booked: 4,
        },
      });

      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      expect(ferry.available_spaces.passengers).toBe(96); // 100 - 4
    });

    it('decreases vehicle availability when vehicles_booked is set', () => {
      const initialState = createStateWithResults();
      const action = updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: {
          change_type: 'booking_created',
          vehicles_booked: 2,
        },
      });

      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      expect(ferry.available_spaces.vehicles).toBe(18); // 20 - 2
    });

    it('decreases cabin availability when cabin_quantity is set', () => {
      const initialState = createStateWithResults();
      const action = updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: {
          change_type: 'booking_created',
          cabin_quantity: 3,
        },
      });

      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      expect(ferry.available_spaces.cabins).toBe(15); // 18 - 3
    });

    it('updates cabin_types array when cabin_quantity is set', () => {
      const initialState = createStateWithResults();
      const action = updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: {
          change_type: 'booking_created',
          cabin_quantity: 3,
        },
      });

      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      // Should decrease from first cabin type (inside_twin: 10 -> 7)
      const insideTwin = ferry.cabin_types.find((c: any) => c.type === 'inside_twin');
      expect(insideTwin.available).toBe(7); // 10 - 3
    });

    it('skips deck/seat types when updating cabin availability', () => {
      const initialState = createStateWithResults([
        createMockFerry({
          cabin_types: [
            { type: 'deck', name: 'Deck', available: 50, price: 0 },
            { type: 'seat', name: 'Seat', available: 30, price: 15 },
            { type: 'inside_twin', name: 'Inside Twin', available: 5, price: 80 },
          ],
        }),
      ]);

      const action = updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: {
          change_type: 'booking_created',
          cabin_quantity: 2,
        },
      });

      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      // Deck and seat should be unchanged
      expect(ferry.cabin_types[0].available).toBe(50); // deck unchanged
      expect(ferry.cabin_types[1].available).toBe(30); // seat unchanged
      // Inside twin should be decreased
      expect(ferry.cabin_types[2].available).toBe(3); // 5 - 2
    });

    it('does not go below 0 for any availability', () => {
      const initialState = createStateWithResults([
        createMockFerry({
          available_spaces: { passengers: 2, vehicles: 1, cabins: 1 },
        }),
      ]);

      const action = updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: {
          passengers_booked: 10, // More than available
          vehicles_booked: 5,
          cabin_quantity: 3,
        },
      });

      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      expect(ferry.available_spaces.passengers).toBe(0);
      expect(ferry.available_spaces.vehicles).toBe(0);
      expect(ferry.available_spaces.cabins).toBe(0);
    });

    it('handles combined booking update (passengers + vehicles + cabins)', () => {
      const initialState = createStateWithResults();
      const action = updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: {
          change_type: 'booking_created',
          passengers_booked: 2,
          vehicles_booked: 1,
          cabin_quantity: 1,
        },
      });

      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      expect(ferry.available_spaces.passengers).toBe(98);
      expect(ferry.available_spaces.vehicles).toBe(19);
      expect(ferry.available_spaces.cabins).toBe(17);
    });
  });

  describe('Cancellation Updates (Increase Availability)', () => {
    it('increases passenger availability when passengers_freed is set', () => {
      const initialState = createStateWithResults([
        createMockFerry({
          available_spaces: { passengers: 90, vehicles: 15, cabins: 10 },
        }),
      ]);

      const action = updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: {
          change_type: 'booking_cancelled',
          passengers_freed: 4,
        },
      });

      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      expect(ferry.available_spaces.passengers).toBe(94); // 90 + 4
    });

    it('increases vehicle availability when vehicles_freed is set', () => {
      const initialState = createStateWithResults([
        createMockFerry({
          available_spaces: { passengers: 90, vehicles: 15, cabins: 10 },
        }),
      ]);

      const action = updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: {
          change_type: 'booking_cancelled',
          vehicles_freed: 2,
        },
      });

      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      expect(ferry.available_spaces.vehicles).toBe(17); // 15 + 2
    });

    it('increases cabin availability when cabins_freed is set', () => {
      const initialState = createStateWithResults([
        createMockFerry({
          available_spaces: { passengers: 90, vehicles: 15, cabins: 10 },
        }),
      ]);

      const action = updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: {
          change_type: 'booking_cancelled',
          cabins_freed: 5,
        },
      });

      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      expect(ferry.available_spaces.cabins).toBe(15); // 10 + 5
    });

    it('updates cabin_types array when cabins_freed is set', () => {
      const initialState = createStateWithResults([
        createMockFerry({
          cabin_types: [
            { type: 'inside_twin', name: 'Inside Twin', available: 5, price: 80 },
            { type: 'outside_twin', name: 'Outside Twin', available: 3, price: 120 },
          ],
        }),
      ]);

      const action = updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: {
          change_type: 'booking_cancelled',
          cabins_freed: 3,
        },
      });

      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      // Freed cabins should be added to first cabin type
      const insideTwin = ferry.cabin_types.find((c: any) => c.type === 'inside_twin');
      expect(insideTwin.available).toBe(8); // 5 + 3
    });

    it('handles combined cancellation update', () => {
      const initialState = createStateWithResults([
        createMockFerry({
          available_spaces: { passengers: 80, vehicles: 10, cabins: 5 },
        }),
      ]);

      const action = updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: {
          change_type: 'booking_cancelled',
          passengers_freed: 4,
          vehicles_freed: 1,
          cabins_freed: 2,
        },
      });

      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      expect(ferry.available_spaces.passengers).toBe(84);
      expect(ferry.available_spaces.vehicles).toBe(11);
      expect(ferry.available_spaces.cabins).toBe(7);
    });
  });

  describe('Ferry Matching', () => {
    it('finds ferry by sailing_id (snake_case)', () => {
      const initialState = createStateWithResults();
      const action = updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: { passengers_booked: 1 },
      });

      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      expect(ferry.available_spaces.passengers).toBe(99);
    });

    it('finds ferry by sailingId (camelCase)', () => {
      const initialState = createStateWithResults([
        createMockFerry({ sailing_id: undefined, sailingId: 'CTN-002' }),
      ]);

      const action = updateFerryAvailability({
        ferryId: 'CTN-002',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: { passengers_booked: 1 },
      });

      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      expect(ferry.available_spaces.passengers).toBe(99);
    });

    it('does not modify state if ferry not found', () => {
      const initialState = createStateWithResults();
      const action = updateFerryAvailability({
        ferryId: 'NON-EXISTENT',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: { passengers_booked: 10 },
      });

      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      // Should remain unchanged
      expect(ferry.available_spaces.passengers).toBe(100);
    });

    it('updates correct ferry when multiple ferries in results', () => {
      const initialState = createStateWithResults([
        createMockFerry({ sailing_id: 'CTN-001', vessel_name: 'Carthage' }),
        createMockFerry({ sailing_id: 'CTN-002', vessel_name: 'Ulysse' }),
        createMockFerry({ sailing_id: 'GNV-001', vessel_name: 'Azzurra' }),
      ]);

      const action = updateFerryAvailability({
        ferryId: 'CTN-002',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: { passengers_booked: 5 },
      });

      const newState = ferryReducer(initialState, action);

      // Only CTN-002 should be updated
      expect((newState.searchResults[0] as any).available_spaces.passengers).toBe(100);
      expect((newState.searchResults[1] as any).available_spaces.passengers).toBe(95);
      expect((newState.searchResults[2] as any).available_spaces.passengers).toBe(100);
    });
  });

  describe('Edge Cases', () => {
    it('initializes available_spaces if not present', () => {
      const initialState = createStateWithResults([
        {
          sailing_id: 'CTN-001',
          operator: 'CTN',
          // No available_spaces
        } as any,
      ]);

      const action = updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: { passengers_booked: 5 },
      });

      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      expect(ferry.available_spaces).toBeDefined();
      // 0 - 5 = 0 (clamped to 0)
      expect(ferry.available_spaces.passengers).toBe(0);
    });

    it('handles empty search results', () => {
      const initialState = createStateWithResults([]);
      const action = updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: { passengers_booked: 5 },
      });

      const newState = ferryReducer(initialState, action);

      expect(newState.searchResults).toEqual([]);
    });

    it('handles ferry with no cabin_types', () => {
      const initialState = createStateWithResults([
        createMockFerry({ cabin_types: undefined }),
      ]);

      const action = updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-CIVITAVECCHIA',
        availability: { cabin_quantity: 2 },
      });

      // Should not throw
      const newState = ferryReducer(initialState, action);
      const ferry = newState.searchResults[0] as any;

      expect(ferry.available_spaces.cabins).toBe(16);
    });
  });
});
