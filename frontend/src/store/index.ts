import { configureStore } from '@reduxjs/toolkit';
import authSlice from './slices/authSlice';
import bookingSlice from './slices/bookingSlice';
import searchSlice from './slices/searchSlice';
import uiSlice from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    booking: bookingSlice,
    search: searchSlice,
    ui: uiSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 