import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';
import { initSentry, SentryErrorBoundary } from './sentry';
import './index.css';
import './i18n';
import App from './App';
import { store, persistor } from './store';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// Initialize Sentry (must be called before React renders)
initSentry();

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Clean up old persisted ferry state (migration - can be removed after all users have migrated)
try {
  const persistedState = localStorage.getItem('persist:root');
  if (persistedState) {
    const parsed = JSON.parse(persistedState);
    if (parsed.ferry) {
      // Remove ferry state from persisted data
      delete parsed.ferry;
      localStorage.setItem('persist:root', JSON.stringify(parsed));
      console.log('Cleaned up old persisted ferry state');
    }
  }
} catch (error) {
  console.error('Error cleaning up persisted state:', error);
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// Clear cache and reload helper
const clearCacheAndReload = async () => {
  try {
    // Unregister service worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
    }
    // Clear caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    // Clear localStorage items related to caching
    localStorage.removeItem('i18nextLng');
    // Force reload bypassing cache
    window.location.reload();
  } catch (e) {
    console.error('Failed to clear cache:', e);
    window.location.reload();
  }
};

// Fallback UI for Sentry Error Boundary
const ErrorFallback = ({ error, resetError }: { error: unknown; componentStack: string; eventId: string; resetError: () => void }) => {
  // Check if it's a chunk loading error
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isChunkError = errorMessage.includes('Loading chunk') ||
                       errorMessage.includes('ChunkLoadError') ||
                       errorMessage.includes('Failed to fetch dynamically imported module');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        <div className="text-red-500 text-6xl mb-4">!</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Something went wrong</h1>
        <p className="text-gray-600 mb-6">
          {isChunkError
            ? "The app needs to be refreshed. This usually happens after an update."
            : "We're sorry, but something unexpected happened. Our team has been notified."}
        </p>
        <div className="space-y-3">
          <button
            onClick={resetError}
            className="w-full bg-sky-600 text-white px-6 py-2 rounded-lg hover:bg-sky-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={clearCacheAndReload}
            className="w-full bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm"
          >
            Clear Cache & Reload
          </button>
        </div>
      </div>
    </div>
  );
};

root.render(
  <React.StrictMode>
    <SentryErrorBoundary fallback={ErrorFallback} showDialog>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </PersistGate>
      </Provider>
    </SentryErrorBoundary>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Register service worker for PWA/offline support
serviceWorkerRegistration.register({
  onSuccess: () => {
    console.log('PWA: App is ready for offline use');
  },
  onUpdate: (registration) => {
    console.log('PWA: New version available');
    // Optionally show a notification to the user
    if (window.confirm('A new version is available! Click OK to refresh.')) {
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  },
  onOffline: () => {
    console.log('PWA: App is offline');
  },
  onOnline: () => {
    console.log('PWA: App is back online');
  },
});
