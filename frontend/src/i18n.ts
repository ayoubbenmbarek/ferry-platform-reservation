import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

i18n
  // Load translations using http (from public/locales folder)
  .use(HttpBackend)
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',

    // Supported languages
    supportedLngs: ['en', 'fr', 'ar', 'it', 'de'],

    // Language detection order
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie'],
      lookupQuerystring: 'lang',
      lookupCookie: 'i18next',
      lookupLocalStorage: 'i18nextLng',
    },

    // Namespaces for organizing translations
    ns: ['common', 'search', 'booking', 'payment', 'auth', 'profile', 'admin'],
    defaultNS: 'common',

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    react: {
      useSuspense: false, // Disable suspense to prevent hard crashes on translation loading failures
    },

    // Don't throw on missing keys, return the key itself
    saveMissing: false,
    returnNull: false,
    returnEmptyString: false,
  });

export default i18n;
