import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';

import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { createAvailabilityAlert, cancelAlert } from '../store/slices/alertSlice';
import { alertService, AvailabilityAlert } from '../services/alertService';
import { Booking } from '../types';
import { colors, spacing, borderRadius } from '../constants/theme';

interface CabinAlertForBookingProps {
  booking: Booking;
  journeyType: 'outbound' | 'return';
  onAlertCreated?: (message: string) => void;
  onAlertCancelled?: () => void;
}

export default function CabinAlertForBooking({
  booking,
  journeyType,
  onAlertCreated,
  onAlertCancelled,
}: CabinAlertForBookingProps) {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { isCreating } = useAppSelector((state) => state.alerts);

  const [existingAlert, setExistingAlert] = useState<AvailabilityAlert | null>(null);
  const [isCheckingAlert, setIsCheckingAlert] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  // Determine journey details based on type
  const isReturn = journeyType === 'return';
  const departurePort = isReturn ? booking.return_departure_port || booking.arrival_port : booking.departure_port;
  const arrivalPort = isReturn ? booking.return_arrival_port || booking.departure_port : booking.arrival_port;
  const departureTime = isReturn ? booking.return_departure_time : booking.departure_time;
  const operator = isReturn ? booking.return_operator || booking.operator : booking.operator;

  // Only render for return if it's a round trip with return details
  if (isReturn && (!booking.is_round_trip || !booking.return_departure_time)) {
    return null;
  }

  const email = user?.email || booking.contact_email;

  // Check for existing alert on mount
  useEffect(() => {
    const checkExistingAlert = async () => {
      if (!email) {
        setIsCheckingAlert(false);
        return;
      }

      try {
        const alert = await alertService.hasExistingBookingAlert(
          email,
          booking.id,
          journeyType
        );
        setExistingAlert(alert);
      } catch (err) {
        // Silently fail - we'll just show the create button
        console.log('Error checking existing alert:', err);
      } finally {
        setIsCheckingAlert(false);
      }
    };

    checkExistingAlert();
  }, [email, booking.id, journeyType]);

  const handleCreateAlert = async () => {
    if (!email) {
      Alert.alert('Email Required', 'Please log in or provide an email to receive notifications.');
      return;
    }

    if (!departureTime) {
      Alert.alert('Error', 'Unable to create alert - missing departure time.');
      return;
    }

    try {
      const departureDateTime = parseISO(departureTime);
      const sailingTime = format(departureDateTime, 'HH:mm');
      const departureDate = format(departureDateTime, 'yyyy-MM-dd');

      const alertData = {
        alert_type: 'cabin' as const,
        email,
        departure_port: departurePort,
        arrival_port: arrivalPort,
        departure_date: departureDate,
        is_round_trip: false, // Individual alert for this journey
        operator,
        sailing_time: sailingTime,
        num_adults: booking.total_passengers,
        num_children: 0,
        num_infants: 0,
        alert_duration_days: 30,
        // Link to booking for cabin upgrade alerts
        booking_id: booking.id,
        journey_type: journeyType,
      };

      const result = await dispatch(createAvailabilityAlert(alertData)).unwrap();
      setExistingAlert(result);
      onAlertCreated?.(`Cabin alert created! We'll notify you at ${email} when cabins become available.`);
    } catch (err: any) {
      Alert.alert('Error', err || 'Failed to create alert. Please try again.');
    }
  };

  const handleCancelAlert = () => {
    if (!existingAlert) return;

    Alert.alert(
      'Cancel Alert',
      'Are you sure you want to cancel this cabin availability alert?',
      [
        { text: 'Keep Alert', style: 'cancel' },
        {
          text: 'Cancel Alert',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              await dispatch(cancelAlert({
                alertId: existingAlert.id,
                email,
              })).unwrap();
              setExistingAlert(null);
              onAlertCancelled?.();
            } catch (err: any) {
              Alert.alert('Error', err || 'Failed to cancel alert.');
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (isCheckingAlert) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const formattedDate = departureTime
    ? format(parseISO(departureTime), 'EEE, MMM d')
    : '';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="bed-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Cabin Availability Alert</Text>
          <Text style={styles.subtitle}>
            {isReturn ? 'Return' : 'Outbound'} • {formattedDate}
          </Text>
        </View>
      </View>

      <Text style={styles.description}>
        {existingAlert
          ? `You'll be notified at ${email} when a cabin becomes available for this sailing.`
          : 'Get notified when a cabin becomes available for this sailing.'}
      </Text>

      {existingAlert ? (
        <View style={styles.activeAlertContainer}>
          <View style={styles.activeAlertBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#059669" />
            <Text style={styles.activeAlertText}>Alert Active</Text>
          </View>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelAlert}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={16} color={colors.error} />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateAlert}
          disabled={isCreating}
          activeOpacity={0.7}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="notifications-outline" size={18} color="#fff" />
              <Text style={styles.createButtonText}>Notify Me</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  activeAlertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  activeAlertText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 4,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.error,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
