import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { supportedLanguages } from '../i18n';

interface LanguageContextType {
  currentLanguage: string;
  isRTL: boolean;
  changeLanguage: (languageCode: string) => Promise<void>;
  supportedLanguages: typeof supportedLanguages;
  isLoading: boolean;
  languageVersion: number; // For forcing re-renders
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const RTL_LANGUAGES = ['ar', 'he'];

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'en');
  const [isLoading, setIsLoading] = useState(false);
  const [languageVersion, setLanguageVersion] = useState(0);

  // Sync with i18n language changes
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      console.log('Language changed to:', lng);
      setCurrentLanguage(lng);
      // Increment version to trigger re-renders
      setLanguageVersion(v => v + 1);

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
  }, []);

  const changeLanguage = useCallback(async (languageCode: string): Promise<void> => {
    if (languageCode === currentLanguage) return;

    setIsLoading(true);
    try {
      console.log('Changing language from', currentLanguage, 'to', languageCode);
      // Change i18n language
      await i18n.changeLanguage(languageCode);
      // Also save to AsyncStorage
      await AsyncStorage.setItem('@app_language', languageCode);
      // Update state
      setCurrentLanguage(languageCode);
      // Force re-render
      setLanguageVersion(v => v + 1);
      console.log('Language changed successfully to:', languageCode);
    } catch (error) {
      console.error('Error changing language:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [currentLanguage]);

  const isRTL = RTL_LANGUAGES.includes(currentLanguage);

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        isRTL,
        changeLanguage,
        supportedLanguages,
        isLoading,
        languageVersion,
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
