import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { combineReducers } from 'redux';

import authSlice from './slices/authSlice';
import bookingSlice from './slices/bookingSlice';
import searchSlice from './slices/searchSlice';
import uiSlice from './slices/uiSlice';
import ferrySlice from './slices/ferrySlice';

// Persist configuration
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['ferry', 'auth'], // Only persist ferry and auth state
};

// Combine reducers
const rootReducer = combineReducers({
  auth: authSlice,
  booking: bookingSlice,
  search: searchSlice,
  ui: uiSlice,
  ferry: ferrySlice,
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 