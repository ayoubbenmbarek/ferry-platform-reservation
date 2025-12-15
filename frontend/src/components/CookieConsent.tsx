import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export interface CookiePreferences {
  essential: boolean; // Always true, can't be disabled
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
}

const COOKIE_CONSENT_KEY = 'voilaferry_cookie_consent';

export const getStoredCookiePreferences = (): CookiePreferences | null => {
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading cookie preferences:', e);
  }
  return null;
};

export const setCookiePreferences = (preferences: CookiePreferences): void => {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(preferences));
    // Dispatch event for other components to react
    window.dispatchEvent(new CustomEvent('cookiePreferencesChanged', { detail: preferences }));
  } catch (e) {
    console.error('Error saving cookie preferences:', e);
  }
};

const CookieConsent: React.FC = () => {
  const { t } = useTranslation('common');
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    functional: true,
    analytics: false,
    marketing: false,
    timestamp: 0,
  });

  useEffect(() => {
    const stored = getStoredCookiePreferences();
    if (!stored) {
      // No consent given yet, show banner
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const newPreferences: CookiePreferences = {
      essential: true,
      functional: true,
      analytics: true,
      marketing: true,
      timestamp: Date.now(),
    };
    setCookiePreferences(newPreferences);
    setIsVisible(false);
  };

  const handleRejectNonEssential = () => {
    const newPreferences: CookiePreferences = {
      essential: true,
      functional: false,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
    };
    setCookiePreferences(newPreferences);
    setIsVisible(false);
  };

  const handleSavePreferences = () => {
    const newPreferences: CookiePreferences = {
      ...preferences,
      essential: true, // Always required
      timestamp: Date.now(),
    };
    setCookiePreferences(newPreferences);
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        {!showDetails ? (
          // Simple banner view
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-gray-700">
                {t('cookies.banner.message', 'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.')}{' '}
                <Link to="/cookie-policy" className="text-blue-600 hover:underline">
                  {t('cookies.banner.learnMore', 'Learn more')}
                </Link>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowDetails(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                {t('cookies.banner.customize', 'Customize')}
              </button>
              <button
                onClick={handleRejectNonEssential}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                {t('cookies.banner.rejectAll', 'Reject Non-Essential')}
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                {t('cookies.banner.acceptAll', 'Accept All')}
              </button>
            </div>
          </div>
        ) : (
          // Detailed preferences view
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('cookies.preferences.title', 'Cookie Preferences')}
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Essential Cookies */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">
                    {t('cookies.preferences.essential.title', 'Essential Cookies')}
                  </h4>
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                    {t('cookies.preferences.alwaysOn', 'Always On')}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {t('cookies.preferences.essential.description', 'Required for the website to function. Cannot be disabled.')}
                </p>
              </div>

              {/* Functional Cookies */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">
                    {t('cookies.preferences.functional.title', 'Functional Cookies')}
                  </h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.functional}
                      onChange={(e) => setPreferences({ ...preferences, functional: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-sm text-gray-600">
                  {t('cookies.preferences.functional.description', 'Remember your preferences like language and recent searches.')}
                </p>
              </div>

              {/* Analytics Cookies */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">
                    {t('cookies.preferences.analytics.title', 'Analytics Cookies')}
                  </h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-sm text-gray-600">
                  {t('cookies.preferences.analytics.description', 'Help us understand how visitors use our website.')}
                </p>
              </div>

              {/* Marketing Cookies */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">
                    {t('cookies.preferences.marketing.title', 'Marketing Cookies')}
                  </h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-sm text-gray-600">
                  {t('cookies.preferences.marketing.description', 'Used to show relevant advertisements.')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                onClick={handleRejectNonEssential}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                {t('cookies.banner.rejectAll', 'Reject Non-Essential')}
              </button>
              <button
                onClick={handleSavePreferences}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                {t('cookies.preferences.save', 'Save Preferences')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CookieConsent;
