import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text, TextInput, Button, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';

import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { createAvailabilityAlert } from '../store/slices/alertSlice';
import { AlertType, CreateAlertRequest } from '../services/alertService';
import { colors, spacing, borderRadius } from '../constants/theme';

interface FerryInfo {
  operator: string;
  departure_time: string;
  arrival_time: string;
  departure_port: string;
  arrival_port: string;
  available_seats?: number;
  available_vehicle_space?: number;
  available_cabins?: number;
}

interface SearchParams {
  departurePort: string;
  arrivalPort: string;
  departureDate: string;
  returnDate?: string;
  isRoundTrip: boolean;
  adults: number;
  children: number;
  infants: number;
  vehicleType?: string;
  vehicleLength?: number;
}

interface AvailabilityAlertModalProps {
  visible: boolean;
  onClose: () => void;
  ferry: FerryInfo | null;
  alertType: AlertType;
  searchParams: SearchParams;
  isReturnJourney?: boolean;
  onSuccess?: (message: string) => void;
}

const ALERT_TYPE_LABELS: Record<AlertType, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
  passenger: { title: 'Passenger Seats', icon: 'people-outline' },
  vehicle: { title: 'Vehicle Space', icon: 'car-outline' },
  cabin: { title: 'Cabin', icon: 'bed-outline' },
};

export default function AvailabilityAlertModal({
  visible,
  onClose,
  ferry,
  alertType,
  searchParams,
  isReturnJourney = false,
  onSuccess,
}: AvailabilityAlertModalProps) {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { isCreating } = useAppSelector((state) => state.alerts);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Pre-fill email from user if authenticated
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setError(null);
      setSuccess(false);
    }
  }, [visible]);

  const validateEmail = (emailToValidate: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailToValidate);
  };

  const handleCreateAlert = async () => {
    if (!ferry) return;

    // Validate email
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setError(null);

    // Extract sailing time from departure time
    const departureDateTime = parseISO(ferry.departure_time);
    const sailingTime = format(departureDateTime, 'HH:mm');

    const alertData: CreateAlertRequest = {
      alert_type: alertType,
      email: email.trim(),
      departure_port: searchParams.departurePort,
      arrival_port: searchParams.arrivalPort,
      departure_date: isReturnJourney && searchParams.returnDate
        ? searchParams.returnDate
        : searchParams.departureDate,
      is_round_trip: searchParams.isRoundTrip,
      return_date: searchParams.returnDate,
      operator: ferry.operator,
      sailing_time: sailingTime,
      num_adults: searchParams.adults,
      num_children: searchParams.children,
      num_infants: searchParams.infants,
      vehicle_type: searchParams.vehicleType,
      vehicle_length_cm: searchParams.vehicleLength
        ? Math.round(searchParams.vehicleLength * 100)
        : undefined,
      alert_duration_days: 30,
    };

    try {
      const result = await dispatch(createAvailabilityAlert(alertData)).unwrap();
      setSuccess(true);
      onSuccess?.(`Alert created! We'll notify you at ${email} when ${ALERT_TYPE_LABELS[alertType].title.toLowerCase()} becomes available.`);

      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err || 'Failed to create alert. Please try again.');
    }
  };

  if (!ferry) return null;

  const typeInfo = ALERT_TYPE_LABELS[alertType];
  const departureDateTime = parseISO(ferry.departure_time);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Ionicons name="notifications-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.title}>Get Notified</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Alert Type Badge */}
            <View style={styles.alertTypeBadge}>
              <Ionicons name={typeInfo.icon} size={18} color={colors.primary} />
              <Text style={styles.alertTypeText}>{typeInfo.title} Alert</Text>
            </View>

            {/* Ferry Summary */}
            <View style={styles.ferrySummary}>
              <Text style={styles.operatorName}>{ferry.operator}</Text>
              <View style={styles.routeRow}>
                <Text style={styles.port}>{searchParams.departurePort}</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
                <Text style={styles.port}>{searchParams.arrivalPort}</Text>
              </View>
              <Text style={styles.dateTime}>
                {format(departureDateTime, 'EEE, MMM d, yyyy')} at{' '}
                {format(departureDateTime, 'HH:mm')}
              </Text>
              <View style={styles.passengersRow}>
                <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.passengersText}>
                  {searchParams.adults} adult{searchParams.adults !== 1 ? 's' : ''}
                  {searchParams.children > 0 && `, ${searchParams.children} child${searchParams.children !== 1 ? 'ren' : ''}`}
                  {searchParams.infants > 0 && `, ${searchParams.infants} infant${searchParams.infants !== 1 ? 's' : ''}`}
                </Text>
              </View>
            </View>

            {/* Email Input */}
            <View style={styles.emailSection}>
              <Text style={styles.emailLabel}>Notification Email</Text>
              <TextInput
                mode="outlined"
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                disabled={!!user?.email || isCreating}
                style={styles.emailInput}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                error={!!error}
              />
              {user?.email && (
                <View style={styles.accountEmailBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#059669" />
                  <Text style={styles.accountEmailText}>From your account</Text>
                </View>
              )}
            </View>

            {/* Duration Info */}
            <View style={styles.durationInfo}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.durationText}>
                Alert active for 30 days or until you're notified
              </Text>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Success Message */}
            {success && (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" />
                <Text style={styles.successText}>Alert created successfully!</Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                mode="outlined"
                onPress={onClose}
                style={styles.cancelButton}
                labelStyle={styles.cancelButtonLabel}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleCreateAlert}
                style={styles.createButton}
                labelStyle={styles.createButtonLabel}
                disabled={isCreating || success}
                loading={isCreating}
              >
                {success ? 'Created!' : 'Create Alert'}
              </Button>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  closeButton: {
    padding: spacing.xs,
  },
  alertTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  alertTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  ferrySummary: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  operatorName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  port: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  dateTime: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  passengersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  passengersText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emailSection: {
    marginBottom: spacing.md,
  },
  emailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emailInput: {
    backgroundColor: colors.surface,
  },
  accountEmailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  accountEmailText: {
    fontSize: 12,
    color: '#059669',
  },
  durationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  durationText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: '#FEE2E2',
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: '#D1FAE5',
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  successText: {
    fontSize: 13,
    color: '#059669',
    flex: 1,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    borderColor: colors.border,
  },
  cancelButtonLabel: {
    color: colors.textSecondary,
  },
  createButton: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  createButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
