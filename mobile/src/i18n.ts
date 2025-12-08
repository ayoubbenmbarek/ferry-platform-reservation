import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import English translations
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enBooking from './locales/en/booking.json';
import enSearch from './locales/en/search.json';
import enPayment from './locales/en/payment.json';
import enProfile from './locales/en/profile.json';

// Import French translations
import frCommon from './locales/fr/common.json';
import frAuth from './locales/fr/auth.json';
import frBooking from './locales/fr/booking.json';
import frSearch from './locales/fr/search.json';
import frPayment from './locales/fr/payment.json';
import frProfile from './locales/fr/profile.json';

// Import Arabic translations
import arCommon from './locales/ar/common.json';
import arAuth from './locales/ar/auth.json';
import arBooking from './locales/ar/booking.json';
import arSearch from './locales/ar/search.json';
import arPayment from './locales/ar/payment.json';
import arProfile from './locales/ar/profile.json';

// Import Italian translations
import itCommon from './locales/it/common.json';
import itAuth from './locales/it/auth.json';
import itBooking from './locales/it/booking.json';
import itSearch from './locales/it/search.json';
import itPayment from './locales/it/payment.json';
import itProfile from './locales/it/profile.json';

// Import German translations
import deCommon from './locales/de/common.json';
import deAuth from './locales/de/auth.json';
import deBooking from './locales/de/booking.json';
import deSearch from './locales/de/search.json';
import dePayment from './locales/de/payment.json';
import deProfile from './locales/de/profile.json';

const LANGUAGE_KEY = '@app_language';

export const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    booking: enBooking,
    search: enSearch,
    payment: enPayment,
    profile: enProfile,
  },
  fr: {
    common: frCommon,
    auth: frAuth,
    booking: frBooking,
    search: frSearch,
    payment: frPayment,
    profile: frProfile,
  },
  ar: {
    common: arCommon,
    auth: arAuth,
    booking: arBooking,
    search: arSearch,
    payment: arPayment,
    profile: arProfile,
  },
  it: {
    common: itCommon,
    auth: itAuth,
    booking: itBooking,
    search: itSearch,
    payment: itPayment,
    profile: itProfile,
  },
  de: {
    common: deCommon,
    auth: deAuth,
    booking: deBooking,
    search: deSearch,
    payment: dePayment,
    profile: deProfile,
  },
};

export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
];

// Language detector that reads from AsyncStorage
const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lng: string) => void) => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (savedLanguage) {
        callback(savedLanguage);
        return;
      }
    } catch (error) {
      console.log('Error reading language from AsyncStorage:', error);
    }
    callback('en'); // Default to English
  },
  init: () => {},
  cacheUserLanguage: async (lng: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lng);
    } catch (error) {
      console.log('Error saving language to AsyncStorage:', error);
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'booking', 'search', 'payment', 'profile'],
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for React Native
    },
  });

export default i18n;

// Helper function to change language and persist to storage
export const changeLanguage = async (languageCode: string): Promise<void> => {
  await i18n.changeLanguage(languageCode);
  await AsyncStorage.setItem(LANGUAGE_KEY, languageCode);
};

// Helper function to get current language
export const getCurrentLanguage = (): string => {
  return i18n.language || 'en';
};
