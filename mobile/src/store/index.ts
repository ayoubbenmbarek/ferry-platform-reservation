import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import searchReducer from './slices/searchSlice';
import bookingReducer from './slices/bookingSlice';
import alertReducer from './slices/alertSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    search: searchReducer,
    booking: bookingReducer,
    alerts: alertReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['booking/setSelectedSchedule'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
