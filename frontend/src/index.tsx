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

// Fallback UI for Sentry Error Boundary
const ErrorFallback = ({ resetError }: { error: unknown; componentStack: string; eventId: string; resetError: () => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-100">
    <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
      <div className="text-red-500 text-6xl mb-4">!</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Something went wrong</h1>
      <p className="text-gray-600 mb-6">
        We're sorry, but something unexpected happened. Our team has been notified.
      </p>
      <button
        onClick={resetError}
        className="bg-sky-600 text-white px-6 py-2 rounded-lg hover:bg-sky-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  </div>
);

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
