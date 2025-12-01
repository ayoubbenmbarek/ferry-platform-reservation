import React, { PropsWithChildren } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { configureStore, combineReducers, PreloadedState } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import authReducer from '../store/slices/authSlice';
import searchReducer from '../store/slices/searchSlice';
import bookingReducer from '../store/slices/bookingSlice';

// Create root reducer
const rootReducer = combineReducers({
  auth: authReducer,
  search: searchReducer,
  booking: bookingReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof setupStore>;

// Setup store function for tests
export function setupStore(preloadedState?: PreloadedState<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  });
}

interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: PreloadedState<RootState>;
  store?: AppStore;
}

// Custom render function with Redux provider
export function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = setupStore(preloadedState),
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: PropsWithChildren<{}>): React.ReactElement {
    return <Provider store={store}>{children}</Provider>;
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// ============================================
// Mock Data Factories
// ============================================

export const createMockUser = (overrides = {}) => ({
  id: 1,
  email: 'test@example.com',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890',
  is_active: true,
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockPassenger = (overrides = {}) => ({
  id: '1',
  passenger_type: 'adult' as const,
  first_name: 'John',
  last_name: 'Doe',
  date_of_birth: '1990-01-01',
  nationality: 'US',
  passport_number: 'ABC123456',
  document_expiry: '2030-01-01',
  has_pet: false,
  ...overrides,
});

export const createMockVehicle = (overrides = {}) => ({
  id: '1',
  vehicle_type: 'car' as const,
  license_plate: 'ABC123',
  make: 'Toyota',
  model: 'Camry',
  ...overrides,
});

export const createMockFerrySchedule = (overrides = {}) => ({
  sailing_id: 'sail-123',
  operator: 'CTN',
  departure_port: 'Tunis',
  arrival_port: 'Marseille',
  departure_time: '2024-06-15T08:00:00Z',
  arrival_time: '2024-06-15T20:00:00Z',
  duration_minutes: 720,
  vessel_name: 'Carthage',
  base_price: 100,
  available_seats: 200,
  amenities: ['wifi', 'restaurant', 'cabin'],
  ...overrides,
});

export const createMockCabin = (overrides = {}) => ({
  id: 1,
  name: 'Standard Cabin',
  description: 'Comfortable cabin with 2 beds',
  capacity: 2,
  price: 80,
  amenities: ['bed', 'bathroom'],
  availability: 10,
  ...overrides,
});

export const createMockMeal = (overrides = {}) => ({
  id: 1,
  name: 'Breakfast',
  description: 'Continental breakfast',
  price: 15,
  type: 'breakfast',
  ...overrides,
});

export const createMockBooking = (overrides = {}) => ({
  id: 1,
  booking_reference: 'BK123456',
  status: 'confirmed' as const,
  sailing_id: 'sail-123',
  operator: 'CTN',
  departure_port: 'Tunis',
  arrival_port: 'Marseille',
  departure_time: '2024-06-15T08:00:00Z',
  arrival_time: '2024-06-15T20:00:00Z',
  vessel_name: 'Carthage',
  contact_email: 'test@example.com',
  contact_phone: '+1234567890',
  contact_first_name: 'John',
  contact_last_name: 'Doe',
  total_adults: 2,
  total_children: 1,
  total_infants: 0,
  total_vehicles: 1,
  subtotal: 350,
  tax_amount: 35,
  total_amount: 385,
  has_cancellation_protection: true,
  passengers: [createMockPassenger()],
  vehicles: [createMockVehicle()],
  created_at: '2024-06-01T10:00:00Z',
  expires_at: '2024-06-01T10:30:00Z',
  ...overrides,
});

export const createMockPort = (overrides = {}) => ({
  id: 1,
  code: 'TUN',
  name: 'Tunis',
  city: 'Tunis',
  country: 'Tunisia',
  ...overrides,
});

export const createMockRoute = (overrides = {}) => ({
  id: 1,
  departure_port: 'Tunis',
  arrival_port: 'Marseille',
  operators: ['CTN', 'Corsica Linea'],
  ...overrides,
});

export const createMockPaymentIntent = (overrides = {}) => ({
  payment_intent_id: 'pi_test_123456',
  client_secret: 'pi_test_123456_secret_abc',
  amount: 385,
  currency: 'EUR',
  ...overrides,
});

// ============================================
// API Mock Helpers
// ============================================

export const mockApiSuccess = <T>(data: T) => {
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

// ============================================
// Wait Utilities
// ============================================

export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

// ============================================
// Re-export everything from testing library
// ============================================

export * from '@testing-library/react-native';
