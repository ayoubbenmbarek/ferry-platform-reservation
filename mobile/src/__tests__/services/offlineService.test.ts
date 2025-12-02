import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineService } from '../../services/offlineService';
import { Booking } from '../../types';

const mockBooking: Booking = {
  id: 1,
  booking_reference: 'TEST123',
  status: 'confirmed',
  departure_port: 'Barcelona',
  arrival_port: 'Palma',
  departure_time: '2024-06-15T10:00:00Z',
  arrival_time: '2024-06-15T14:00:00Z',
  operator: 'Test Ferry',
  vessel_name: 'Test Vessel',
  total_passengers: 2,
  total_vehicles: 0,
  total_amount: 150.00,
  contact_email: 'test@example.com',
  contact_phone: '+1234567890',
  is_round_trip: false,
  passengers: [],
};

const mockBooking2: Booking = {
  ...mockBooking,
  id: 2,
  booking_reference: 'TEST456',
};

describe('OfflineService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('cacheBookings', () => {
    it('should cache bookings successfully', async () => {
      await offlineService.cacheBookings([mockBooking]);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const calls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0]).toBe('offline_cached_bookings');

      const storedData = JSON.parse(calls[0][1]);
      expect(storedData.data).toHaveLength(1);
      expect(storedData.data[0].booking_reference).toBe('TEST123');
    });

    it('should cache multiple bookings', async () => {
      await offlineService.cacheBookings([mockBooking, mockBooking2]);

      const calls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const storedData = JSON.parse(calls[0][1]);
      expect(storedData.data).toHaveLength(2);
    });
  });

  describe('getCachedBookings', () => {
    it('should return null when no bookings are cached', async () => {
      const cached = await offlineService.getCachedBookings();
      expect(cached).toBeNull();
    });

    it('should return cached bookings when they exist', async () => {
      const cachedData = {
        data: [mockBooking],
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));

      const cached = await offlineService.getCachedBookings();

      expect(cached).not.toBeNull();
      expect(cached).toHaveLength(1);
      expect(cached![0].booking_reference).toBe('TEST123');
    });

    it('should return null for expired cache', async () => {
      const cachedData = {
        data: [mockBooking],
        timestamp: Date.now() - 48 * 60 * 60 * 1000,
        expiresAt: Date.now() - 24 * 60 * 60 * 1000,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));

      const cached = await offlineService.getCachedBookings();
      expect(cached).toBeNull();
    });
  });

  describe('getCachedBooking', () => {
    it('should return a single cached booking by ID', async () => {
      const cachedData = {
        data: [mockBooking, mockBooking2],
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));

      const booking = await offlineService.getCachedBooking(2);

      expect(booking).not.toBeNull();
      expect(booking!.booking_reference).toBe('TEST456');
    });

    it('should return null when booking not found', async () => {
      const cachedData = {
        data: [mockBooking],
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));

      const booking = await offlineService.getCachedBooking(999);
      expect(booking).toBeNull();
    });

    it('should return null when no bookings cached', async () => {
      const booking = await offlineService.getCachedBooking(1);
      expect(booking).toBeNull();
    });
  });

  describe('queueOperation', () => {
    it('should queue a cancel booking operation', async () => {
      const operation = await offlineService.queueOperation('cancel_booking', 1);

      expect(operation.type).toBe('cancel_booking');
      expect(operation.bookingId).toBe(1);
      expect(operation.retryCount).toBe(0);
      expect(operation.id).toContain('cancel_booking_1_');
    });

    it('should store operation in AsyncStorage', async () => {
      await offlineService.queueOperation('cancel_booking', 1);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const calls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const pendingCall = calls.find((c) => c[0] === 'offline_pending_operations');
      expect(pendingCall).toBeDefined();
    });
  });

  describe('getPendingOperations', () => {
    it('should return empty array when no operations queued', async () => {
      const pending = await offlineService.getPendingOperations();
      expect(pending).toEqual([]);
    });

    it('should return queued operations', async () => {
      const operations = [
        { id: 'op1', type: 'cancel_booking', bookingId: 1, timestamp: Date.now(), retryCount: 0 },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(operations));

      const pending = await offlineService.getPendingOperations();

      expect(pending).toHaveLength(1);
      expect(pending[0].type).toBe('cancel_booking');
    });
  });

  describe('getPendingOperationsCount', () => {
    it('should return 0 when no operations queued', async () => {
      const count = await offlineService.getPendingOperationsCount();
      expect(count).toBe(0);
    });

    it('should return correct count', async () => {
      const operations = [
        { id: 'op1', type: 'cancel_booking', bookingId: 1, timestamp: Date.now(), retryCount: 0 },
        { id: 'op2', type: 'cancel_booking', bookingId: 2, timestamp: Date.now(), retryCount: 0 },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(operations));

      const count = await offlineService.getPendingOperationsCount();
      expect(count).toBe(2);
    });
  });

  describe('removePendingOperation', () => {
    it('should remove a specific operation', async () => {
      const operations = [
        { id: 'op1', type: 'cancel_booking', bookingId: 1, timestamp: Date.now(), retryCount: 0 },
        { id: 'op2', type: 'cancel_booking', bookingId: 2, timestamp: Date.now(), retryCount: 0 },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(operations));

      await offlineService.removePendingOperation('op1');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'offline_pending_operations',
        expect.any(String)
      );
    });
  });

  describe('incrementRetryCount', () => {
    it('should increment retry count', async () => {
      const operations = [
        { id: 'op1', type: 'cancel_booking', bookingId: 1, timestamp: Date.now(), retryCount: 0 },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(operations));

      const result = await offlineService.incrementRetryCount('op1');

      expect(result).toBe(true);
    });

    it('should return false for non-existent operation', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('[]');

      const result = await offlineService.incrementRetryCount('non-existent');
      expect(result).toBe(false);
    });

    it('should remove operation after max retries', async () => {
      const operations = [
        { id: 'op1', type: 'cancel_booking', bookingId: 1, timestamp: Date.now(), retryCount: 2 },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(operations));

      const result = await offlineService.incrementRetryCount('op1');

      expect(result).toBe(false);
    });
  });

  describe('clearPendingOperations', () => {
    it('should remove pending operations from storage', async () => {
      await offlineService.clearPendingOperations();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('offline_pending_operations');
    });
  });

  describe('syncPendingOperations', () => {
    it('should sync operations successfully', async () => {
      const operations = [
        { id: 'op1', type: 'cancel_booking', bookingId: 1, timestamp: Date.now(), retryCount: 0 },
      ];
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify(operations))
        .mockResolvedValueOnce(JSON.stringify(operations));

      const mockCancelFn = jest.fn().mockResolvedValue(true);
      const result = await offlineService.syncPendingOperations(mockCancelFn);

      expect(result.success).toBe(true);
      expect(result.syncedOperations).toBe(1);
      expect(mockCancelFn).toHaveBeenCalledWith(1);
    });

    it('should handle failed operations', async () => {
      const operations = [
        { id: 'op1', type: 'cancel_booking', bookingId: 1, timestamp: Date.now(), retryCount: 0 },
      ];
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify(operations))
        .mockResolvedValueOnce(JSON.stringify(operations));

      const mockCancelFn = jest.fn().mockResolvedValue(false);
      const result = await offlineService.syncPendingOperations(mockCancelFn);

      expect(result.success).toBe(false);
      expect(result.failedOperations).toBe(1);
    });

    it('should handle exceptions during sync', async () => {
      const operations = [
        { id: 'op1', type: 'cancel_booking', bookingId: 1, timestamp: Date.now(), retryCount: 0 },
      ];
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify(operations))
        .mockResolvedValueOnce(JSON.stringify(operations));

      const mockCancelFn = jest.fn().mockRejectedValue(new Error('Network error'));
      const result = await offlineService.syncPendingOperations(mockCancelFn);

      expect(result.success).toBe(false);
      expect(result.failedOperations).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('lastSyncTime', () => {
    it('should set last sync time', async () => {
      const timestamp = Date.now();
      await offlineService.setLastSyncTime(timestamp);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'offline_last_sync',
        timestamp.toString()
      );
    });

    it('should return null when no sync time set', async () => {
      const time = await offlineService.getLastSyncTime();
      expect(time).toBeNull();
    });

    it('should return saved sync time', async () => {
      const timestamp = Date.now();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(timestamp.toString());

      const time = await offlineService.getLastSyncTime();
      expect(time).toBe(timestamp);
    });
  });

  describe('isCacheStale', () => {
    it('should return true when no cache exists', async () => {
      const isStale = await offlineService.isCacheStale();
      expect(isStale).toBe(true);
    });

    it('should return false for fresh cache', async () => {
      const cachedData = {
        data: [mockBooking],
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));

      const isStale = await offlineService.isCacheStale();
      expect(isStale).toBe(false);
    });

    it('should return true for expired cache', async () => {
      const cachedData = {
        data: [mockBooking],
        timestamp: Date.now() - 48 * 60 * 60 * 1000,
        expiresAt: Date.now() - 24 * 60 * 60 * 1000,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));

      const isStale = await offlineService.isCacheStale();
      expect(isStale).toBe(true);
    });
  });

  describe('getCacheAge', () => {
    it('should return null when no cache exists', async () => {
      const age = await offlineService.getCacheAge();
      expect(age).toBeNull();
    });

    it('should return cache age in milliseconds', async () => {
      const timestamp = Date.now() - 5000;
      const cachedData = {
        data: [mockBooking],
        timestamp,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));

      const age = await offlineService.getCacheAge();
      expect(age).not.toBeNull();
      expect(age).toBeGreaterThanOrEqual(5000);
      expect(age).toBeLessThan(10000);
    });
  });

  describe('cacheUser and getCachedUser', () => {
    it('should cache user data', async () => {
      const userData = { id: 1, email: 'test@example.com' };
      await offlineService.cacheUser(userData);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'offline_cached_user',
        expect.any(String)
      );
    });

    it('should return null when no user cached', async () => {
      const cached = await offlineService.getCachedUser();
      expect(cached).toBeNull();
    });

    it('should return cached user data', async () => {
      const userData = { id: 1, email: 'test@example.com' };
      const cachedData = {
        data: userData,
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));

      const cached = await offlineService.getCachedUser();
      expect(cached).toEqual(userData);
    });
  });

  describe('clearAll', () => {
    it('should clear all offline data', async () => {
      await offlineService.clearAll();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('offline_cached_bookings');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('offline_pending_operations');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('offline_last_sync');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('offline_cached_user');
    });
  });

  describe('isSyncing', () => {
    it('should return false when not syncing', () => {
      expect(offlineService.isSyncing()).toBe(false);
    });
  });
});
