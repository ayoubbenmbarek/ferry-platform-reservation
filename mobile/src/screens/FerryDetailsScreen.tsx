import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Chip, Button, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, differenceInMinutes } from 'date-fns';

import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius } from '../constants/theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'FerryDetails'>;

export default function FerryDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { schedule } = route.params;

  const formatTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'HH:mm');
    } catch {
      return '--:--';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'EEE, MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  const formatDuration = () => {
    try {
      const mins = differenceInMinutes(
        parseISO(schedule.arrival_time),
        parseISO(schedule.departure_time)
      );
      const hours = Math.floor(mins / 60);
      const minutes = mins % 60;
      return `${hours}h ${minutes}m`;
    } catch {
      return '--';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.operatorRow}>
              <Chip style={styles.operatorChip}>{schedule.operator}</Chip>
              <Text style={styles.vesselName}>{schedule.vessel_name}</Text>
            </View>

            <Text style={styles.date}>{formatDate(schedule.departure_time)}</Text>

            <View style={styles.routeContainer}>
              <View style={styles.routePoint}>
                <View style={styles.routeDot} />
                <View>
                  <Text style={styles.time}>{formatTime(schedule.departure_time)}</Text>
                  <Text style={styles.port}>{schedule.departure_port}</Text>
                </View>
              </View>

              <View style={styles.durationContainer}>
                <View style={styles.routeLine} />
                <View style={styles.durationBadge}>
                  <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.duration}>{formatDuration()}</Text>
                </View>
              </View>

              <View style={styles.routePoint}>
                <View style={[styles.routeDot, styles.routeDotEnd]} />
                <View>
                  <Text style={styles.time}>{formatTime(schedule.arrival_time)}</Text>
                  <Text style={styles.port}>{schedule.arrival_port}</Text>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Amenities */}
        {schedule.amenities && schedule.amenities.length > 0 && (
          <Card style={styles.section}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Onboard Amenities</Text>
              <View style={styles.amenitiesGrid}>
                {schedule.amenities.map((amenity, index) => (
                  <View key={index} style={styles.amenityItem}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={styles.amenityText}>{amenity}</Text>
                  </View>
                ))}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Availability */}
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Availability</Text>
            <View style={styles.availabilityRow}>
              <View style={styles.availabilityItem}>
                <Ionicons name="people" size={24} color={colors.primary} />
                <Text style={styles.availabilityValue}>{schedule.available_capacity}</Text>
                <Text style={styles.availabilityLabel}>Passenger seats</Text>
              </View>
              <View style={styles.availabilityItem}>
                <Ionicons name="car" size={24} color={colors.primary} />
                <Text style={styles.availabilityValue}>{schedule.vehicle_capacity}</Text>
                <Text style={styles.availabilityLabel}>Vehicle spaces</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Price Info */}
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Pricing</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Adult (Deck)</Text>
              <Text style={styles.priceValue}>€{(schedule.base_price ?? 0).toFixed(2)}</Text>
            </View>
            <Divider style={styles.priceDivider} />
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Child (4-11 years)</Text>
              <Text style={styles.priceValue}>€{((schedule.base_price ?? 0) * 0.5).toFixed(2)}</Text>
            </View>
            <Divider style={styles.priceDivider} />
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Infant (0-3 years)</Text>
              <Text style={styles.priceValue}>Free</Text>
            </View>
            <Text style={styles.priceNote}>
              Cabin upgrades and meals available during booking
            </Text>
          </Card.Content>
        </Card>

        {/* Bottom spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Book Button */}
      <View style={styles.bottomBar}>
        <View style={styles.priceContainer}>
          <Text style={styles.fromText}>From</Text>
          <Text style={styles.totalPrice}>€{(schedule.base_price ?? 0).toFixed(0)}</Text>
          <Text style={styles.perPerson}>per person</Text>
        </View>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('Booking', { schedule })}
          style={styles.bookButton}
          contentStyle={styles.bookButtonContent}
        >
          Book Now
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerCard: {
    margin: spacing.md,
    borderRadius: borderRadius.lg,
  },
  operatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  operatorChip: {
    backgroundColor: colors.background,
  },
  vesselName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  date: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  routeContainer: {
    marginLeft: spacing.sm,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  routeDotEnd: {
    backgroundColor: colors.secondary,
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
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 5,
    marginVertical: spacing.sm,
  },
  routeLine: {
    width: 2,
    height: 40,
    backgroundColor: colors.border,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: spacing.md,
  },
  duration: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  section: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  amenitiesGrid: {
    gap: spacing.sm,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  amenityText: {
    fontSize: 14,
    color: colors.text,
  },
  availabilityRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  availabilityItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  availabilityValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xs,
  },
  availabilityLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  priceLabel: {
    fontSize: 14,
    color: colors.text,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  priceDivider: {
    marginVertical: spacing.xs,
  },
  priceNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceContainer: {
    flex: 1,
  },
  fromText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  perPerson: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bookButton: {
    borderRadius: borderRadius.md,
  },
  bookButtonContent: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
});
