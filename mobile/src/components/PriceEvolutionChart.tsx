import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { colors, spacing, borderRadius } from '../constants/theme';
import { pricingService, PriceHistoryData, PriceHistoryPoint } from '../services/pricingService';

interface PriceEvolutionChartProps {
  departurePort: string;
  arrivalPort: string;
  days?: number;
}

const PERIOD_OPTIONS = [7, 14, 30, 60];

export default function PriceEvolutionChart({
  departurePort,
  arrivalPort,
  days = 30,
}: PriceEvolutionChartProps) {
  const [historyData, setHistoryData] = useState<PriceHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(days);

  const fetchData = useCallback(async () => {
    if (!departurePort || !arrivalPort) return;

    setLoading(true);
    setError(null);

    try {
      const data = await pricingService.getPriceHistory({
        departurePort,
        arrivalPort,
        days: selectedPeriod,
      });
      setHistoryData(data);
    } catch (err: any) {
      console.error('Failed to fetch price history:', err);
      setError(err.response?.data?.detail || 'Failed to load price history');
    } finally {
      setLoading(false);
    }
  }, [departurePort, arrivalPort, selectedPeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTrendColor = (trend: string): string => {
    switch (trend) {
      case 'rising':
        return '#EF4444';
      case 'falling':
        return '#22C55E';
      default:
        return '#6B7280';
    }
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'rising':
        return 'trending-up';
      case 'falling':
        return 'trending-down';
      default:
        return 'remove';
    }
  };

  // Simple chart rendering
  const renderSimpleChart = () => {
    if (!historyData || historyData.history.length === 0) return null;

    const screenWidth = Dimensions.get('window').width - spacing.md * 4;
    const chartHeight = 150;
    const prices = historyData.history.map((p) => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    // Calculate points for the line
    const points = historyData.history.map((point, index) => {
      const x = (index / (historyData.history.length - 1)) * screenWidth;
      const y = chartHeight - ((point.price - minPrice) / priceRange) * chartHeight;
      return { x, y, price: point.price, date: point.date };
    });

    return (
      <View style={styles.chartContainer}>
        {/* Y-axis labels */}
        <View style={styles.yAxisLabels}>
          <Text style={styles.axisLabel}>{maxPrice.toFixed(0)}€</Text>
          <Text style={styles.axisLabel}>{((maxPrice + minPrice) / 2).toFixed(0)}€</Text>
          <Text style={styles.axisLabel}>{minPrice.toFixed(0)}€</Text>
        </View>

        {/* Chart area */}
        <View style={[styles.chartArea, { height: chartHeight }]}>
          {/* Grid lines */}
          <View style={[styles.gridLine, { top: 0 }]} />
          <View style={[styles.gridLine, { top: chartHeight / 2 }]} />
          <View style={[styles.gridLine, { top: chartHeight - 1 }]} />

          {/* Price bars */}
          <View style={styles.barsContainer}>
            {historyData.history.map((point, index) => {
              const height = Math.max(4, ((point.price - minPrice) / priceRange) * chartHeight);
              const isLowest = point.lowest && point.price === point.lowest;
              const isHighest = point.highest && point.price === point.highest;

              return (
                <View
                  key={index}
                  style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor: isLowest ? '#22C55E' : isHighest ? '#EF4444' : '#3B82F6',
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        {/* X-axis labels */}
        <View style={styles.xAxisLabels}>
          {historyData.history.length > 0 && (
            <>
              <Text style={styles.axisLabel}>
                {format(parseISO(historyData.history[0].date), 'MMM dd')}
              </Text>
              <Text style={styles.axisLabel}>
                {format(parseISO(historyData.history[historyData.history.length - 1].date), 'MMM dd')}
              </Text>
            </>
          )}
        </View>
      </View>
    );
  };

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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Price Evolution</Text>

        {/* Period selector */}
        <View style={styles.periodSelector}>
          {PERIOD_OPTIONS.map((period) => (
            <TouchableOpacity
              key={period}
              style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === period && styles.periodButtonTextActive,
                ]}
              >
                {period}d
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Chart */}
      {renderSimpleChart()}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
          <Text style={styles.legendText}>Lowest</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
          <Text style={styles.legendText}>Average</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendText}>Highest</Text>
        </View>
      </View>

      {/* Statistics */}
      {historyData && (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Average</Text>
            <Text style={styles.statValue}>{historyData.average_price}€</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#DCFCE7' }]}>
            <Text style={[styles.statLabel, { color: '#16A34A' }]}>Period Low</Text>
            <Text style={[styles.statValue, { color: '#166534' }]}>{historyData.min_price}€</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.statLabel, { color: '#DC2626' }]}>Period High</Text>
            <Text style={[styles.statValue, { color: '#991B1B' }]}>{historyData.max_price}€</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Trend</Text>
            <View style={styles.trendContainer}>
              <Ionicons
                name={getTrendIcon(historyData.trend) as any}
                size={18}
                color={getTrendColor(historyData.trend)}
              />
              <Text style={[styles.trendText, { color: getTrendColor(historyData.trend) }]}>
                {historyData.trend.charAt(0).toUpperCase() + historyData.trend.slice(1)}
              </Text>
            </View>
          </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  periodSelector: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    overflow: 'hidden',
  },
  periodButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: '#fff',
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
  },
  periodButtonText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  periodButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  chartContainer: {
    padding: spacing.md,
    flexDirection: 'row',
  },
  yAxisLabels: {
    width: 40,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: spacing.xs,
  },
  chartArea: {
    flex: 1,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '100%',
    paddingHorizontal: 2,
  },
  bar: {
    flex: 1,
    marginHorizontal: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    minWidth: 2,
    maxWidth: 8,
  },
  xAxisLabels: {
    position: 'absolute',
    bottom: -20,
    left: 40,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  axisLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  trendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    height: 250,
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
