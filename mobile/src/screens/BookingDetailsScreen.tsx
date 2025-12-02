import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Share,
  TouchableOpacity,
} from 'react-native';
import { Text, Card, Button, Chip, Divider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, differenceInDays } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { bookingService } from '../services/bookingService';
import { notificationService } from '../services/notificationService';
import { offlineService } from '../services/offlineService';
import { getToken } from '../services/api';
import { useNetwork } from '../contexts/NetworkContext';
import { RootStackParamList, Booking, BookingStatus } from '../types';
import { colors, spacing, borderRadius } from '../constants/theme';
import { CANCELLATION_RESTRICTION_DAYS, API_BASE_URL } from '../constants/config';
import CabinAlertForBooking from '../components/CabinAlertForBooking';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'BookingDetails'>;

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E' },
  confirmed: { bg: '#D1FAE5', text: '#065F46' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B' },
  completed: { bg: '#E0E7FF', text: '#3730A3' },
  expired: { bg: '#F3F4F6', text: '#6B7280' },
  pending_cancellation: { bg: '#FED7AA', text: '#C2410C' },
};

export default function BookingDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { bookingId } = route.params;
  const { isConnected, refreshPendingCount } = useNetwork();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isViewingCached, setIsViewingCached] = useState(false);
  const [alertToastMessage, setAlertToastMessage] = useState<string | null>(null);

  const handleAlertCreated = (message: string) => {
    setAlertToastMessage(message);
    setTimeout(() => setAlertToastMessage(null), 5000);
  };

  const loadBooking = async () => {
    try {
      if (isConnected) {
        const data = await bookingService.getBooking(bookingId);
        setBooking(data);
        setIsViewingCached(false);
        // Update cache with fresh data
        await offlineService.updateCachedBooking(data);
      } else {
        // Load from cache when offline
        const cached = await offlineService.getCachedBooking(bookingId);
        if (cached) {
          setBooking(cached);
          setIsViewingCached(true);
        } else {
          setError('Booking not available offline');
        }
      }
      setError(null);
    } catch (err: any) {
      // Try to load from cache on error
      const cached = await offlineService.getCachedBooking(bookingId);
      if (cached) {
        setBooking(cached);
        setIsViewingCached(true);
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBooking();
  }, [bookingId, isConnected]);

  const onRefresh = async () => {
    if (!isConnected) return;
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
    if (!booking || booking.status?.toLowerCase() !== 'confirmed') return false;
    const daysUntil = getDaysUntilDeparture();
    // Cannot cancel if departure has already passed
    if (daysUntil < 0) return false;
    const hasProtection = booking.extra_data?.has_cancellation_protection;
    return hasProtection || daysUntil >= CANCELLATION_RESTRICTION_DAYS;
  };

  const isDeparturePassed = () => {
    return getDaysUntilDeparture() < 0;
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

    const cancelMessage = isConnected
      ? 'Are you sure you want to cancel this booking? This action cannot be undone.'
      : 'You are offline. The cancellation will be queued and processed when you are back online.';

    Alert.alert(
      'Cancel Booking',
      cancelMessage,
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              if (isConnected) {
                const updated = await bookingService.cancelBooking(bookingId);
                setBooking(updated);
                // Update cache with cancelled booking
                await offlineService.updateCachedBooking(updated);
              } else {
                // Queue the cancellation for when back online
                await offlineService.queueOperation('cancel_booking', bookingId);
                // Update local booking state to show pending cancellation
                setBooking({
                  ...booking,
                  status: 'pending_cancellation' as any,
                });
                await refreshPendingCount();
              }
              // Cancel any scheduled departure reminders
              await notificationService.cancelBookingReminders(bookingId);
              Alert.alert(
                'Success',
                isConnected
                  ? 'Your booking has been cancelled.'
                  : 'Cancellation queued. It will be processed when you are back online.'
              );
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

  const handleSetReminders = async () => {
    if (!booking) return;
    try {
      const scheduledIds = await notificationService.scheduleDepartureReminders(booking);
      if (scheduledIds.length > 0) {
        Alert.alert(
          'Reminders Set',
          `${scheduledIds.length} reminder(s) scheduled for this trip.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'No Reminders',
          'No reminders could be scheduled. Either notifications are disabled in settings or the reminder times have already passed.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error setting reminders:', error);
      Alert.alert('Error', 'Failed to set reminders');
    }
  };

  const handleDownloadETicket = async () => {
    if (!booking) return;

    setIsDownloading(true);
    try {
      const token = await getToken();
      const filename = `eticket-${booking.booking_reference}.pdf`;
      const downloadPath = `${FileSystem.cacheDirectory}${filename}`;

      // Download PDF from backend
      const downloadResult = await FileSystem.downloadAsync(
        `${API_BASE_URL}/bookings/${booking.id}/eticket`,
        downloadPath,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (downloadResult.status !== 200) {
        throw new Error('Failed to download E-Ticket PDF');
      }

      // Share the downloaded PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `E-Ticket ${booking.booking_reference}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Downloaded', `E-Ticket saved as ${filename}`);
      }
    } catch (error) {
      console.error('Error downloading E-Ticket:', error);
      Alert.alert('Error', 'Failed to download E-Ticket. Please try again.');
    } finally {
      setIsDownloading(false);
    }
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            enabled={isConnected}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Offline Banner */}
        {!isConnected && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={20} color="#92400E" />
            <Text style={styles.offlineBannerText}>
              {isViewingCached ? 'Viewing cached data' : 'You are offline'}
            </Text>
          </View>
        )}

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

        {/* Cabins Section - Show both original selection and upgrades */}
        {(booking.cabin_id || booking.return_cabin_id || (booking.booking_cabins && booking.booking_cabins.length > 0)) && (
          <Card style={styles.section}>
            <Card.Content>
              <Text style={styles.sectionTitle}>
                <Ionicons name="bed-outline" size={18} color={colors.primary} /> Cabins
              </Text>

              {(() => {
                // Calculate upgrade totals to get original cabin prices
                const outboundUpgrades = booking.booking_cabins
                  ?.filter(c => c.journey_type === 'OUTBOUND')
                  .reduce((sum, c) => sum + c.total_price, 0) || 0;
                const returnUpgrades = booking.booking_cabins
                  ?.filter(c => c.journey_type === 'RETURN')
                  .reduce((sum, c) => sum + c.total_price, 0) || 0;

                // Original cabin price = cabin_supplement - upgrades
                const originalOutboundPrice = Math.max(0, (booking.cabin_supplement || 0) - outboundUpgrades);
                const originalReturnPrice = Math.max(0, (booking.return_cabin_supplement || 0) - returnUpgrades);

                return (
                  <>
                    {/* Original cabin selection (outbound) */}
                    {booking.cabin_id && originalOutboundPrice > 0 && (
                      <View style={styles.cabinRow}>
                        <View style={styles.cabinInfo}>
                          <View style={styles.cabinHeader}>
                            <Text style={styles.cabinName}>{booking.cabin_name || `Cabin #${booking.cabin_id}`}</Text>
                            <View style={[styles.journeyBadge, { backgroundColor: '#D1FAE5' }]}>
                              <Text style={[styles.journeyBadgeText, { color: '#065F46' }]}>Outbound</Text>
                            </View>
                          </View>
                          <Text style={styles.cabinDetails}>
                            {booking.cabin_type && `${booking.cabin_type} • `}Original Selection
                          </Text>
                        </View>
                        <Text style={styles.cabinPrice}>€{originalOutboundPrice.toFixed(2)}</Text>
                      </View>
                    )}

                    {/* Original cabin selection (return) */}
                    {booking.return_cabin_id && originalReturnPrice > 0 && (
                      <View style={styles.cabinRow}>
                        <View style={styles.cabinInfo}>
                          <View style={styles.cabinHeader}>
                            <Text style={styles.cabinName}>{booking.return_cabin_name || `Cabin #${booking.return_cabin_id}`}</Text>
                            <View style={[styles.journeyBadge, { backgroundColor: '#E0E7FF' }]}>
                              <Text style={[styles.journeyBadgeText, { color: '#3730A3' }]}>Return</Text>
                            </View>
                          </View>
                          <Text style={styles.cabinDetails}>
                            {booking.return_cabin_type && `${booking.return_cabin_type} • `}Original Selection
                          </Text>
                        </View>
                        <Text style={styles.cabinPrice}>€{originalReturnPrice.toFixed(2)}</Text>
                      </View>
                    )}

                    {/* Upgraded cabins */}
                    {booking.booking_cabins && booking.booking_cabins.map((cabin, index) => (
                      <View key={cabin.id || index} style={styles.cabinRow}>
                        <View style={styles.cabinInfo}>
                          <View style={styles.cabinHeader}>
                            <Text style={styles.cabinName}>{cabin.cabin_name || `Cabin #${cabin.cabin_id}`}</Text>
                            <View style={[
                              styles.journeyBadge,
                              { backgroundColor: cabin.journey_type === 'RETURN' ? '#E0E7FF' : '#D1FAE5' }
                            ]}>
                              <Text style={[
                                styles.journeyBadgeText,
                                { color: cabin.journey_type === 'RETURN' ? '#3730A3' : '#065F46' }
                              ]}>
                                {cabin.journey_type === 'RETURN' ? 'Return' : 'Outbound'}
                              </Text>
                            </View>
                            <View style={[styles.journeyBadge, { backgroundColor: '#FEF3C7', marginLeft: 4 }]}>
                              <Text style={[styles.journeyBadgeText, { color: '#92400E' }]}>Upgrade</Text>
                            </View>
                          </View>
                          <Text style={styles.cabinDetails}>
                            {cabin.cabin_type && `${cabin.cabin_type} • `}Qty: {cabin.quantity}
                          </Text>
                        </View>
                        <Text style={styles.cabinPrice}>€{cabin.total_price.toFixed(2)}</Text>
                      </View>
                    ))}
                  </>
                );
              })()}
            </Card.Content>
          </Card>
        )}

        {/* Cabin Alerts - Only for confirmed bookings */}
        {booking.status?.toLowerCase() === 'confirmed' && isConnected && (
          <View style={styles.cabinAlertsSection}>
            <Text style={styles.cabinAlertsSectionTitle}>Cabin Availability Alerts</Text>
            <Text style={styles.cabinAlertsDescription}>
              Get notified when cabins become available for your journey
            </Text>
            <View style={styles.cabinAlertsContainer}>
              <CabinAlertForBooking
                booking={booking}
                journeyType="outbound"
                onAlertCreated={handleAlertCreated}
              />
              {booking.is_round_trip && booking.return_departure_time && (
                <CabinAlertForBooking
                  booking={booking}
                  journeyType="return"
                  onAlertCreated={handleAlertCreated}
                />
              )}
            </View>
          </View>
        )}

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

        {/* Price Summary */}
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>
              <Ionicons name="receipt-outline" size={18} color={colors.primary} /> Price Summary
            </Text>

            {/* Passengers breakdown */}
            {booking.passengers && booking.passengers.length > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>
                  Passengers ({booking.total_passengers})
                </Text>
                <Text style={styles.priceValue}>
                  €{booking.passengers.reduce((sum, p) => sum + (p.final_price || p.base_price || 0), 0).toFixed(2)}
                </Text>
              </View>
            )}

            {/* Vehicles breakdown */}
            {booking.vehicles && booking.vehicles.length > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>
                  Vehicles ({booking.total_vehicles})
                </Text>
                <Text style={styles.priceValue}>
                  €{booking.vehicles.reduce((sum, v) => sum + (v.final_price || v.base_price || 0), 0).toFixed(2)}
                </Text>
              </View>
            )}

            {/* Cabin costs - cabin_supplement includes both original + upgrades */}
            {(() => {
              // Calculate upgrade totals by journey type
              const outboundUpgrades = booking.booking_cabins
                ?.filter(c => c.journey_type === 'OUTBOUND')
                .reduce((sum, c) => sum + c.total_price, 0) || 0;
              const returnUpgrades = booking.booking_cabins
                ?.filter(c => c.journey_type === 'RETURN')
                .reduce((sum, c) => sum + c.total_price, 0) || 0;

              // Original cabin price = cabin_supplement - outbound upgrades
              const originalOutbound = Math.max(0, (booking.cabin_supplement || 0) - outboundUpgrades);
              const originalReturn = Math.max(0, (booking.return_cabin_supplement || 0) - returnUpgrades);

              return (
                <>
                  {/* Original cabin (outbound) */}
                  {originalOutbound > 0 && (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Cabin (Outbound)</Text>
                      <Text style={styles.priceValue}>€{originalOutbound.toFixed(2)}</Text>
                    </View>
                  )}

                  {/* Original cabin (return) */}
                  {originalReturn > 0 && (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Cabin (Return)</Text>
                      <Text style={styles.priceValue}>€{originalReturn.toFixed(2)}</Text>
                    </View>
                  )}

                  {/* Cabin upgrades */}
                  {outboundUpgrades > 0 && (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Cabin Upgrade (Outbound)</Text>
                      <Text style={styles.priceValue}>€{outboundUpgrades.toFixed(2)}</Text>
                    </View>
                  )}

                  {returnUpgrades > 0 && (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Cabin Upgrade (Return)</Text>
                      <Text style={styles.priceValue}>€{returnUpgrades.toFixed(2)}</Text>
                    </View>
                  )}
                </>
              );
            })()}

            {/* Subtotal */}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Subtotal</Text>
              <Text style={styles.priceValue}>€{booking.subtotal.toFixed(2)}</Text>
            </View>

            {/* Discount */}
            {booking.discount_amount > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: colors.success }]}>Discount</Text>
                <Text style={[styles.priceValue, { color: colors.success }]}>
                  -€{booking.discount_amount.toFixed(2)}
                </Text>
              </View>
            )}

            {/* Tax */}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Tax (10%)</Text>
              <Text style={styles.priceValue}>€{booking.tax_amount.toFixed(2)}</Text>
            </View>

            {/* Total */}
            <View style={[styles.priceRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                €{booking.total_amount.toFixed(2)} {booking.currency}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          {booking.status?.toLowerCase() === 'confirmed' && (
            <Button
              mode="contained"
              onPress={() => navigation.navigate('ETicket', { booking })}
              icon="qrcode"
              style={styles.eticketButton}
            >
              View E-Ticket
            </Button>
          )}

          <Button
            mode="outlined"
            onPress={handleDownloadETicket}
            icon="file-pdf-box"
            style={styles.actionButton}
            loading={isDownloading}
            disabled={isDownloading || booking.status?.toLowerCase() !== 'confirmed'}
          >
            {isDownloading ? 'Downloading...' : 'Download E-Ticket PDF'}
          </Button>

          <Button
            mode="outlined"
            onPress={handleShare}
            icon="share-outline"
            style={styles.actionButton}
          >
            Share
          </Button>

          {booking.status?.toLowerCase() === 'confirmed' && (
            <Button
              mode="outlined"
              onPress={handleSetReminders}
              icon="bell-outline"
              style={styles.actionButton}
            >
              Set Reminders
            </Button>
          )}

          {booking.status?.toLowerCase() === 'confirmed' && (
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

      {/* Toast Message */}
      {alertToastMessage && (
        <View style={styles.toastContainer}>
          <View style={styles.toast}>
            <Ionicons name="checkmark-circle" size={20} color="#059669" />
            <Text style={styles.toastText}>{alertToastMessage}</Text>
            <TouchableOpacity onPress={() => setAlertToastMessage(null)}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
    marginVertical: 0,
    marginHorizontal: 0,
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
  eticketButton: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
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
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: spacing.md,
    gap: spacing.sm,
  },
  offlineBannerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400E',
  },
  // Booked Cabins styles
  cabinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cabinInfo: {
    flex: 1,
  },
  cabinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  cabinName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  journeyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  journeyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cabinDetails: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  cabinPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  cabinAlertsSection: {
    margin: spacing.md,
    marginBottom: 0,
  },
  cabinAlertsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cabinAlertsDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  cabinAlertsContainer: {
    gap: spacing.md,
  },
  // Price Summary styles
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  priceLabel: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  totalRow: {
    borderBottomWidth: 0,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.primary,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  toastContainer: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.md,
    right: spacing.md,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    color: '#065F46',
    fontWeight: '500',
  },
});
