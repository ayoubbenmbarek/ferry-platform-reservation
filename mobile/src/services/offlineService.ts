import AsyncStorage from '@react-native-async-storage/async-storage';
import { Booking } from '../types';

// Storage keys
const STORAGE_KEYS = {
  CACHED_BOOKINGS: 'offline_cached_bookings',
  PENDING_OPERATIONS: 'offline_pending_operations',
  LAST_SYNC: 'offline_last_sync',
  CACHED_USER: 'offline_cached_user',
} as const;

// Types for offline operations
export type OfflineOperationType = 'cancel_booking' | 'update_booking';

export interface PendingOperation {
  id: string;
  type: OfflineOperationType;
  bookingId: number;
  data?: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

export interface OfflineSyncResult {
  success: boolean;
  syncedOperations: number;
  failedOperations: number;
  errors: string[];
}

export interface CachedData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// Cache expiration time (24 hours)
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000;
const MAX_RETRY_COUNT = 3;

class OfflineService {
  private syncInProgress = false;

  /**
   * Cache bookings for offline access
   */
  async cacheBookings(bookings: Booking[]): Promise<void> {
    try {
      const cachedData: CachedData<Booking[]> = {
        data: bookings,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_EXPIRATION_MS,
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.CACHED_BOOKINGS,
        JSON.stringify(cachedData)
      );
    } catch (error) {
      console.error('Error caching bookings:', error);
      throw error;
    }
  }

  /**
   * Get cached bookings
   */
  async getCachedBookings(): Promise<Booking[] | null> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_BOOKINGS);
      if (!cached) return null;

      const cachedData: CachedData<Booking[]> = JSON.parse(cached);

      // Check if cache has expired
      if (Date.now() > cachedData.expiresAt) {
        await this.clearCachedBookings();
        return null;
      }

      return cachedData.data;
    } catch (error) {
      console.error('Error getting cached bookings:', error);
      return null;
    }
  }

  /**
   * Get a single cached booking by ID
   */
  async getCachedBooking(bookingId: number): Promise<Booking | null> {
    const bookings = await this.getCachedBookings();
    if (!bookings) return null;
    return bookings.find((b) => b.id === bookingId) || null;
  }

  /**
   * Update a single booking in the cache
   */
  async updateCachedBooking(booking: Booking): Promise<void> {
    const bookings = await this.getCachedBookings();
    if (!bookings) return;

    const index = bookings.findIndex((b) => b.id === booking.id);
    if (index !== -1) {
      bookings[index] = booking;
      await this.cacheBookings(bookings);
    }
  }

  /**
   * Remove a booking from the cache
   */
  async removeCachedBooking(bookingId: number): Promise<void> {
    const bookings = await this.getCachedBookings();
    if (!bookings) return;

    const filteredBookings = bookings.filter((b) => b.id !== bookingId);
    await this.cacheBookings(filteredBookings);
  }

  /**
   * Clear cached bookings
   */
  async clearCachedBookings(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.CACHED_BOOKINGS);
  }

  /**
   * Queue an operation for when the device is back online
   */
  async queueOperation(
    type: OfflineOperationType,
    bookingId: number,
    data?: Record<string, unknown>
  ): Promise<PendingOperation> {
    const operation: PendingOperation = {
      id: `${type}_${bookingId}_${Date.now()}`,
      type,
      bookingId,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    const pendingOps = await this.getPendingOperations();
    pendingOps.push(operation);

    await AsyncStorage.setItem(
      STORAGE_KEYS.PENDING_OPERATIONS,
      JSON.stringify(pendingOps)
    );

    // Also update local cache to reflect the pending change
    if (type === 'cancel_booking') {
      const booking = await this.getCachedBooking(bookingId);
      if (booking) {
        booking.status = 'pending_cancellation';
        await this.updateCachedBooking(booking);
      }
    }

    return operation;
  }

  /**
   * Get all pending operations
   */
  async getPendingOperations(): Promise<PendingOperation[]> {
    try {
      const ops = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_OPERATIONS);
      return ops ? JSON.parse(ops) : [];
    } catch (error) {
      console.error('Error getting pending operations:', error);
      return [];
    }
  }

  /**
   * Get count of pending operations
   */
  async getPendingOperationsCount(): Promise<number> {
    const ops = await this.getPendingOperations();
    return ops.length;
  }

  /**
   * Remove a pending operation
   */
  async removePendingOperation(operationId: string): Promise<void> {
    const pendingOps = await this.getPendingOperations();
    const filteredOps = pendingOps.filter((op) => op.id !== operationId);
    await AsyncStorage.setItem(
      STORAGE_KEYS.PENDING_OPERATIONS,
      JSON.stringify(filteredOps)
    );
  }

  /**
   * Update retry count for a pending operation
   */
  async incrementRetryCount(operationId: string): Promise<boolean> {
    const pendingOps = await this.getPendingOperations();
    const opIndex = pendingOps.findIndex((op) => op.id === operationId);

    if (opIndex === -1) return false;

    pendingOps[opIndex].retryCount += 1;

    // Remove if max retries exceeded
    if (pendingOps[opIndex].retryCount >= MAX_RETRY_COUNT) {
      pendingOps.splice(opIndex, 1);
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_OPERATIONS,
        JSON.stringify(pendingOps)
      );
      return false;
    }

    await AsyncStorage.setItem(
      STORAGE_KEYS.PENDING_OPERATIONS,
      JSON.stringify(pendingOps)
    );
    return true;
  }

  /**
   * Clear all pending operations
   */
  async clearPendingOperations(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_OPERATIONS);
  }

  /**
   * Sync pending operations with the server
   * Returns a result object with sync status
   */
  async syncPendingOperations(
    cancelBookingFn: (bookingId: number) => Promise<boolean>
  ): Promise<OfflineSyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        syncedOperations: 0,
        failedOperations: 0,
        errors: ['Sync already in progress'],
      };
    }

    this.syncInProgress = true;
    const result: OfflineSyncResult = {
      success: true,
      syncedOperations: 0,
      failedOperations: 0,
      errors: [],
    };

    try {
      const pendingOps = await this.getPendingOperations();

      for (const operation of pendingOps) {
        try {
          let success = false;

          switch (operation.type) {
            case 'cancel_booking':
              success = await cancelBookingFn(operation.bookingId);
              break;
            // Add more operation types as needed
            default:
              console.warn(`Unknown operation type: ${operation.type}`);
              success = false;
          }

          if (success) {
            await this.removePendingOperation(operation.id);
            result.syncedOperations += 1;
          } else {
            const shouldRetry = await this.incrementRetryCount(operation.id);
            if (!shouldRetry) {
              result.errors.push(
                `Operation ${operation.id} failed after ${MAX_RETRY_COUNT} retries`
              );
            }
            result.failedOperations += 1;
          }
        } catch (error) {
          result.failedOperations += 1;
          result.errors.push(
            `Error syncing operation ${operation.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          await this.incrementRetryCount(operation.id);
        }
      }

      // Update last sync time
      await this.setLastSyncTime(Date.now());
      result.success = result.failedOperations === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(
        `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  /**
   * Set last sync timestamp
   */
  async setLastSyncTime(timestamp: number): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp.toString());
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTime(): Promise<number | null> {
    const time = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return time ? parseInt(time, 10) : null;
  }

  /**
   * Check if cache is stale (older than expiration time)
   */
  async isCacheStale(): Promise<boolean> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_BOOKINGS);
      if (!cached) return true;

      const cachedData: CachedData<Booking[]> = JSON.parse(cached);
      return Date.now() > cachedData.expiresAt;
    } catch {
      return true;
    }
  }

  /**
   * Get cache age in milliseconds
   */
  async getCacheAge(): Promise<number | null> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_BOOKINGS);
      if (!cached) return null;

      const cachedData: CachedData<Booking[]> = JSON.parse(cached);
      return Date.now() - cachedData.timestamp;
    } catch {
      return null;
    }
  }

  /**
   * Cache user data for offline access
   */
  async cacheUser(user: Record<string, unknown>): Promise<void> {
    const cachedData: CachedData<Record<string, unknown>> = {
      data: user,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_EXPIRATION_MS,
    };
    await AsyncStorage.setItem(
      STORAGE_KEYS.CACHED_USER,
      JSON.stringify(cachedData)
    );
  }

  /**
   * Get cached user data
   */
  async getCachedUser(): Promise<Record<string, unknown> | null> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_USER);
      if (!cached) return null;

      const cachedData: CachedData<Record<string, unknown>> = JSON.parse(cached);

      if (Date.now() > cachedData.expiresAt) {
        await AsyncStorage.removeItem(STORAGE_KEYS.CACHED_USER);
        return null;
      }

      return cachedData.data;
    } catch {
      return null;
    }
  }

  /**
   * Clear all offline data
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.CACHED_BOOKINGS),
      AsyncStorage.removeItem(STORAGE_KEYS.PENDING_OPERATIONS),
      AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC),
      AsyncStorage.removeItem(STORAGE_KEYS.CACHED_USER),
    ]);
  }

  /**
   * Check if sync is currently in progress
   */
  isSyncing(): boolean {
    return this.syncInProgress;
  }
}

export const offlineService = new OfflineService();
