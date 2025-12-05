import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Text, Button, Divider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import ViewShot, { captureRef } from 'react-native-view-shot';

import { Booking } from '../types';
import { colors, spacing, borderRadius } from '../constants/theme';
import { API_BASE_URL } from '../constants/config';
import { getToken } from '../services/api';

type RouteProps = RouteProp<{ ETicket: { booking: Booking } }, 'ETicket'>;

export default function ETicketScreen() {
  const route = useRoute<RouteProps>();
  const { booking } = route.params;
  const ticketRef = useRef<View>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const formatTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'HH:mm');
    } catch {
      return '--:--';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'EEE, dd MMM yyyy');
    } catch {
      return dateString;
    }
  };

  const formatFullDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'dd MMMM yyyy');
    } catch {
      return dateString;
    }
  };

  // Generate QR code data - contains booking reference and verification info
  const qrData = JSON.stringify({
    ref: booking.booking_reference,
    id: booking.id,
    departure: booking.departure_port,
    arrival: booking.arrival_port,
    date: booking.departure_time,
    passengers: booking.total_passengers,
    operator: booking.operator,
  });

  const handleShare = async () => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing not available', 'Sharing is not available on this device');
        return;
      }

      // Capture the ticket as an image
      if (ticketRef.current) {
        const uri = await captureRef(ticketRef, {
          format: 'png',
          quality: 1,
        });

        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `E-Ticket ${booking.booking_reference}`,
        });
      }
    } catch (error) {
      console.error('Error sharing ticket:', error);
      Alert.alert('Error', 'Failed to share ticket. Please try again.');
    }
  };

  const handleDownload = async () => {
    try {
      if (ticketRef.current) {
        const uri = await captureRef(ticketRef, {
          format: 'png',
          quality: 1,
        });

        const filename = `eticket-${booking.booking_reference}.png`;
        const downloadPath = `${FileSystem.documentDirectory}${filename}`;

        await FileSystem.copyAsync({
          from: uri,
          to: downloadPath,
        });

        Alert.alert(
          'Downloaded',
          `E-Ticket saved as ${filename}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error downloading ticket:', error);
      Alert.alert('Error', 'Failed to download ticket. Please try again.');
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
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

      // Check if sharing is available
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `E-Ticket ${booking.booking_reference}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        // If sharing not available, just notify the user where it's saved
        Alert.alert(
          'Downloaded',
          `E-Ticket PDF saved to ${filename}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      Alert.alert('Error', 'Failed to download E-Ticket PDF. Please try again.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return colors.success;
      case 'pending':
        return colors.warning;
      case 'cancelled':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Ticket Card */}
        <View ref={ticketRef} collapsable={false} style={styles.ticketContainer}>
          {/* Header */}
          <View style={styles.ticketHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.operatorName}>{booking.operator}</Text>
              <Text style={styles.ticketType}>E-TICKET</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
              <Text style={styles.statusText}>{booking.status.toUpperCase()}</Text>
            </View>
          </View>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            <QRCode
              value={qrData}
              size={180}
              backgroundColor="white"
              color={colors.text}
            />
            <Text style={styles.bookingRef}>{booking.booking_reference}</Text>
            <Text style={styles.scanText}>Scan at check-in</Text>
          </View>

          {/* Ticket Divider */}
          <View style={styles.ticketDivider}>
            <View style={styles.dividerCircleLeft} />
            <View style={styles.dividerLine} />
            <View style={styles.dividerCircleRight} />
          </View>

          {/* Journey Details */}
          <View style={styles.journeySection}>
            <Text style={styles.journeyLabel}>OUTBOUND JOURNEY</Text>

            <View style={styles.routeContainer}>
              <View style={styles.portInfo}>
                <Text style={styles.portCode}>{booking.departure_port}</Text>
                <Text style={styles.timeText}>{formatTime(booking.departure_time)}</Text>
              </View>

              <View style={styles.routeLine}>
                <Ionicons name="boat" size={24} color={colors.primary} />
                <View style={styles.routeDash} />
                <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
              </View>

              <View style={styles.portInfo}>
                <Text style={styles.portCode}>{booking.arrival_port}</Text>
                <Text style={styles.timeText}>{formatTime(booking.arrival_time)}</Text>
              </View>
            </View>

            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.dateText}>{formatDate(booking.departure_time)}</Text>
            </View>

            <View style={styles.vesselRow}>
              <Ionicons name="boat-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.vesselText}>{booking.vessel_name}</Text>
            </View>
          </View>

          {/* Return Journey if round trip */}
          {booking.is_round_trip && booking.return_departure_time && (
            <>
              <Divider style={styles.sectionDivider} />
              <View style={styles.journeySection}>
                <Text style={styles.journeyLabel}>RETURN JOURNEY</Text>

                <View style={styles.routeContainer}>
                  <View style={styles.portInfo}>
                    <Text style={styles.portCode}>{booking.return_departure_port}</Text>
                    <Text style={styles.timeText}>{formatTime(booking.return_departure_time)}</Text>
                  </View>

                  <View style={styles.routeLine}>
                    <Ionicons name="boat" size={24} color={colors.secondary} />
                    <View style={styles.routeDash} />
                    <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
                  </View>

                  <View style={styles.portInfo}>
                    <Text style={styles.portCode}>{booking.return_arrival_port}</Text>
                    <Text style={styles.timeText}>
                      {booking.return_arrival_time ? formatTime(booking.return_arrival_time) : '--:--'}
                    </Text>
                  </View>
                </View>

                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.dateText}>{formatDate(booking.return_departure_time)}</Text>
                </View>

                <View style={styles.vesselRow}>
                  <Ionicons name="boat-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.vesselText}>{booking.return_vessel_name || 'TBC'}</Text>
                </View>
              </View>
            </>
          )}

          {/* Passenger & Vehicle Info */}
          <Divider style={styles.sectionDivider} />
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="people" size={20} color={colors.primary} />
                <Text style={styles.infoLabel}>Passengers</Text>
                <Text style={styles.infoValue}>{booking.total_passengers}</Text>
              </View>
              {booking.total_vehicles > 0 && (
                <View style={styles.infoItem}>
                  <Ionicons name="car" size={20} color={colors.primary} />
                  <Text style={styles.infoLabel}>Vehicles</Text>
                  <Text style={styles.infoValue}>{booking.total_vehicles}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Contact Info */}
          <View style={styles.contactSection}>
            <Text style={styles.contactName}>
              {booking.contact_first_name} {booking.contact_last_name}
            </Text>
            <Text style={styles.contactDetail}>{booking.contact_email}</Text>
            {booking.contact_phone && (
              <Text style={styles.contactDetail}>{booking.contact_phone}</Text>
            )}
          </View>

          {/* Footer */}
          <View style={styles.ticketFooter}>
            <Text style={styles.footerText}>
              Present this e-ticket at check-in
            </Text>
            <Text style={styles.footerNote}>
              Please arrive at least 90 minutes before departure
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            onPress={handleDownloadPdf}
            icon={isDownloadingPdf ? undefined : "file-pdf-box"}
            style={styles.actionButton}
            disabled={isDownloadingPdf}
          >
            {isDownloadingPdf ? 'Downloading...' : 'Download PDF'}
          </Button>
          <Button
            mode="outlined"
            onPress={handleShare}
            icon="share-variant"
            style={styles.actionButton}
          >
            Share
          </Button>
        </View>
        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={handleDownload}
            icon="image"
            style={[styles.actionButton, { flex: 1 }]}
          >
            Save as Image
          </Button>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Check-in Instructions</Text>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>1</Text>
            <Text style={styles.instructionText}>
              Arrive at the port at least 90 minutes before departure
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>2</Text>
            <Text style={styles.instructionText}>
              Present this QR code at the check-in counter
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>3</Text>
            <Text style={styles.instructionText}>
              Have your ID/passport ready for verification
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>4</Text>
            <Text style={styles.instructionText}>
              Proceed to the boarding area after check-in
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
  },
  ticketContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.primary,
  },
  headerLeft: {
    flex: 1,
  },
  operatorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  ticketType: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  qrContainer: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: '#fff',
  },
  bookingRef: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    letterSpacing: 2,
  },
  scanText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  ticketDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -10,
  },
  dividerCircleLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  dividerLine: {
    flex: 1,
    height: 2,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dividerCircleRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  journeySection: {
    padding: spacing.md,
  },
  journeyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  portInfo: {
    alignItems: 'center',
    flex: 1,
  },
  portCode: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  timeText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'center',
  },
  routeDash: {
    width: 40,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dateText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  vesselRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vesselText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  sectionDivider: {
    marginHorizontal: spacing.md,
  },
  infoSection: {
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  contactSection: {
    padding: spacing.md,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  contactDetail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ticketFooter: {
    padding: spacing.md,
    backgroundColor: colors.primary + '10',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  footerNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
    borderRadius: borderRadius.md,
  },
  instructions: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: spacing.sm,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
