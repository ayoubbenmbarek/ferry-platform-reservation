/**
 * WebSocket hook for real-time ferry availability updates.
 *
 * Provides instant updates when:
 * - Bookings are made/cancelled on our platform
 * - External API changes are detected (every 2 min sync)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { AppState, AppStateStatus } from 'react-native';

export interface AvailabilityUpdate {
  type: 'availability_update' | 'connected' | 'subscribed' | 'pong' | 'error';
  route?: string;
  data?: {
    ferry_id: string;
    route: string;
    departure_time: string;
    availability: {
      change_type?: 'booking_created' | 'booking_cancelled';
      passengers_booked?: number;
      passengers_freed?: number;
      vehicles_booked?: number;
      vehicles_freed?: number;
      booking_reference?: string;
      seats?: {
        total: number;
        available: number;
        sold: number;
      };
      cabins?: {
        inside: { total: number; available: number };
        outside: { total: number; available: number };
        suite: { total: number; available: number };
      };
      vehicles?: {
        car: { total: number; available: number };
        motorcycle: { total: number; available: number };
        camper: { total: number; available: number };
      };
    };
    source: 'internal' | 'external';
    updated_at: string;
  };
  client_id?: string;
  routes?: string[];
  message?: string;
}

interface UseAvailabilityWebSocketOptions {
  routes?: string[];
  onUpdate?: (update: AvailabilityUpdate) => void;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  subscribedRoutes: string[];
  lastUpdate: AvailabilityUpdate | null;
  error: string | null;
  reconnectAttempts: number;
}

// Get WebSocket URL from API configuration
const getWebSocketUrl = (routes: string[] = []): string => {
  const extra = Constants.expoConfig?.extra || {};
  const hostUri = Constants.expoConfig?.hostUri;
  const debuggerHost = hostUri?.split(':')[0];

  let wsHost: string;
  let wsProtocol = 'ws:';

  if (__DEV__) {
    // Development mode
    if (debuggerHost && debuggerHost !== 'localhost') {
      // Physical device connecting via Expo
      wsHost = `${debuggerHost}:8010`;
    } else if (extra.apiBaseUrl) {
      // API URL explicitly set
      try {
        const url = new URL(extra.apiBaseUrl);
        wsHost = url.host;
        wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      } catch {
        wsHost = 'localhost:8010';
      }
    } else if (Platform.OS === 'android') {
      // Android emulator
      wsHost = '10.0.2.2:8010';
    } else {
      // iOS simulator
      wsHost = 'localhost:8010';
    }
  } else {
    // Production
    wsHost = 'api.maritime-reservations.com';
    wsProtocol = 'wss:';
  }

  let url = `${wsProtocol}//${wsHost}/ws/availability`;

  if (routes.length > 0) {
    url += `?routes=${routes.join(',')}`;
  }

  console.log('[WebSocket] Connecting to:', url);
  return url;
};

export function useAvailabilityWebSocket(options: UseAvailabilityWebSocketOptions = {}) {
  const {
    routes = [],
    onUpdate,
    autoConnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    subscribedRoutes: [],
    lastUpdate: null,
    error: null,
    reconnectAttempts: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Don't connect if app is in background
    if (appStateRef.current !== 'active') {
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const ws = new WebSocket(getWebSocketUrl(routes));
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected for availability updates');
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          reconnectAttempts: 0,
          error: null,
        }));

        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'ping' }));
          }
        }, 30000); // Ping every 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          const update: AvailabilityUpdate = JSON.parse(event.data);

          setState(prev => ({ ...prev, lastUpdate: update }));

          // Update subscribed routes if we receive a subscribed message
          if (update.type === 'subscribed' && update.routes) {
            setState(prev => ({ ...prev, subscribedRoutes: update.routes! }));
          }

          // Call the update callback
          if (onUpdate) {
            onUpdate(update);
          }

          // Log availability changes
          if (update.type === 'availability_update' && update.data) {
            const changeType = update.data.availability.change_type;
            const source = update.data.source;
            console.log(
              `[WebSocket] Availability update [${source}]: ${update.data.route} - ${changeType || 'sync'}`
            );
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        setState(prev => ({ ...prev, error: 'WebSocket connection error' }));
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Closed:', event.code, event.reason);

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
        }));

        // Attempt to reconnect if not a normal closure and app is active
        if (
          event.code !== 1000 &&
          appStateRef.current === 'active' &&
          state.reconnectAttempts < maxReconnectAttempts
        ) {
          console.log(`[WebSocket] Reconnecting in ${reconnectInterval}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            setState(prev => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }));
            connect();
          }, reconnectInterval);
        }
      };
    } catch (err) {
      console.error('[WebSocket] Failed to create:', err);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: 'Failed to connect to WebSocket',
      }));
    }
  }, [routes, onUpdate, state.reconnectAttempts, reconnectInterval, maxReconnectAttempts]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      subscribedRoutes: [],
    }));
  }, []);

  // Subscribe to additional routes
  const subscribe = useCallback((routesToSubscribe: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'subscribe',
        routes: routesToSubscribe,
      }));
    }
  }, []);

  // Unsubscribe from routes
  const unsubscribe = useCallback((routesToUnsubscribe: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'unsubscribe',
        routes: routesToUnsubscribe,
      }));
    }
  }, []);

  // Handle app state changes (disconnect when backgrounded, reconnect when active)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - reconnect
        console.log('[WebSocket] App active - reconnecting...');
        connect();
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background - disconnect to save battery
        console.log('[WebSocket] App backgrounded - disconnecting...');
        disconnect();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [connect, disconnect]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update subscriptions when routes prop changes
  useEffect(() => {
    if (state.isConnected && routes.length > 0) {
      subscribe(routes);
    }
  }, [routes, state.isConnected, subscribe]);

  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
}

export default useAvailabilityWebSocket;
