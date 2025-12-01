import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Share,
} from 'react-native';
import { Text, Card, Button, Chip, Divider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, differenceInDays } from 'date-fns';

import { bookingService } from '../services/bookingService';
import { RootStackParamList, Booking, BookingStatus } from '../types';
import { colors, spacing, borderRadius } from '../constants/theme';
import { CANCELLATION_RESTRICTION_DAYS } from '../constants/config';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'BookingDetails'>;

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E' },
  confirmed: { bg: '#D1FAE5', text: '#065F46' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B' },
  completed: { bg: '#E0E7FF', text: '#3730A3' },
  expired: { bg: '#F3F4F6', text: '#6B7280' },
};

export default function BookingDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { bookingId } = route.params;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBooking = async () => {
    try {
      const data = await bookingService.getBooking(bookingId);
      setBooking(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBooking();
  }, [bookingId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBooking();
    setRefreshing(false);
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'EEE, MMM d, yyyy • HH:mm');
    } catch {
      return dateString;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'HH:mm');
    } catch {
      return '--:--';
    }
  };

  const getDaysUntilDeparture = () => {
    if (!booking) return 0;
    try {
      return differenceInDays(parseISO(booking.departure_time), new Date());
    } catch {
      return 0;
    }
  };

  const canCancel = () => {
    if (!booking || booking.status !== 'confirmed') return false;
    const daysUntil = getDaysUntilDeparture();
    const hasProtection = booking.extra_data?.has_cancellation_protection;
    return hasProtection || daysUntil >= CANCELLATION_RESTRICTION_DAYS;
  };

  const handleCancel = () => {
    if (!booking) return;

    const daysUntil = getDaysUntilDeparture();
    const hasProtection = booking.extra_data?.has_cancellation_protection;

    if (daysUntil < CANCELLATION_RESTRICTION_DAYS && !hasProtection) {
      Alert.alert(
        'Cannot Cancel',
        `Cancellations are not allowed within ${CANCELLATION_RESTRICTION_DAYS} days of departure. Your trip departs in ${daysUntil} days.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking? This action cannot be undone.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              const updated = await bookingService.cancelBooking(bookingId);
              setBooking(updated);
              Alert.alert('Success', 'Your booking has been cancelled.');
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    if (!booking) return;
    try {
      await Share.share({
        message: `Ferry booking: ${booking.departure_port} → ${booking.arrival_port}\nReference: ${booking.booking_reference}\nDate: ${formatDateTime(booking.departure_time)}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleDownloadInvoice = async () => {
    // In a real app, this would download the PDF
    Alert.alert('Download Invoice', 'Invoice download functionality coming soon!');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading booking...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!booking || error) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={60} color={colors.error} />
          <Text style={styles.errorTitle}>Unable to Load Booking</Text>
          <Text style={styles.errorMessage}>{error || 'Booking not found'}</Text>
          <Button mode="contained" onPress={() => navigation.goBack()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const status = (booking.status || 'pending').toLowerCase();
  const statusStyle = statusColors[status] || statusColors.pending;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.reference}>#{booking.booking_reference}</Text>
            <Chip
              style={[styles.statusChip, { backgroundColor: statusStyle.bg }]}
              textStyle={[styles.statusText, { color: statusStyle.text }]}
            >
              {(booking.status || 'pending').charAt(0).toUpperCase() + (booking.status || 'pending').slice(1)}
            </Chip>
          </View>
          <Text style={styles.price}>€{(booking.total_amount ?? 0).toFixed(2)}</Text>
        </View>

        {/* Route Card */}
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Trip Details</Text>

            {/* Outbound */}
            <View style={styles.journeySection}>
              <View style={styles.journeyHeader}>
                <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                <Text style={styles.journeyLabel}>Outbound</Text>
              </View>

              <View style={styles.routeRow}>
                <View style={styles.routePoint}>
                  <Text style={styles.time}>{formatTime(booking.departure_time)}</Text>
                  <Text style={styles.port}>{booking.departure_port}</Text>
                </View>
                <View style={styles.routeArrow}>
                  <Ionicons name="arrow-forward" size={20} color={colors.border} />
                </View>
                <View style={styles.routePoint}>
                  <Text style={styles.time}>{formatTime(booking.arrival_time)}</Text>
                  <Text style={styles.port}>{booking.arrival_port}</Text>
                </View>
              </View>

              <Text style={styles.dateText}>{formatDateTime(booking.departure_time)}</Text>
              <Text style={styles.operatorText}>{booking.operator} • {booking.vessel_name}</Text>
            </View>

            {/* Return */}
            {booking.is_round_trip && booking.return_departure_time && (
              <>
                <Divider style={styles.journeyDivider} />
                <View style={styles.journeySection}>
                  <View style={styles.journeyHeader}>
                    <Ionicons name="arrow-back" size={16} color={colors.secondary} />
                    <Text style={styles.journeyLabel}>Return</Text>
                  </View>

                  <View style={styles.routeRow}>
                    <View style={styles.routePoint}>
                      <Text style={styles.time}>{formatTime(booking.return_departure_time)}</Text>
                      <Text style={styles.port}>{booking.arrival_port}</Text>
                    </View>
                    <View style={styles.routeArrow}>
                      <Ionicons name="arrow-forward" size={20} color={colors.border} />
                    </View>
                    <View style={styles.routePoint}>
                      <Text style={styles.time}>{formatTime(booking.return_arrival_time || '')}</Text>
                      <Text style={styles.port}>{booking.departure_port}</Text>
                    </View>
                  </View>

                  <Text style={styles.dateText}>{formatDateTime(booking.return_departure_time)}</Text>
                </View>
              </>
            )}
          </Card.Content>
        </Card>

        {/* Passengers */}
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>
              Passengers ({booking.total_passengers})
            </Text>
            {booking.passengers?.map((passenger, index) => (
              <View key={index} style={styles.passengerRow}>
                <Ionicons name="person" size={20} color={colors.textSecondary} />
                <View style={styles.passengerInfo}>
                  <Text style={styles.passengerName}>
                    {passenger.first_name} {passenger.last_name}
                  </Text>
                  <Text style={styles.passengerType}>
                    {passenger.passenger_type.charAt(0).toUpperCase() + passenger.passenger_type.slice(1)}
                  </Text>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Protection Status */}
        {booking.extra_data?.has_cancellation_protection && (
          <Card style={styles.protectionCard}>
            <Card.Content style={styles.protectionContent}>
              <Ionicons name="shield-checkmark" size={24} color={colors.success} />
              <View style={styles.protectionText}>
                <Text style={styles.protectionTitle}>Cancellation Protection Active</Text>
                <Text style={styles.protectionSubtitle}>
                  You can cancel anytime for a full refund
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={handleDownloadInvoice}
            icon="download"
            style={styles.actionButton}
          >
            Download Invoice
          </Button>

          <Button
            mode="outlined"
            onPress={handleShare}
            icon="share-outline"
            style={styles.actionButton}
          >
            Share
          </Button>

          {booking.status === 'confirmed' && (
            <Button
              mode="outlined"
              onPress={handleCancel}
              loading={isCancelling}
              disabled={isCancelling}
              icon="close-circle"
              style={[styles.actionButton, styles.cancelButton]}
              textColor={canCancel() ? colors.error : colors.disabled}
            >
              Cancel Booking
            </Button>
          )}
        </View>

        {/* Contact Info */}
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.contactRow}>
              <Ionicons name="mail" size={18} color={colors.textSecondary} />
              <Text style={styles.contactText}>{booking.contact_email}</Text>
            </View>
            <View style={styles.contactRow}>
              <Ionicons name="call" size={18} color={colors.textSecondary} />
              <Text style={styles.contactText}>{booking.contact_phone}</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Bottom spacing */}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  errorMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  reference: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  statusChip: {
    height: 28,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  price: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
  },
  section: {
    margin: spacing.md,
    marginBottom: 0,
    borderRadius: borderRadius.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  journeySection: {
    paddingVertical: spacing.sm,
  },
  journeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  journeyLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  routePoint: {
    alignItems: 'center',
    flex: 1,
  },
  routeArrow: {
    paddingHorizontal: spacing.md,
  },
  time: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  port: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dateText: {
    fontSize: 14,
    color: colors.text,
  },
  operatorText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  journeyDivider: {
    marginVertical: spacing.md,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  passengerInfo: {
    marginLeft: spacing.md,
  },
  passengerName: {
    fontSize: 16,
    color: colors.text,
  },
  passengerType: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  protectionCard: {
    margin: spacing.md,
    marginBottom: 0,
    borderRadius: borderRadius.lg,
    backgroundColor: '#D1FAE5',
  },
  protectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  protectionText: {
    marginLeft: spacing.md,
  },
  protectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065F46',
  },
  protectionSubtitle: {
    fontSize: 14,
    color: '#065F46',
    opacity: 0.8,
  },
  actions: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    borderRadius: borderRadius.md,
  },
  cancelButton: {
    borderColor: colors.error,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  contactText: {
    fontSize: 16,
    color: colors.text,
  },
});
