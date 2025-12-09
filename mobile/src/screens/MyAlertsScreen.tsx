import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Text, Card, Chip, Divider, SegmentedButtons, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, differenceInDays, isAfter } from 'date-fns';

import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import {
  fetchUserAlerts,
  cancelAlert,
  markAlertFulfilled,
  selectAlerts,
  selectIsLoading,
} from '../store/slices/alertSlice';
import { AvailabilityAlert, AlertStatus, AlertType } from '../services/alertService';
import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius } from '../constants/theme';
import RunningBear from '../components/RunningBear';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type FilterValue = 'active' | 'all' | 'notified';

const STATUS_COLORS: Record<AlertStatus, { bg: string; text: string }> = {
  active: { bg: '#D1FAE5', text: '#065F46' },      // Green - waiting for availability
  notified: { bg: '#FEF3C7', text: '#92400E' },    // Amber/Orange - availability found, action needed!
  fulfilled: { bg: '#E0E7FF', text: '#3730A3' },   // Purple - booked
  expired: { bg: '#F3F4F6', text: '#6B7280' },     // Gray - expired
  cancelled: { bg: '#FEE2E2', text: '#991B1B' },   // Red - cancelled
};

const ALERT_TYPE_ICONS: Record<AlertType, keyof typeof Ionicons.glyphMap> = {
  passenger: 'people-outline',
  vehicle: 'car-outline',
  cabin: 'bed-outline',
};

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  passenger: 'Passenger Seats',
  vehicle: 'Vehicle Space',
  cabin: 'Cabin',
};

export default function MyAlertsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();

  const alerts = useAppSelector(selectAlerts);
  const isLoading = useAppSelector(selectIsLoading);
  const { user } = useAppSelector((state) => state.auth);

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('active');
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadAlerts = useCallback(async () => {
    if (!user?.email) return;
    try {
      await dispatch(fetchUserAlerts({ email: user.email })).unwrap();
    } catch (err) {
      console.error('Error loading alerts:', err);
    }
  }, [dispatch, user?.email]);

  // Load alerts on focus
  useFocusEffect(
    useCallback(() => {
      loadAlerts();
    }, [loadAlerts])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  const handleCancelAlert = (alert: AvailabilityAlert) => {
    Alert.alert(
      'Cancel Alert',
      `Are you sure you want to cancel this ${ALERT_TYPE_LABELS[alert.alert_type].toLowerCase()} alert for ${alert.departure_port} → ${alert.arrival_port}?`,
      [
        { text: 'Keep Alert', style: 'cancel' },
        {
          text: 'Cancel Alert',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(alert.id);
            try {
              await dispatch(cancelAlert({
                alertId: alert.id,
                email: alert.email,
              })).unwrap();
            } catch (err: any) {
              Alert.alert('Error', err || 'Failed to cancel alert');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const handleMarkFulfilled = async (alert: AvailabilityAlert) => {
    try {
      await dispatch(markAlertFulfilled({
        alertId: alert.id,
        email: alert.email,
      })).unwrap();
    } catch (err: any) {
      Alert.alert('Error', err || 'Failed to update alert');
    }
  };

  const handleNotifiedAlertPress = (alert: AvailabilityAlert) => {
    // Only cabin alerts linked to a booking can navigate to AddCabin
    if (alert.alert_type === 'cabin' && alert.booking_id) {
      navigation.navigate('AddCabin', {
        bookingId: alert.booking_id,
        alertId: alert.id,
        journeyType: alert.journey_type || 'outbound',
      });
    } else {
      // For non-cabin alerts or alerts without booking, show info
      Alert.alert(
        'Availability Found!',
        `${ALERT_TYPE_LABELS[alert.alert_type]} is now available for ${alert.departure_port} → ${alert.arrival_port} on ${formatDate(alert.departure_date)}.\n\nSearch for this route to book now!`,
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Mark as Booked',
            onPress: () => handleMarkFulfilled(alert),
          },
        ]
      );
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'active') return alert.status === 'active';
    if (filter === 'notified') return alert.status === 'notified';
    return true;
  });

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'EEE, MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  const getDaysRemaining = (alert: AvailabilityAlert) => {
    if (alert.status !== 'active') return null;
    try {
      const departure = parseISO(alert.departure_date);
      const days = differenceInDays(departure, new Date());
      if (days < 0) return 'Departed';
      if (days === 0) return 'Today';
      if (days === 1) return 'Tomorrow';
      return `${days} days`;
    } catch {
      return null;
    }
  };

  const renderAlertCard = ({ item: alert }: { item: AvailabilityAlert }) => {
    const statusStyle = STATUS_COLORS[alert.status];
    const icon = ALERT_TYPE_ICONS[alert.alert_type];
    const typeLabel = ALERT_TYPE_LABELS[alert.alert_type];
    const daysRemaining = getDaysRemaining(alert);
    const isCancelling = cancellingId === alert.id;
    const isNotified = alert.status === 'notified';
    const canNavigate = isNotified && alert.alert_type === 'cabin' && alert.booking_id;

    return (
        <Card
          style={[styles.alertCard, isNotified && styles.notifiedCard]}
          onPress={isNotified ? () => handleNotifiedAlertPress(alert) : undefined}
        >
          <Card.Content>
            {/* Notified banner */}
            {isNotified && (
              <View style={styles.notifiedBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#92400E" />
                <Text style={styles.notifiedBannerText}>
                  {canNavigate ? 'Tap to add cabin to your booking' : 'Availability found! Tap for details'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#92400E" />
              </View>
            )}
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.alertTypeContainer}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name={icon} size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.alertTypeLabel}>{typeLabel}</Text>
                <Text style={styles.operatorText}>{alert.operator}</Text>
              </View>
            </View>
            <Chip
              style={[styles.statusChip, { backgroundColor: statusStyle.bg }]}
              textStyle={[styles.statusText, { color: statusStyle.text }]}
            >
              {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
            </Chip>
          </View>

          {/* Route */}
          <View style={styles.routeContainer}>
            <View style={styles.routeRow}>
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.routeText}>
                {alert.departure_port} → {alert.arrival_port}
              </Text>
            </View>
            <View style={styles.routeRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.routeText}>
                {formatDate(alert.departure_date)}
                {alert.sailing_time && ` at ${alert.sailing_time}`}
              </Text>
            </View>
            {daysRemaining && (
              <View style={styles.routeRow}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.daysRemainingText}>{daysRemaining}</Text>
              </View>
            )}
          </View>

          {/* Passengers/Vehicles info */}
          <View style={styles.passengerInfo}>
            <Text style={styles.passengerText}>
              {alert.num_adults} adult{alert.num_adults !== 1 ? 's' : ''}
              {(alert.num_children ?? 0) > 0 && `, ${alert.num_children} child${alert.num_children !== 1 ? 'ren' : ''}`}
              {(alert.num_infants ?? 0) > 0 && `, ${alert.num_infants} infant${alert.num_infants !== 1 ? 's' : ''}`}
            </Text>
            {alert.vehicle_type && (
              <Text style={styles.vehicleText}>
                Vehicle: {alert.vehicle_type}
                {alert.vehicle_length_cm && ` (${(alert.vehicle_length_cm / 100).toFixed(1)}m)`}
              </Text>
            )}
          </View>

          <Divider style={styles.divider} />

          {/* Actions */}
          <View style={styles.actionsRow}>
            {alert.status === 'active' && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleCancelAlert(alert)}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                    <Text style={styles.cancelActionText}>Cancel Alert</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {alert.status === 'notified' && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleMarkFulfilled(alert)}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                <Text style={styles.fulfilledActionText}>Mark as Booked</Text>
              </TouchableOpacity>
            )}

            <View style={styles.createdAtContainer}>
              <Text style={styles.createdAtText}>
                Created {format(parseISO(alert.created_at), 'MMM d, yyyy')}
              </Text>
            </View>
          </View>
        </Card.Content>
        </Card>
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.emptyContainer}>
          <Ionicons name="log-in-outline" size={80} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>Sign In Required</Text>
          <Text style={styles.emptySubtitle}>
            Please sign in to view your availability alerts
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filter}
          onValueChange={(value) => setFilter(value as FilterValue)}
          buttons={[
            { value: 'active', label: 'Active' },
            { value: 'notified', label: 'Notified' },
            { value: 'all', label: 'All' },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>
          {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? 's' : ''}
          {filter !== 'all' && ` (${filter})`}
        </Text>
      </View>

      {isLoading && alerts.length === 0 ? (
        <RunningBear message="Loading your alerts" fullScreen={false} />
      ) : filteredAlerts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={80} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Alerts Found</Text>
          <Text style={styles.emptySubtitle}>
            {filter === 'active'
              ? "You don't have any active availability alerts"
              : filter === 'notified'
              ? "No alerts have been triggered yet"
              : "You haven't created any availability alerts yet"}
          </Text>
          <Text style={styles.emptyHint}>
            Create alerts from the search results when availability is limited
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAlerts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderAlertCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterContainer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  segmentedButtons: {
    backgroundColor: colors.background,
  },
  statsRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statsText: {
    fontSize: 14,
    color: colors.textSecondary,
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
    marginBottom: spacing.sm,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  listContent: {
    padding: spacing.md,
  },
  alertCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
  },
  notifiedCard: {
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  notifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    marginHorizontal: -spacing.md,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopLeftRadius: borderRadius.lg - 2,
    borderTopRightRadius: borderRadius.lg - 2,
    gap: spacing.xs,
  },
  notifiedBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  alertTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  operatorText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statusChip: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
    marginVertical: 0,
    marginHorizontal: 0,
  },
  routeContainer: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routeText: {
    fontSize: 14,
    color: colors.text,
  },
  daysRemainingText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  passengerInfo: {
    marginBottom: spacing.sm,
  },
  passengerText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  vehicleText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  cancelActionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.error,
  },
  fulfilledActionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.success,
  },
  createdAtContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  createdAtText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
