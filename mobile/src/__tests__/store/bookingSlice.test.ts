import { configureStore } from '@reduxjs/toolkit';
import bookingReducer, {
  setSelectedSchedule,
  setReturnSchedule,
  setContactInfo,
  addPassenger,
  updatePassenger,
  removePassenger,
  setPassengers,
  addVehicle,
  updateVehicle,
  removeVehicle,
  setVehicles,
  setSelectedCabin,
  setReturnCabin,
  addMeal,
  updateMealQuantity,
  removeMeal,
  setCancellationProtection,
  setPromoCode,
  setPromoDiscount,
  setSpecialRequests,
  setCurrentBooking,
  clearBookingError,
  resetBooking,
  createBooking,
  fetchUserBookings,
  cancelBooking,
  selectBookingTotal,
} from '../../store/slices/bookingSlice';
import { bookingService } from '../../services/bookingService';
import {
  createMockFerrySchedule,
  createMockPassenger,
  createMockVehicle,
  createMockCabin,
  createMockMeal,
  createMockBooking,
} from '../../test-utils/testUtils';

// Mock the booking service
jest.mock('../../services/bookingService');
const mockedBookingService = bookingService as jest.Mocked<typeof bookingService>;

describe('bookingSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: { booking: bookingReducer },
    });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().booking;
      expect(state.selectedSchedule).toBeNull();
      expect(state.returnSchedule).toBeNull();
      expect(state.contactInfo).toEqual({
        email: '',
        phone: '',
        firstName: '',
        lastName: '',
      });
      expect(state.passengers).toEqual([]);
      expect(state.vehicles).toEqual([]);
      expect(state.hasCancellationProtection).toBe(false);
    });
  });

  describe('schedule actions', () => {
    it('should set selected schedule', () => {
      const schedule = createMockFerrySchedule();
      store.dispatch(setSelectedSchedule(schedule));
      expect(store.getState().booking.selectedSchedule).toEqual(schedule);
    });

    it('should set return schedule', () => {
      const schedule = createMockFerrySchedule({ sailing_id: 'return-123' });
      store.dispatch(setReturnSchedule(schedule));
      expect(store.getState().booking.returnSchedule).toEqual(schedule);
    });

    it('should clear return schedule', () => {
      store.dispatch(setReturnSchedule(createMockFerrySchedule()));
      store.dispatch(setReturnSchedule(null));
      expect(store.getState().booking.returnSchedule).toBeNull();
    });
  });

  describe('contact info actions', () => {
    it('should set contact info', () => {
      store.dispatch(setContactInfo({
        email: 'test@example.com',
        phone: '+1234567890',
      }));

      const state = store.getState().booking;
      expect(state.contactInfo.email).toBe('test@example.com');
      expect(state.contactInfo.phone).toBe('+1234567890');
    });

    it('should merge contact info', () => {
      store.dispatch(setContactInfo({ email: 'test@example.com' }));
      store.dispatch(setContactInfo({ firstName: 'John' }));

      const state = store.getState().booking;
      expect(state.contactInfo.email).toBe('test@example.com');
      expect(state.contactInfo.firstName).toBe('John');
    });
  });

  describe('passenger actions', () => {
    it('should add passenger', () => {
      const passenger = createMockPassenger();
      store.dispatch(addPassenger(passenger));
      expect(store.getState().booking.passengers).toHaveLength(1);
      expect(store.getState().booking.passengers[0]).toEqual(passenger);
    });

    it('should update passenger', () => {
      const passenger = createMockPassenger();
      store.dispatch(addPassenger(passenger));
      store.dispatch(updatePassenger({
        index: 0,
        passenger: { ...passenger, first_name: 'Jane' },
      }));

      expect(store.getState().booking.passengers[0].first_name).toBe('Jane');
    });

    it('should remove passenger', () => {
      store.dispatch(addPassenger(createMockPassenger({ id: '1' })));
      store.dispatch(addPassenger(createMockPassenger({ id: '2' })));
      store.dispatch(removePassenger(0));

      const passengers = store.getState().booking.passengers;
      expect(passengers).toHaveLength(1);
      expect(passengers[0].id).toBe('2');
    });

    it('should set all passengers', () => {
      const passengers = [
        createMockPassenger({ id: '1' }),
        createMockPassenger({ id: '2' }),
      ];
      store.dispatch(setPassengers(passengers));
      expect(store.getState().booking.passengers).toEqual(passengers);
    });
  });

  describe('vehicle actions', () => {
    it('should add vehicle', () => {
      const vehicle = createMockVehicle();
      store.dispatch(addVehicle(vehicle));
      expect(store.getState().booking.vehicles).toHaveLength(1);
    });

    it('should update vehicle', () => {
      const vehicle = createMockVehicle();
      store.dispatch(addVehicle(vehicle));
      store.dispatch(updateVehicle({
        index: 0,
        vehicle: { ...vehicle, license_plate: 'XYZ789' },
      }));

      expect(store.getState().booking.vehicles[0].license_plate).toBe('XYZ789');
    });

    it('should remove vehicle', () => {
      store.dispatch(addVehicle(createMockVehicle({ id: '1' })));
      store.dispatch(addVehicle(createMockVehicle({ id: '2' })));
      store.dispatch(removeVehicle(0));

      expect(store.getState().booking.vehicles).toHaveLength(1);
    });

    it('should set all vehicles', () => {
      const vehicles = [createMockVehicle(), createMockVehicle()];
      store.dispatch(setVehicles(vehicles));
      expect(store.getState().booking.vehicles).toEqual(vehicles);
    });
  });

  describe('cabin actions', () => {
    it('should set selected cabin', () => {
      const cabin = createMockCabin();
      store.dispatch(setSelectedCabin({ cabin, quantity: 2 }));

      const state = store.getState().booking;
      expect(state.selectedCabin).toEqual(cabin);
      expect(state.cabinQuantity).toBe(2);
    });

    it('should set return cabin', () => {
      const cabin = createMockCabin();
      store.dispatch(setReturnCabin({ cabin, quantity: 1 }));

      const state = store.getState().booking;
      expect(state.returnCabin).toEqual(cabin);
      expect(state.returnCabinQuantity).toBe(1);
    });

    it('should clear cabin', () => {
      store.dispatch(setSelectedCabin({ cabin: createMockCabin(), quantity: 1 }));
      store.dispatch(setSelectedCabin({ cabin: null, quantity: 0 }));

      const state = store.getState().booking;
      expect(state.selectedCabin).toBeNull();
      expect(state.cabinQuantity).toBe(0);
    });
  });

  describe('meal actions', () => {
    it('should add meal', () => {
      const meal = createMockMeal();
      store.dispatch(addMeal({ meal, quantity: 2, journey: 'outbound' }));

      const state = store.getState().booking;
      expect(state.selectedMeals).toHaveLength(1);
      expect(state.selectedMeals[0].quantity).toBe(2);
    });

    it('should add to existing meal quantity', () => {
      const meal = createMockMeal();
      store.dispatch(addMeal({ meal, quantity: 2, journey: 'outbound' }));
      store.dispatch(addMeal({ meal, quantity: 1, journey: 'outbound' }));

      const state = store.getState().booking;
      expect(state.selectedMeals).toHaveLength(1);
      expect(state.selectedMeals[0].quantity).toBe(3);
    });

    it('should update meal quantity', () => {
      const meal = createMockMeal();
      store.dispatch(addMeal({ meal, quantity: 2, journey: 'outbound' }));
      // Note: meal.id is a number, and the slice compares with === so we need to match the type
      store.dispatch(updateMealQuantity({ mealId: meal.id as unknown as string, journey: 'outbound', quantity: 5 }));

      expect(store.getState().booking.selectedMeals[0].quantity).toBe(5);
    });

    it('should remove meal when quantity is 0', () => {
      const meal = createMockMeal();
      store.dispatch(addMeal({ meal, quantity: 2, journey: 'outbound' }));
      // meal.id must match the type stored in state (number)
      store.dispatch(updateMealQuantity({ mealId: meal.id as unknown as string, journey: 'outbound', quantity: 0 }));

      expect(store.getState().booking.selectedMeals).toHaveLength(0);
    });

    it('should remove meal explicitly', () => {
      const meal = createMockMeal();
      store.dispatch(addMeal({ meal, quantity: 2, journey: 'outbound' }));
      // meal.id must match the type stored in state (number)
      store.dispatch(removeMeal({ mealId: meal.id as unknown as string, journey: 'outbound' }));

      expect(store.getState().booking.selectedMeals).toHaveLength(0);
    });
  });

  describe('options actions', () => {
    it('should set cancellation protection', () => {
      store.dispatch(setCancellationProtection(true));
      expect(store.getState().booking.hasCancellationProtection).toBe(true);
    });

    it('should set promo code', () => {
      store.dispatch(setPromoCode('SAVE20'));
      expect(store.getState().booking.promoCode).toBe('SAVE20');
    });

    it('should set promo discount', () => {
      store.dispatch(setPromoDiscount(50));
      expect(store.getState().booking.promoDiscount).toBe(50);
    });

    it('should set special requests', () => {
      store.dispatch(setSpecialRequests('Wheelchair assistance needed'));
      expect(store.getState().booking.specialRequests).toBe('Wheelchair assistance needed');
    });
  });

  describe('booking state actions', () => {
    it('should set current booking', () => {
      const booking = createMockBooking();
      store.dispatch(setCurrentBooking(booking));
      expect(store.getState().booking.currentBooking).toEqual(booking);
    });

    it('should clear booking error', () => {
      store = configureStore({
        reducer: { booking: bookingReducer },
        preloadedState: {
          booking: {
            ...store.getState().booking,
            bookingError: 'Some error',
          },
        },
      });

      store.dispatch(clearBookingError());
      expect(store.getState().booking.bookingError).toBeNull();
    });

    it('should reset booking to initial state', () => {
      store.dispatch(setSelectedSchedule(createMockFerrySchedule()));
      store.dispatch(addPassenger(createMockPassenger()));
      store.dispatch(setCancellationProtection(true));
      store.dispatch(resetBooking());

      const state = store.getState().booking;
      expect(state.selectedSchedule).toBeNull();
      expect(state.passengers).toEqual([]);
      expect(state.hasCancellationProtection).toBe(false);
    });
  });

  describe('createBooking thunk', () => {
    it('should handle successful booking creation', async () => {
      const mockBooking = createMockBooking();
      mockedBookingService.createBooking.mockResolvedValueOnce(mockBooking);

      // Set up state with required data
      store.dispatch(setSelectedSchedule(createMockFerrySchedule()));
      store.dispatch(setContactInfo({
        email: 'test@example.com',
        phone: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
      }));
      store.dispatch(addPassenger(createMockPassenger()));

      await store.dispatch(createBooking({ adults: 1 }));

      const state = store.getState().booking;
      expect(state.currentBooking).toEqual(mockBooking);
      expect(state.isCreatingBooking).toBe(false);
      expect(state.bookingError).toBeNull();
    });

    it('should handle booking creation failure', async () => {
      const errorMessage = 'Booking failed';
      mockedBookingService.createBooking.mockRejectedValueOnce(new Error(errorMessage));

      // Must set up valid state to pass validation before service is called
      store.dispatch(setSelectedSchedule(createMockFerrySchedule()));
      store.dispatch(setContactInfo({
        email: 'test@example.com',
        phone: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
      }));
      store.dispatch(addPassenger(createMockPassenger()));

      await store.dispatch(createBooking({ adults: 1 }));

      const state = store.getState().booking;
      expect(state.bookingError).toBe(errorMessage);
      expect(state.isCreatingBooking).toBe(false);
    });

    it('should set loading state during booking creation', async () => {
      mockedBookingService.createBooking.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockBooking()), 100))
      );

      // Set up valid state for booking creation
      store.dispatch(setSelectedSchedule(createMockFerrySchedule()));
      store.dispatch(setContactInfo({
        email: 'test@example.com',
        phone: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
      }));
      store.dispatch(addPassenger(createMockPassenger()));

      const promise = store.dispatch(createBooking({ adults: 1 }));

      expect(store.getState().booking.isCreatingBooking).toBe(true);

      await promise;
      expect(store.getState().booking.isCreatingBooking).toBe(false);
    });
  });

  describe('fetchUserBookings thunk', () => {
    it('should fetch user bookings successfully', async () => {
      const mockBookings = [createMockBooking(), createMockBooking({ id: 2 })];
      mockedBookingService.listBookings.mockResolvedValueOnce({
        bookings: mockBookings,
        total: 2,
        page: 1,
        limit: 10,
      });

      await store.dispatch(fetchUserBookings());

      const state = store.getState().booking;
      expect(state.userBookings).toEqual(mockBookings);
      expect(state.isLoadingBookings).toBe(false);
    });

    it('should handle fetch error', async () => {
      const errorMessage = 'Failed to fetch bookings';
      mockedBookingService.listBookings.mockRejectedValueOnce(new Error(errorMessage));

      await store.dispatch(fetchUserBookings());

      const state = store.getState().booking;
      expect(state.bookingsError).toBe(errorMessage);
      expect(state.isLoadingBookings).toBe(false);
    });
  });

  describe('cancelBooking thunk', () => {
    it('should cancel booking successfully', async () => {
      const originalBooking = createMockBooking({ status: 'confirmed' });
      const cancelledBooking = { ...originalBooking, status: 'cancelled' as const };

      store = configureStore({
        reducer: { booking: bookingReducer },
        preloadedState: {
          booking: {
            ...store.getState().booking,
            userBookings: [originalBooking],
            currentBooking: originalBooking,
          },
        },
      });

      mockedBookingService.cancelBooking.mockResolvedValueOnce(cancelledBooking);

      await store.dispatch(cancelBooking({ bookingId: originalBooking.id, reason: 'Changed plans' }));

      const state = store.getState().booking;
      expect(state.userBookings[0].status).toBe('cancelled');
      expect(state.currentBooking?.status).toBe('cancelled');
    });
  });

  describe('selectBookingTotal selector', () => {
    it('should calculate total correctly', () => {
      const schedule = createMockFerrySchedule({ base_price: 100 });
      const cabin = createMockCabin({ price: 80 });
      const meal = createMockMeal({ price: 15 });

      store.dispatch(setSelectedSchedule(schedule));
      store.dispatch(addPassenger(createMockPassenger()));
      store.dispatch(addPassenger(createMockPassenger({ id: '2' })));
      store.dispatch(setSelectedCabin({ cabin, quantity: 1 }));
      store.dispatch(addMeal({ meal, quantity: 2, journey: 'outbound' }));
      store.dispatch(setCancellationProtection(true));

      const total = selectBookingTotal(store.getState());

      // 2 passengers * 100 = 200
      // 1 cabin * 80 = 80
      // 2 meals * 15 = 30
      // Cancellation protection = 15
      // Total = 325
      expect(total).toBe(325);
    });

    it('should apply promo discount', () => {
      const schedule = createMockFerrySchedule({ base_price: 100 });
      store.dispatch(setSelectedSchedule(schedule));
      store.dispatch(addPassenger(createMockPassenger()));
      store.dispatch(setPromoDiscount(20));

      const total = selectBookingTotal(store.getState());
      expect(total).toBe(80); // 100 - 20
    });

    it('should not return negative total', () => {
      const schedule = createMockFerrySchedule({ base_price: 10 });
      store.dispatch(setSelectedSchedule(schedule));
      store.dispatch(addPassenger(createMockPassenger()));
      store.dispatch(setPromoDiscount(100));

      const total = selectBookingTotal(store.getState());
      expect(total).toBe(0);
    });
  });
});
