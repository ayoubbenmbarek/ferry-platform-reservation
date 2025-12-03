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
import { colors, spacing, borderRadius } from '../constants/theme';
import {
  pricingService,
  PricePrediction,
  RouteInsights,
} from '../services/pricingService';

interface PriceInsightsProps {
  departurePort: string;
  arrivalPort: string;
  departureDate?: string;
  passengers?: number;
}

type TabType = 'prediction' | 'insights';

export default function PriceInsightsComponent({
  departurePort,
  arrivalPort,
  departureDate,
  passengers = 1,
}: PriceInsightsProps) {
  const [prediction, setPrediction] = useState<PricePrediction | null>(null);
  const [insights, setInsights] = useState<RouteInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('prediction');

  const fetchData = useCallback(async () => {
    if (!departurePort || !arrivalPort) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch insights for the route
      const insightsData = await pricingService.getRouteInsights({
        departurePort,
        arrivalPort,
      });
      setInsights(insightsData);

      // If a date is selected, fetch prediction for that date
      if (departureDate) {
        const predictionData = await pricingService.getPrediction({
          departurePort,
          arrivalPort,
          departureDate,
          passengers,
        });
        setPrediction(predictionData);
      }
    } catch (err: any) {
      console.error('Failed to fetch price insights:', err);
      setError(err.response?.data?.detail || 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, [departurePort, arrivalPort, departureDate, passengers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getRecommendationStyle = (recommendation: string) => {
    switch (recommendation) {
      case 'great_deal':
        return { bg: '#DCFCE7', text: '#166534', icon: 'checkmark-circle' as const };
      case 'book_now':
        return { bg: '#DBEAFE', text: '#1E40AF', icon: 'flash' as const };
      case 'wait':
        return { bg: '#FEF3C7', text: '#92400E', icon: 'time' as const };
      default:
        return { bg: '#F3F4F6', text: '#374151', icon: 'information-circle' as const };
    }
  };

  const getRecommendationText = (recommendation: string): string => {
    switch (recommendation) {
      case 'great_deal':
        return 'Great Deal!';
      case 'book_now':
        return 'Book Now';
      case 'wait':
        return 'Consider Waiting';
      default:
        return 'Fair Price';
    }
  };

  const renderTrendIcon = (trend: string) => {
    switch (trend) {
      case 'rising':
        return (
          <View style={styles.trendRow}>
            <Ionicons name="trending-up" size={16} color="#EF4444" />
            <Text style={[styles.trendText, { color: '#EF4444' }]}>Rising</Text>
          </View>
        );
      case 'falling':
        return (
          <View style={styles.trendRow}>
            <Ionicons name="trending-down" size={16} color="#22C55E" />
            <Text style={[styles.trendText, { color: '#22C55E' }]}>Falling</Text>
          </View>
        );
      default:
        return (
          <View style={styles.trendRow}>
            <Ionicons name="remove" size={16} color="#6B7280" />
            <Text style={[styles.trendText, { color: '#6B7280' }]}>Stable</Text>
          </View>
        );
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#22C55E';
    if (confidence >= 0.6) return '#3B82F6';
    if (confidence >= 0.4) return '#F59E0B';
    return '#EF4444';
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
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'prediction' && styles.tabActive]}
          onPress={() => setActiveTab('prediction')}
        >
          <Ionicons
            name="analytics"
            size={16}
            color={activeTab === 'prediction' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'prediction' && styles.tabTextActive]}>
            AI Prediction
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'insights' && styles.tabActive]}
          onPress={() => setActiveTab('insights')}
        >
          <Ionicons
            name="stats-chart"
            size={16}
            color={activeTab === 'insights' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'insights' && styles.tabTextActive]}>
            Route Insights
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'prediction' && (
          <>
            {!departureDate ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyStateText}>Select a date to see price predictions</Text>
              </View>
            ) : prediction ? (
              <>
                {/* Recommendation Banner */}
                <View
                  style={[
                    styles.recommendationBanner,
                    { backgroundColor: getRecommendationStyle(prediction.recommendation).bg },
                  ]}
                >
                  <Ionicons
                    name={getRecommendationStyle(prediction.recommendation).icon}
                    size={24}
                    color={getRecommendationStyle(prediction.recommendation).text}
                  />
                  <View style={styles.recommendationContent}>
                    <Text
                      style={[
                        styles.recommendationTitle,
                        { color: getRecommendationStyle(prediction.recommendation).text },
                      ]}
                    >
                      {getRecommendationText(prediction.recommendation)}
                    </Text>
                    <Text
                      style={[
                        styles.recommendationReason,
                        { color: getRecommendationStyle(prediction.recommendation).text },
                      ]}
                    >
                      {prediction.recommendation_reason}
                    </Text>
                    {prediction.potential_savings > 0 && (
                      <Text
                        style={[
                          styles.savingsText,
                          { color: getRecommendationStyle(prediction.recommendation).text },
                        ]}
                      >
                        Potential savings: {prediction.potential_savings}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Price Prediction */}
                <View style={styles.priceGrid}>
                  <View style={styles.priceCard}>
                    <Text style={styles.priceLabel}>Current Price</Text>
                    <Text style={styles.priceValue}>{prediction.current_price}</Text>
                  </View>
                  <View style={[styles.priceCard, { backgroundColor: '#EFF6FF' }]}>
                    <Text style={[styles.priceLabel, { color: '#1E40AF' }]}>Predicted</Text>
                    <Text style={[styles.priceValue, { color: '#1E40AF' }]}>
                      {prediction.predicted_price}
                    </Text>
                    <Text style={styles.priceRange}>
                      ({prediction.predicted_low} - {prediction.predicted_high})
                    </Text>
                  </View>
                </View>

                {/* Trend & Confidence */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Price Trend</Text>
                    {renderTrendIcon(prediction.trend)}
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Confidence</Text>
                    <View style={styles.confidenceContainer}>
                      <View style={styles.confidenceBar}>
                        <View
                          style={[
                            styles.confidenceFill,
                            {
                              width: `${prediction.confidence * 100}%`,
                              backgroundColor: getConfidenceColor(prediction.confidence),
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.confidenceText}>
                        {(prediction.confidence * 100).toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Booking Window */}
                {prediction.booking_window && (
                  <View style={styles.bookingWindow}>
                    <Text style={styles.sectionTitle}>Optimal Booking Window</Text>
                    <View style={styles.bookingWindowRow}>
                      <Text style={styles.bookingWindowLabel}>Best time to book:</Text>
                      <Text style={styles.bookingWindowValue}>
                        {prediction.booking_window.optimal_days_before} days before
                      </Text>
                    </View>
                    <View style={styles.bookingWindowRow}>
                      <Text style={styles.bookingWindowLabel}>Expected savings:</Text>
                      <Text style={[styles.bookingWindowValue, { color: '#22C55E' }]}>
                        {prediction.booking_window.expected_savings}
                      </Text>
                    </View>
                    <View style={styles.bookingWindowRow}>
                      <Text style={styles.bookingWindowLabel}>Risk level:</Text>
                      <Text
                        style={[
                          styles.bookingWindowValue,
                          {
                            color:
                              prediction.booking_window.risk_level === 'low'
                                ? '#22C55E'
                                : prediction.booking_window.risk_level === 'medium'
                                ? '#F59E0B'
                                : '#EF4444',
                          },
                        ]}
                      >
                        {prediction.booking_window.risk_level.charAt(0).toUpperCase() +
                          prediction.booking_window.risk_level.slice(1)}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            ) : null}
          </>
        )}

        {activeTab === 'insights' && insights && (
          <>
            {/* Current Status */}
            <View
              style={[
                styles.statusCard,
                { backgroundColor: insights.current_status.is_good_deal ? '#DCFCE7' : '#F9FAFB' },
              ]}
            >
              <View style={styles.statusLeft}>
                <Text style={styles.statusLabel}>Current Price</Text>
                <Text style={styles.statusPrice}>{insights.current_status.current_price}</Text>
              </View>
              <View style={styles.statusRight}>
                <View
                  style={[
                    styles.dealBadge,
                    {
                      backgroundColor: insights.current_status.is_good_deal ? '#16A34A' : '#6B7280',
                    },
                  ]}
                >
                  <Text style={styles.dealBadgeText}>{insights.current_status.deal_quality}</Text>
                </View>
                <Text style={styles.percentileText}>
                  {insights.current_status.percentile.toFixed(0)}th percentile
                </Text>
              </View>
            </View>

            {/* Statistics */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statCardLabel}>30-Day Average</Text>
                <Text style={styles.statCardValue}>{insights.statistics.avg_price_30d}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statCardLabel}>Price Range</Text>
                <Text style={styles.statCardValue}>
                  {insights.statistics.min_price_30d} - {insights.statistics.max_price_30d}
                </Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[styles.statCardLabel, { color: '#16A34A' }]}>All-Time Low</Text>
                <Text style={[styles.statCardValue, { color: '#166534' }]}>
                  {insights.statistics.all_time_low}
                </Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[styles.statCardLabel, { color: '#DC2626' }]}>All-Time High</Text>
                <Text style={[styles.statCardValue, { color: '#991B1B' }]}>
                  {insights.statistics.all_time_high}
                </Text>
              </View>
            </View>

            {/* Patterns */}
            <View style={styles.patternsCard}>
              <Text style={styles.sectionTitle}>Booking Patterns</Text>
              <View style={styles.patternRow}>
                <Text style={styles.patternLabel}>Best day to travel:</Text>
                <Text style={[styles.patternValue, { color: '#22C55E' }]}>
                  {insights.patterns.best_day_of_week}
                </Text>
              </View>
              <View style={styles.patternRow}>
                <Text style={styles.patternLabel}>Most expensive day:</Text>
                <Text style={[styles.patternValue, { color: '#EF4444' }]}>
                  {insights.patterns.worst_day_of_week}
                </Text>
              </View>
              <View style={styles.patternRow}>
                <Text style={styles.patternLabel}>Best booking window:</Text>
                <Text style={styles.patternValue}>{insights.patterns.best_booking_window}</Text>
              </View>
              <View style={styles.patternRow}>
                <Text style={styles.patternLabel}>Weekend premium:</Text>
                <Text style={styles.patternValue}>
                  +{(insights.patterns.weekday_vs_weekend * 100).toFixed(0)}%
                </Text>
              </View>
            </View>

            {/* Recent Trend */}
            <View style={styles.trendCard}>
              <Text style={styles.trendCardLabel}>7-Day Trend</Text>
              {renderTrendIcon(insights.current_status.trend_7d)}
            </View>
          </>
        )}
      </ScrollView>
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
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
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
    maxHeight: 400,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyStateText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  recommendationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  recommendationReason: {
    fontSize: 13,
    marginTop: 4,
    opacity: 0.8,
  },
  savingsText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  priceGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  priceCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  priceRange: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  bookingWindow: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  bookingWindowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bookingWindowLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  bookingWindowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  statusLeft: {},
  statusLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  statusRight: {
    alignItems: 'flex-end',
  },
  dealBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dealBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  percentileText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  statCardLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  statCardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  patternsCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  patternRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  patternLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  patternValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  trendCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  trendCardLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
