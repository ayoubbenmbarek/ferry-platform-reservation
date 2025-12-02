import React, { useEffect, useState, useCallback } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  View,
  Animated,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { Text, Button, Switch } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, addDays, addMonths } from 'date-fns';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import {
  quickSaveRoute,
  deletePriceAlert,
  checkRouteSaved,
  selectIsRouteSaved,
  selectRouteAlertId,
  selectIsCreating,
  selectIsDeleting,
} from '../store/slices/priceAlertSlice';
import { colors, spacing, borderRadius } from '../constants/theme';

interface SaveRouteButtonProps {
  departurePort: string;
  arrivalPort: string;
  price?: number;
  searchDate?: string;  // The date from search, if available
  compact?: boolean;
  showLabel?: boolean;
  onSaveSuccess?: () => void;
  onRemoveSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function SaveRouteButton({
  departurePort,
  arrivalPort,
  price,
  searchDate,
  compact = false,
  showLabel = true,
  onSaveSuccess,
  onRemoveSuccess,
  onError,
}: SaveRouteButtonProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  // Use selectors with route params
  const isSaved = useAppSelector(selectIsRouteSaved(departurePort, arrivalPort));
  const alertId = useAppSelector(selectRouteAlertId(departurePort, arrivalPort));
  const isCreating = useAppSelector(selectIsCreating);
  const isDeleting = useAppSelector(selectIsDeleting);

  const [scaleAnim] = useState(new Animated.Value(1));
  const [isLocalLoading, setIsLocalLoading] = useState(false);

  // Modal state for date range selection
  const [showModal, setShowModal] = useState(false);
  const [useDateRange, setUseDateRange] = useState(true);
  const [dateFrom, setDateFrom] = useState<Date>(searchDate ? new Date(searchDate) : addDays(new Date(), 1));
  const [dateTo, setDateTo] = useState<Date>(searchDate ? addDays(new Date(searchDate), 14) : addDays(new Date(), 15));
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const isLoading = isCreating || isDeleting || isLocalLoading;

  // Check if route is saved on mount
  useEffect(() => {
    if (user?.email || departurePort && arrivalPort) {
      dispatch(checkRouteSaved({
        departure: departurePort,
        arrival: arrivalPort,
        email: user?.email,
      }));
    }
  }, [dispatch, departurePort, arrivalPort, user?.email]);

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleButtonPress = useCallback(() => {
    if (!user) {
      onError?.('Please log in to save routes');
      return;
    }

    animatePress();

    if (isSaved && alertId) {
      // If already saved, show options
      Alert.alert(
        'Saved Route',
        `${formatPortName(departurePort)} → ${formatPortName(arrivalPort)}`,
        [
          {
            text: 'Change Dates',
            onPress: () => {
              // First remove old alert, then show modal for new dates
              handleRemoveAndResave();
            },
          },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: handleRemove,
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } else {
      // Show modal for date selection
      setShowModal(true);
    }
  }, [user, isSaved, alertId, departurePort, arrivalPort, onError]);

  const handleRemoveAndResave = useCallback(async () => {
    if (!alertId) return;

    setIsLocalLoading(true);
    try {
      await dispatch(deletePriceAlert({
        alertId,
        departure: departurePort,
        arrival: arrivalPort,
      })).unwrap();
      // After removing, show modal to save with new dates
      setIsLocalLoading(false);
      setShowModal(true);
    } catch (error: any) {
      setIsLocalLoading(false);
      onError?.(error || 'Failed to update route');
    }
  }, [dispatch, alertId, departurePort, arrivalPort, onError]);

  const handleRemove = useCallback(async () => {
    if (!alertId) return;

    setIsLocalLoading(true);
    try {
      await dispatch(deletePriceAlert({
        alertId,
        departure: departurePort,
        arrival: arrivalPort,
      })).unwrap();
      onRemoveSuccess?.();
    } catch (error: any) {
      onError?.(error || 'Failed to remove route');
    } finally {
      setIsLocalLoading(false);
    }
  }, [dispatch, alertId, departurePort, arrivalPort, onRemoveSuccess, onError]);

  const handleSave = useCallback(async () => {
    setShowModal(false);
    setIsLocalLoading(true);

    try {
      await dispatch(quickSaveRoute({
        departure: departurePort,
        arrival: arrivalPort,
        price,
        dateFrom: useDateRange ? format(dateFrom, 'yyyy-MM-dd') : undefined,
        dateTo: useDateRange ? format(dateTo, 'yyyy-MM-dd') : undefined,
      })).unwrap();
      onSaveSuccess?.();
    } catch (error: any) {
      onError?.(error || 'Failed to save route');
    } finally {
      setIsLocalLoading(false);
    }
  }, [dispatch, departurePort, arrivalPort, price, useDateRange, dateFrom, dateTo, onSaveSuccess, onError]);

  const handleFromDateChange = (_event: any, selectedDate?: Date) => {
    setShowFromPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDateFrom(selectedDate);
      // Ensure dateTo is after dateFrom
      if (selectedDate > dateTo) {
        setDateTo(addDays(selectedDate, 7));
      }
    }
  };

  const handleToDateChange = (_event: any, selectedDate?: Date) => {
    setShowToPicker(Platform.OS === 'ios');
    if (selectedDate && selectedDate > dateFrom) {
      setDateTo(selectedDate);
    }
  };

  const formatPortName = (port: string) => port.charAt(0).toUpperCase() + port.slice(1);

  // Date Range Selection Modal
  const renderModal = () => (
    <Modal
      visible={showModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Save Route for Price Alerts</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.alertInfo}>
            <Text style={styles.alertInfoText}>
              We'll notify you when the price drops or increases by 5% or more. Never miss a deal!
            </Text>
          </View>

          <View style={styles.routeDisplay}>
            <Text style={styles.routeText}>
              {formatPortName(departurePort)} → {formatPortName(arrivalPort)}
            </Text>
            {price && (
              <Text style={styles.priceText}>Current price: €{price}</Text>
            )}
          </View>

          <View style={styles.dateToggle}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Track specific travel dates</Text>
              <Switch
                value={useDateRange}
                onValueChange={setUseDateRange}
                color={colors.primary}
              />
            </View>
            <Text style={styles.toggleHint}>
              {useDateRange
                ? 'Get alerts for the best price within your travel window'
                : 'Track general route prices (any date)'}
            </Text>
          </View>

          {useDateRange && (
            <View style={styles.dateSection}>
              {Platform.OS === 'ios' ? (
                // iOS: Show inline date pickers
                <>
                  <View style={styles.datePickerRow}>
                    <Text style={styles.dateLabel}>From</Text>
                    <DateTimePicker
                      value={dateFrom}
                      mode="date"
                      display="compact"
                      minimumDate={new Date()}
                      maximumDate={addMonths(new Date(), 12)}
                      onChange={handleFromDateChange}
                      style={styles.iosDatePicker}
                    />
                  </View>

                  <View style={styles.datePickerRow}>
                    <Text style={styles.dateLabel}>To</Text>
                    <DateTimePicker
                      value={dateTo}
                      mode="date"
                      display="compact"
                      minimumDate={addDays(dateFrom, 1)}
                      maximumDate={addMonths(new Date(), 12)}
                      onChange={handleToDateChange}
                      style={styles.iosDatePicker}
                    />
                  </View>
                </>
              ) : (
                // Android: Show buttons that open picker
                <>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowFromPicker(true)}
                  >
                    <Text style={styles.dateLabel}>From</Text>
                    <Text style={styles.dateValue}>{format(dateFrom, 'MMM d, yyyy')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowToPicker(true)}
                  >
                    <Text style={styles.dateLabel}>To</Text>
                    <Text style={styles.dateValue}>{format(dateTo, 'MMM d, yyyy')}</Text>
                  </TouchableOpacity>

                  {showFromPicker && (
                    <DateTimePicker
                      value={dateFrom}
                      mode="date"
                      display="default"
                      minimumDate={new Date()}
                      maximumDate={addMonths(new Date(), 12)}
                      onChange={handleFromDateChange}
                    />
                  )}

                  {showToPicker && (
                    <DateTimePicker
                      value={dateTo}
                      mode="date"
                      display="default"
                      minimumDate={addDays(dateFrom, 1)}
                      maximumDate={addMonths(new Date(), 12)}
                      onChange={handleToDateChange}
                    />
                  )}
                </>
              )}
            </View>
          )}

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowModal(false)}
              style={styles.cancelButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
              style={styles.saveButton}
              loading={isLoading}
            >
              Save & Track Prices
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (compact) {
    return (
      <>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            style={[
              styles.compactButton,
              isSaved && styles.compactButtonSaved,
            ]}
            onPress={handleButtonPress}
            disabled={isLoading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={isSaved ? colors.primary : colors.textSecondary} />
            ) : (
              <Ionicons
                name={isSaved ? 'heart' : 'heart-outline'}
                size={20}
                color={isSaved ? colors.error : colors.textSecondary}
              />
            )}
          </TouchableOpacity>
        </Animated.View>
        {renderModal()}
      </>
    );
  }

  return (
    <>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[
            styles.button,
            isSaved && styles.buttonSaved,
          ]}
          onPress={handleButtonPress}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={isSaved ? '#fff' : colors.primary} />
          ) : (
            <>
              <Ionicons
                name={isSaved ? 'heart' : 'heart-outline'}
                size={18}
                color={isSaved ? '#fff' : colors.primary}
              />
              {showLabel && (
                <Text style={[styles.buttonText, isSaved && styles.buttonTextSaved]}>
                  {isSaved ? 'Saved' : 'Save Route'}
                </Text>
              )}
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
      {renderModal()}
    </>
  );
}

// Floating Action Button variant
export function SaveRouteFAB({
  departurePort,
  arrivalPort,
  price,
  onSaveSuccess,
  onRemoveSuccess,
  onError,
}: Omit<SaveRouteButtonProps, 'compact' | 'showLabel'>) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const isSaved = useAppSelector(selectIsRouteSaved(departurePort, arrivalPort));
  const alertId = useAppSelector(selectRouteAlertId(departurePort, arrivalPort));
  const isCreating = useAppSelector(selectIsCreating);
  const isDeleting = useAppSelector(selectIsDeleting);

  const [scaleAnim] = useState(new Animated.Value(1));
  const [isLocalLoading, setIsLocalLoading] = useState(false);

  const isLoading = isCreating || isDeleting || isLocalLoading;

  useEffect(() => {
    if (departurePort && arrivalPort) {
      dispatch(checkRouteSaved({
        departure: departurePort,
        arrival: arrivalPort,
        email: user?.email,
      }));
    }
  }, [dispatch, departurePort, arrivalPort, user?.email]);

  const handlePress = useCallback(async () => {
    if (!user) {
      onError?.('Please log in to save routes');
      return;
    }

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setIsLocalLoading(true);

    try {
      if (isSaved && alertId) {
        await dispatch(deletePriceAlert({
          alertId,
          departure: departurePort,
          arrival: arrivalPort,
        })).unwrap();
        onRemoveSuccess?.();
      } else {
        await dispatch(quickSaveRoute({
          departure: departurePort,
          arrival: arrivalPort,
          price,
        })).unwrap();
        onSaveSuccess?.();
      }
    } catch (error: any) {
      onError?.(error || 'Failed to update route');
    } finally {
      setIsLocalLoading(false);
    }
  }, [dispatch, isSaved, alertId, departurePort, arrivalPort, price, user, scaleAnim]);

  return (
    <Animated.View style={[styles.fab, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[styles.fabButton, isSaved && styles.fabButtonSaved]}
        onPress={handlePress}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <View style={styles.fabContent}>
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={22}
              color="#fff"
            />
            <Text style={styles.fabText}>
              {isSaved ? 'Saved' : 'Save'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Standard button styles
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  buttonSaved: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  buttonTextSaved: {
    color: '#fff',
  },

  // Compact button styles (icon only)
  compactButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactButtonSaved: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },

  // FAB styles
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    zIndex: 100,
  },
  fabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 24,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabButtonSaved: {
    backgroundColor: colors.error,
  },
  fabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  fabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl + 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  routeDisplay: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  priceText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  dateToggle: {
    marginBottom: spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  toggleHint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  dateSection: {
    marginBottom: spacing.lg,
  },
  datePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  iosDatePicker: {
    flex: 1,
    marginLeft: spacing.md,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  dateLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
});
