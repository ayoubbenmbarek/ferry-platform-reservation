// Booking Redux slice
export interface BookingState {
  currentBooking: any | null;
  bookings: any[];
  isLoading: boolean;
  error: string | null;
}

const initialState: BookingState = {
  currentBooking: null,
  bookings: [],
  isLoading: false,
  error: null,
};

// Simple reducer for now
const bookingSlice = {
  name: 'booking',
  initialState,
  reducers: {
    setCurrentBooking: (state: BookingState, action: any) => {
      state.currentBooking = action.payload;
    },
    setBookings: (state: BookingState, action: any) => {
      state.bookings = action.payload;
    },
    setLoading: (state: BookingState, action: any) => {
      state.isLoading = action.payload;
    },
    setError: (state: BookingState, action: any) => {
      state.error = action.payload;
    },
    clearError: (state: BookingState) => {
      state.error = null;
    },
  },
};

export const { setCurrentBooking, setBookings, setLoading, setError, clearError } = bookingSlice.reducers || {};
export default (state = initialState, action: any) => {
  switch (action.type) {
    case 'booking/setCurrentBooking':
      return { ...state, currentBooking: action.payload };
    case 'booking/setBookings':
      return { ...state, bookings: action.payload };
    case 'booking/setLoading':
      return { ...state, isLoading: action.payload };
    case 'booking/setError':
      return { ...state, error: action.payload };
    case 'booking/clearError':
      return { ...state, error: null };
    default:
      return state;
  }
}; 