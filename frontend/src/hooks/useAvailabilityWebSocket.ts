/**
 * WebSocket hook for real-time ferry availability updates.
 *
 * Provides instant updates when:
 * - Bookings are made/cancelled on our platform
 * - External API changes are detected (every 2 min sync)
 */

import { useState, useEffect, useCallback, useRef } from 'react';

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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Build WebSocket URL
  const getWebSocketUrl = useCallback(() => {
    // Get API URL from environment (same as API calls)
    const apiUrl = process.env.REACT_APP_API_URL || '/api/v1';

    let wsHost: string;
    let protocol: string;

    if (apiUrl.startsWith('http')) {
      // Production/staging: derive WebSocket URL from API URL
      // e.g., https://api-staging.voilaferry.com/api/v1 -> wss://api-staging.voilaferry.com
      const url = new URL(apiUrl);
      protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      wsHost = url.host;
    } else {
      // Development: use localhost with WebSocket port
      const isDev = process.env.NODE_ENV === 'development' ||
                    window.location.hostname === 'localhost' ||
                    window.location.hostname.match(/^192\.168\./);
      protocol = isDev ? 'ws:' : (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
      wsHost = `${window.location.hostname}:8010`;
    }

    let url = `${protocol}//${wsHost}/ws/availability`;

    if (routes.length > 0) {
      url += `?routes=${routes.join(',')}`;
    }

    console.log('[WebSocket] Connecting to:', url);
    return url;
  }, [routes]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔌 WebSocket connected for availability updates');
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
              `📢 Availability update [${source}]: ${update.data.route} - ${changeType || 'sync'}`,
              update.data
            );
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({ ...prev, error: 'WebSocket connection error' }));
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);

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

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && state.reconnectAttempts < maxReconnectAttempts) {
          console.log(`Attempting to reconnect in ${reconnectInterval}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            setState(prev => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }));
            connect();
          }, reconnectInterval);
        }
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: 'Failed to connect to WebSocket',
      }));
    }
  }, [getWebSocketUrl, onUpdate, state.reconnectAttempts, reconnectInterval, maxReconnectAttempts]);

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
  // Use JSON.stringify to avoid re-running on every render when routes array is recreated
  const routesKey = JSON.stringify(routes);
  useEffect(() => {
    if (state.isConnected && routes.length > 0) {
      subscribe(routes);
    }
  }, [routesKey, state.isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
}

export default useAvailabilityWebSocket;
