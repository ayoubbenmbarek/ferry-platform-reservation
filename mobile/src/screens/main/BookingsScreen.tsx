import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Text, Card, Chip, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, differenceInSeconds } from 'date-fns';

import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { fetchUserBookings } from '../../store/slices/bookingSlice';
import { RootStackParamList } from '../../types';
import { Booking, BookingStatus } from '../../types';
import { colors, spacing, borderRadius } from '../../constants/theme';
import { useNetwork } from '../../contexts/NetworkContext';
import { offlineService } from '../../services/offlineService';

// Booking expiration time in minutes
const BOOKING_EXPIRATION_MINUTES = 30;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E' },
  confirmed: { bg: '#D1FAE5', text: '#065F46' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B' },
  completed: { bg: '#E0E7FF', text: '#3730A3' },
  expired: { bg: '#F3F4F6', text: '#6B7280' },
  // Handle case variations
  PENDING: { bg: '#FEF3C7', text: '#92400E' },
  CONFIRMED: { bg: '#D1FAE5', text: '#065F46' },
  CANCELLED: { bg: '#FEE2E2', text: '#991B1B' },
  COMPLETED: { bg: '#E0E7FF', text: '#3730A3' },
  EXPIRED: { bg: '#F3F4F6', text: '#6B7280' },
};

// Helper to calculate time remaining
const getTimeRemaining = (createdAt: string | undefined, expiresAt: string | undefined) => {
  if (!createdAt && !expiresAt) return { seconds: 0, percentage: 0 };

  const now = new Date();
  let expirationTime: Date;

  if (expiresAt) {
    expirationTime = parseISO(expiresAt);
  } else if (createdAt) {
    const created = parseISO(createdAt);
    expirationTime = new Date(created.getTime() + BOOKING_EXPIRATION_MINUTES * 60 * 1000);
  } else {
    return { seconds: 0, percentage: 0 };
  }

  const secondsRemaining = Math.max(0, differenceInSeconds(expirationTime, now));
  const totalSeconds = BOOKING_EXPIRATION_MINUTES * 60;
  const percentage = Math.max(0, Math.min(100, (secondsRemaining / totalSeconds) * 100));

  return { seconds: secondsRemaining, percentage };
};

// Format seconds to MM:SS
const formatTimeRemaining = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function BookingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { userBookings, isLoadingBookings, bookingsError } = useAppSelector(
    (state) => state.booking
  );
  const { isConnected, pendingOperationsCount, isSyncing } = useNetwork();

  const [refreshing, setRefreshing] = React.useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isViewingCached, setIsViewingCached] = useState(false);
  const [cachedBookings, setCachedBookings] = useState<Booking[]>([]);

  // Update current time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cache bookings when loaded from server
  useEffect(() => {
    if (userBookings.length > 0 && isConnected) {
      offlineService.cacheBookings(userBookings);
      setIsViewingCached(false);
    }
  }, [userBookings, isConnected]);

  // Load cached bookings when offline
  useEffect(() => {
    const loadCachedData = async () => {
      if (!isConnected && isAuthenticated) {
        const cached = await offlineService.getCachedBookings();
        if (cached) {
          setCachedBookings(cached);
          setIsViewingCached(true);
        }
      } else {
        setIsViewingCached(false);
      }
    };
    loadCachedData();
  }, [isConnected, isAuthenticated]);

  const loadBookings = useCallback(() => {
    if (isAuthenticated && isConnected) {
      dispatch(fetchUserBookings());
    }
  }, [dispatch, isAuthenticated, isConnected]);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
  );

  const onRefresh = async () => {
    if (!isConnected) return;
    setRefreshing(true);
    await dispatch(fetchUserBookings());
    setRefreshing(false);
  };

  // Use cached bookings when offline
  const displayedBookings = isViewingCached ? cachedBookings : userBookings;

  const formatDateTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'EEE, MMM d, yyyy • HH:mm');
    } catch {
      return dateString;
    }
  };

  const renderBookingCard = ({ item }: { item: Booking }) => {
    const status = item.status?.toLowerCase() || 'pending';
    const statusStyle = statusColors[status] || statusColors.pending;

    // Handle total_amount which might be string, number, or undefined
    // Also fallback to calculating from subtotal + tax if total_amount is 0
    let totalAmount = typeof item.total_amount === 'string'
      ? parseFloat(item.total_amount)
      : (item.total_amount ?? 0);

    // Fallback: calculate from subtotal + tax if total_amount is 0
    if (totalAmount === 0) {
      const subtotal = typeof item.subtotal === 'string' ? parseFloat(item.subtotal) : (item.subtotal ?? 0);
      const taxAmount = typeof item.tax_amount === 'string' ? parseFloat(item.tax_amount) : (item.tax_amount ?? 0);
      totalAmount = subtotal + taxAmount;
    }

    const isPending = status === 'pending';

    // Calculate time remaining for pending bookings
    const timeRemaining = isPending
      ? getTimeRemaining(item.created_at, item.expires_at)
      : { seconds: 0, percentage: 0 };

    const isExpiringSoon = isPending && timeRemaining.seconds < 300; // Less than 5 minutes
    const isExpired = isPending && timeRemaining.seconds === 0;

    // Get progress bar color based on time remaining
    const getProgressBarColor = () => {
      if (timeRemaining.percentage > 50) return colors.success;
      if (timeRemaining.percentage > 25) return '#F59E0B'; // Orange/warning
      return colors.error;
    };

    const handlePayNow = () => {
      navigation.navigate('Payment', { bookingId: item.id });
    };

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('BookingDetails', { bookingId: item.id })}
      >
        <Card style={styles.bookingCard}>
          <Card.Content>
            {/* Pending Payment Warning Banner */}
            {isPending && !isExpired && (
              <View style={[styles.pendingBanner, isExpiringSoon && styles.pendingBannerUrgent]}>
                <View style={styles.pendingBannerContent}>
                  <View style={styles.pendingBannerLeft}>
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color={isExpiringSoon ? colors.error : '#92400E'}
                    />
                    <View>
                      <Text style={[styles.pendingBannerTitle, isExpiringSoon && styles.pendingBannerTitleUrgent]}>
                        {isExpiringSoon ? 'Expiring soon!' : 'Payment pending'}
                      </Text>
                      <Text style={[styles.pendingBannerTime, isExpiringSoon && styles.pendingBannerTimeUrgent]}>
                        {formatTimeRemaining(timeRemaining.seconds)} remaining
                      </Text>
                    </View>
                  </View>
                </View>
                {/* Progress bar */}
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${timeRemaining.percentage}%`,
                        backgroundColor: getProgressBarColor(),
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {/* Expired Banner */}
            {isPending && isExpired && (
              <View style={styles.expiredBanner}>
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={styles.expiredBannerText}>
                  This booking has expired
                </Text>
              </View>
            )}

            {/* Header */}
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.bookingRef}>#{item.booking_reference}</Text>
                <Chip
                  compact
                  mode="flat"
                  style={[styles.statusChip, { backgroundColor: statusStyle.bg }]}
                  textStyle={[styles.statusText, { color: statusStyle.text }]}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Chip>
              </View>
              <Text style={styles.price}>
                €{totalAmount.toFixed(2)}
              </Text>
            </View>

            {/* Route */}
            <View style={styles.routeContainer}>
              <View style={styles.routePoint}>
                <View style={styles.routeDot} />
                <Text style={styles.portName}>{item.departure_port}</Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routePoint}>
                <View style={[styles.routeDot, styles.routeDotEnd]} />
                <Text style={styles.portName}>{item.arrival_port}</Text>
              </View>
            </View>

            {/* Details */}
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Ionicons name="calendar" size={16} color={colors.textSecondary} />
                <Text style={styles.detailText}>
                  {formatDateTime(item.departure_time)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="boat" size={16} color={colors.textSecondary} />
                <Text style={styles.detailText}>
                  {item.operator} • {item.vessel_name}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="people" size={16} color={colors.textSecondary} />
                <Text style={styles.detailText}>
                  {item.total_passengers || 1} passenger{(item.total_passengers || 1) > 1 ? 's' : ''}
                </Text>
              </View>
              {(item.total_vehicles ?? 0) > 0 && (
                <View style={styles.detailRow}>
                  <Ionicons name="car" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    {item.total_vehicles} vehicle{item.total_vehicles > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>

            {/* Round Trip Badge */}
            {item.is_round_trip && (
              <View style={styles.roundTripBadge}>
                <Ionicons name="repeat" size={14} color={colors.primary} />
                <Text style={styles.roundTripText}>Round Trip</Text>
              </View>
            )}

            {/* Pay Now Button for Pending Bookings */}
            {isPending && !isExpired && (
              <TouchableOpacity
                style={[styles.payNowButton, isExpiringSoon && styles.payNowButtonUrgent]}
                onPress={handlePayNow}
              >
                <Ionicons name="card" size={20} color="#fff" />
                <Text style={styles.payNowButtonText}>Pay Now</Text>
                <Text style={styles.payNowAmount}>€{totalAmount.toFixed(2)}</Text>
              </TouchableOpacity>
            )}
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Ionicons name="boat-outline" size={80} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>Sign in to see your bookings</Text>
          <Text style={styles.emptySubtitle}>
            Create an account or sign in to manage your ferry reservations
          </Text>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('Auth')}
            style={styles.signInButton}
          >
            Sign In
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Loading
  if (isLoadingBookings && displayedBookings.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your bookings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state
  if (!isLoadingBookings && displayedBookings.length === 0 && !isViewingCached) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Ionicons name="boat-outline" size={80} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptySubtitle}>
            Start exploring ferry routes and book your first trip
          </Text>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('Search' as any)}
            style={styles.searchButton}
            icon="magnify"
          >
            Search Ferries
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
        <Text style={styles.subtitle}>{displayedBookings.length} booking{displayedBookings.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Offline Banner */}
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={20} color="#92400E" />
          <View style={styles.offlineBannerContent}>
            <Text style={styles.offlineBannerTitle}>You're offline</Text>
            <Text style={styles.offlineBannerText}>
              {isViewingCached ? 'Showing cached bookings' : 'Connect to load bookings'}
            </Text>
          </View>
        </View>
      )}

      {/* Pending Operations Banner */}
      {isConnected && pendingOperationsCount > 0 && (
        <View style={styles.syncBanner}>
          <Ionicons
            name={isSyncing ? 'sync' : 'cloud-upload-outline'}
            size={20}
            color={colors.primary}
          />
          <Text style={styles.syncBannerText}>
            {isSyncing
              ? 'Syncing changes...'
              : `${pendingOperationsCount} pending change${pendingOperationsCount > 1 ? 's' : ''}`}
          </Text>
        </View>
      )}

      <FlatList
        data={displayedBookings}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderBookingCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            enabled={isConnected}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: 0,
  },
  bookingCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  bookingRef: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statusChip: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
    marginVertical: 0,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  routeContainer: {
    marginBottom: spacing.md,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  routeDotEnd: {
    backgroundColor: colors.secondary,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: colors.border,
    marginLeft: 4,
    marginVertical: spacing.xs,
  },
  portName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  detailsContainer: {
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  roundTripBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  roundTripText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
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
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  signInButton: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
  },
  searchButton: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  offlineBannerContent: {
    flex: 1,
  },
  offlineBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  offlineBannerText: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  syncBannerText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  // Pending booking styles
  pendingBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  pendingBannerUrgent: {
    backgroundColor: '#FEE2E2',
  },
  pendingBannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pendingBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  pendingBannerTitleUrgent: {
    color: colors.error,
  },
  pendingBannerTime: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  pendingBannerTimeUrgent: {
    color: colors.error,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  expiredBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  expiredBannerText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.error,
  },
  payNowButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  payNowButtonUrgent: {
    backgroundColor: colors.error,
  },
  payNowButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  payNowAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
