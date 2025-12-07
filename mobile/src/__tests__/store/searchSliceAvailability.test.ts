import { configureStore } from '@reduxjs/toolkit';
import searchReducer, {
  updateFerryAvailability,
} from '../../store/slices/searchSlice';
import { FerrySchedule } from '../../types';

/**
 * Tests for WebSocket availability updates in searchSlice.
 *
 * Tests the updateFerryAvailability reducer which handles:
 * - Passenger booking/cancellation updates
 * - Vehicle booking/cancellation updates
 * - Cabin booking/cancellation updates (cabin_quantity, cabins_freed)
 */

// Helper to create mock ferry schedule
const createMockFerry = (overrides: Partial<FerrySchedule> = {}): FerrySchedule => ({
  id: 'ferry-1',
  sailing_id: 'CTN-001',
  operator: 'CTN',
  departure_port: 'Tunis',
  arrival_port: 'Marseille',
  departure_time: '2024-06-15T10:00:00',
  arrival_time: '2024-06-15T22:00:00',
  duration: '12h',
  vessel_name: 'Carthage',
  adult_price: 150,
  child_price: 75,
  infant_price: 0,
  vehicle_price: 200,
  available_capacity: 100,
  available_vehicle_space: 50,
  available_cabins: 20,
  amenities: [],
  ...overrides,
});

describe('searchSlice - WebSocket Availability Updates', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: { search: searchReducer },
      preloadedState: {
        search: {
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
          outboundResults: [createMockFerry()],
          returnResults: [createMockFerry({ sailing_id: 'CTN-002', id: 'ferry-2' })],
          isSearching: false,
          searchError: null,
          selectedOutbound: null,
          selectedReturn: null,
          ports: [],
          routes: {},
          isLoadingPorts: false,
        },
      },
    });
  });

  describe('Passenger Availability Updates', () => {
    it('should decrease passenger capacity on booking', () => {
      const initialCapacity = store.getState().search.outboundResults[0].available_capacity;

      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: {
          change_type: 'booking',
          passengers_booked: 3,
        },
      }));

      const updatedCapacity = store.getState().search.outboundResults[0].available_capacity;
      expect(updatedCapacity).toBe(initialCapacity! - 3);
    });

    it('should increase passenger capacity on cancellation', () => {
      // First book some passengers
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: { passengers_booked: 5 },
      }));

      const afterBooking = store.getState().search.outboundResults[0].available_capacity;

      // Then cancel
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: { passengers_freed: 2 },
      }));

      const afterCancellation = store.getState().search.outboundResults[0].available_capacity;
      expect(afterCancellation).toBe(afterBooking! + 2);
    });

    it('should not go below zero for passenger capacity', () => {
      // Try to book more than available
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: { passengers_booked: 200 },
      }));

      const capacity = store.getState().search.outboundResults[0].available_capacity;
      expect(capacity).toBe(0);
    });
  });

  describe('Vehicle Availability Updates', () => {
    it('should decrease vehicle space on booking', () => {
      const initialSpace = store.getState().search.outboundResults[0].available_vehicle_space;

      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: { vehicles_booked: 2 },
      }));

      const updatedSpace = store.getState().search.outboundResults[0].available_vehicle_space;
      expect(updatedSpace).toBe(initialSpace! - 2);
    });

    it('should increase vehicle space on cancellation', () => {
      // First book
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: { vehicles_booked: 3 },
      }));

      const afterBooking = store.getState().search.outboundResults[0].available_vehicle_space;

      // Then cancel
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: { vehicles_freed: 1 },
      }));

      const afterCancellation = store.getState().search.outboundResults[0].available_vehicle_space;
      expect(afterCancellation).toBe(afterBooking! + 1);
    });

    it('should not go below zero for vehicle space', () => {
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: { vehicles_booked: 100 },
      }));

      const space = store.getState().search.outboundResults[0].available_vehicle_space;
      expect(space).toBe(0);
    });
  });

  describe('Cabin Availability Updates (cabin_quantity)', () => {
    it('should decrease cabin count on booking using cabin_quantity', () => {
      const initialCabins = store.getState().search.outboundResults[0].available_cabins;

      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: {
          cabin_quantity: 2,
          cabin_type: 'inside',
        },
      }));

      const updatedCabins = store.getState().search.outboundResults[0].available_cabins;
      expect(updatedCabins).toBe(initialCabins! - 2);
    });

    it('should not go below zero for cabins', () => {
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: { cabin_quantity: 50 },
      }));

      const cabins = store.getState().search.outboundResults[0].available_cabins;
      expect(cabins).toBe(0);
    });
  });

  describe('Cabin Availability Updates (cabins_freed)', () => {
    it('should increase cabin count on cancellation using cabins_freed', () => {
      // First book some cabins
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: { cabin_quantity: 5 },
      }));

      const afterBooking = store.getState().search.outboundResults[0].available_cabins;

      // Then cancel using cabins_freed
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: { cabins_freed: 3 },
      }));

      const afterCancellation = store.getState().search.outboundResults[0].available_cabins;
      expect(afterCancellation).toBe(afterBooking! + 3);
    });

    it('should correctly restore cabin count after full cancellation', () => {
      const initialCabins = store.getState().search.outboundResults[0].available_cabins;

      // Book 5 cabins
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: { cabin_quantity: 5 },
      }));

      // Cancel all 5 cabins
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: { cabins_freed: 5 },
      }));

      const finalCabins = store.getState().search.outboundResults[0].available_cabins;
      expect(finalCabins).toBe(initialCabins);
    });
  });

  describe('Combined Updates', () => {
    it('should handle combined booking update', () => {
      const initial = store.getState().search.outboundResults[0];

      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: {
          passengers_booked: 4,
          vehicles_booked: 1,
          cabin_quantity: 2,
        },
      }));

      const updated = store.getState().search.outboundResults[0];
      expect(updated.available_capacity).toBe(initial.available_capacity! - 4);
      expect(updated.available_vehicle_space).toBe(initial.available_vehicle_space! - 1);
      expect(updated.available_cabins).toBe(initial.available_cabins! - 2);
    });

    it('should handle combined cancellation update', () => {
      // First book
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: {
          passengers_booked: 4,
          vehicles_booked: 1,
          cabin_quantity: 2,
        },
      }));

      const afterBooking = store.getState().search.outboundResults[0];

      // Then cancel
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: {
          passengers_freed: 4,
          vehicles_freed: 1,
          cabins_freed: 2,
        },
      }));

      const afterCancellation = store.getState().search.outboundResults[0];
      expect(afterCancellation.available_capacity).toBe(afterBooking.available_capacity! + 4);
      expect(afterCancellation.available_vehicle_space).toBe(afterBooking.available_vehicle_space! + 1);
      expect(afterCancellation.available_cabins).toBe(afterBooking.available_cabins! + 2);
    });
  });

  describe('Ferry Matching', () => {
    it('should update by sailing_id', () => {
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: { passengers_booked: 10 },
      }));

      const ferry = store.getState().search.outboundResults[0];
      expect(ferry.available_capacity).toBe(90);
    });

    it('should update by id fallback', () => {
      store.dispatch(updateFerryAvailability({
        ferryId: 'ferry-1',
        route: 'TUNIS-MARSEILLE',
        availability: { passengers_booked: 5 },
      }));

      const ferry = store.getState().search.outboundResults[0];
      expect(ferry.available_capacity).toBe(95);
    });

    it('should not update non-matching ferries', () => {
      const initialCapacity = store.getState().search.outboundResults[0].available_capacity;

      store.dispatch(updateFerryAvailability({
        ferryId: 'NON-EXISTENT',
        route: 'TUNIS-MARSEILLE',
        availability: { passengers_booked: 10 },
      }));

      const capacity = store.getState().search.outboundResults[0].available_capacity;
      expect(capacity).toBe(initialCapacity);
    });
  });

  describe('Return Results Updates', () => {
    it('should update return results by sailing_id', () => {
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-002',
        route: 'MARSEILLE-TUNIS',
        availability: { cabin_quantity: 3 },
      }));

      const returnFerry = store.getState().search.returnResults[0];
      expect(returnFerry.available_cabins).toBe(17); // 20 - 3
    });

    it('should update return results with cabins_freed', () => {
      // First book
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-002',
        route: 'MARSEILLE-TUNIS',
        availability: { cabin_quantity: 5 },
      }));

      // Then cancel
      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-002',
        route: 'MARSEILLE-TUNIS',
        availability: { cabins_freed: 2 },
      }));

      const returnFerry = store.getState().search.returnResults[0];
      expect(returnFerry.available_cabins).toBe(17); // 20 - 5 + 2
    });
  });

  describe('Edge Cases', () => {
    it('should handle update with no availability fields', () => {
      const initial = store.getState().search.outboundResults[0];

      store.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: {},
      }));

      const updated = store.getState().search.outboundResults[0];
      expect(updated.available_capacity).toBe(initial.available_capacity);
      expect(updated.available_cabins).toBe(initial.available_cabins);
    });

    it('should handle null/undefined initial values', () => {
      // Create store with null availability values
      const storeWithNulls = configureStore({
        reducer: { search: searchReducer },
        preloadedState: {
          search: {
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
            outboundResults: [{
              ...createMockFerry(),
              available_capacity: undefined as any,
              available_cabins: undefined as any,
            }],
            returnResults: [],
            isSearching: false,
            searchError: null,
            selectedOutbound: null,
            selectedReturn: null,
            ports: [],
            routes: {},
            isLoadingPorts: false,
          },
        },
      });

      // Should handle gracefully with || 0 fallback
      storeWithNulls.dispatch(updateFerryAvailability({
        ferryId: 'CTN-001',
        route: 'TUNIS-MARSEILLE',
        availability: { cabins_freed: 5 },
      }));

      const ferry = storeWithNulls.getState().search.outboundResults[0];
      expect(ferry.available_cabins).toBe(5); // 0 + 5
    });

    it('should handle multiple rapid updates', () => {
      // Simulate multiple rapid WebSocket updates
      for (let i = 0; i < 10; i++) {
        store.dispatch(updateFerryAvailability({
          ferryId: 'CTN-001',
          route: 'TUNIS-MARSEILLE',
          availability: { passengers_booked: 1 },
        }));
      }

      const ferry = store.getState().search.outboundResults[0];
      expect(ferry.available_capacity).toBe(90); // 100 - 10
    });
  });
});
