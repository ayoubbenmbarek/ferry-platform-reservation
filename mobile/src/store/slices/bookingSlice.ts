import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { bookingService } from '../../services/bookingService';
import { Booking, Passenger, Vehicle, Cabin, Meal, FerrySchedule, VehicleType } from '../../types';
import { CANCELLATION_PROTECTION_PRICE } from '../../constants/config';

interface ContactInfo {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
}

interface BookingState {
  // Current booking flow
  selectedSchedule: FerrySchedule | null;
  returnSchedule: FerrySchedule | null;

  // Contact info
  contactInfo: ContactInfo;

  // Passengers
  passengers: Passenger[];

  // Vehicles
  vehicles: Vehicle[];

  // Cabin selections
  selectedCabin: Cabin | null;
  cabinQuantity: number;
  returnCabin: Cabin | null;
  returnCabinQuantity: number;

  // Meal selections
  selectedMeals: { meal: Meal; quantity: number; journey: 'outbound' | 'return' }[];

  // Options
  hasCancellationProtection: boolean;
  promoCode: string;
  promoDiscount: number;
  specialRequests: string;

  // Created booking
  currentBooking: Booking | null;
  isCreatingBooking: boolean;
  bookingError: string | null;

  // User bookings list
  userBookings: Booking[];
  isLoadingBookings: boolean;
  bookingsError: string | null;
}

const initialState: BookingState = {
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
};

// Price multipliers (same as BookingScreen and PaymentScreen)
const CHILD_PRICE_MULTIPLIER = 0.5;
const INFANT_PRICE_MULTIPLIER = 0;
const VEHICLE_PRICE = 50;
const TAX_RATE = 0.10;

// Payload type for createBooking
interface CreateBookingPayload {
  cabinSelections?: { cabinId: string; quantity: number; price: number }[];
  returnCabinSelections?: { cabinId: string; quantity: number; price: number }[];
  mealSelections?: { mealId: string; quantity: number; price: number }[];
  returnMealSelections?: { mealId: string; quantity: number; price: number }[];
  // Passenger counts
  adults?: number;
  children?: number;
  infants?: number;
  vehicleCount?: number;
  // Vehicle details with type and license plate
  vehicleDetails?: Vehicle[];
}

// Create booking
export const createBooking = createAsyncThunk(
  'booking/create',
  async (payload: CreateBookingPayload | undefined, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { booking: BookingState };
      const {
        selectedSchedule,
        returnSchedule,
        contactInfo,
        passengers,
        vehicles,
        selectedCabin,
        returnCabin,
        selectedMeals,
        hasCancellationProtection,
        promoCode,
        specialRequests,
      } = state.booking;

      // Use payload cabin/meal selections if provided
      const { cabinSelections, returnCabinSelections, mealSelections, returnMealSelections, adults = 1, children = 0, infants = 0, vehicleCount = 0, vehicleDetails } = payload || {};

      // Calculate prices
      const calculateJourneyFare = (basePrice: number) => {
        const adultTotal = (basePrice ?? 0) * adults;
        const childTotal = (basePrice ?? 0) * CHILD_PRICE_MULTIPLIER * children;
        const infantTotal = (basePrice ?? 0) * INFANT_PRICE_MULTIPLIER * infants;
        return adultTotal + childTotal + infantTotal;
      };

      const outboundFare = selectedSchedule ? calculateJourneyFare(selectedSchedule.base_price ?? 0) : 0;
      const returnFare = returnSchedule ? calculateJourneyFare(returnSchedule.base_price ?? 0) : 0;
      const outboundVehicleCost = vehicleCount * VEHICLE_PRICE;
      const returnVehicleCost = returnSchedule ? vehicleCount * VEHICLE_PRICE : 0;

      const cabinTotal = (cabinSelections || []).reduce((sum, c) => sum + (c.price * c.quantity), 0)
        + (returnCabinSelections || []).reduce((sum, c) => sum + (c.price * c.quantity), 0);

      const mealTotal = (mealSelections || []).reduce((sum, m) => sum + (m.price * m.quantity), 0)
        + (returnMealSelections || []).reduce((sum, m) => sum + (m.price * m.quantity), 0);

      const cancellationCost = hasCancellationProtection ? CANCELLATION_PROTECTION_PRICE : 0;
      const subtotal = outboundFare + returnFare + outboundVehicleCost + returnVehicleCost + cabinTotal + mealTotal + cancellationCost;
      const taxAmount = subtotal * TAX_RATE;
      const totalAmount = subtotal + taxAmount;

      console.log('[CreateBooking] Price calculation:', {
        outboundFare,
        returnFare,
        outboundVehicleCost,
        returnVehicleCost,
        cabinTotal,
        mealTotal,
        cancellationCost,
        subtotal,
        taxAmount,
        totalAmount,
      });

      console.log('[CreateBooking] Selected schedule:', JSON.stringify(selectedSchedule, null, 2));
      console.log('[CreateBooking] Passengers:', JSON.stringify(passengers, null, 2));
      console.log('[CreateBooking] Contact:', JSON.stringify(contactInfo, null, 2));

      if (!selectedSchedule) {
        throw new Error('No schedule selected');
      }

      if (!passengers || passengers.length === 0) {
        throw new Error('At least one passenger is required');
      }

      if (!contactInfo.email || !contactInfo.firstName || !contactInfo.lastName) {
        throw new Error('Contact information is incomplete');
      }

      // Send ferry_prices in the format backend expects
      const ferryPrices = {
        adult: selectedSchedule.base_price ?? 0,
        child: (selectedSchedule.base_price ?? 0) * CHILD_PRICE_MULTIPLIER,
        infant: 0,
        vehicle: VEHICLE_PRICE,
      };

      const returnFerryPrices = returnSchedule ? {
        adult: returnSchedule.base_price ?? 0,
        child: (returnSchedule.base_price ?? 0) * CHILD_PRICE_MULTIPLIER,
        infant: 0,
        vehicle: VEHICLE_PRICE,
      } : undefined;

      const bookingData = {
        sailing_id: selectedSchedule.sailing_id || selectedSchedule.id,
        operator: selectedSchedule.operator,
        departure_port: selectedSchedule.departure_port,
        arrival_port: selectedSchedule.arrival_port,
        departure_time: selectedSchedule.departure_time,
        arrival_time: selectedSchedule.arrival_time,
        vessel_name: selectedSchedule.vessel_name,
        is_round_trip: !!returnSchedule,
        return_sailing_id: returnSchedule?.sailing_id || returnSchedule?.id,
        return_operator: returnSchedule?.operator,
        return_departure_port: returnSchedule?.departure_port,
        return_arrival_port: returnSchedule?.arrival_port,
        return_departure_time: returnSchedule?.departure_time,
        return_arrival_time: returnSchedule?.arrival_time,
        return_vessel_name: returnSchedule?.vessel_name,
        // Ferry prices for backend calculation (same format as frontend web)
        ferry_prices: ferryPrices,
        return_ferry_prices: returnFerryPrices,
        // Backend expects contact_info as nested object
        contact_info: {
          email: contactInfo.email,
          phone: contactInfo.phone || '',
          first_name: contactInfo.firstName,
          last_name: contactInfo.lastName,
        },
        // Transform passengers to match backend schema (type instead of passenger_type)
        passengers: passengers.map(p => ({
          type: p.passenger_type,
          first_name: p.first_name,
          last_name: p.last_name,
          date_of_birth: p.date_of_birth,
          nationality: p.nationality || 'FR',
          passport_number: p.passport_number,
          document_expiry: p.passport_expiry,
          has_pet: p.has_pet || false,
          pet_type: p.pet_type,
        })),
        // Use vehicle details from payload (with license plates, make, model) or fall back to Redux state
        // Backend expects: type (not vehicle_type), registration (not license_plate)
        vehicles: vehicleDetails && vehicleDetails.length > 0
          ? vehicleDetails.map(v => ({
              type: v.vehicle_type,  // Backend now supports all our vehicle types
              registration: v.license_plate,
              make: v.make || undefined,
              model: v.model || undefined,
            }))
          : vehicles.length > 0
            ? vehicles.map(v => ({
                type: v.vehicle_type,
                registration: v.license_plate,
                make: v.make || undefined,
                model: v.model || undefined,
              }))
            : undefined,
        // Legacy single cabin support
        cabin_id: selectedCabin?.id,
        return_cabin_id: returnCabin?.id,
        // Multi-cabin selections from payload
        cabin_selections: cabinSelections?.filter(c => c.quantity > 0).map(c => ({
          cabin_id: Number(c.cabinId),
          quantity: c.quantity,
          price: c.price * c.quantity,
        })),
        return_cabin_selections: returnCabinSelections?.filter(c => c.quantity > 0).map(c => ({
          cabin_id: Number(c.cabinId),
          quantity: c.quantity,
          price: c.price * c.quantity,
        })),
        total_cabin_price: cabinSelections?.reduce((sum, c) => sum + (c.price * c.quantity), 0) || 0,
        total_return_cabin_price: returnCabinSelections?.reduce((sum, c) => sum + (c.price * c.quantity), 0) || 0,
        // Meal selections from payload or Redux state
        meals: (() => {
          const outboundMeals = mealSelections?.filter(m => m.quantity > 0).map(m => ({
            meal_id: String(m.mealId),
            quantity: m.quantity,
            journey: 'outbound' as const,
          })) || [];
          const returnMeals = returnMealSelections?.filter(m => m.quantity > 0).map(m => ({
            meal_id: String(m.mealId),
            quantity: m.quantity,
            journey: 'return' as const,
          })) || [];
          const allMeals = [...outboundMeals, ...returnMeals];
          if (allMeals.length > 0) return allMeals;
          if (selectedMeals.length > 0) {
            return selectedMeals.map(m => ({
              meal_id: String(m.meal.id),
              quantity: m.quantity,
              journey: m.journey,
            }));
          }
          return undefined;
        })(),
        promo_code: promoCode || undefined,
        has_cancellation_protection: hasCancellationProtection,
        special_requests: specialRequests || undefined,
        // Passenger counts
        total_adults: adults,
        total_children: children,
        total_infants: infants,
        total_vehicles: vehicleCount,
        // Price breakdown (calculated on frontend)
        outbound_fare: outboundFare,
        return_fare: returnFare,
        vehicle_cost: outboundVehicleCost + returnVehicleCost,
        cabin_cost: cabinTotal,
        meal_cost: mealTotal,
        cancellation_protection_cost: cancellationCost,
        // Totals
        subtotal: subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      };

      console.log('[CreateBooking] Booking data:', JSON.stringify(bookingData, null, 2));

      const booking = await bookingService.createBooking(bookingData);
      return booking;
    } catch (error: any) {
      console.error('[CreateBooking] Error:', error.message);
      return rejectWithValue(error.message);
    }
  }
);

// Fetch user bookings
export const fetchUserBookings = createAsyncThunk(
  'booking/fetchUserBookings',
  async (_, { rejectWithValue }) => {
    try {
      const response = await bookingService.listBookings();
      return response.bookings;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Cancel booking
export const cancelBooking = createAsyncThunk(
  'booking/cancel',
  async ({ bookingId, reason }: { bookingId: number; reason?: string }, { rejectWithValue }) => {
    try {
      const booking = await bookingService.cancelBooking(bookingId, { reason });
      return booking;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Get booking details
export const fetchBookingDetails = createAsyncThunk(
  'booking/fetchDetails',
  async (bookingId: number, { rejectWithValue }) => {
    try {
      const booking = await bookingService.getBooking(bookingId);
      return booking;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    setSelectedSchedule: (state, action: PayloadAction<FerrySchedule>) => {
      state.selectedSchedule = action.payload;
    },
    setReturnSchedule: (state, action: PayloadAction<FerrySchedule | null>) => {
      state.returnSchedule = action.payload;
    },
    setContactInfo: (state, action: PayloadAction<Partial<ContactInfo>>) => {
      state.contactInfo = { ...state.contactInfo, ...action.payload };
    },
    addPassenger: (state, action: PayloadAction<Passenger>) => {
      state.passengers.push(action.payload);
    },
    updatePassenger: (state, action: PayloadAction<{ index: number; passenger: Passenger }>) => {
      state.passengers[action.payload.index] = action.payload.passenger;
    },
    removePassenger: (state, action: PayloadAction<number>) => {
      state.passengers.splice(action.payload, 1);
    },
    setPassengers: (state, action: PayloadAction<Passenger[]>) => {
      state.passengers = action.payload;
    },
    addVehicle: (state, action: PayloadAction<Vehicle>) => {
      state.vehicles.push(action.payload);
    },
    updateVehicle: (state, action: PayloadAction<{ index: number; vehicle: Vehicle }>) => {
      state.vehicles[action.payload.index] = action.payload.vehicle;
    },
    removeVehicle: (state, action: PayloadAction<number>) => {
      state.vehicles.splice(action.payload, 1);
    },
    setVehicles: (state, action: PayloadAction<Vehicle[]>) => {
      state.vehicles = action.payload;
    },
    setSelectedCabin: (state, action: PayloadAction<{ cabin: Cabin | null; quantity: number }>) => {
      state.selectedCabin = action.payload.cabin;
      state.cabinQuantity = action.payload.quantity;
    },
    setReturnCabin: (state, action: PayloadAction<{ cabin: Cabin | null; quantity: number }>) => {
      state.returnCabin = action.payload.cabin;
      state.returnCabinQuantity = action.payload.quantity;
    },
    addMeal: (state, action: PayloadAction<{ meal: Meal; quantity: number; journey: 'outbound' | 'return' }>) => {
      const existingIndex = state.selectedMeals.findIndex(
        m => m.meal.id === action.payload.meal.id && m.journey === action.payload.journey
      );
      if (existingIndex >= 0) {
        state.selectedMeals[existingIndex].quantity += action.payload.quantity;
      } else {
        state.selectedMeals.push(action.payload);
      }
    },
    updateMealQuantity: (state, action: PayloadAction<{ mealId: string; journey: 'outbound' | 'return'; quantity: number }>) => {
      const index = state.selectedMeals.findIndex(
        m => m.meal.id === action.payload.mealId && m.journey === action.payload.journey
      );
      if (index >= 0) {
        if (action.payload.quantity <= 0) {
          state.selectedMeals.splice(index, 1);
        } else {
          state.selectedMeals[index].quantity = action.payload.quantity;
        }
      }
    },
    removeMeal: (state, action: PayloadAction<{ mealId: string; journey: 'outbound' | 'return' }>) => {
      state.selectedMeals = state.selectedMeals.filter(
        m => !(m.meal.id === action.payload.mealId && m.journey === action.payload.journey)
      );
    },
    setCancellationProtection: (state, action: PayloadAction<boolean>) => {
      state.hasCancellationProtection = action.payload;
    },
    setPromoCode: (state, action: PayloadAction<string>) => {
      state.promoCode = action.payload;
    },
    setPromoDiscount: (state, action: PayloadAction<number>) => {
      state.promoDiscount = action.payload;
    },
    setSpecialRequests: (state, action: PayloadAction<string>) => {
      state.specialRequests = action.payload;
    },
    setCurrentBooking: (state, action: PayloadAction<Booking>) => {
      state.currentBooking = action.payload;
    },
    clearBookingError: (state) => {
      state.bookingError = null;
    },
    resetBooking: () => initialState,
  },
  extraReducers: (builder) => {
    // Create booking
    builder
      .addCase(createBooking.pending, (state) => {
        state.isCreatingBooking = true;
        state.bookingError = null;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.isCreatingBooking = false;
        state.currentBooking = action.payload;
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.isCreatingBooking = false;
        state.bookingError = action.payload as string;
      });

    // Fetch user bookings
    builder
      .addCase(fetchUserBookings.pending, (state) => {
        state.isLoadingBookings = true;
        state.bookingsError = null;
      })
      .addCase(fetchUserBookings.fulfilled, (state, action) => {
        state.isLoadingBookings = false;
        state.userBookings = action.payload;
      })
      .addCase(fetchUserBookings.rejected, (state, action) => {
        state.isLoadingBookings = false;
        state.bookingsError = action.payload as string;
      });

    // Cancel booking
    builder
      .addCase(cancelBooking.fulfilled, (state, action) => {
        const index = state.userBookings.findIndex(b => b.id === action.payload.id);
        if (index >= 0) {
          state.userBookings[index] = action.payload;
        }
        if (state.currentBooking?.id === action.payload.id) {
          state.currentBooking = action.payload;
        }
      });

    // Fetch booking details
    builder
      .addCase(fetchBookingDetails.fulfilled, (state, action) => {
        state.currentBooking = action.payload;
      });
  },
});

// Selectors
export const selectBookingTotal = (state: { booking: BookingState }): number => {
  const { selectedSchedule, returnSchedule, passengers, vehicles, selectedCabin, cabinQuantity, returnCabin, returnCabinQuantity, selectedMeals, hasCancellationProtection, promoDiscount } = state.booking;

  let total = 0;

  // Base fare per passenger
  if (selectedSchedule) {
    total += selectedSchedule.base_price * passengers.length;
  }
  if (returnSchedule) {
    total += returnSchedule.base_price * passengers.length;
  }

  // Vehicle costs (simplified - would need actual pricing)
  total += vehicles.length * 50; // Placeholder

  // Cabin costs
  if (selectedCabin) {
    total += selectedCabin.price * cabinQuantity;
  }
  if (returnCabin) {
    total += returnCabin.price * returnCabinQuantity;
  }

  // Meal costs
  selectedMeals.forEach(m => {
    total += m.meal.price * m.quantity;
  });

  // Cancellation protection
  if (hasCancellationProtection) {
    total += CANCELLATION_PROTECTION_PRICE;
  }

  // Promo discount
  total -= promoDiscount;

  return Math.max(0, total);
};

export const {
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
} = bookingSlice.actions;

export default bookingSlice.reducer;
