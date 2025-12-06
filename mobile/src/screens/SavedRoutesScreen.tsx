import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Text, Card, Chip, Menu, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, addDays } from 'date-fns';

import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import {
  fetchSavedRoutes,
  loadMoreSavedRoutes,
  deletePriceAlert,
  pausePriceAlert,
  resumePriceAlert,
  selectSavedRoutes,
  selectIsLoading,
  selectHasMoreRoutes,
  selectStats,
  fetchPriceAlertStats,
} from '../store/slices/priceAlertSlice';
import { PriceAlert } from '../services/priceAlertService';
import LoadingScreen from '../components/LoadingScreen';
import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius } from '../constants/theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SavedRoutesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();

  const savedRoutes = useAppSelector(selectSavedRoutes);
  const isLoading = useAppSelector(selectIsLoading);
  const hasMore = useAppSelector(selectHasMoreRoutes);
  const stats = useAppSelector(selectStats);
  const user = useAppSelector((state) => state.auth.user);

  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(() => {
    dispatch(fetchSavedRoutes());
    dispatch(fetchPriceAlertStats());
  }, [dispatch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchSavedRoutes()),
      dispatch(fetchPriceAlertStats()),
    ]);
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      dispatch(loadMoreSavedRoutes({}));
    }
  };

  const handleDelete = (route: PriceAlert) => {
    Alert.alert(
      'Remove Saved Route',
      `Stop watching prices for ${route.departure_port} to ${route.arrival_port}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            dispatch(deletePriceAlert({
              alertId: route.id,
              departure: route.departure_port,
              arrival: route.arrival_port,
            }));
          },
        },
      ]
    );
    setMenuVisible(null);
  };

  const handleTogglePause = async (route: PriceAlert) => {
    if (route.status === 'paused') {
      await dispatch(resumePriceAlert(route.id));
    } else {
      await dispatch(pausePriceAlert(route.id));
    }
    setMenuVisible(null);
  };

  const handleSearchRoute = (route: PriceAlert) => {
    // Navigate to search with this route pre-filled
    // Use best_price_date if available, otherwise date_from, otherwise tomorrow
    const searchDate = route.best_price_date
      || route.date_from
      || format(addDays(new Date(), 1), 'yyyy-MM-dd');

    navigation.navigate('Main', {
      screen: 'Search',
      params: {
        prefillDeparture: route.departure_port,
        prefillArrival: route.arrival_port,
        prefillDate: searchDate,
      },
    } as any);
  };

  const formatPortName = (port: string) => {
    return port.charAt(0).toUpperCase() + port.slice(1);
  };

  const renderRouteCard = ({ item: route }: { item: PriceAlert }) => {
    const isPaused = route.status === 'paused';
    const hasPriceDrop = Boolean(route.price_change_percent && route.price_change_percent < 0);
    const hasPriceIncrease = Boolean(route.price_change_percent && route.price_change_percent > 0);

    return (
      <Card style={[styles.routeCard, isPaused && styles.routeCardPaused]}>
        <Card.Content>
          {/* Header with Route and Menu */}
          <View style={styles.cardHeader}>
            <View style={styles.routeInfo}>
              <View style={styles.routeRow}>
                <Text style={styles.portName}>{formatPortName(route.departure_port)}</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
                <Text style={styles.portName}>{formatPortName(route.arrival_port)}</Text>
              </View>
              {isPaused && (
                <Chip compact style={styles.pausedChip} textStyle={styles.pausedChipText}>
                  Paused
                </Chip>
              )}
            </View>
            {/* Show date range if set */}
            {(route.date_from || route.date_to) && (
              <View style={styles.dateRangeRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.dateRangeText}>
                  {route.date_from && route.date_to
                    ? `${format(parseISO(route.date_from), 'MMM d')} - ${format(parseISO(route.date_to), 'MMM d, yyyy')}`
                    : route.date_from
                    ? `From ${format(parseISO(route.date_from), 'MMM d, yyyy')}`
                    : `Until ${format(parseISO(route.date_to!), 'MMM d, yyyy')}`}
                </Text>
              </View>
            )}
            <Menu
              visible={menuVisible === route.id}
              onDismiss={() => setMenuVisible(null)}
              anchor={
                <TouchableOpacity onPress={() => setMenuVisible(route.id)}>
                  <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              }
            >
              <Menu.Item
                onPress={() => handleSearchRoute(route)}
                title="Search This Route"
                leadingIcon="magnify"
              />
              <Menu.Item
                onPress={() => handleTogglePause(route)}
                title={isPaused ? 'Resume Alerts' : 'Pause Alerts'}
                leadingIcon={isPaused ? 'play' : 'pause'}
              />
              <Divider />
              <Menu.Item
                onPress={() => handleDelete(route)}
                title="Remove"
                leadingIcon="delete"
                titleStyle={{ color: colors.error }}
              />
            </Menu>
          </View>

          {/* Price Information */}
          {route.initial_price && (
            <View style={styles.priceSection}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Initial Price:</Text>
                <Text style={styles.priceValue}>{route.initial_price.toFixed(0)}</Text>
              </View>
              {route.current_price && route.current_price !== route.initial_price && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Current Price:</Text>
                  <Text style={[
                    styles.priceValue,
                    hasPriceDrop && styles.priceDropText,
                    hasPriceIncrease && styles.priceIncreaseText,
                  ]}>
                    {route.current_price.toFixed(0)}
                  </Text>
                  {route.price_change_percent && (
                    <View style={[
                      styles.changeChip,
                      hasPriceDrop && styles.changeChipDrop,
                      hasPriceIncrease && styles.changeChipIncrease,
                    ]}>
                      <Ionicons
                        name={hasPriceDrop ? 'arrow-down' : 'arrow-up'}
                        size={12}
                        color={hasPriceDrop ? '#059669' : '#DC2626'}
                      />
                      <Text style={[
                        styles.changeText,
                        hasPriceDrop && styles.changeTextDrop,
                        hasPriceIncrease && styles.changeTextIncrease,
                      ]}>
                        {Math.abs(route.price_change_percent).toFixed(1)}%
                      </Text>
                    </View>
                  )}
                </View>
              )}
              {route.lowest_price && route.lowest_price < route.initial_price && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Lowest Seen:</Text>
                  <Text style={[styles.priceValue, styles.priceDropText]}>
                    {route.lowest_price.toFixed(0)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Notification Settings */}
          <View style={styles.settingsRow}>
            {route.notify_on_drop && (
              <View style={styles.settingBadge}>
                <Ionicons name="trending-down" size={12} color={colors.success} />
                <Text style={styles.settingText}>Price drops</Text>
              </View>
            )}
            {route.notify_on_increase && (
              <View style={styles.settingBadge}>
                <Ionicons name="trending-up" size={12} color={colors.warning} />
                <Text style={styles.settingText}>Price increases</Text>
              </View>
            )}
            {route.target_price && (
              <View style={styles.settingBadge}>
                <Ionicons name="flag" size={12} color={colors.primary} />
                <Text style={styles.settingText}>Target: {route.target_price}</Text>
              </View>
            )}
          </View>

          {/* Footer with Date and Actions */}
          <View style={styles.cardFooter}>
            <Text style={styles.dateText}>
              Saved {format(parseISO(route.created_at), 'MMM d, yyyy')}
            </Text>
            {route.last_checked_at && (
              <Text style={styles.checkedText}>
                Checked {format(parseISO(route.last_checked_at), 'MMM d')}
              </Text>
            )}
          </View>

          {/* Quick Search Button */}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => handleSearchRoute(route)}
          >
            <Ionicons name="search" size={16} color={colors.primary} />
            <Text style={styles.searchButtonText}>Search Ferries</Text>
          </TouchableOpacity>
        </Card.Content>
      </Card>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerSection}>
      {/* Stats Cards */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.active_alerts}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.paused_alerts}</Text>
            <Text style={styles.statLabel}>Paused</Text>
          </View>
          <View style={[styles.statCard, styles.statCardHighlight]}>
            <Text style={[styles.statNumber, styles.statNumberHighlight]}>
              {stats.routes_with_price_drops}
            </Text>
            <Text style={styles.statLabel}>Price Drops</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="heart-outline" size={80} color={colors.textSecondary} />
      <Text style={styles.emptyTitle}>No Saved Routes</Text>
      <Text style={styles.emptySubtitle}>
        Save routes from search results to get notified when prices change
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => navigation.navigate('Main', { screen: 'Search' } as any)}
      >
        <Ionicons name="search" size={18} color="#fff" />
        <Text style={styles.emptyButtonText}>Search Ferries</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading && savedRoutes.length === 0) {
    return <LoadingScreen message="Loading saved routes" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={savedRoutes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderRouteCard}
        ListHeaderComponent={savedRoutes.length > 0 ? renderHeader : null}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={savedRoutes.length === 0 ? styles.emptyList : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isLoading && savedRoutes.length > 0 ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: 16,
  },
  listContent: {
    padding: spacing.md,
  },
  emptyList: {
    flex: 1,
  },
  headerSection: {
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statCardHighlight: {
    backgroundColor: '#D1FAE5',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  statNumberHighlight: {
    color: '#059669',
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  routeCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
  },
  routeCardPaused: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  routeInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  portName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  pausedChip: {
    backgroundColor: colors.disabled,
    height: 22,
  },
  pausedChipText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  dateRangeText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  priceSection: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    width: 100,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  priceDropText: {
    color: '#059669',
  },
  priceIncreaseText: {
    color: '#DC2626',
  },
  changeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.background,
  },
  changeChipDrop: {
    backgroundColor: '#D1FAE5',
  },
  changeChipIncrease: {
    backgroundColor: '#FEE2E2',
  },
  changeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  changeTextDrop: {
    color: '#059669',
  },
  changeTextIncrease: {
    color: '#DC2626',
  },
  settingsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  settingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  settingText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  checkedText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loadingMore: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
