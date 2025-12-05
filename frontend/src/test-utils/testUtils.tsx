/**
 * Test utilities for React Testing Library with Redux and Router support.
 */

import React, { PropsWithChildren } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { combineReducers, configureStore } from '@reduxjs/toolkit';

// Import your actual reducers
import authSlice from '../store/slices/authSlice';
import bookingSlice from '../store/slices/bookingSlice';
import searchSlice from '../store/slices/searchSlice';
import ferrySlice from '../store/slices/ferrySlice';
import uiSlice from '../store/slices/uiSlice';

// Define the root reducer
const rootReducer = combineReducers({
  auth: authSlice,
  booking: bookingSlice,
  search: searchSlice,
  ferry: ferrySlice,
  ui: uiSlice,
});

// Define RootState type from the root reducer
export type RootState = ReturnType<typeof rootReducer>;

// Create a test store factory
export function setupStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
  });
}

// Define AppStore type
export type AppStore = ReturnType<typeof setupStore>;

// Interface for custom render options
interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: Partial<RootState>;
  store?: AppStore;
}

/**
 * Custom render function that wraps components with providers.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = setupStore(preloadedState),
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: PropsWithChildren<{}>): JSX.Element {
    return (
      <Provider store={store}>
        <BrowserRouter>{children}</BrowserRouter>
      </Provider>
    );
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

/**
 * Render with just Router (no Redux)
 */
export function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Sample test data factories
export const createMockUser = (overrides = {}) => ({
  id: 1,
  email: 'test@example.com',
  first_name: 'John',
  last_name: 'Doe',
  is_active: true,
  is_verified: true,
  ...overrides,
});

export const createMockBooking = (overrides = {}) => ({
  id: 1,
  bookingReference: 'MR-TEST001',
  operator: 'CTN',
  departurePort: 'Tunis',
  arrivalPort: 'Marseille',
  departureTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  vesselName: 'Carthage',
  totalPassengers: 2,
  totalVehicles: 0,
  subtotal: 300,
  taxAmount: 30,
  totalAmount: 330,
  currency: 'EUR',
  status: 'PENDING',
  contactEmail: 'customer@example.com',
  contactFirstName: 'Marie',
  contactLastName: 'Dupont',
  ...overrides,
});

export const createMockPassenger = (overrides = {}) => ({
  id: 1,
  passengerType: 'ADULT',
  firstName: 'Marie',
  lastName: 'Dupont',
  dateOfBirth: '1985-05-15',
  nationality: 'FR',
  basePrice: 150,
  finalPrice: 150,
  ...overrides,
});

export const createMockVehicle = (overrides = {}) => ({
  id: 1,
  vehicleType: 'CAR',
  make: 'Peugeot',
  model: '308',
  licensePlate: 'AB-123-CD',
  lengthCm: 430,
  widthCm: 180,
  heightCm: 145,
  basePrice: 200,
  finalPrice: 200,
  ...overrides,
});

export const createMockFerry = (overrides = {}) => ({
  sailingId: 'CTN-2024-001',
  operator: 'CTN',
  departurePort: 'Tunis',
  arrivalPort: 'Marseille',
  departureTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  arrivalTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000).toISOString(),
  vesselName: 'Carthage',
  adultPrice: 150,
  childPrice: 75,
  infantPrice: 0,
  vehiclePrice: 200,
  availableSeats: 100,
  ...overrides,
});

export const createMockCabin = (overrides = {}) => ({
  id: 1,
  name: 'Inside Twin',
  cabinType: 'INSIDE',
  bedType: 'TWIN',
  maxOccupancy: 2,
  basePrice: 50,
  hasWindow: false,
  hasPrivateBathroom: true,
  hasAirConditioning: true,
  isAvailable: true,
  ...overrides,
});

// Mock API responses
export const mockApiSuccess = (data: any) => {
  return Promise.resolve({ data });
};

export const mockApiError = (status: number, message: string) => {
  return Promise.reject({
    response: {
      status,
      data: { detail: message },
    },
  });
};
