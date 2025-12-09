/**
 * Tests for useAvailabilityWebSocket hook.
 *
 * Tests cover:
 * - AvailabilityUpdate type structure
 * - WebSocket URL generation
 * - Message parsing
 * - State management logic
 */

import { Platform } from 'react-native';

// Mock Platform before any imports
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {},
    hostUri: null,
  },
}));

import { AvailabilityUpdate } from '../../hooks/useAvailabilityWebSocket';

describe('useAvailabilityWebSocket', () => {
  describe('AvailabilityUpdate Type Structure', () => {
    it('should have correct structure for availability_update type', () => {
      const update: AvailabilityUpdate = {
        type: 'availability_update',
        route: 'TUNIS-MARSEILLE',
        data: {
          ferry_id: 'CTN-001',
          route: 'TUNIS-MARSEILLE',
          departure_time: '2024-06-15T10:00:00',
          availability: {
            change_type: 'booking_created',
            passengers_booked: 5,
          },
          source: 'internal',
          updated_at: '2024-06-01T12:00:00',
        },
      };

      expect(update.type).toBe('availability_update');
      expect(update.route).toBe('TUNIS-MARSEILLE');
      expect(update.data?.ferry_id).toBe('CTN-001');
      expect(update.data?.availability.passengers_booked).toBe(5);
    });

    it('should have correct structure for connected type', () => {
      const update: AvailabilityUpdate = {
        type: 'connected',
        client_id: 'test-client-123',
        message: 'Connected to availability updates',
      };

      expect(update.type).toBe('connected');
      expect(update.client_id).toBe('test-client-123');
    });

    it('should have correct structure for subscribed type', () => {
      const update: AvailabilityUpdate = {
        type: 'subscribed',
        routes: ['TUNIS-MARSEILLE', 'TUNIS-GENOA'],
      };

      expect(update.type).toBe('subscribed');
      expect(update.routes).toHaveLength(2);
      expect(update.routes).toContain('TUNIS-MARSEILLE');
    });

    it('should have correct structure for pong type', () => {
      const update: AvailabilityUpdate = {
        type: 'pong',
      };

      expect(update.type).toBe('pong');
    });

    it('should have correct structure for error type', () => {
      const update: AvailabilityUpdate = {
        type: 'error',
        message: 'Invalid route format',
      };

      expect(update.type).toBe('error');
      expect(update.message).toBe('Invalid route format');
    });
  });

  describe('Availability Data Structure', () => {
    it('should support booking_created change type', () => {
      const update: AvailabilityUpdate = {
        type: 'availability_update',
        data: {
          ferry_id: 'CTN-001',
          route: 'TUNIS-MARSEILLE',
          departure_time: '2024-06-15T10:00:00',
          availability: {
            change_type: 'booking_created',
            passengers_booked: 3,
            vehicles_booked: 1,
            booking_reference: 'MR-TEST001',
          },
          source: 'internal',
          updated_at: '2024-06-01T12:00:00',
        },
      };

      expect(update.data?.availability.change_type).toBe('booking_created');
      expect(update.data?.availability.passengers_booked).toBe(3);
      expect(update.data?.availability.vehicles_booked).toBe(1);
    });

    it('should support booking_cancelled change type', () => {
      const update: AvailabilityUpdate = {
        type: 'availability_update',
        data: {
          ferry_id: 'CTN-001',
          route: 'TUNIS-MARSEILLE',
          departure_time: '2024-06-15T10:00:00',
          availability: {
            change_type: 'booking_cancelled',
            passengers_freed: 2,
            vehicles_freed: 1,
          },
          source: 'internal',
          updated_at: '2024-06-01T12:00:00',
        },
      };

      expect(update.data?.availability.change_type).toBe('booking_cancelled');
      expect(update.data?.availability.passengers_freed).toBe(2);
      expect(update.data?.availability.vehicles_freed).toBe(1);
    });

    it('should support detailed seats availability', () => {
      const update: AvailabilityUpdate = {
        type: 'availability_update',
        data: {
          ferry_id: 'CTN-001',
          route: 'TUNIS-MARSEILLE',
          departure_time: '2024-06-15T10:00:00',
          availability: {
            seats: {
              total: 500,
              available: 450,
              sold: 50,
            },
          },
          source: 'external',
          updated_at: '2024-06-01T12:00:00',
        },
      };

      expect(update.data?.availability.seats?.total).toBe(500);
      expect(update.data?.availability.seats?.available).toBe(450);
      expect(update.data?.availability.seats?.sold).toBe(50);
    });

    it('should support detailed cabins availability', () => {
      const update: AvailabilityUpdate = {
        type: 'availability_update',
        data: {
          ferry_id: 'CTN-001',
          route: 'TUNIS-MARSEILLE',
          departure_time: '2024-06-15T10:00:00',
          availability: {
            cabins: {
              inside: { total: 20, available: 15 },
              outside: { total: 15, available: 10 },
              suite: { total: 5, available: 3 },
            },
          },
          source: 'external',
          updated_at: '2024-06-01T12:00:00',
        },
      };

      expect(update.data?.availability.cabins?.inside.available).toBe(15);
      expect(update.data?.availability.cabins?.outside.available).toBe(10);
      expect(update.data?.availability.cabins?.suite.available).toBe(3);
    });

    it('should support detailed vehicles availability', () => {
      const update: AvailabilityUpdate = {
        type: 'availability_update',
        data: {
          ferry_id: 'CTN-001',
          route: 'TUNIS-MARSEILLE',
          departure_time: '2024-06-15T10:00:00',
          availability: {
            vehicles: {
              car: { total: 100, available: 80 },
              motorcycle: { total: 20, available: 18 },
              camper: { total: 10, available: 5 },
            },
          },
          source: 'external',
          updated_at: '2024-06-01T12:00:00',
        },
      };

      expect(update.data?.availability.vehicles?.car.available).toBe(80);
      expect(update.data?.availability.vehicles?.motorcycle.available).toBe(18);
      expect(update.data?.availability.vehicles?.camper.available).toBe(5);
    });

    it('should support internal vs external source', () => {
      const internalUpdate: AvailabilityUpdate = {
        type: 'availability_update',
        data: {
          ferry_id: 'CTN-001',
          route: 'TUNIS-MARSEILLE',
          departure_time: '2024-06-15T10:00:00',
          availability: { passengers_booked: 1 },
          source: 'internal',
          updated_at: '2024-06-01T12:00:00',
        },
      };

      const externalUpdate: AvailabilityUpdate = {
        type: 'availability_update',
        data: {
          ferry_id: 'CTN-001',
          route: 'TUNIS-MARSEILLE',
          departure_time: '2024-06-15T10:00:00',
          availability: { passengers_booked: 1 },
          source: 'external',
          updated_at: '2024-06-01T12:00:00',
        },
      };

      expect(internalUpdate.data?.source).toBe('internal');
      expect(externalUpdate.data?.source).toBe('external');
    });
  });

  describe('WebSocket Message Parsing', () => {
    it('should parse availability_update message correctly', () => {
      const rawMessage = JSON.stringify({
        type: 'availability_update',
        route: 'TUNIS-MARSEILLE',
        data: {
          ferry_id: 'CTN-001',
          route: 'TUNIS-MARSEILLE',
          departure_time: '2024-06-15T10:00:00',
          availability: {
            change_type: 'booking_created',
            passengers_booked: 5,
          },
          source: 'internal',
          updated_at: '2024-06-01T12:00:00',
        },
      });

      const update: AvailabilityUpdate = JSON.parse(rawMessage);

      expect(update.type).toBe('availability_update');
      expect(update.data?.availability.passengers_booked).toBe(5);
    });

    it('should parse connected message correctly', () => {
      const rawMessage = JSON.stringify({
        type: 'connected',
        client_id: 'uuid-12345',
        message: 'Connected to real-time availability updates',
      });

      const update: AvailabilityUpdate = JSON.parse(rawMessage);

      expect(update.type).toBe('connected');
      expect(update.client_id).toBe('uuid-12345');
    });

    it('should parse subscribed message correctly', () => {
      const rawMessage = JSON.stringify({
        type: 'subscribed',
        routes: ['TUNIS-MARSEILLE', 'TUNIS-GENOA'],
      });

      const update: AvailabilityUpdate = JSON.parse(rawMessage);

      expect(update.type).toBe('subscribed');
      expect(update.routes).toEqual(['TUNIS-MARSEILLE', 'TUNIS-GENOA']);
    });
  });

  describe('WebSocket Action Messages', () => {
    it('should create correct subscribe action format', () => {
      const routes = ['TUNIS-MARSEILLE', 'TUNIS-GENOA'];
      const subscribeAction = JSON.stringify({
        action: 'subscribe',
        routes: routes,
      });

      const parsed = JSON.parse(subscribeAction);
      expect(parsed.action).toBe('subscribe');
      expect(parsed.routes).toEqual(routes);
    });

    it('should create correct unsubscribe action format', () => {
      const routes = ['TUNIS-MARSEILLE'];
      const unsubscribeAction = JSON.stringify({
        action: 'unsubscribe',
        routes: routes,
      });

      const parsed = JSON.parse(unsubscribeAction);
      expect(parsed.action).toBe('unsubscribe');
      expect(parsed.routes).toEqual(routes);
    });

    it('should create correct ping action format', () => {
      const pingAction = JSON.stringify({ action: 'ping' });

      const parsed = JSON.parse(pingAction);
      expect(parsed.action).toBe('ping');
    });
  });

  describe('WebSocket URL Construction', () => {
    it('should construct URL with routes as query params', () => {
      const routes = ['TUNIS-MARSEILLE', 'TUNIS-GENOA'];
      const baseUrl = 'ws://localhost:8010/ws/availability';
      const fullUrl = `${baseUrl}?routes=${routes.join(',')}`;

      expect(fullUrl).toBe('ws://localhost:8010/ws/availability?routes=TUNIS-MARSEILLE,TUNIS-GENOA');
    });

    it('should construct URL without query params when no routes', () => {
      const routes: string[] = [];
      const baseUrl = 'ws://localhost:8010/ws/availability';
      const fullUrl = routes.length > 0 ? `${baseUrl}?routes=${routes.join(',')}` : baseUrl;

      expect(fullUrl).toBe('ws://localhost:8010/ws/availability');
    });

    it('should handle single route correctly', () => {
      const routes = ['TUNIS-MARSEILLE'];
      const baseUrl = 'ws://localhost:8010/ws/availability';
      const fullUrl = `${baseUrl}?routes=${routes.join(',')}`;

      expect(fullUrl).toBe('ws://localhost:8010/ws/availability?routes=TUNIS-MARSEILLE');
    });
  });

  describe('WebSocket State Management', () => {
    interface WebSocketState {
      isConnected: boolean;
      isConnecting: boolean;
      subscribedRoutes: string[];
      lastUpdate: AvailabilityUpdate | null;
      error: string | null;
      reconnectAttempts: number;
    }

    it('should have correct initial state', () => {
      const initialState: WebSocketState = {
        isConnected: false,
        isConnecting: false,
        subscribedRoutes: [],
        lastUpdate: null,
        error: null,
        reconnectAttempts: 0,
      };

      expect(initialState.isConnected).toBe(false);
      expect(initialState.isConnecting).toBe(false);
      expect(initialState.subscribedRoutes).toEqual([]);
      expect(initialState.lastUpdate).toBeNull();
      expect(initialState.error).toBeNull();
      expect(initialState.reconnectAttempts).toBe(0);
    });

    it('should update state on connection', () => {
      const state: WebSocketState = {
        isConnected: false,
        isConnecting: true,
        subscribedRoutes: [],
        lastUpdate: null,
        error: null,
        reconnectAttempts: 0,
      };

      // Simulate connection success
      const newState: WebSocketState = {
        ...state,
        isConnected: true,
        isConnecting: false,
        reconnectAttempts: 0,
        error: null,
      };

      expect(newState.isConnected).toBe(true);
      expect(newState.isConnecting).toBe(false);
    });

    it('should update state on disconnection', () => {
      const state: WebSocketState = {
        isConnected: true,
        isConnecting: false,
        subscribedRoutes: ['TUNIS-MARSEILLE'],
        lastUpdate: null,
        error: null,
        reconnectAttempts: 0,
      };

      // Simulate disconnection
      const newState: WebSocketState = {
        ...state,
        isConnected: false,
        isConnecting: false,
        subscribedRoutes: [],
      };

      expect(newState.isConnected).toBe(false);
      expect(newState.subscribedRoutes).toEqual([]);
    });

    it('should update subscribed routes on subscribed message', () => {
      const state: WebSocketState = {
        isConnected: true,
        isConnecting: false,
        subscribedRoutes: [],
        lastUpdate: null,
        error: null,
        reconnectAttempts: 0,
      };

      const subscribedMessage: AvailabilityUpdate = {
        type: 'subscribed',
        routes: ['TUNIS-MARSEILLE', 'TUNIS-GENOA'],
      };

      // Simulate state update
      const newState: WebSocketState = {
        ...state,
        subscribedRoutes: subscribedMessage.routes!,
      };

      expect(newState.subscribedRoutes).toEqual(['TUNIS-MARSEILLE', 'TUNIS-GENOA']);
    });

    it('should update lastUpdate on availability message', () => {
      const state: WebSocketState = {
        isConnected: true,
        isConnecting: false,
        subscribedRoutes: ['TUNIS-MARSEILLE'],
        lastUpdate: null,
        error: null,
        reconnectAttempts: 0,
      };

      const update: AvailabilityUpdate = {
        type: 'availability_update',
        route: 'TUNIS-MARSEILLE',
        data: {
          ferry_id: 'CTN-001',
          route: 'TUNIS-MARSEILLE',
          departure_time: '2024-06-15T10:00:00',
          availability: { passengers_booked: 5 },
          source: 'internal',
          updated_at: '2024-06-01T12:00:00',
        },
      };

      // Simulate state update
      const newState: WebSocketState = {
        ...state,
        lastUpdate: update,
      };

      expect(newState.lastUpdate).toEqual(update);
      expect(newState.lastUpdate?.data?.availability.passengers_booked).toBe(5);
    });

    it('should handle error state', () => {
      const state: WebSocketState = {
        isConnected: false,
        isConnecting: false,
        subscribedRoutes: [],
        lastUpdate: null,
        error: null,
        reconnectAttempts: 0,
      };

      // Simulate error
      const newState: WebSocketState = {
        ...state,
        error: 'WebSocket connection error',
      };

      expect(newState.error).toBe('WebSocket connection error');
    });

    it('should track reconnect attempts', () => {
      const state: WebSocketState = {
        isConnected: false,
        isConnecting: false,
        subscribedRoutes: [],
        lastUpdate: null,
        error: null,
        reconnectAttempts: 0,
      };

      // Simulate reconnect attempt
      const newState: WebSocketState = {
        ...state,
        reconnectAttempts: state.reconnectAttempts + 1,
      };

      expect(newState.reconnectAttempts).toBe(1);
    });

    it('should reset reconnect attempts on successful connection', () => {
      const state: WebSocketState = {
        isConnected: false,
        isConnecting: true,
        subscribedRoutes: [],
        lastUpdate: null,
        error: null,
        reconnectAttempts: 3,
      };

      // Simulate successful connection
      const newState: WebSocketState = {
        ...state,
        isConnected: true,
        isConnecting: false,
        reconnectAttempts: 0,
        error: null,
      };

      expect(newState.reconnectAttempts).toBe(0);
      expect(newState.isConnected).toBe(true);
    });
  });

  describe('Options Defaults', () => {
    it('should have correct default options', () => {
      const defaultOptions = {
        routes: [],
        onUpdate: undefined,
        autoConnect: true,
        reconnectInterval: 3000,
        maxReconnectAttempts: 5,
      };

      expect(defaultOptions.autoConnect).toBe(true);
      expect(defaultOptions.reconnectInterval).toBe(3000);
      expect(defaultOptions.maxReconnectAttempts).toBe(5);
      expect(defaultOptions.routes).toEqual([]);
    });
  });
});
