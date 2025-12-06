import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supportedLanguages, changeLanguage as i18nChangeLanguage } from '../i18n';

interface LanguageContextType {
  currentLanguage: string;
  isRTL: boolean;
  changeLanguage: (languageCode: string) => Promise<void>;
  supportedLanguages: typeof supportedLanguages;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const RTL_LANGUAGES = ['ar', 'he'];

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'en');
  const [isLoading, setIsLoading] = useState(false);

  // Sync with i18n language changes
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setCurrentLanguage(lng);

      // Handle RTL for Arabic
      const shouldBeRTL = RTL_LANGUAGES.includes(lng);
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.allowRTL(shouldBeRTL);
        I18nManager.forceRTL(shouldBeRTL);
        // Note: RTL changes require app restart to take full effect
      }
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  const changeLanguage = async (languageCode: string): Promise<void> => {
    if (languageCode === currentLanguage) return;

    setIsLoading(true);
    try {
      await i18nChangeLanguage(languageCode);
      setCurrentLanguage(languageCode);
    } catch (error) {
      console.error('Error changing language:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const isRTL = RTL_LANGUAGES.includes(currentLanguage);

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        isRTL,
        changeLanguage,
        supportedLanguages,
        isLoading,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
