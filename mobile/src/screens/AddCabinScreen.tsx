import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, Card, Button, ActivityIndicator, Divider, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';

import { cabinService, Cabin } from '../services/cabinService';
import { bookingService } from '../services/bookingService';
import { RootStackParamList, Booking } from '../types';
import { colors, spacing, borderRadius } from '../constants/theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'AddCabin'>;

interface CabinQuantity {
  [cabinId: number]: number;
}

export default function AddCabinScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { bookingId, alertId, journeyType } = route.params;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [cabinQuantities, setCabinQuantities] = useState<CabinQuantity>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [bookingId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load booking and cabins in parallel
      const [bookingData, cabinsData] = await Promise.all([
        bookingService.getBooking(bookingId),
        cabinService.getCabins({ is_available: true }),
      ]);

      setBooking(bookingData);
      setCabins(cabinsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuantityChange = (cabinId: number, delta: number) => {
    setCabinQuantities((prev) => {
      const current = prev[cabinId] || 0;
      const newQuantity = Math.max(0, Math.min(10, current + delta));

      if (newQuantity === 0) {
        const { [cabinId]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [cabinId]: newQuantity };
    });
  };

  const getTotalCabins = () => {
    return Object.values(cabinQuantities).reduce((sum, qty) => sum + qty, 0);
  };

  const getTotalPrice = () => {
    return Object.entries(cabinQuantities).reduce((sum, [cabinId, qty]) => {
      const cabin = cabins.find((c) => c.id === Number(cabinId));
      return sum + (cabin?.base_price || 0) * qty;
    }, 0);
  };

  const handleProceedToPayment = () => {
    const selectedCabins = Object.entries(cabinQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([cabinId, qty]) => {
        const cabin = cabins.find((c) => c.id === Number(cabinId))!;
        return {
          cabinId: Number(cabinId),
          quantity: qty,
          unitPrice: cabin.base_price,
        };
      });

    if (selectedCabins.length === 0) {
      Alert.alert('No Cabins Selected', 'Please select at least one cabin to continue.');
      return;
    }

    navigation.navigate('Payment', {
      bookingId,
      cabinUpgrade: {
        cabinSelections: selectedCabins,
        totalAmount: getTotalPrice(),
        journeyType,
        alertId,
      },
    });
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'EEE, MMM d, yyyy');
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading available cabins...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !booking) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={60} color={colors.error} />
          <Text style={styles.errorTitle}>Error Loading Data</Text>
          <Text style={styles.errorMessage}>{error || 'Booking not found'}</Text>
          <Button mode="contained" onPress={loadData} style={styles.retryButton}>
            Try Again
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const isReturn = journeyType === 'return';
  const departurePort = isReturn ? booking.return_departure_port : booking.departure_port;
  const arrivalPort = isReturn ? booking.return_arrival_port : booking.arrival_port;
  const departureTime = isReturn ? booking.return_departure_time : booking.departure_time;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Booking Info Header */}
        <View style={styles.bookingHeader}>
          <View style={styles.journeyBadge}>
            <Ionicons name="boat-outline" size={16} color={colors.primary} />
            <Text style={styles.journeyText}>
              {isReturn ? 'Return Journey' : 'Outbound Journey'}
            </Text>
          </View>

          <View style={styles.routeInfo}>
            <Text style={styles.routeText}>
              {departurePort} → {arrivalPort}
            </Text>
            {departureTime && (
              <Text style={styles.dateText}>
                {formatDate(departureTime)} at {formatTime(departureTime)}
              </Text>
            )}
          </View>

          <View style={styles.bookingRef}>
            <Text style={styles.bookingRefLabel}>Booking Reference</Text>
            <Text style={styles.bookingRefValue}>#{booking.booking_reference}</Text>
          </View>
        </View>

        {/* Cabins List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Cabins</Text>
          <Text style={styles.sectionSubtitle}>
            Select cabins to add to your booking
          </Text>

          {cabins.length === 0 ? (
            <View style={styles.noCabinsContainer}>
              <Ionicons name="bed-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.noCabinsText}>No cabins available at the moment</Text>
            </View>
          ) : (
            cabins.map((cabin) => {
              const quantity = cabinQuantities[cabin.id] || 0;
              const amenities = cabinService.getAmenities(cabin);

              return (
                <Card key={cabin.id} style={styles.cabinCard}>
                  <Card.Content>
                    <View style={styles.cabinHeader}>
                      <View style={styles.cabinIconContainer}>
                        <Ionicons
                          name={cabinService.getCabinTypeIcon(cabin.cabin_type) as any}
                          size={24}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.cabinInfo}>
                        <Text style={styles.cabinName}>{cabin.name}</Text>
                        <Text style={styles.cabinType}>
                          {cabinService.getCabinTypeName(cabin.cabin_type)}
                        </Text>
                      </View>
                      <View style={styles.priceContainer}>
                        <Text style={styles.priceValue}>€{cabin.base_price.toFixed(2)}</Text>
                        <Text style={styles.priceLabel}>per cabin</Text>
                      </View>
                    </View>

                    {cabin.description && (
                      <Text style={styles.cabinDescription}>{cabin.description}</Text>
                    )}

                    <View style={styles.cabinDetails}>
                      <View style={styles.detailItem}>
                        <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.detailText}>Up to {cabin.max_occupancy} guests</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="bed-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.detailText}>{cabin.bed_type}</Text>
                      </View>
                    </View>

                    {amenities.length > 0 && (
                      <View style={styles.amenitiesContainer}>
                        {amenities.map((amenity) => (
                          <Chip key={amenity} style={styles.amenityChip} textStyle={styles.amenityText}>
                            {amenity}
                          </Chip>
                        ))}
                      </View>
                    )}

                    <Divider style={styles.divider} />

                    {/* Quantity Selector */}
                    <View style={styles.quantityContainer}>
                      <Text style={styles.quantityLabel}>Quantity</Text>
                      <View style={styles.quantitySelector}>
                        <TouchableOpacity
                          style={[styles.quantityButton, quantity === 0 && styles.quantityButtonDisabled]}
                          onPress={() => handleQuantityChange(cabin.id, -1)}
                          disabled={quantity === 0}
                        >
                          <Ionicons
                            name="remove"
                            size={20}
                            color={quantity === 0 ? colors.textLight : colors.primary}
                          />
                        </TouchableOpacity>
                        <Text style={styles.quantityValue}>{quantity}</Text>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => handleQuantityChange(cabin.id, 1)}
                        >
                          <Ionicons name="add" size={20} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {quantity > 0 && (
                      <View style={styles.subtotalContainer}>
                        <Text style={styles.subtotalLabel}>Subtotal</Text>
                        <Text style={styles.subtotalValue}>
                          €{(cabin.base_price * quantity).toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </Card.Content>
                </Card>
              );
            })
          )}
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Bottom Bar */}
      {getTotalCabins() > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.totalInfo}>
            <Text style={styles.totalLabel}>
              {getTotalCabins()} cabin{getTotalCabins() !== 1 ? 's' : ''} selected
            </Text>
            <Text style={styles.totalPrice}>€{getTotalPrice().toFixed(2)}</Text>
          </View>
          <Button
            mode="contained"
            onPress={handleProceedToPayment}
            style={styles.payButton}
            labelStyle={styles.payButtonLabel}
          >
            Continue to Payment
          </Button>
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
    fontSize: 16,
    color: colors.textSecondary,
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
  },
  errorMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retryButton: {
    marginTop: spacing.lg,
  },
  bookingHeader: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  journeyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  journeyText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  routeInfo: {
    marginBottom: spacing.md,
  },
  routeText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  dateText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  bookingRef: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  bookingRefLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  bookingRefValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  section: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  noCabinsContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  noCabinsText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  cabinCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
  },
  cabinHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cabinIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cabinInfo: {
    flex: 1,
  },
  cabinName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  cabinType: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  priceLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  cabinDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  cabinDetails: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  amenityChip: {
    height: 26,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amenityText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 13,
    marginVertical: 0,
    marginHorizontal: 0,
  },
  divider: {
    marginVertical: spacing.md,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quantityButtonDisabled: {
    opacity: 0.5,
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    minWidth: 30,
    textAlign: 'center',
  },
  subtotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  subtotalLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  subtotalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.success,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  totalInfo: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  payButton: {
    paddingHorizontal: spacing.lg,
  },
  payButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
