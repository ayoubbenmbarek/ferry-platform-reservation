import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../constants/theme';
import FareCalendar from './FareCalendar';
import PriceInsightsComponent from './PriceInsights';
import PriceEvolutionChart from './PriceEvolutionChart';
import FlexibleDatesSearch from './FlexibleDatesSearch';

interface SmartPricingPanelProps {
  departurePort: string;
  arrivalPort: string;
  departureDate?: string;
  passengers?: number;
  onDateSelect?: (date: string, price: number) => void;
  compact?: boolean;
}

type ViewMode = 'calendar' | 'chart' | 'insights' | 'flexible';

export default function SmartPricingPanel({
  departurePort,
  arrivalPort,
  departureDate,
  passengers = 1,
  onDateSelect,
  compact = false,
}: SmartPricingPanelProps) {
  const [selectedDate, setSelectedDate] = useState<string | undefined>(departureDate);
  const [activeView, setActiveView] = useState<ViewMode>('calendar');

  const handleDateSelect = (date: string, price: number) => {
    setSelectedDate(date);
    onDateSelect?.(date, price);
  };

  if (!departurePort || !arrivalPort) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="map-outline" size={48} color="#D1D5DB" />
        <Text style={styles.emptyText}>
          Select departure and arrival ports to see pricing insights
        </Text>
      </View>
    );
  }

  if (compact) {
    return (
      <FareCalendar
        departurePort={departurePort}
        arrivalPort={arrivalPort}
        passengers={passengers}
        onDateSelect={handleDateSelect}
        selectedDate={selectedDate}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="analytics" size={20} color={colors.primary} />
          <Text style={styles.headerTitle}>Smart Pricing</Text>
        </View>
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI-Powered</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeView === 'calendar' && styles.tabActive]}
            onPress={() => setActiveView('calendar')}
          >
            <Ionicons
              name="calendar"
              size={16}
              color={activeView === 'calendar' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeView === 'calendar' && styles.tabTextActive]}>
              Calendar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeView === 'chart' && styles.tabActive]}
            onPress={() => setActiveView('chart')}
          >
            <Ionicons
              name="trending-up"
              size={16}
              color={activeView === 'chart' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeView === 'chart' && styles.tabTextActive]}>
              Price Trend
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeView === 'insights' && styles.tabActive]}
            onPress={() => setActiveView('insights')}
          >
            <Ionicons
              name="bulb"
              size={16}
              color={activeView === 'insights' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeView === 'insights' && styles.tabTextActive]}>
              AI Insights
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeView === 'flexible' && styles.tabActive]}
            onPress={() => setActiveView('flexible')}
          >
            <Ionicons
              name="swap-horizontal"
              size={16}
              color={activeView === 'flexible' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeView === 'flexible' && styles.tabTextActive]}>
              Flexible
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeView === 'calendar' && (
          <FareCalendar
            departurePort={departurePort}
            arrivalPort={arrivalPort}
            passengers={passengers}
            onDateSelect={handleDateSelect}
            selectedDate={selectedDate}
          />
        )}

        {activeView === 'chart' && (
          <PriceEvolutionChart
            departurePort={departurePort}
            arrivalPort={arrivalPort}
            days={30}
          />
        )}

        {activeView === 'insights' && (
          <PriceInsightsComponent
            departurePort={departurePort}
            arrivalPort={arrivalPort}
            departureDate={selectedDate}
            passengers={passengers}
          />
        )}

        {activeView === 'flexible' && (
          <FlexibleDatesSearch
            departurePort={departurePort}
            arrivalPort={arrivalPort}
            departureDate={selectedDate}
            passengers={passengers}
            onDateSelect={handleDateSelect}
          />
        )}
      </ScrollView>

      {/* Footer tip */}
      <View style={styles.footer}>
        <Ionicons name="information-circle" size={16} color="#1E40AF" />
        <Text style={styles.footerText}>
          {activeView === 'calendar' && 'Tap on a date to see available ferries'}
          {activeView === 'chart' && 'See how prices have changed over time'}
          {activeView === 'insights' && 'AI analyzes patterns for smart advice'}
          {activeView === 'flexible' && 'Explore nearby dates for best deals'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  emptyContainer: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  aiBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  tabsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabs: {
    flexDirection: 'row',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    backgroundColor: '#EFF6FF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  content: {
    padding: spacing.md,
    maxHeight: 500,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE',
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
  },
});
