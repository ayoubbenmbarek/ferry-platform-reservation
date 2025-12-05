import React from 'react';
import { View, StyleSheet, Share } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAppDispatch } from '../hooks/useAppDispatch';
import { resetBooking } from '../store/slices/bookingSlice';
import { resetSearch } from '../store/slices/searchSlice';
import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius } from '../constants/theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'BookingConfirmation'>;

export default function BookingConfirmationScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const dispatch = useAppDispatch();
  const { bookingReference } = route.params;

  React.useEffect(() => {
    // Success haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleViewBooking = () => {
    // Reset booking state and navigate to bookings
    dispatch(resetBooking());
    dispatch(resetSearch());

    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'Main',
            state: {
              routes: [
                { name: 'Home' },
                { name: 'Search' },
                { name: 'Bookings' },
                { name: 'Profile' },
              ],
              index: 2, // Bookings tab
            },
          },
        ],
      })
    );
  };

  const handleNewSearch = () => {
    dispatch(resetBooking());
    dispatch(resetSearch());

    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'Main',
            state: {
              routes: [
                { name: 'Home' },
                { name: 'Search' },
                { name: 'Bookings' },
                { name: 'Profile' },
              ],
              index: 1, // Search tab
            },
          },
        ],
      })
    );
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I've booked a ferry trip! Booking reference: ${bookingReference}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success Animation */}
        <View style={styles.successContainer}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={60} color="#fff" />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.subtitle}>
          Your ferry trip has been successfully booked
        </Text>

        {/* Booking Reference */}
        <Card style={styles.referenceCard}>
          <Card.Content style={styles.referenceContent}>
            <Text style={styles.referenceLabel}>Booking Reference</Text>
            <Text style={styles.referenceValue}>{bookingReference}</Text>
            <Text style={styles.referenceHint}>
              Save this reference for your records
            </Text>
          </Card.Content>
        </Card>

        {/* Info */}
        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <Ionicons name="mail-outline" size={24} color={colors.primary} />
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>Confirmation Email Sent</Text>
              <Text style={styles.infoSubtitle}>
                Check your inbox for booking details
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="document-text-outline" size={24} color={colors.primary} />
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>E-Ticket Available</Text>
              <Text style={styles.infoSubtitle}>
                Download from your booking details
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="notifications-outline" size={24} color={colors.primary} />
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>Trip Reminders</Text>
              <Text style={styles.infoSubtitle}>
                We'll notify you before departure
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={handleViewBooking}
            style={styles.primaryButton}
            contentStyle={styles.buttonContent}
            icon="ferry"
          >
            View My Booking
          </Button>

          <Button
            mode="outlined"
            onPress={handleNewSearch}
            style={styles.secondaryButton}
            contentStyle={styles.buttonContent}
            icon="magnify"
          >
            Book Another Trip
          </Button>

          <Button
            mode="text"
            onPress={handleShare}
            icon="share-outline"
          >
            Share
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  referenceCard: {
    marginBottom: spacing.xl,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
  },
  referenceContent: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  referenceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: spacing.xs,
  },
  referenceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  referenceHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  infoContainer: {
    marginBottom: spacing.xl,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  infoText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  infoSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    gap: spacing.sm,
  },
  primaryButton: {
    borderRadius: borderRadius.md,
  },
  secondaryButton: {
    borderRadius: borderRadius.md,
  },
  buttonContent: {
    paddingVertical: spacing.xs,
  },
});
