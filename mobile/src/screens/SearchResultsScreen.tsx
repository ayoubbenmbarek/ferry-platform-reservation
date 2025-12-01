import React from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Text, Card, Chip, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, differenceInMinutes } from 'date-fns';

import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { selectOutbound, selectReturn } from '../store/slices/searchSlice';
import { setSelectedSchedule, setReturnSchedule } from '../store/slices/bookingSlice';
import { RootStackParamList, FerrySchedule } from '../types';
import { colors, spacing, borderRadius } from '../constants/theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'SearchResults'>;

export default function SearchResultsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const dispatch = useAppDispatch();

  const {
    outboundResults,
    returnResults,
    selectedOutbound,
    selectedReturn,
    isRoundTrip,
    isSearching,
    adults,
    children,
    infants,
  } = useAppSelector((state) => state.search);

  // Price multipliers (children typically 50% off, infants free)
  const CHILD_PRICE_MULTIPLIER = 0.5;
  const INFANT_PRICE_MULTIPLIER = 0;

  const calculateTotalPrice = (basePrice: number) => {
    const adultTotal = basePrice * adults;
    const childTotal = basePrice * CHILD_PRICE_MULTIPLIER * children;
    const infantTotal = basePrice * INFANT_PRICE_MULTIPLIER * infants;
    return adultTotal + childTotal + infantTotal;
  };

  const [showReturn, setShowReturn] = React.useState(false);

  // Find cheapest ferry for Best Price highlighting
  const cheapestOutboundId = React.useMemo(() => {
    if (outboundResults.length === 0) return null;
    const cheapest = outboundResults.reduce((min, ferry) => {
      const minPrice = min.base_price ?? 999999;
      const currentPrice = ferry.base_price ?? 999999;
      return currentPrice < minPrice ? ferry : min;
    }, outboundResults[0]);
    return cheapest.sailing_id || cheapest.id;
  }, [outboundResults]);

  const cheapestReturnId = React.useMemo(() => {
    if (returnResults.length === 0) return null;
    const cheapest = returnResults.reduce((min, ferry) => {
      const minPrice = min.base_price ?? 999999;
      const currentPrice = ferry.base_price ?? 999999;
      return currentPrice < minPrice ? ferry : min;
    }, returnResults[0]);
    return cheapest.sailing_id || cheapest.id;
  }, [returnResults]);

  const formatTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'HH:mm');
    } catch {
      return '--:--';
    }
  };

  const formatDuration = (departure: string, arrival: string) => {
    try {
      const mins = differenceInMinutes(parseISO(arrival), parseISO(departure));
      const hours = Math.floor(mins / 60);
      const minutes = mins % 60;
      return `${hours}h ${minutes}m`;
    } catch {
      return '--';
    }
  };

  const handleSelectOutbound = (schedule: FerrySchedule) => {
    dispatch(selectOutbound(schedule));
    dispatch(setSelectedSchedule(schedule));

    if (isRoundTrip && returnResults.length > 0) {
      setShowReturn(true);
    } else {
      navigation.navigate('Booking', { schedule });
    }
  };

  const handleSelectReturn = (schedule: FerrySchedule) => {
    dispatch(selectReturn(schedule));
    dispatch(setReturnSchedule(schedule));

    if (selectedOutbound) {
      navigation.navigate('Booking', {
        schedule: selectedOutbound,
        returnSchedule: schedule,
      });
    }
  };

  const renderFerryCard = (schedule: FerrySchedule, isReturn: boolean = false) => {
    const isSelected = isReturn
      ? selectedReturn?.sailing_id === schedule.sailing_id
      : selectedOutbound?.sailing_id === schedule.sailing_id;

    const ferryId = schedule.sailing_id || schedule.id;
    const isBestPrice = isReturn
      ? ferryId === cheapestReturnId
      : ferryId === cheapestOutboundId;

    return (
      <TouchableOpacity
        onPress={() => isReturn ? handleSelectReturn(schedule) : handleSelectOutbound(schedule)}
      >
        <Card style={[styles.ferryCard, isSelected && styles.ferryCardSelected, isBestPrice && styles.bestPriceCard]}>
          <Card.Content>
            {/* Best Price Badge */}
            {isBestPrice && (
              <View style={styles.bestPriceBadge}>
                <Ionicons name="star" size={12} color="#fff" />
                <Text style={styles.bestPriceBadgeText}>Best Price</Text>
              </View>
            )}

            {/* Operator & Vessel */}
            <View style={styles.cardHeader}>
              <View style={styles.operatorInfo}>
                <Chip compact style={styles.operatorChip}>
                  {schedule.operator}
                </Chip>
                <Text style={styles.vesselName}>{schedule.vessel_name}</Text>
              </View>
              <View style={styles.priceContainer}>
                <Text style={[styles.price, isBestPrice && styles.bestPriceText]}>
                  €{(schedule.base_price ?? 0).toFixed(0)}
                </Text>
                <Text style={styles.priceLabel}>per adult</Text>
                {(children > 0 || infants > 0) && (
                  <Text style={styles.totalPrice}>
                    Total: €{calculateTotalPrice(schedule.base_price ?? 0).toFixed(0)}
                  </Text>
                )}
              </View>
            </View>

            {/* Times */}
            <View style={styles.timesContainer}>
              <View style={styles.timeBlock}>
                <Text style={styles.time}>{formatTime(schedule.departure_time)}</Text>
                <Text style={styles.port}>{schedule.departure_port}</Text>
              </View>

              <View style={styles.durationBlock}>
                <Text style={styles.duration}>
                  {formatDuration(schedule.departure_time, schedule.arrival_time)}
                </Text>
                <View style={styles.durationLine}>
                  <View style={styles.dot} />
                  <View style={styles.line} />
                  <Ionicons name="boat" size={16} color={colors.primary} />
                  <View style={styles.line} />
                  <View style={styles.dot} />
                </View>
                <Text style={styles.directText}>Direct</Text>
              </View>

              <View style={styles.timeBlock}>
                <Text style={styles.time}>{formatTime(schedule.arrival_time)}</Text>
                <Text style={styles.port}>{schedule.arrival_port}</Text>
              </View>
            </View>

            {/* Availability */}
            <View style={styles.availabilityRow}>
              <View style={styles.availabilityBadge}>
                <Ionicons
                  name="people"
                  size={14}
                  color={schedule.available_capacity > 50 ? colors.success : colors.warning}
                />
                <Text
                  style={[
                    styles.availabilityText,
                    { color: schedule.available_capacity > 50 ? colors.success : colors.warning },
                  ]}
                >
                  {schedule.available_capacity > 100
                    ? 'Good availability'
                    : schedule.available_capacity > 50
                    ? 'Limited seats'
                    : 'Few seats left'}
                </Text>
              </View>
              {schedule.amenities?.length > 0 && (
                <View style={styles.amenitiesRow}>
                  {schedule.amenities.slice(0, 3).map((amenity, index) => (
                    <Chip
                      key={index}
                      compact
                      style={styles.amenityChip}
                      textStyle={styles.amenityChipText}
                    >
                      {amenity}
                    </Chip>
                  ))}
                </View>
              )}
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  if (isSearching) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Searching for ferries...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentResults = showReturn ? returnResults : outboundResults;

  if (currentResults.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.emptyContainer}>
          <Ionicons name="boat-outline" size={80} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No ferries found</Text>
          <Text style={styles.emptySubtitle}>
            Try adjusting your search dates or route
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Journey Toggle */}
      {isRoundTrip && (
        <View style={styles.journeyToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, !showReturn && styles.toggleButtonActive]}
            onPress={() => setShowReturn(false)}
          >
            <Text style={[styles.toggleText, !showReturn && styles.toggleTextActive]}>
              Outbound
            </Text>
            {selectedOutbound && (
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, showReturn && styles.toggleButtonActive]}
            onPress={() => selectedOutbound && setShowReturn(true)}
            disabled={!selectedOutbound}
          >
            <Text
              style={[
                styles.toggleText,
                showReturn && styles.toggleTextActive,
                !selectedOutbound && styles.toggleTextDisabled,
              ]}
            >
              Return
            </Text>
            {selectedReturn && (
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {currentResults.length} {showReturn ? 'return' : 'outbound'} ferry
          {currentResults.length !== 1 ? 's' : ''} found
        </Text>
      </View>

      {/* Results List */}
      <FlatList
        data={currentResults}
        keyExtractor={(item) => item.sailing_id}
        renderItem={({ item }) => renderFerryCard(item, showReturn)}
        contentContainerStyle={styles.listContent}
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
  },
  journeyToggle: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: '#fff',
  },
  toggleTextDisabled: {
    color: colors.disabled,
  },
  resultsHeader: {
    padding: spacing.md,
  },
  resultsCount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: 0,
  },
  ferryCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ferryCardSelected: {
    borderColor: colors.primary,
  },
  bestPriceCard: {
    borderColor: colors.success,
    borderWidth: 2,
  },
  bestPriceBadge: {
    position: 'absolute',
    top: -10,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    zIndex: 1,
  },
  bestPriceBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  bestPriceText: {
    color: colors.success,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  operatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  operatorChip: {
    backgroundColor: colors.background,
  },
  vesselName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  priceLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  totalPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
  timesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  timeBlock: {
    alignItems: 'center',
  },
  time: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  port: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  durationBlock: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  duration: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  durationLine: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  directText: {
    fontSize: 11,
    color: colors.success,
    marginTop: spacing.xs,
  },
  availabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  amenitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  amenityChip: {
    height: 24,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amenityChipText: {
    fontSize: 11,
    lineHeight: 14,
    marginVertical: 0,
    marginHorizontal: 0,
  },
});
