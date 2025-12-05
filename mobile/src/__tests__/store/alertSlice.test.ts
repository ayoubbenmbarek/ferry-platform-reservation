import { configureStore, EnhancedStore } from '@reduxjs/toolkit';
import alertReducer, {
  fetchUserAlerts,
  createAvailabilityAlert,
  cancelAlert,
  markAlertFulfilled,
  fetchAlertStats,
  clearAlerts,
  clearError,
  removeAlertFromList,
  selectAlerts,
  selectActiveAlerts,
  selectIsLoading,
  selectIsCreating,
  selectError,
  selectStats,
  selectActiveAlertCount,
} from '../../store/slices/alertSlice';
import { alertService, AvailabilityAlert, AlertStats } from '../../services/alertService';
import { createMockAvailabilityAlert, createMockAlertStats } from '../../test-utils/testUtils';

// Mock the alertService
jest.mock('../../services/alertService', () => ({
  alertService: {
    getAlerts: jest.fn(),
    createAlert: jest.fn(),
    updateAlert: jest.fn(),
    cancelAlert: jest.fn(),
    markAsFulfilled: jest.fn(),
    getAlertStats: jest.fn(),
  },
}));

const mockedAlertService = alertService as jest.Mocked<typeof alertService>;

interface AlertState {
  alerts: AvailabilityAlert[];
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  stats: AlertStats | null;
  isLoadingStats: boolean;
}

interface RootState {
  alerts: AlertState;
}

const createTestStore = (preloadedState?: Partial<AlertState>) => {
  return configureStore({
    reducer: { alerts: alertReducer },
    preloadedState: preloadedState ? { alerts: preloadedState as AlertState } : undefined,
  });
};

type AppStore = ReturnType<typeof createTestStore>;
type AppDispatch = AppStore['dispatch'];

describe('alertSlice', () => {
  let store: AppStore;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().alerts;
      expect(state.alerts).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.isCreating).toBe(false);
      expect(state.error).toBeNull();
      expect(state.stats).toBeNull();
      expect(state.isLoadingStats).toBe(false);
    });
  });

  describe('synchronous actions', () => {
    it('should clear alerts', () => {
      const mockAlert = createMockAvailabilityAlert() as AvailabilityAlert;
      store = createTestStore({
        alerts: [mockAlert],
        isLoading: false,
        isCreating: false,
        error: null,
        stats: createMockAlertStats() as AlertStats,
        isLoadingStats: false,
      });

      store.dispatch(clearAlerts());
      const state = store.getState().alerts;
      expect(state.alerts).toEqual([]);
      expect(state.stats).toBeNull();
    });

    it('should clear error', () => {
      store = createTestStore({
        alerts: [],
        isLoading: false,
        isCreating: false,
        error: 'Test error',
        stats: null,
        isLoadingStats: false,
      });

      store.dispatch(clearError());
      expect(store.getState().alerts.error).toBeNull();
    });

    it('should remove alert from list', () => {
      const mockAlerts = [
        createMockAvailabilityAlert({ id: 1 }),
        createMockAvailabilityAlert({ id: 2 }),
      ] as AvailabilityAlert[];
      store = createTestStore({
        alerts: mockAlerts,
        isLoading: false,
        isCreating: false,
        error: null,
        stats: null,
        isLoadingStats: false,
      });

      store.dispatch(removeAlertFromList(1));
      expect(store.getState().alerts.alerts).toHaveLength(1);
      expect(store.getState().alerts.alerts[0].id).toBe(2);
    });
  });

  describe('fetchUserAlerts', () => {
    it('should fetch alerts successfully', async () => {
      const mockAlerts = [createMockAvailabilityAlert()] as AvailabilityAlert[];
      mockedAlertService.getAlerts.mockResolvedValueOnce(mockAlerts);

      await store.dispatch(fetchUserAlerts({ email: 'test@example.com' }));

      const state = store.getState().alerts;
      expect(state.alerts).toEqual(mockAlerts);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle fetch error', async () => {
      mockedAlertService.getAlerts.mockRejectedValueOnce({
        response: { data: { detail: 'Failed to fetch' } },
      });

      await store.dispatch(fetchUserAlerts({ email: 'test@example.com' }));

      const state = store.getState().alerts;
      expect(state.alerts).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Failed to fetch');
    });

    it('should set loading state while fetching', async () => {
      mockedAlertService.getAlerts.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      const promise = store.dispatch(fetchUserAlerts({}));
      expect(store.getState().alerts.isLoading).toBe(true);

      await promise;
      expect(store.getState().alerts.isLoading).toBe(false);
    });
  });

  describe('createAvailabilityAlert', () => {
    it('should create alert successfully', async () => {
      const mockAlert = createMockAvailabilityAlert() as AvailabilityAlert;
      mockedAlertService.createAlert.mockResolvedValueOnce(mockAlert);

      await store.dispatch(
        createAvailabilityAlert({
          alert_type: 'cabin',
          email: 'test@example.com',
          departure_port: 'Tunis',
          arrival_port: 'Marseille',
          departure_date: '2024-06-15',
          is_round_trip: false,
          operator: 'CTN',
          num_adults: 2,
          num_children: 0,
          num_infants: 0,
          alert_duration_days: 30,
        })
      );

      const state = store.getState().alerts;
      expect(state.alerts).toContainEqual(mockAlert);
      expect(state.isCreating).toBe(false);
    });

    it('should update stats when creating alert', async () => {
      const mockAlert = createMockAvailabilityAlert() as AvailabilityAlert;
      const initialStats = createMockAlertStats() as AlertStats;
      mockedAlertService.createAlert.mockResolvedValueOnce(mockAlert);

      store = createTestStore({
        alerts: [],
        isLoading: false,
        isCreating: false,
        error: null,
        stats: initialStats,
        isLoadingStats: false,
      });

      await store.dispatch(
        createAvailabilityAlert({
          alert_type: 'cabin',
          email: 'test@example.com',
          departure_port: 'Tunis',
          arrival_port: 'Marseille',
          departure_date: '2024-06-15',
          is_round_trip: false,
          operator: 'CTN',
          num_adults: 2,
          num_children: 0,
          num_infants: 0,
          alert_duration_days: 30,
        })
      );

      const state = store.getState().alerts;
      expect(state.stats?.total_alerts).toBe(initialStats.total_alerts + 1);
      expect(state.stats?.active_alerts).toBe(initialStats.active_alerts + 1);
    });

    it('should handle create error', async () => {
      mockedAlertService.createAlert.mockRejectedValueOnce({
        response: { data: { detail: 'Duplicate alert' } },
      });

      await store.dispatch(
        createAvailabilityAlert({
          alert_type: 'cabin',
          email: 'test@example.com',
          departure_port: 'Tunis',
          arrival_port: 'Marseille',
          departure_date: '2024-06-15',
          is_round_trip: false,
          operator: 'CTN',
          num_adults: 2,
          num_children: 0,
          num_infants: 0,
          alert_duration_days: 30,
        })
      );

      const state = store.getState().alerts;
      expect(state.error).toBe('Duplicate alert');
      expect(state.isCreating).toBe(false);
    });
  });

  describe('cancelAlert', () => {
    it('should cancel alert successfully', async () => {
      const mockAlerts = [
        createMockAvailabilityAlert({ id: 1 }),
        createMockAvailabilityAlert({ id: 2 }),
      ] as AvailabilityAlert[];
      mockedAlertService.cancelAlert.mockResolvedValueOnce(undefined);

      store = createTestStore({
        alerts: mockAlerts,
        isLoading: false,
        isCreating: false,
        error: null,
        stats: createMockAlertStats() as AlertStats,
        isLoadingStats: false,
      });

      await store.dispatch(cancelAlert({ alertId: 1 }));

      const state = store.getState().alerts;
      expect(state.alerts).toHaveLength(1);
      expect(state.alerts[0].id).toBe(2);
      expect(state.stats?.active_alerts).toBe(2); // Decremented from 3
    });
  });

  describe('markAlertFulfilled', () => {
    it('should mark alert as fulfilled', async () => {
      const mockAlert = createMockAvailabilityAlert({ id: 1, status: 'active' }) as AvailabilityAlert;
      const fulfilledAlert = { ...mockAlert, status: 'fulfilled' as const };
      mockedAlertService.markAsFulfilled.mockResolvedValueOnce(fulfilledAlert);

      store = createTestStore({
        alerts: [mockAlert],
        isLoading: false,
        isCreating: false,
        error: null,
        stats: createMockAlertStats() as AlertStats,
        isLoadingStats: false,
      });

      await store.dispatch(markAlertFulfilled({ alertId: 1 }));

      const state = store.getState().alerts;
      expect(state.alerts[0].status).toBe('fulfilled');
    });
  });

  describe('fetchAlertStats', () => {
    it('should fetch stats successfully', async () => {
      const mockStats = createMockAlertStats() as AlertStats;
      mockedAlertService.getAlertStats.mockResolvedValueOnce(mockStats);

      await store.dispatch(fetchAlertStats());

      const state = store.getState().alerts;
      expect(state.stats).toEqual(mockStats);
      expect(state.isLoadingStats).toBe(false);
    });
  });

  describe('selectors', () => {
    const mockAlerts = [
      createMockAvailabilityAlert({ id: 1, status: 'active' }),
      createMockAvailabilityAlert({ id: 2, status: 'notified' }),
      createMockAvailabilityAlert({ id: 3, status: 'active' }),
    ] as AvailabilityAlert[];

    beforeEach(() => {
      store = createTestStore({
        alerts: mockAlerts,
        isLoading: false,
        isCreating: true,
        error: 'Test error',
        stats: createMockAlertStats() as AlertStats,
        isLoadingStats: false,
      });
    });

    it('selectAlerts should return all alerts', () => {
      expect(selectAlerts(store.getState())).toHaveLength(3);
    });

    it('selectActiveAlerts should return only active alerts', () => {
      const activeAlerts = selectActiveAlerts(store.getState());
      expect(activeAlerts).toHaveLength(2);
      expect(activeAlerts.every((a) => a.status === 'active')).toBe(true);
    });

    it('selectIsLoading should return loading state', () => {
      expect(selectIsLoading(store.getState())).toBe(false);
    });

    it('selectIsCreating should return creating state', () => {
      expect(selectIsCreating(store.getState())).toBe(true);
    });

    it('selectError should return error', () => {
      expect(selectError(store.getState())).toBe('Test error');
    });

    it('selectStats should return stats', () => {
      expect(selectStats(store.getState())).toEqual(createMockAlertStats());
    });

    it('selectActiveAlertCount should return active count from stats', () => {
      expect(selectActiveAlertCount(store.getState())).toBe(3);
    });

    it('selectActiveAlertCount should count from alerts if no stats', () => {
      store = createTestStore({
        alerts: mockAlerts,
        isLoading: false,
        isCreating: false,
        error: null,
        stats: null,
        isLoadingStats: false,
      });

      expect(selectActiveAlertCount(store.getState())).toBe(2);
    });
  });
});
