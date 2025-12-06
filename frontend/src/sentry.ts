/**
 * Sentry Configuration for Frontend
 * Error tracking and performance monitoring
 */

import * as Sentry from '@sentry/react';

// Check if Sentry should be initialized
const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;
const ENVIRONMENT = process.env.REACT_APP_ENVIRONMENT || 'development';
const VERSION = process.env.REACT_APP_VERSION || '1.0.0';

/**
 * Initialize Sentry error tracking
 */
export const initSentry = (): boolean => {
  if (!SENTRY_DSN) {
    console.info('Sentry DSN not configured, error tracking disabled');
    return false;
  }

  // Don't initialize in development unless explicitly enabled
  if (ENVIRONMENT === 'development' && !process.env.REACT_APP_SENTRY_DEBUG) {
    console.info('Sentry disabled in development');
    return false;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENVIRONMENT,
      release: `maritime-booking-frontend@${VERSION}`,

      // Performance Monitoring
      tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 0.5,

      // Session Replay (if using)
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,

      // Integrations
      integrations: [
        // Browser tracing for performance monitoring
        Sentry.browserTracingIntegration(),
        // Replay integration for session recording (optional)
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],

      // Filter out noisy errors
      ignoreErrors: [
        // Browser extension errors
        'top.GLOBALS',
        'originalCreateNotification',
        'canvas.contentDocument',
        'MyApp_RemoveAllHighlights',
        'http://tt.teleport',
        'atomicFindClose',
        // Network errors that are often user-caused
        'Network Error',
        'Failed to fetch',
        'NetworkError',
        'ChunkLoadError',
        // User browser issues
        'ResizeObserver loop',
        'Non-Error promise rejection',
        // Navigation errors
        'Navigation cancelled',
        'navigation cancelled',
        'Abort due to navigation',
        'AbortError',
        // React Router errors
        'No routes matched location',
      ],

      // URLs to ignore
      denyUrls: [
        // Chrome extensions
        /extensions\//i,
        /^chrome:\/\//i,
        /^chrome-extension:\/\//i,
        // Firefox extensions
        /^moz-extension:\/\//i,
        // Safari extensions
        /^safari-web-extension:\/\//i,
        // Analytics/tracking scripts
        /google-analytics\.com/,
        /googletagmanager\.com/,
      ],

      // Before sending error
      beforeSend(event, hint) {
        // Filter out certain errors
        const error = hint?.originalException;

        // Don't send errors from development builds
        if (ENVIRONMENT === 'development') {
          console.error('Sentry would send:', event);
          return null;
        }

        // Filter out user-cancelled actions
        if (error instanceof Error) {
          if (error.message.includes('cancelled') ||
              error.message.includes('aborted')) {
            return null;
          }
        }

        return event;
      },

      // Before sending breadcrumb
      beforeBreadcrumb(breadcrumb) {
        // Filter out certain breadcrumbs
        if (breadcrumb.category === 'console') {
          // Don't capture console.log in production
          if (breadcrumb.level === 'log') {
            return null;
          }
        }

        // Filter out health check requests
        if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
          const url = breadcrumb.data?.url || '';
          if (typeof url === 'string' && url.includes('/health')) {
            return null;
          }
        }

        return breadcrumb;
      },
    });

    console.info(`Sentry initialized for ${ENVIRONMENT}`);
    return true;
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
    return false;
  }
};

/**
 * Set user context for Sentry
 */
export const setUserContext = (user: {
  id?: string | number;
  email?: string;
  username?: string;
} | null): void => {
  if (user) {
    Sentry.setUser({
      id: user.id?.toString(),
      email: user.email,
      username: user.username,
    });
  } else {
    Sentry.setUser(null);
  }
};

/**
 * Add a breadcrumb for debugging
 */
export const addBreadcrumb = (
  message: string,
  category: string = 'custom',
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, unknown>
): void => {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  });
};

/**
 * Capture an exception manually
 */
export const captureException = (
  error: Error | unknown,
  context?: Record<string, unknown>
): void => {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
};

/**
 * Capture a message manually
 */
export const captureMessage = (
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
): void => {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureMessage(message, level);
  });
};

/**
 * Set custom tags for filtering
 */
export const setTags = (tags: Record<string, string>): void => {
  Object.entries(tags).forEach(([key, value]) => {
    Sentry.setTag(key, value);
  });
};

/**
 * Start a performance span
 */
export const startSpan = (
  name: string,
  op: string = 'custom'
): Sentry.Span | undefined => {
  return Sentry.startInactiveSpan({ name, op });
};

// Export Sentry components for React
export const SentryErrorBoundary = Sentry.ErrorBoundary;
export const SentryProfiler = Sentry.withProfiler;

export default Sentry;
