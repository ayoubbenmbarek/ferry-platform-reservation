import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Get extra config from app.config.js
const extra = Constants.expoConfig?.extra || {};

// Get the local IP for development
// For iOS simulator, use localhost
// For Android emulator, use 10.0.2.2
// For physical devices, use your computer's local IP
const getDevApiUrl = () => {
  // First try to auto-detect from Expo host (works for physical devices)
  const hostUri = Constants.expoConfig?.hostUri;
  const debuggerHost = hostUri?.split(':')[0];

  if (debuggerHost && debuggerHost !== 'localhost') {
    const url = `http://${debuggerHost}:8010/api/v1`;
    console.log('[Config] Auto-detected API URL from Expo host:', url);
    return url;
  }

  // Check if API_BASE_URL is explicitly set in env (and not empty)
  if (extra.apiBaseUrl && extra.apiBaseUrl.length > 0) {
    console.log('[Config] Using API_BASE_URL from env:', extra.apiBaseUrl);
    return extra.apiBaseUrl;
  }

  // Fallback for different platforms
  if (Platform?.OS === 'android') {
    // Android emulator uses 10.0.2.2 to access host machine
    console.log('[Config] Using Android emulator URL: 10.0.2.2');
    return 'http://10.0.2.2:8010/api/v1';
  }

  // iOS simulator can use localhost
  console.log('[Config] Using iOS simulator localhost');
  return 'http://localhost:8010/api/v1';
};

// API Configuration
export const API_BASE_URL = __DEV__
  ? getDevApiUrl()
  : 'https://api.voilaferry.com/api/v1';

// Stripe Configuration
export const STRIPE_PUBLISHABLE_KEY = extra.stripePublishableKey || (__DEV__
  ? 'pk_test_your_test_key'
  : 'pk_live_your_live_key');

// Google OAuth - loaded from environment variables via app.config.js
export const GOOGLE_CLIENT_ID = extra.googleClientId || '';
export const GOOGLE_IOS_CLIENT_ID = extra.googleIosClientId || extra.googleClientId || '';
export const GOOGLE_ANDROID_CLIENT_ID = extra.googleAndroidClientId || extra.googleClientId || '';

// Chatbot Configuration
const getChatbotUrl = () => {
  // Check if explicitly set in env
  if (extra.chatbotApiUrl && extra.chatbotApiUrl.length > 0) {
    return extra.chatbotApiUrl;
  }

  // Auto-detect from Expo host (similar to API URL)
  const hostUri = Constants.expoConfig?.hostUri;
  const debuggerHost = hostUri?.split(':')[0];

  if (__DEV__ && debuggerHost && debuggerHost !== 'localhost') {
    return `http://${debuggerHost}:3100`;
  }

  // Fallback for different platforms in dev
  if (__DEV__) {
    if (Platform?.OS === 'android') {
      return 'http://10.0.2.2:3100';
    }
    return 'http://localhost:3100';
  }

  return 'https://chatbot.voilaferry.com';
};

export const CHATBOT_API_URL = getChatbotUrl();

// App Constants
export const APP_NAME = 'Maritime Reservations';
export const BOOKING_EXPIRY_MINUTES = 15;

// Cancellation Protection
export const CANCELLATION_PROTECTION_PRICE = 15;
export const CANCELLATION_RESTRICTION_DAYS = 7;
