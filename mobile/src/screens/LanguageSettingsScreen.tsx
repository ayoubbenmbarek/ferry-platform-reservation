import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { updateProfile } from '../store/slices/authSlice';
import { useLanguage } from '../contexts/LanguageContext';
import { colors, spacing, borderRadius } from '../constants/theme';

export default function LanguageSettingsScreen() {
  const { t } = useTranslation(['common', 'profile']);
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { currentLanguage, changeLanguage, supportedLanguages } = useLanguage();

  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);
  const [isSaving, setIsSaving] = useState(false);

  const handleSelectLanguage = async (languageCode: string) => {
    if (languageCode === selectedLanguage) return;

    setSelectedLanguage(languageCode);
    setIsSaving(true);

    try {
      // Change app language immediately
      await changeLanguage(languageCode);

      // If authenticated, also save to server
      if (isAuthenticated) {
        await dispatch(updateProfile({
          preferred_language: languageCode,
        })).unwrap();
      }

      const language = supportedLanguages.find(l => l.code === languageCode);
      Alert.alert(
        t('common:common.success'),
        `${language?.name} selected`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert(t('common:common.error'), error || 'Failed to save preference');
      // Revert selection on error
      setSelectedLanguage(currentLanguage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            Choose your preferred language for the app interface and communications.
          </Text>
        </View>

        {/* Language List */}
        <View style={styles.languageList}>
          {supportedLanguages.map((language) => (
            <TouchableOpacity
              key={language.code}
              style={[
                styles.languageItem,
                selectedLanguage === language.code && styles.languageItemSelected,
              ]}
              onPress={() => handleSelectLanguage(language.code)}
              disabled={isSaving}
            >
              <Text style={styles.flag}>{language.flag}</Text>
              <View style={styles.languageInfo}>
                <Text style={styles.languageName}>{language.name}</Text>
                <Text style={styles.languageNative}>{language.nativeName}</Text>
              </View>
              {selectedLanguage === language.code ? (
                isSaving ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </View>
                )
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        {/* Note for guests */}
        {!isAuthenticated && (
          <View style={styles.noteSection}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.noteText}>
              Sign in to save your language preference across devices.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  infoSection: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  languageList: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  languageItemSelected: {
    backgroundColor: `${colors.primary}10`,
  },
  flag: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  languageNative: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
