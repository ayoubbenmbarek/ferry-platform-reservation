import React, { useEffect, useState } from 'react';
import { offlineService } from '../services/offlineService';

interface OfflineIndicatorProps {
  showWhenOnline?: boolean;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ showWhenOnline = false }) => {
  const [isOnline, setIsOnline] = useState(offlineService.getIsOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Subscribe to online/offline changes
    const unsubscribe = offlineService.subscribe((online) => {
      setIsOnline(online);
      if (online) {
        // Sync pending operations when back online
        handleSync();
      }
    });

    // Get initial pending count
    setPendingCount(offlineService.getPendingOperationsCount());

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Show indicator when offline or when there are pending operations
    const shouldShow = !isOnline || (showWhenOnline && pendingCount > 0);
    setIsVisible(shouldShow);
  }, [isOnline, showWhenOnline, pendingCount]);

  const handleSync = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      await offlineService.syncPendingOperations();
      setPendingCount(offlineService.getPendingOperationsCount());
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 flex items-center justify-center gap-2 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      } ${
        !isOnline ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
      }`}
    >
      {!isOnline ? (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
          <span className="text-sm font-medium">No internet connection</span>
        </>
      ) : isSyncing ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-sm font-medium">Syncing changes...</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-sm font-medium">
            {pendingCount} pending change{pendingCount !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleSync}
            className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
          >
            Sync now
          </button>
        </>
      )}
    </div>
  );
};

export default OfflineIndicator;
