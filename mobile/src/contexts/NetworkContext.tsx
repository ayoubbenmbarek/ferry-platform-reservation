import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { offlineService, OfflineSyncResult } from '../services/offlineService';
import { bookingService } from '../services/bookingService';

interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: string | null;
  isSyncing: boolean;
  pendingOperationsCount: number;
  lastSyncTime: number | null;
  syncError: string | null;
  syncNow: () => Promise<OfflineSyncResult | null>;
  refreshPendingCount: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);
  const [connectionType, setConnectionType] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingOperationsCount, setPendingOperationsCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const wasOffline = useRef(false);
  const unsubscribeRef = useRef<NetInfoSubscription | null>(null);

  // Cancel booking function for sync
  const cancelBookingFn = useCallback(async (bookingId: number): Promise<boolean> => {
    try {
      await bookingService.cancelBooking(bookingId);
      return true;
    } catch (error) {
      console.error('Failed to cancel booking during sync:', error);
      return false;
    }
  }, []);

  // Refresh pending operations count
  const refreshPendingCount = useCallback(async () => {
    const count = await offlineService.getPendingOperationsCount();
    setPendingOperationsCount(count);
  }, []);

  // Sync pending operations
  const syncNow = useCallback(async (): Promise<OfflineSyncResult | null> => {
    if (!isConnected || isSyncing) return null;

    setIsSyncing(true);
    setSyncError(null);

    try {
      const result = await offlineService.syncPendingOperations(cancelBookingFn);

      if (!result.success && result.errors.length > 0) {
        setSyncError(result.errors[0]);
      }

      const syncTime = await offlineService.getLastSyncTime();
      setLastSyncTime(syncTime);

      await refreshPendingCount();

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setSyncError(errorMessage);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [isConnected, isSyncing, cancelBookingFn, refreshPendingCount]);

  // Handle network state changes
  const handleNetworkChange = useCallback((state: NetInfoState) => {
    const connected = state.isConnected ?? false;
    setIsConnected(connected);
    setIsInternetReachable(state.isInternetReachable);
    setConnectionType(state.type);

    // If we were offline and now back online, trigger sync
    if (wasOffline.current && connected && state.isInternetReachable) {
      syncNow();
    }

    wasOffline.current = !connected;
  }, [syncNow]);

  // Initialize network monitoring
  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable);
      setConnectionType(state.type);
      wasOffline.current = !state.isConnected;
    });

    // Subscribe to network changes
    unsubscribeRef.current = NetInfo.addEventListener(handleNetworkChange);

    // Load last sync time and pending count
    const loadOfflineState = async () => {
      const syncTime = await offlineService.getLastSyncTime();
      setLastSyncTime(syncTime);
      await refreshPendingCount();
    };
    loadOfflineState();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [handleNetworkChange, refreshPendingCount]);

  const value: NetworkContextType = {
    isConnected,
    isInternetReachable,
    connectionType,
    isSyncing,
    pendingOperationsCount,
    lastSyncTime,
    syncError,
    syncNow,
    refreshPendingCount,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextType {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

export { NetworkContext };
