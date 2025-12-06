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

import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { updateProfile } from '../store/slices/authSlice';
import { colors, spacing, borderRadius } from '../constants/theme';

interface Currency {
  code: string;
  name: string;
  symbol: string;
}

const CURRENCIES: Currency[] = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت' },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.' },
  { code: 'DZD', name: 'Algerian Dinar', symbol: 'د.ج' },
];

export default function CurrencySettingsScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  // Default to user preference or 'EUR'
  const [selectedCurrency, setSelectedCurrency] = useState(
    user?.preferred_currency || 'EUR'
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSelectCurrency = async (currencyCode: string) => {
    setSelectedCurrency(currencyCode);

    if (isAuthenticated) {
      setIsSaving(true);
      try {
        await dispatch(updateProfile({
          preferred_currency: currencyCode,
        })).unwrap();
        Alert.alert('Success', 'Currency preference saved', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } catch (error: any) {
        Alert.alert('Error', error || 'Failed to save preference');
      } finally {
        setIsSaving(false);
      }
    } else {
      // For non-authenticated users, just navigate back
      // TODO: Store in AsyncStorage for guest users
      const currency = CURRENCIES.find(c => c.code === currencyCode);
      Alert.alert('Currency Selected', `${currency?.name} (${currency?.symbol}) selected`, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            Choose your preferred currency for displaying prices. Actual payment currency may vary by operator.
          </Text>
        </View>

        {/* Currency List */}
        <View style={styles.currencyList}>
          {CURRENCIES.map((currency) => (
            <TouchableOpacity
              key={currency.code}
              style={[
                styles.currencyItem,
                selectedCurrency === currency.code && styles.currencyItemSelected,
              ]}
              onPress={() => handleSelectCurrency(currency.code)}
              disabled={isSaving}
            >
              <View style={styles.currencySymbol}>
                <Text style={styles.symbolText}>{currency.symbol}</Text>
              </View>
              <View style={styles.currencyInfo}>
                <Text style={styles.currencyName}>{currency.name}</Text>
                <Text style={styles.currencyCode}>{currency.code}</Text>
              </View>
              {selectedCurrency === currency.code ? (
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

        {/* Note */}
        <View style={styles.noteSection}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.noteText}>
            {isAuthenticated
              ? 'Your currency preference will be used as the default when viewing prices.'
              : 'Sign in to save your currency preference across devices.'
            }
          </Text>
        </View>
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
  currencyList: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  currencyItemSelected: {
    backgroundColor: `${colors.primary}10`,
  },
  currencySymbol: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  symbolText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  currencyCode: {
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
