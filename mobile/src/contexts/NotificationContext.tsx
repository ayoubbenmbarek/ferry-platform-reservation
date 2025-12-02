import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { notificationService, NotificationSettings } from '../services/notificationService';
import { authService } from '../services/authService';
import { useAppSelector } from '../hooks/useAppDispatch';
import { RootStackParamList } from '../types';

interface NotificationContextType {
  isInitialized: boolean;
  hasPermission: boolean;
  pushToken: string | null;
  settings: NotificationSettings;
  requestPermissions: () => Promise<boolean>;
  updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    bookingConfirmations: true,
    departureReminder24h: true,
    departureReminder2h: true,
    priceAlerts: true,
    promotions: false,
  });

  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  // Register push token with backend
  const registerTokenWithBackend = useCallback(async (token: string | null) => {
    if (token && isAuthenticated) {
      try {
        await authService.registerPushToken(token);
      } catch (error) {
        console.log('Failed to register push token with backend:', error);
      }
    }
  }, [isAuthenticated]);

  // Initialize notifications
  useEffect(() => {
    const init = async () => {
      const initialized = await notificationService.initialize();
      setIsInitialized(true);
      setHasPermission(initialized);

      if (initialized) {
        const token = await notificationService.getPushToken();
        setPushToken(token);
        // Register with backend if user is authenticated
        if (token && isAuthenticated) {
          registerTokenWithBackend(token);
        }
      }

      const storedSettings = await notificationService.getSettings();
      setSettings(storedSettings);
    };

    init();
  }, []);

  // Re-register token when user logs in
  useEffect(() => {
    if (isAuthenticated && pushToken) {
      registerTokenWithBackend(pushToken);
    }
  }, [isAuthenticated, pushToken, registerTokenWithBackend]);

  // Setup notification listeners
  useEffect(() => {
    // Handle notification received while app is foregrounded
    notificationListener.current = notificationService.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
      }
    );

    // Handle notification tap
    responseListener.current = notificationService.addNotificationResponseListener(
      (response) => {
        const data = response.notification.request.content.data;
        handleNotificationTap(data);
      }
    );

    return () => {
      if (notificationListener.current) {
        notificationService.removeListener(notificationListener.current);
      }
      if (responseListener.current) {
        notificationService.removeListener(responseListener.current);
      }
    };
  }, []);

  const handleNotificationTap = useCallback((data: any) => {
    if (!data) return;

    switch (data.type) {
      case 'booking_confirmation':
      case 'departure_reminder_24h':
      case 'departure_reminder_2h':
        if (data.bookingId) {
          navigation.navigate('BookingDetails', { bookingId: data.bookingId });
        }
        break;
      case 'availability_alert':
        // Navigate to AddCabin screen if booking_id exists, otherwise to MyAlerts
        if (data.booking_id && data.alert_id) {
          navigation.navigate('AddCabin', {
            bookingId: data.booking_id,
            alertId: data.alert_id,
            alertType: data.alert_type || 'cabin',
          });
        } else {
          navigation.navigate('MyAlerts');
        }
        break;
      case 'price_alert':
        // Navigate to saved routes to see the price change
        if (data.alert_id) {
          navigation.navigate('SavedRoutes');
        } else {
          navigation.navigate('SavedRoutes');
        }
        break;
      case 'promotion':
        // Navigate to home or specific promo
        navigation.navigate('Main');
        break;
      default:
        break;
    }
  }, [navigation]);

  const requestPermissions = useCallback(async () => {
    const granted = await notificationService.requestPermissions();
    setHasPermission(granted);
    if (granted) {
      const token = await notificationService.registerForPushNotifications();
      setPushToken(token);
      // Register token with backend
      if (token) {
        registerTokenWithBackend(token);
      }
    }
    return granted;
  }, [registerTokenWithBackend]);

  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    const updated = await notificationService.updateSettings(newSettings);
    setSettings(updated);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        isInitialized,
        hasPermission,
        pushToken,
        settings,
        requestPermissions,
        updateSettings,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
