// Mock dependencies before imports
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'ExponentPushToken[test123]' })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id-123')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  getBadgeCountAsync: jest.fn(() => Promise.resolve(0)),
  setBadgeCountAsync: jest.fn(() => Promise.resolve()),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: {
    HIGH: 4,
    DEFAULT: 3,
  },
  SchedulableTriggerInputTypes: {
    DATE: 'date',
  },
}));

jest.mock('expo-device', () => ({
  isDevice: true,
}));

jest.mock('expo-constants', () => ({
  appOwnership: null, // null = standalone app, 'expo' = Expo Go
  expoConfig: {
    extra: {
      eas: {
        projectId: 'test-project-id',
      },
    },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Import after mocks are set up
import { notificationService, NotificationSettings } from '../../services/notificationService';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays } from 'date-fns';

// Helper to create mock booking (not importing from testUtils to avoid Platform issues)
const createMockBooking = (overrides = {}) => ({
  id: 1,
  booking_reference: 'BK123456',
  status: 'confirmed' as const,
  sailing_id: 'sail-123',
  operator: 'CTN',
  departure_port: 'Tunis',
  arrival_port: 'Marseille',
  departure_time: '2024-06-15T08:00:00Z',
  arrival_time: '2024-06-15T20:00:00Z',
  vessel_name: 'Carthage',
  is_round_trip: false,
  contact_email: 'test@example.com',
  contact_phone: '+1234567890',
  contact_first_name: 'John',
  contact_last_name: 'Doe',
  total_passengers: 3,
  total_vehicles: 1,
  subtotal: 350,
  discount_amount: 0,
  tax_amount: 35,
  total_amount: 385,
  currency: 'EUR',
  created_at: '2024-06-01T10:00:00Z',
  ...overrides,
});

describe('NotificationService', () => {
  beforeEach(() => {
    // Clear mock call history but keep implementations
    jest.clearAllMocks();

    // Reset AsyncStorage mock to default implementation
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    // Ensure Notifications mock returns expected values
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notification-id-123');
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  });

  describe('Permission handling', () => {
    it('should request permissions successfully', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });

      const result = await notificationService.requestPermissions();

      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return true if permissions already granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });

      const result = await notificationService.requestPermissions();

      expect(result).toBe(true);
    });

    it('should check if permissions are granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });

      const result = await notificationService.hasPermissions();

      expect(result).toBe(true);
    });
  });

  describe('Settings management', () => {
    it('should return default settings when none stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const settings = await notificationService.getSettings();

      expect(settings).toEqual({
        enabled: true,
        bookingConfirmations: true,
        departureReminder24h: true,
        departureReminder2h: true,
        priceAlerts: true,
        promotions: false,
      });
    });

    it('should return stored settings', async () => {
      const storedSettings: NotificationSettings = {
        enabled: true,
        bookingConfirmations: false,
        departureReminder24h: true,
        departureReminder2h: false,
        priceAlerts: true,
        promotions: true,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(storedSettings));

      const settings = await notificationService.getSettings();

      expect(settings.bookingConfirmations).toBe(false);
      expect(settings.departureReminder2h).toBe(false);
      expect(settings.promotions).toBe(true);
    });

    it('should update settings', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const updated = await notificationService.updateSettings({ promotions: true });

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      expect(updated.promotions).toBe(true);
    });
  });

  describe('Booking confirmation notification', () => {
    it('should send booking confirmation notification', async () => {
      const booking = createMockBooking({
        id: 123,
        booking_reference: 'BK123456',
        departure_port: 'Tunis',
        arrival_port: 'Marseille',
      });

      // Mock settings to have notifications enabled
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ enabled: true, bookingConfirmations: true })
      );

      const notificationId = await notificationService.sendBookingConfirmation(booking);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: expect.objectContaining({
          title: 'Booking Confirmed! 🎉',
          body: expect.stringContaining('Tunis'),
          data: expect.objectContaining({
            type: 'booking_confirmation',
            bookingId: 123,
            bookingReference: 'BK123456',
          }),
        }),
        trigger: null,
      });
      expect(notificationId).toBe('notification-id-123');
    });

    it('should not send notification if disabled', async () => {
      const booking = createMockBooking();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ enabled: false, bookingConfirmations: true })
      );

      const notificationId = await notificationService.sendBookingConfirmation(booking);

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(notificationId).toBeNull();
    });
  });

  describe('Departure reminders', () => {
    it('should schedule 24h and 2h reminders for future departures', async () => {
      // Create a booking departing 3 days from now
      const futureDate = addDays(new Date(), 3);
      const booking = createMockBooking({
        id: 456,
        departure_time: futureDate.toISOString(),
        departure_port: 'Tunis',
        arrival_port: 'Marseille',
      });

      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(
          JSON.stringify({
            enabled: true,
            departureReminder24h: true,
            departureReminder2h: true,
          })
        )
        .mockResolvedValueOnce(null); // For storing scheduled reminders

      const scheduledIds = await notificationService.scheduleDepartureReminders(booking);

      // Should schedule both 24h and 2h reminders
      expect(scheduledIds.length).toBe(2);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    });

    it('should not schedule reminders if departure is too soon', async () => {
      // Create a booking departing in 1 hour
      const soonDate = new Date(Date.now() + 60 * 60 * 1000);
      const booking = createMockBooking({
        departure_time: soonDate.toISOString(),
      });

      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(
          JSON.stringify({
            enabled: true,
            departureReminder24h: true,
            departureReminder2h: true,
          })
        )
        .mockResolvedValueOnce(null);

      const scheduledIds = await notificationService.scheduleDepartureReminders(booking);

      // Neither reminder should be scheduled (both times have passed)
      expect(scheduledIds.length).toBe(0);
    });

    it('should cancel reminders for a booking', async () => {
      const reminderIds = ['reminder-1', 'reminder-2'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ 123: reminderIds })
      );

      await notificationService.cancelBookingReminders(123);

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-1');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-2');
    });
  });

  describe('Price alerts', () => {
    it('should send price alert notification', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ enabled: true, priceAlerts: true })
      );

      const route = { departure: 'Tunis', arrival: 'Marseille' };
      const notificationId = await notificationService.sendPriceAlert(route, 150, 120);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: expect.objectContaining({
          title: 'Price Drop Alert! 💰',
          body: expect.stringContaining('€120'),
          data: expect.objectContaining({
            type: 'price_alert',
            newPrice: 120,
            oldPrice: 150,
          }),
        }),
        trigger: null,
      });
      expect(notificationId).toBe('notification-id-123');
    });

    it('should not send price alert if disabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ enabled: true, priceAlerts: false })
      );

      const route = { departure: 'Tunis', arrival: 'Marseille' };
      const notificationId = await notificationService.sendPriceAlert(route, 150, 120);

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(notificationId).toBeNull();
    });
  });

  describe('Promotional notifications', () => {
    it('should send promotion notification when enabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ enabled: true, promotions: true })
      );

      const notificationId = await notificationService.sendPromotion(
        'Summer Sale!',
        '50% off all routes'
      );

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: expect.objectContaining({
          title: 'Summer Sale!',
          body: '50% off all routes',
          data: expect.objectContaining({
            type: 'promotion',
          }),
        }),
        trigger: null,
      });
      expect(notificationId).toBe('notification-id-123');
    });

    it('should not send promotion if disabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ enabled: true, promotions: false })
      );

      const notificationId = await notificationService.sendPromotion(
        'Summer Sale!',
        '50% off all routes'
      );

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(notificationId).toBeNull();
    });
  });

  describe('Badge management', () => {
    it('should get badge count', async () => {
      (Notifications.getBadgeCountAsync as jest.Mock).mockResolvedValueOnce(5);

      const count = await notificationService.getBadgeCount();

      expect(count).toBe(5);
    });

    it('should set badge count', async () => {
      await notificationService.setBadgeCount(10);

      expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(10);
    });

    it('should clear badge', async () => {
      await notificationService.clearBadge();

      expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(0);
    });
  });

  describe('Notification management', () => {
    it('should get all scheduled notifications', async () => {
      const mockNotifications = [
        { identifier: '1', content: { title: 'Test' }, trigger: null },
      ];
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce(
        mockNotifications
      );

      const notifications = await notificationService.getScheduledNotifications();

      expect(notifications).toEqual(mockNotifications);
    });

    it('should cancel all notifications', async () => {
      await notificationService.cancelAllNotifications();

      expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@scheduled_reminders');
    });
  });
});
