import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addHours, subHours, parseISO, isBefore } from 'date-fns';
import { Booking } from '../types';

// Storage keys
const STORAGE_KEYS = {
  PUSH_TOKEN: '@notification_push_token',
  SETTINGS: '@notification_settings',
  SCHEDULED_REMINDERS: '@scheduled_reminders',
};

// Default notification settings
export interface NotificationSettings {
  enabled: boolean;
  bookingConfirmations: boolean;
  departureReminder24h: boolean;
  departureReminder2h: boolean;
  priceAlerts: boolean;
  promotions: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  bookingConfirmations: true,
  departureReminder24h: true,
  departureReminder2h: true,
  priceAlerts: true,
  promotions: false,
};

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private pushToken: string | null = null;

  /**
   * Initialize notification service and request permissions
   * Note: Local notifications work in Expo Go, but push notifications require a development build
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up notification channels for Android
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

      // Request permissions for local notifications
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('Notification permissions not granted');
        return false;
      }

      // Try to get push token (will gracefully fail in Expo Go)
      // Local notifications will still work even without push token
      await this.registerForPushNotifications();

      return true;
    } catch (error) {
      console.log('Notification initialization warning:', (error as Error).message);
      // Return true anyway - local notifications may still work
      return true;
    }
  }

  /**
   * Setup Android notification channels
   */
  private async setupAndroidChannels(): Promise<void> {
    await Notifications.setNotificationChannelAsync('bookings', {
      name: 'Booking Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0066CC',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Departure Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0066CC',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('promotions', {
      name: 'Promotions & Offers',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('price-alerts', {
      name: 'Price Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  /**
   * Request notification permissions
   * Note: Local notifications work on simulators, push notifications require physical device
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.log('Permission request warning:', (error as Error).message);
      // Return true on simulators - local notifications may still work
      return !Device.isDevice;
    }
  }

  /**
   * Check if permissions are granted
   */
  async hasPermissions(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Register for push notifications and get token
   * Note: Push notifications are not supported in Expo Go (SDK 53+)
   * Local notifications still work. Push tokens require a development build.
   */
  async registerForPushNotifications(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return null;
      }

      // Check if we're running in Expo Go (push tokens not supported in SDK 53+)
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo) {
        console.log('Push notifications not available in Expo Go. Local notifications still work.');
        return null;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.log('No EAS projectId configured. Push notifications disabled.');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      this.pushToken = token.data;
      await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token.data);

      return token.data;
    } catch (error) {
      // Silently handle - push notifications are optional
      console.log('Push notifications unavailable:', (error as Error).message);
      return null;
    }
  }

  /**
   * Get stored push token
   */
  async getPushToken(): Promise<string | null> {
    if (this.pushToken) {
      return this.pushToken;
    }
    return await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
  }

  /**
   * Get notification settings
   */
  async getSettings(): Promise<NotificationSettings> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Update notification settings
   */
  async updateSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  }

  /**
   * Send booking confirmation notification
   */
  async sendBookingConfirmation(booking: Booking): Promise<string | null> {
    const settings = await this.getSettings();
    if (!settings.enabled || !settings.bookingConfirmations) {
      return null;
    }

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Booking Confirmed! 🎉',
        body: `Your trip from ${booking.departure_port} to ${booking.arrival_port} is confirmed. Reference: ${booking.booking_reference}`,
        data: {
          type: 'booking_confirmation',
          bookingId: booking.id,
          bookingReference: booking.booking_reference,
        },
        sound: 'default',
      },
      trigger: null, // Send immediately
    });
  }

  /**
   * Schedule departure reminder notifications
   */
  async scheduleDepartureReminders(booking: Booking): Promise<string[]> {
    const settings = await this.getSettings();
    const scheduledIds: string[] = [];

    if (!settings.enabled) {
      return scheduledIds;
    }

    const departureTime = parseISO(booking.departure_time);
    const now = new Date();

    // Schedule 24-hour reminder
    if (settings.departureReminder24h) {
      const reminder24h = subHours(departureTime, 24);
      if (isBefore(now, reminder24h)) {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Departure Tomorrow! ⏰',
            body: `Your ferry from ${booking.departure_port} to ${booking.arrival_port} departs in 24 hours. Don't forget your documents!`,
            data: {
              type: 'departure_reminder_24h',
              bookingId: booking.id,
              bookingReference: booking.booking_reference,
            },
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminder24h,
          },
        });
        scheduledIds.push(id);
      }
    }

    // Schedule 2-hour reminder
    if (settings.departureReminder2h) {
      const reminder2h = subHours(departureTime, 2);
      if (isBefore(now, reminder2h)) {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Departing Soon! 🚢',
            body: `Your ferry from ${booking.departure_port} departs in 2 hours. Time to head to the port!`,
            data: {
              type: 'departure_reminder_2h',
              bookingId: booking.id,
              bookingReference: booking.booking_reference,
            },
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminder2h,
          },
        });
        scheduledIds.push(id);
      }
    }

    // Store scheduled reminder IDs for potential cancellation
    await this.storeScheduledReminders(booking.id, scheduledIds);

    return scheduledIds;
  }

  /**
   * Store scheduled reminder IDs
   */
  private async storeScheduledReminders(bookingId: number, reminderIds: string[]): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULED_REMINDERS);
      const reminders = stored ? JSON.parse(stored) : {};
      reminders[bookingId] = reminderIds;
      await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULED_REMINDERS, JSON.stringify(reminders));
    } catch (error) {
      console.error('Failed to store scheduled reminders:', error);
    }
  }

  /**
   * Cancel scheduled reminders for a booking
   */
  async cancelBookingReminders(bookingId: number): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULED_REMINDERS);
      if (!stored) return;

      const reminders = JSON.parse(stored);
      const reminderIds = reminders[bookingId] || [];

      for (const id of reminderIds) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }

      delete reminders[bookingId];
      await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULED_REMINDERS, JSON.stringify(reminders));
    } catch (error) {
      console.error('Failed to cancel booking reminders:', error);
    }
  }

  /**
   * Send price alert notification
   */
  async sendPriceAlert(
    route: { departure: string; arrival: string },
    oldPrice: number,
    newPrice: number
  ): Promise<string | null> {
    const settings = await this.getSettings();
    if (!settings.enabled || !settings.priceAlerts) {
      return null;
    }

    const priceDrop = oldPrice - newPrice;
    const percentDrop = Math.round((priceDrop / oldPrice) * 100);

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Price Drop Alert! 💰',
        body: `${route.departure} → ${route.arrival} is now €${newPrice} (${percentDrop}% off!)`,
        data: {
          type: 'price_alert',
          departure: route.departure,
          arrival: route.arrival,
          newPrice,
          oldPrice,
        },
        sound: 'default',
      },
      trigger: null,
    });
  }

  /**
   * Send promotional notification
   */
  async sendPromotion(title: string, message: string, data?: object): Promise<string | null> {
    const settings = await this.getSettings();
    if (!settings.enabled || !settings.promotions) {
      return null;
    }

    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: message,
        data: {
          type: 'promotion',
          ...data,
        },
        sound: 'default',
      },
      trigger: null,
    });
  }

  /**
   * Get all scheduled notifications
   */
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem(STORAGE_KEYS.SCHEDULED_REMINDERS);
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Clear badge
   */
  async clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
  }

  /**
   * Add notification received listener
   */
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Add notification response listener (when user taps notification)
   */
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  /**
   * Remove notification listener
   */
  removeListener(subscription: Notifications.Subscription): void {
    subscription.remove();
  }
}

export const notificationService = new NotificationService();
