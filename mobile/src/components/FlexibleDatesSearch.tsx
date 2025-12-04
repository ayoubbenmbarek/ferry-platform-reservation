import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { colors, spacing, borderRadius } from '../constants/theme';
import { pricingService, FlexibleSearchResult, FlexibleDateOption } from '../services/pricingService';

interface FlexibleDatesSearchProps {
  departurePort: string;
  arrivalPort: string;
  departureDate?: string;
  passengers?: number;
  onDateSelect?: (date: string, price: number) => void;
}

const FLEXIBILITY_OPTIONS = [1, 2, 3, 5, 7];

export default function FlexibleDatesSearch({
  departurePort,
  arrivalPort,
  departureDate,
  passengers = 1,
  onDateSelect,
}: FlexibleDatesSearchProps) {
  const [searchResult, setSearchResult] = useState<FlexibleSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flexibility, setFlexibility] = useState(3);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!departurePort || !arrivalPort || !departureDate) return;

    setLoading(true);
    setError(null);

    try {
      const data = await pricingService.getFlexibleSearch({
        departurePort,
        arrivalPort,
        departureDate,
        flexibilityDays: flexibility,
        passengers,
      });
      setSearchResult(data);
    } catch (err: any) {
      console.error('Failed to fetch flexible dates:', err);
      setError(err.response?.data?.detail || 'Failed to load flexible dates');
    } finally {
      setLoading(false);
    }
  }, [departurePort, arrivalPort, departureDate, flexibility, passengers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDateSelect = (option: FlexibleDateOption) => {
    setSelectedDate(option.date);
    onDateSelect?.(option.date, option.price);
  };

  const formatDate = (dateStr: string): string => {
    return format(parseISO(dateStr), 'EEE, MMM dd');
  };

  const getPriceChangeColor = (diff: number): string => {
    if (diff < 0) return '#22C55E';
    if (diff > 0) return '#EF4444';
    return '#6B7280';
  };

  if (!departureDate) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>Select a departure date first</Text>
          <Text style={styles.emptyHint}>Go to the Calendar tab and tap on a date</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchData}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const potentialSavings =
    searchResult?.selected_price && searchResult.cheapest_price < searchResult.selected_price
      ? searchResult.selected_price - searchResult.cheapest_price
      : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Flexible Dates</Text>
          <Text style={styles.headerSubtitle}>Compare prices around your selected date</Text>
        </View>

        {/* Flexibility selector */}
        <View style={styles.flexibilitySelector}>
          <Text style={styles.flexibilityLabel}>+/-</Text>
          <View style={styles.flexibilityButtons}>
            {FLEXIBILITY_OPTIONS.map((days) => (
              <TouchableOpacity
                key={days}
                style={[styles.flexButton, flexibility === days && styles.flexButtonActive]}
                onPress={() => setFlexibility(days)}
              >
                <Text
                  style={[styles.flexButtonText, flexibility === days && styles.flexButtonTextActive]}
                >
                  {days}d
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Savings Banner */}
      {potentialSavings > 0 && (
        <View style={styles.savingsBanner}>
          <Ionicons name="cash-outline" size={20} color="#16A34A" />
          <Text style={styles.savingsText}>
            Save up to <Text style={styles.savingsAmount}>{potentialSavings.toFixed(2)}€</Text> by
            choosing a different date!
          </Text>
        </View>
      )}

      {/* Options List */}
      {searchResult && (
        <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
          {searchResult.results.map((option) => (
            <TouchableOpacity
              key={option.date}
              style={[
                styles.optionItem,
                selectedDate === option.date && styles.optionItemSelected,
                option.is_cheapest && styles.optionItemCheapest,
              ]}
              onPress={() => handleDateSelect(option)}
            >
              <View style={styles.optionLeft}>
                <View style={styles.optionDateRow}>
                  <Text style={styles.optionDate}>{formatDate(option.date)}</Text>
                  {option.is_cheapest && (
                    <View style={styles.cheapestBadge}>
                      <Text style={styles.cheapestBadgeText}>Cheapest</Text>
                    </View>
                  )}
                  {option.is_selected && (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>Selected</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.optionFerries}>{option.num_ferries} ferries available</Text>
              </View>

              <View style={styles.optionRight}>
                <Text
                  style={[styles.optionPrice, option.is_cheapest && { color: '#16A34A' }]}
                >
                  {option.price}€
                </Text>
                {option.savings_vs_selected !== 0 && (
                  <Text
                    style={[
                      styles.optionSavings,
                      { color: getPriceChangeColor(-option.savings_vs_selected) },
                    ]}
                  >
                    {option.savings_vs_selected > 0 ? 'Save ' : '+'}
                    {Math.abs(option.savings_vs_selected).toFixed(2)}€
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Footer */}
      {searchResult?.selected_price && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Selected: {searchResult.selected_price}€ | Cheapest: {searchResult.cheapest_price}€
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  flexibilitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  flexibilityLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  flexibilityButtons: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    overflow: 'hidden',
  },
  flexButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: '#fff',
  },
  flexButtonActive: {
    backgroundColor: colors.primary,
  },
  flexButtonText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  flexButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: '#DCFCE7',
    borderBottomWidth: 1,
    borderBottomColor: '#BBF7D0',
  },
  savingsText: {
    flex: 1,
    fontSize: 13,
    color: '#166534',
  },
  savingsAmount: {
    fontWeight: '700',
  },
  optionsList: {
    maxHeight: 300,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  optionItemCheapest: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 3,
    borderLeftColor: '#22C55E',
  },
  optionLeft: {
    flex: 1,
  },
  optionDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  optionDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  cheapestBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  cheapestBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#166534',
  },
  selectedBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  selectedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1E40AF',
  },
  optionFerries: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  optionRight: {
    alignItems: 'flex-end',
  },
  optionPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  optionSavings: {
    fontSize: 11,
    marginTop: 2,
  },
  footer: {
    padding: spacing.sm,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyHint: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
    fontSize: 12,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  errorText: {
    color: '#EF4444',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  retryText: {
    color: colors.primary,
    fontWeight: '600',
  },
});
