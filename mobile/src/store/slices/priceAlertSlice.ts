import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  priceAlertService,
  PriceAlert,
  CreatePriceAlertRequest,
  UpdatePriceAlertRequest,
  PriceAlertStats,
  PriceAlertStatus,
  CheckRouteResponse,
} from '../../services/priceAlertService';

interface SavedRoutesCache {
  [key: string]: CheckRouteResponse; // key: "departure_arrival"
}

interface PriceAlertState {
  savedRoutes: PriceAlert[];
  total: number;
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  isCreating: boolean;
  isDeleting: boolean;
  error: string | null;
  stats: PriceAlertStats | null;
  isLoadingStats: boolean;
  // Cache for quick route status checks
  routeStatusCache: SavedRoutesCache;
  isCheckingRoute: boolean;
}

const initialState: PriceAlertState = {
  savedRoutes: [],
  total: 0,
  page: 1,
  hasMore: false,
  isLoading: false,
  isCreating: false,
  isDeleting: false,
  error: null,
  stats: null,
  isLoadingStats: false,
  routeStatusCache: {},
  isCheckingRoute: false,
};

// Helper to create route cache key
const getRouteCacheKey = (departure: string, arrival: string): string =>
  `${departure.toLowerCase()}_${arrival.toLowerCase()}`;

// Async thunks
export const fetchSavedRoutes = createAsyncThunk(
  'priceAlerts/fetchSavedRoutes',
  async (
    params: { status?: PriceAlertStatus; page?: number; per_page?: number } | undefined,
    { rejectWithValue }
  ) => {
    try {
      const response = await priceAlertService.getMyRoutes(params);
      return response;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || error.message || 'Failed to fetch saved routes'
      );
    }
  }
);

export const loadMoreSavedRoutes = createAsyncThunk(
  'priceAlerts/loadMoreSavedRoutes',
  async (
    { status, per_page = 20 }: { status?: PriceAlertStatus; per_page?: number },
    { getState, rejectWithValue }
  ) => {
    try {
      const state = getState() as { priceAlerts: PriceAlertState };
      const nextPage = state.priceAlerts.page + 1;
      const response = await priceAlertService.getMyRoutes({ status, page: nextPage, per_page });
      return response;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || error.message || 'Failed to load more routes'
      );
    }
  }
);

export const createPriceAlert = createAsyncThunk(
  'priceAlerts/createPriceAlert',
  async (data: CreatePriceAlertRequest, { rejectWithValue }) => {
    try {
      const alert = await priceAlertService.createAlert(data);
      return alert;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || error.message || 'Failed to save route'
      );
    }
  }
);

export const updatePriceAlert = createAsyncThunk(
  'priceAlerts/updatePriceAlert',
  async (
    { alertId, data, email }: { alertId: number; data: UpdatePriceAlertRequest; email?: string },
    { rejectWithValue }
  ) => {
    try {
      const alert = await priceAlertService.updateAlert(alertId, data, email);
      return alert;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || error.message || 'Failed to update route'
      );
    }
  }
);

export const deletePriceAlert = createAsyncThunk(
  'priceAlerts/deletePriceAlert',
  async (
    { alertId, email, departure, arrival }: { alertId: number; email?: string; departure: string; arrival: string },
    { rejectWithValue }
  ) => {
    try {
      await priceAlertService.deleteAlert(alertId, email);
      return { alertId, departure, arrival };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || error.message || 'Failed to remove saved route'
      );
    }
  }
);

export const pausePriceAlert = createAsyncThunk(
  'priceAlerts/pausePriceAlert',
  async (alertId: number, { rejectWithValue }) => {
    try {
      const alert = await priceAlertService.pauseAlert(alertId);
      return alert;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || error.message || 'Failed to pause alert'
      );
    }
  }
);

export const resumePriceAlert = createAsyncThunk(
  'priceAlerts/resumePriceAlert',
  async (alertId: number, { rejectWithValue }) => {
    try {
      const alert = await priceAlertService.resumeAlert(alertId);
      return alert;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || error.message || 'Failed to resume alert'
      );
    }
  }
);

export const checkRouteSaved = createAsyncThunk(
  'priceAlerts/checkRouteSaved',
  async (
    { departure, arrival, email }: { departure: string; arrival: string; email?: string },
    { getState, rejectWithValue }
  ) => {
    try {
      // Check cache first
      const state = getState() as { priceAlerts: PriceAlertState };
      const cacheKey = getRouteCacheKey(departure, arrival);
      const cached = state.priceAlerts.routeStatusCache[cacheKey];

      if (cached !== undefined) {
        return { ...cached, departure, arrival, fromCache: true };
      }

      const response = await priceAlertService.checkRouteSaved(departure, arrival, email);
      return { ...response, departure, arrival, fromCache: false };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || error.message || 'Failed to check route status'
      );
    }
  }
);

export const fetchPriceAlertStats = createAsyncThunk(
  'priceAlerts/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const stats = await priceAlertService.getStats();
      return stats;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || error.message || 'Failed to fetch stats'
      );
    }
  }
);

// Quick save route action
export const quickSaveRoute = createAsyncThunk(
  'priceAlerts/quickSaveRoute',
  async (
    { departure, arrival, price, email, dateFrom, dateTo }: {
      departure: string;
      arrival: string;
      price?: number;
      email?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const alert = await priceAlertService.quickSaveRoute(departure, arrival, price, email, dateFrom, dateTo);
      return alert;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || error.message || 'Failed to save route'
      );
    }
  }
);

const priceAlertSlice = createSlice({
  name: 'priceAlerts',
  initialState,
  reducers: {
    clearSavedRoutes: (state) => {
      state.savedRoutes = [];
      state.total = 0;
      state.page = 1;
      state.hasMore = false;
      state.stats = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearRouteCache: (state) => {
      state.routeStatusCache = {};
    },
    invalidateRouteCache: (state, action: PayloadAction<{ departure: string; arrival: string }>) => {
      const key = getRouteCacheKey(action.payload.departure, action.payload.arrival);
      delete state.routeStatusCache[key];
    },
    setRouteCached: (state, action: PayloadAction<{ departure: string; arrival: string; isSaved: boolean; alertId: number | null; status: PriceAlertStatus | null }>) => {
      const key = getRouteCacheKey(action.payload.departure, action.payload.arrival);
      state.routeStatusCache[key] = {
        is_saved: action.payload.isSaved,
        alert_id: action.payload.alertId,
        status: action.payload.status,
      };
    },
  },
  extraReducers: (builder) => {
    // Fetch saved routes
    builder
      .addCase(fetchSavedRoutes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSavedRoutes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.savedRoutes = action.payload.routes;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.hasMore = action.payload.has_more;

        // Update cache with fetched routes
        action.payload.routes.forEach((route) => {
          const key = getRouteCacheKey(route.departure_port, route.arrival_port);
          state.routeStatusCache[key] = {
            is_saved: true,
            alert_id: route.id,
            status: route.status,
          };
        });
      })
      .addCase(fetchSavedRoutes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Load more routes
    builder
      .addCase(loadMoreSavedRoutes.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadMoreSavedRoutes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.savedRoutes = [...state.savedRoutes, ...action.payload.routes];
        state.page = action.payload.page;
        state.hasMore = action.payload.has_more;

        // Update cache
        action.payload.routes.forEach((route) => {
          const key = getRouteCacheKey(route.departure_port, route.arrival_port);
          state.routeStatusCache[key] = {
            is_saved: true,
            alert_id: route.id,
            status: route.status,
          };
        });
      })
      .addCase(loadMoreSavedRoutes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Create price alert
    builder
      .addCase(createPriceAlert.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createPriceAlert.fulfilled, (state, action) => {
        state.isCreating = false;
        state.savedRoutes.unshift(action.payload);
        state.total += 1;

        // Update cache
        const key = getRouteCacheKey(action.payload.departure_port, action.payload.arrival_port);
        state.routeStatusCache[key] = {
          is_saved: true,
          alert_id: action.payload.id,
          status: action.payload.status,
        };

        // Update stats
        if (state.stats) {
          state.stats.total_alerts += 1;
          state.stats.active_alerts += 1;
        }
      })
      .addCase(createPriceAlert.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload as string;
      });

    // Quick save route
    builder
      .addCase(quickSaveRoute.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(quickSaveRoute.fulfilled, (state, action) => {
        state.isCreating = false;
        state.savedRoutes.unshift(action.payload);
        state.total += 1;

        const key = getRouteCacheKey(action.payload.departure_port, action.payload.arrival_port);
        state.routeStatusCache[key] = {
          is_saved: true,
          alert_id: action.payload.id,
          status: action.payload.status,
        };

        if (state.stats) {
          state.stats.total_alerts += 1;
          state.stats.active_alerts += 1;
        }
      })
      .addCase(quickSaveRoute.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload as string;
      });

    // Update price alert
    builder
      .addCase(updatePriceAlert.fulfilled, (state, action) => {
        const index = state.savedRoutes.findIndex((r) => r.id === action.payload.id);
        if (index !== -1) {
          state.savedRoutes[index] = action.payload;
        }

        const key = getRouteCacheKey(action.payload.departure_port, action.payload.arrival_port);
        state.routeStatusCache[key] = {
          is_saved: action.payload.status !== 'cancelled',
          alert_id: action.payload.id,
          status: action.payload.status,
        };
      });

    // Delete price alert
    builder
      .addCase(deletePriceAlert.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deletePriceAlert.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.savedRoutes = state.savedRoutes.filter((r) => r.id !== action.payload.alertId);
        state.total -= 1;

        // Update cache
        const key = getRouteCacheKey(action.payload.departure, action.payload.arrival);
        state.routeStatusCache[key] = {
          is_saved: false,
          alert_id: null,
          status: null,
        };

        if (state.stats && state.stats.active_alerts > 0) {
          state.stats.active_alerts -= 1;
        }
      })
      .addCase(deletePriceAlert.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload as string;
      });

    // Pause alert
    builder
      .addCase(pausePriceAlert.fulfilled, (state, action) => {
        const index = state.savedRoutes.findIndex((r) => r.id === action.payload.id);
        if (index !== -1) {
          state.savedRoutes[index] = action.payload;
        }

        const key = getRouteCacheKey(action.payload.departure_port, action.payload.arrival_port);
        state.routeStatusCache[key] = {
          is_saved: true,
          alert_id: action.payload.id,
          status: 'paused',
        };

        if (state.stats) {
          state.stats.active_alerts -= 1;
          state.stats.paused_alerts += 1;
        }
      });

    // Resume alert
    builder
      .addCase(resumePriceAlert.fulfilled, (state, action) => {
        const index = state.savedRoutes.findIndex((r) => r.id === action.payload.id);
        if (index !== -1) {
          state.savedRoutes[index] = action.payload;
        }

        const key = getRouteCacheKey(action.payload.departure_port, action.payload.arrival_port);
        state.routeStatusCache[key] = {
          is_saved: true,
          alert_id: action.payload.id,
          status: 'active',
        };

        if (state.stats) {
          state.stats.active_alerts += 1;
          state.stats.paused_alerts -= 1;
        }
      });

    // Check route saved
    builder
      .addCase(checkRouteSaved.pending, (state) => {
        state.isCheckingRoute = true;
      })
      .addCase(checkRouteSaved.fulfilled, (state, action) => {
        state.isCheckingRoute = false;
        if (!action.payload.fromCache) {
          const key = getRouteCacheKey(action.payload.departure, action.payload.arrival);
          state.routeStatusCache[key] = {
            is_saved: action.payload.is_saved,
            alert_id: action.payload.alert_id,
            status: action.payload.status,
          };
        }
      })
      .addCase(checkRouteSaved.rejected, (state) => {
        state.isCheckingRoute = false;
      });

    // Fetch stats
    builder
      .addCase(fetchPriceAlertStats.pending, (state) => {
        state.isLoadingStats = true;
      })
      .addCase(fetchPriceAlertStats.fulfilled, (state, action) => {
        state.isLoadingStats = false;
        state.stats = action.payload;
      })
      .addCase(fetchPriceAlertStats.rejected, (state) => {
        state.isLoadingStats = false;
      });
  },
});

export const {
  clearSavedRoutes,
  clearError,
  clearRouteCache,
  invalidateRouteCache,
  setRouteCached,
} = priceAlertSlice.actions;

// Selectors
export const selectSavedRoutes = (state: { priceAlerts: PriceAlertState }) => state.priceAlerts.savedRoutes;
export const selectActiveSavedRoutes = (state: { priceAlerts: PriceAlertState }) =>
  state.priceAlerts.savedRoutes.filter((r) => r.status === 'active');
export const selectPausedRoutes = (state: { priceAlerts: PriceAlertState }) =>
  state.priceAlerts.savedRoutes.filter((r) => r.status === 'paused');
export const selectSavedRoutesTotal = (state: { priceAlerts: PriceAlertState }) => state.priceAlerts.total;
export const selectHasMoreRoutes = (state: { priceAlerts: PriceAlertState }) => state.priceAlerts.hasMore;
export const selectIsLoading = (state: { priceAlerts: PriceAlertState }) => state.priceAlerts.isLoading;
export const selectIsCreating = (state: { priceAlerts: PriceAlertState }) => state.priceAlerts.isCreating;
export const selectIsDeleting = (state: { priceAlerts: PriceAlertState }) => state.priceAlerts.isDeleting;
export const selectError = (state: { priceAlerts: PriceAlertState }) => state.priceAlerts.error;
export const selectStats = (state: { priceAlerts: PriceAlertState }) => state.priceAlerts.stats;

// Route status selector
export const selectIsRouteSaved = (departure: string, arrival: string) => (state: { priceAlerts: PriceAlertState }) => {
  const key = getRouteCacheKey(departure, arrival);
  return state.priceAlerts.routeStatusCache[key]?.is_saved ?? false;
};

export const selectRouteAlertId = (departure: string, arrival: string) => (state: { priceAlerts: PriceAlertState }) => {
  const key = getRouteCacheKey(departure, arrival);
  return state.priceAlerts.routeStatusCache[key]?.alert_id ?? null;
};

export const selectRouteStatus = (departure: string, arrival: string) => (state: { priceAlerts: PriceAlertState }) => {
  const key = getRouteCacheKey(departure, arrival);
  return state.priceAlerts.routeStatusCache[key] ?? null;
};

export default priceAlertSlice.reducer;
