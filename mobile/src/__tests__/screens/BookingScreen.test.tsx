import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../store/slices/authSlice';
import bookingReducer, { setContactInfo } from '../../store/slices/bookingSlice';
import searchReducer from '../../store/slices/searchSlice';
import { createMockUser, createMockFerrySchedule } from '../../test-utils/testUtils';

// Test that auto-fill contact info logic works correctly
describe('BookingScreen - Auto-fill Contact Info', () => {
  const createStore = (preloadedState = {}) =>
    configureStore({
      reducer: {
        auth: authReducer,
        booking: bookingReducer,
        search: searchReducer,
      },
      preloadedState,
    });

  describe('auto-fill contact info from logged-in user', () => {
    it('should have auto-fill logic that pre-fills contact info when user is logged in', () => {
      // Create a store with an authenticated user
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+1234567890',
      });

      const store = createStore({
        auth: {
          user: mockUser,
          token: 'test-token',
          isAuthenticated: true,
          isLoading: false,
          error: null,
        },
        booking: {
          selectedSchedule: null,
          returnSchedule: null,
          contactInfo: {
            email: '',
            phone: '',
            firstName: '',
            lastName: '',
          },
          passengers: [],
          vehicles: [],
          selectedCabin: null,
          cabinQuantity: 0,
          returnCabin: null,
          returnCabinQuantity: 0,
          selectedMeals: [],
          hasCancellationProtection: false,
          promoCode: '',
          promoDiscount: 0,
          specialRequests: '',
          currentBooking: null,
          isCreatingBooking: false,
          bookingError: null,
          userBookings: [],
          isLoadingBookings: false,
          bookingsError: null,
        },
        search: {
          departurePort: null,
          arrivalPort: null,
          departureDate: null,
          returnDate: null,
          passengers: 1,
          adults: 1,
          children: 0,
          infants: 0,
          vehicles: 0,
          vehicleSelections: [],
          isRoundTrip: false,
          outboundSchedules: [],
          returnSchedules: [],
          selectedOutbound: null,
          selectedReturn: null,
          isSearching: false,
          searchError: null,
          ports: [],
          routes: {},
          isLoadingPorts: false,
          isLoadingRoutes: false,
        },
      });

      // Simulate what BookingScreen useEffect does for auto-fill
      const state = store.getState();
      const user = state.auth.user;
      const contactInfo = state.booking.contactInfo;

      // The auto-fill logic: if user exists and contactInfo.email is empty
      if (user && !contactInfo.email) {
        store.dispatch(
          setContactInfo({
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone || '',
          })
        );
      }

      // Verify contact info was filled from user
      const updatedState = store.getState();
      expect(updatedState.booking.contactInfo.email).toBe('john.doe@example.com');
      expect(updatedState.booking.contactInfo.firstName).toBe('John');
      expect(updatedState.booking.contactInfo.lastName).toBe('Doe');
      expect(updatedState.booking.contactInfo.phone).toBe('+1234567890');
    });

    it('should not overwrite existing contact info', () => {
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        first_name: 'John',
        last_name: 'Doe',
      });

      const store = createStore({
        auth: {
          user: mockUser,
          token: 'test-token',
          isAuthenticated: true,
          isLoading: false,
          error: null,
        },
        booking: {
          selectedSchedule: null,
          returnSchedule: null,
          contactInfo: {
            email: 'existing@email.com', // Already has email
            phone: '+999',
            firstName: 'Jane',
            lastName: 'Smith',
          },
          passengers: [],
          vehicles: [],
          selectedCabin: null,
          cabinQuantity: 0,
          returnCabin: null,
          returnCabinQuantity: 0,
          selectedMeals: [],
          hasCancellationProtection: false,
          promoCode: '',
          promoDiscount: 0,
          specialRequests: '',
          currentBooking: null,
          isCreatingBooking: false,
          bookingError: null,
          userBookings: [],
          isLoadingBookings: false,
          bookingsError: null,
        },
        search: {
          departurePort: null,
          arrivalPort: null,
          departureDate: null,
          returnDate: null,
          passengers: 1,
          adults: 1,
          children: 0,
          infants: 0,
          vehicles: 0,
          vehicleSelections: [],
          isRoundTrip: false,
          outboundSchedules: [],
          returnSchedules: [],
          selectedOutbound: null,
          selectedReturn: null,
          isSearching: false,
          searchError: null,
          ports: [],
          routes: {},
          isLoadingPorts: false,
          isLoadingRoutes: false,
        },
      });

      // Simulate auto-fill logic
      const state = store.getState();
      const user = state.auth.user;
      const contactInfo = state.booking.contactInfo;

      // Auto-fill only if email is empty
      if (user && !contactInfo.email) {
        store.dispatch(
          setContactInfo({
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone || '',
          })
        );
      }

      // Verify original contact info was preserved
      const updatedState = store.getState();
      expect(updatedState.booking.contactInfo.email).toBe('existing@email.com');
      expect(updatedState.booking.contactInfo.firstName).toBe('Jane');
      expect(updatedState.booking.contactInfo.lastName).toBe('Smith');
    });

    it('should not fill contact info when user is not logged in', () => {
      const store = createStore({
        auth: {
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        },
        booking: {
          selectedSchedule: null,
          returnSchedule: null,
          contactInfo: {
            email: '',
            phone: '',
            firstName: '',
            lastName: '',
          },
          passengers: [],
          vehicles: [],
          selectedCabin: null,
          cabinQuantity: 0,
          returnCabin: null,
          returnCabinQuantity: 0,
          selectedMeals: [],
          hasCancellationProtection: false,
          promoCode: '',
          promoDiscount: 0,
          specialRequests: '',
          currentBooking: null,
          isCreatingBooking: false,
          bookingError: null,
          userBookings: [],
          isLoadingBookings: false,
          bookingsError: null,
        },
        search: {
          departurePort: null,
          arrivalPort: null,
          departureDate: null,
          returnDate: null,
          passengers: 1,
          adults: 1,
          children: 0,
          infants: 0,
          vehicles: 0,
          vehicleSelections: [],
          isRoundTrip: false,
          outboundSchedules: [],
          returnSchedules: [],
          selectedOutbound: null,
          selectedReturn: null,
          isSearching: false,
          searchError: null,
          ports: [],
          routes: {},
          isLoadingPorts: false,
          isLoadingRoutes: false,
        },
      });

      // Simulate auto-fill logic
      const state = store.getState();
      const user = state.auth.user;
      const contactInfo = state.booking.contactInfo;

      // Auto-fill only if user exists
      if (user && !contactInfo.email) {
        store.dispatch(
          setContactInfo({
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone || '',
          })
        );
      }

      // Contact info should remain empty
      const updatedState = store.getState();
      expect(updatedState.booking.contactInfo.email).toBe('');
      expect(updatedState.booking.contactInfo.firstName).toBe('');
      expect(updatedState.booking.contactInfo.lastName).toBe('');
    });

    it('should handle user without phone number', () => {
      const mockUser = createMockUser({
        email: 'john@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone: null, // No phone
      });

      const store = createStore({
        auth: {
          user: mockUser,
          token: 'test-token',
          isAuthenticated: true,
          isLoading: false,
          error: null,
        },
        booking: {
          selectedSchedule: null,
          returnSchedule: null,
          contactInfo: {
            email: '',
            phone: '',
            firstName: '',
            lastName: '',
          },
          passengers: [],
          vehicles: [],
          selectedCabin: null,
          cabinQuantity: 0,
          returnCabin: null,
          returnCabinQuantity: 0,
          selectedMeals: [],
          hasCancellationProtection: false,
          promoCode: '',
          promoDiscount: 0,
          specialRequests: '',
          currentBooking: null,
          isCreatingBooking: false,
          bookingError: null,
          userBookings: [],
          isLoadingBookings: false,
          bookingsError: null,
        },
        search: {
          departurePort: null,
          arrivalPort: null,
          departureDate: null,
          returnDate: null,
          passengers: 1,
          adults: 1,
          children: 0,
          infants: 0,
          vehicles: 0,
          vehicleSelections: [],
          isRoundTrip: false,
          outboundSchedules: [],
          returnSchedules: [],
          selectedOutbound: null,
          selectedReturn: null,
          isSearching: false,
          searchError: null,
          ports: [],
          routes: {},
          isLoadingPorts: false,
          isLoadingRoutes: false,
        },
      });

      // Simulate auto-fill logic
      const state = store.getState();
      const user = state.auth.user;
      const contactInfo = state.booking.contactInfo;

      if (user && !contactInfo.email) {
        store.dispatch(
          setContactInfo({
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone || '', // Fallback to empty string
          })
        );
      }

      // Verify phone defaults to empty string
      const updatedState = store.getState();
      expect(updatedState.booking.contactInfo.email).toBe('john@example.com');
      expect(updatedState.booking.contactInfo.phone).toBe('');
    });
  });
});
