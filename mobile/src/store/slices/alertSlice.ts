import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  alertService,
  AvailabilityAlert,
  CreateAlertRequest,
  AlertStats,
  AlertStatus,
} from '../../services/alertService';

interface AlertState {
  alerts: AvailabilityAlert[];
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  stats: AlertStats | null;
  isLoadingStats: boolean;
}

const initialState: AlertState = {
  alerts: [],
  isLoading: false,
  isCreating: false,
  error: null,
  stats: null,
  isLoadingStats: false,
};

// Async thunks
export const fetchUserAlerts = createAsyncThunk(
  'alerts/fetchUserAlerts',
  async (
    params: { email?: string; status?: AlertStatus } | undefined,
    { rejectWithValue }
  ) => {
    try {
      const alerts = await alertService.getAlerts(params);
      return alerts;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || error.message || 'Failed to fetch alerts'
      );
    }
  }
);

export const createAvailabilityAlert = createAsyncThunk(
  'alerts/createAvailabilityAlert',
  async (data: CreateAlertRequest, { rejectWithValue }) => {
    try {
      const alert = await alertService.createAlert(data);
      return alert;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || error.message || 'Failed to create alert'
      );
    }
  }
);

export const cancelAlert = createAsyncThunk(
  'alerts/cancelAlert',
  async (
    { alertId, email }: { alertId: number; email?: string },
    { rejectWithValue }
  ) => {
    try {
      await alertService.cancelAlert(alertId, email);
      return alertId;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || error.message || 'Failed to cancel alert'
      );
    }
  }
);

export const markAlertFulfilled = createAsyncThunk(
  'alerts/markAlertFulfilled',
  async (
    { alertId, email }: { alertId: number; email?: string },
    { rejectWithValue }
  ) => {
    try {
      const alert = await alertService.markAsFulfilled(alertId, email);
      return alert;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || error.message || 'Failed to update alert'
      );
    }
  }
);

export const fetchAlertStats = createAsyncThunk(
  'alerts/fetchAlertStats',
  async (_, { rejectWithValue }) => {
    try {
      const stats = await alertService.getAlertStats();
      return stats;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || error.message || 'Failed to fetch stats'
      );
    }
  }
);

const alertSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    clearAlerts: (state) => {
      state.alerts = [];
      state.stats = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    removeAlertFromList: (state, action: PayloadAction<number>) => {
      state.alerts = state.alerts.filter((alert) => alert.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    // Fetch user alerts
    builder
      .addCase(fetchUserAlerts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUserAlerts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.alerts = action.payload;
      })
      .addCase(fetchUserAlerts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Create availability alert
    builder
      .addCase(createAvailabilityAlert.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createAvailabilityAlert.fulfilled, (state, action) => {
        state.isCreating = false;
        state.alerts.unshift(action.payload);
        if (state.stats) {
          state.stats.total_alerts += 1;
          state.stats.active_alerts += 1;
        }
      })
      .addCase(createAvailabilityAlert.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload as string;
      });

    // Cancel alert
    builder
      .addCase(cancelAlert.pending, (state) => {
        state.error = null;
      })
      .addCase(cancelAlert.fulfilled, (state, action) => {
        state.alerts = state.alerts.filter((alert) => alert.id !== action.payload);
        if (state.stats && state.stats.active_alerts > 0) {
          state.stats.active_alerts -= 1;
        }
      })
      .addCase(cancelAlert.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Mark alert fulfilled
    builder
      .addCase(markAlertFulfilled.fulfilled, (state, action) => {
        const index = state.alerts.findIndex((a) => a.id === action.payload.id);
        if (index !== -1) {
          state.alerts[index] = action.payload;
        }
        if (state.stats && state.stats.active_alerts > 0) {
          state.stats.active_alerts -= 1;
        }
      });

    // Fetch alert stats
    builder
      .addCase(fetchAlertStats.pending, (state) => {
        state.isLoadingStats = true;
      })
      .addCase(fetchAlertStats.fulfilled, (state, action) => {
        state.isLoadingStats = false;
        state.stats = action.payload;
      })
      .addCase(fetchAlertStats.rejected, (state) => {
        state.isLoadingStats = false;
      });
  },
});

export const { clearAlerts, clearError, removeAlertFromList } = alertSlice.actions;

// Selectors
export const selectAlerts = (state: { alerts: AlertState }) => state.alerts.alerts;
export const selectActiveAlerts = (state: { alerts: AlertState }) =>
  state.alerts.alerts.filter((a) => a.status === 'active');
export const selectIsLoading = (state: { alerts: AlertState }) => state.alerts.isLoading;
export const selectIsCreating = (state: { alerts: AlertState }) => state.alerts.isCreating;
export const selectError = (state: { alerts: AlertState }) => state.alerts.error;
export const selectStats = (state: { alerts: AlertState }) => state.alerts.stats;
export const selectActiveAlertCount = (state: { alerts: AlertState }) =>
  state.alerts.stats?.active_alerts ?? state.alerts.alerts.filter((a) => a.status === 'active').length;

export default alertSlice.reducer;
