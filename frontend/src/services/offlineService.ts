// Offline Service for Web Frontend
// Provides caching and offline support using localStorage and IndexedDB

const STORAGE_KEYS = {
  CACHED_BOOKINGS: 'offline_cached_bookings',
  CACHED_USER: 'offline_cached_user',
  CACHED_PORTS: 'offline_cached_ports',
  CACHED_ROUTES: 'offline_cached_routes',
  PENDING_OPERATIONS: 'offline_pending_operations',
  LAST_SYNC: 'offline_last_sync',
} as const;

// Cache expiration time (24 hours)
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000;

export interface CachedData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export type OfflineOperationType = 'save_route' | 'delete_route' | 'update_alert';

export interface PendingOperation {
  id: string;
  type: OfflineOperationType;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

class OfflineService {
  private isOnline: boolean = navigator.onLine;
  private listeners: Set<(isOnline: boolean) => void> = new Set();

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.setOnline(true));
    window.addEventListener('offline', () => this.setOnline(false));
  }

  private setOnline(status: boolean) {
    this.isOnline = status;
    this.listeners.forEach(listener => listener(status));

    if (status) {
      // Trigger sync when back online
      this.syncPendingOperations();
    }
  }

  // Subscribe to online/offline changes
  subscribe(callback: (isOnline: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getIsOnline(): boolean {
    return this.isOnline;
  }

  // Generic cache methods
  private setCache<T>(key: string, data: T, expirationMs: number = CACHE_EXPIRATION_MS): void {
    const cachedData: CachedData<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + expirationMs,
    };
    try {
      localStorage.setItem(key, JSON.stringify(cachedData));
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }

  private getCache<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cachedData: CachedData<T> = JSON.parse(cached);

      // Check if cache has expired
      if (Date.now() > cachedData.expiresAt) {
        localStorage.removeItem(key);
        return null;
      }

      return cachedData.data;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  // Cache ports
  cachePorts(ports: unknown[]): void {
    this.setCache(STORAGE_KEYS.CACHED_PORTS, ports);
  }

  getCachedPorts(): unknown[] | null {
    return this.getCache(STORAGE_KEYS.CACHED_PORTS);
  }

  // Cache routes
  cacheRoutes(routes: Record<string, string[]>): void {
    this.setCache(STORAGE_KEYS.CACHED_ROUTES, routes);
  }

  getCachedRoutes(): Record<string, string[]> | null {
    return this.getCache(STORAGE_KEYS.CACHED_ROUTES);
  }

  // Cache user data
  cacheUser(user: Record<string, unknown>): void {
    this.setCache(STORAGE_KEYS.CACHED_USER, user);
  }

  getCachedUser(): Record<string, unknown> | null {
    return this.getCache(STORAGE_KEYS.CACHED_USER);
  }

  // Cache bookings
  cacheBookings(bookings: unknown[]): void {
    this.setCache(STORAGE_KEYS.CACHED_BOOKINGS, bookings);
  }

  getCachedBookings(): unknown[] | null {
    return this.getCache(STORAGE_KEYS.CACHED_BOOKINGS);
  }

  // Pending operations queue
  async queueOperation(type: OfflineOperationType, data: Record<string, unknown>): Promise<PendingOperation> {
    const operation: PendingOperation = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    const pendingOps = this.getPendingOperations();
    pendingOps.push(operation);
    localStorage.setItem(STORAGE_KEYS.PENDING_OPERATIONS, JSON.stringify(pendingOps));

    // Try to sync immediately if online
    if (this.isOnline) {
      this.syncPendingOperations();
    }

    return operation;
  }

  getPendingOperations(): PendingOperation[] {
    try {
      const ops = localStorage.getItem(STORAGE_KEYS.PENDING_OPERATIONS);
      return ops ? JSON.parse(ops) : [];
    } catch {
      return [];
    }
  }

  getPendingOperationsCount(): number {
    return this.getPendingOperations().length;
  }

  removePendingOperation(operationId: string): void {
    const pendingOps = this.getPendingOperations();
    const filteredOps = pendingOps.filter(op => op.id !== operationId);
    localStorage.setItem(STORAGE_KEYS.PENDING_OPERATIONS, JSON.stringify(filteredOps));
  }

  async syncPendingOperations(): Promise<{ success: number; failed: number }> {
    const pendingOps = this.getPendingOperations();
    let success = 0;
    let failed = 0;

    for (const operation of pendingOps) {
      try {
        // Attempt to sync operation
        await this.executeOperation(operation);
        this.removePendingOperation(operation.id);
        success++;
      } catch (error) {
        console.error('Failed to sync operation:', operation.id, error);
        operation.retryCount++;

        // Remove if max retries exceeded
        if (operation.retryCount >= 3) {
          this.removePendingOperation(operation.id);
        }
        failed++;
      }
    }

    if (success > 0) {
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
    }

    return { success, failed };
  }

  private async executeOperation(operation: PendingOperation): Promise<void> {
    // This would call the appropriate API based on operation type
    // For now, just log it
    console.log('Executing operation:', operation);

    switch (operation.type) {
      case 'save_route':
        // Call save route API
        break;
      case 'delete_route':
        // Call delete route API
        break;
      case 'update_alert':
        // Call update alert API
        break;
    }
  }

  getLastSyncTime(): number | null {
    const time = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return time ? parseInt(time, 10) : null;
  }

  clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }
}

export const offlineService = new OfflineService();
