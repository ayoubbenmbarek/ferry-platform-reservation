import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform, Linking } from 'react-native';
import { Text, Card, Button, Divider, Checkbox } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, differenceInSeconds } from 'date-fns';
import { CardField, useConfirmPayment, CardFieldInput } from '@stripe/stripe-react-native';

import { useAppSelector } from '../hooks/useAppDispatch';
import { bookingService } from '../services/bookingService';
import { ferryService } from '../services/ferryService';
import { notificationService } from '../services/notificationService';
import { cabinService } from '../services/cabinService';
import { alertService } from '../services/alertService';
import { RootStackParamList, Booking, Cabin, Meal, CabinUpgradePaymentParams } from '../types';
import { colors, spacing, borderRadius } from '../constants/theme';
import { CANCELLATION_PROTECTION_PRICE } from '../constants/config';
import LoadingScreen from '../components/LoadingScreen';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'Payment'>;

// Booking expiration time in minutes (default if expires_at not set)
const BOOKING_EXPIRATION_MINUTES = 30;

// Price multipliers (same as BookingScreen)
const CHILD_PRICE_MULTIPLIER = 0.5;
const INFANT_PRICE_MULTIPLIER = 0;
const VEHICLE_PRICE = 50;

export default function PaymentScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { bookingId, cabinUpgrade, cabinSelections, returnCabinSelections, mealSelections, returnMealSelections } = route.params as any;

  // Check if this is a cabin upgrade payment
  const isCabinUpgrade = !!cabinUpgrade;
  const cabinUpgradeData = cabinUpgrade as CabinUpgradePaymentParams | undefined;

  // Stripe hook for payment confirmation
  const { confirmPayment, loading: stripeLoading } = useConfirmPayment();

  // Get data from Redux state
  const { selectedSchedule, returnSchedule, hasCancellationProtection, passengers } = useAppSelector((state) => state.booking);
  const { adults, children, infants, vehicles } = useAppSelector((state) => state.search);

  const [booking, setBooking] = useState<Booking | null>(null);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<{ seconds: number; percentage: number }>({ seconds: 0, percentage: 100 });
  const [cardDetails, setCardDetails] = useState<CardFieldInput.Details | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isPriceBreakdownExpanded, setIsPriceBreakdownExpanded] = useState(false);

  useEffect(() => {
    loadData();
  }, [bookingId]);

  // Countdown timer - only for new bookings (not cabin upgrades)
  useEffect(() => {
    // Skip timer for cabin upgrades - the booking is already confirmed
    if (!booking || isCabinUpgrade) return;

    // Skip timer for already confirmed bookings
    if (booking.status === 'confirmed') return;

    const calculateTimeRemaining = () => {
      const now = new Date();
      let expirationTime: Date;

      if (booking.expires_at) {
        expirationTime = parseISO(booking.expires_at);
      } else if (booking.created_at) {
        const created = parseISO(booking.created_at);
        expirationTime = new Date(created.getTime() + BOOKING_EXPIRATION_MINUTES * 60 * 1000);
      } else {
        return { seconds: BOOKING_EXPIRATION_MINUTES * 60, percentage: 100 };
      }

      const secondsRemaining = Math.max(0, differenceInSeconds(expirationTime, now));
      const totalSeconds = BOOKING_EXPIRATION_MINUTES * 60;
      const percentage = Math.max(0, Math.min(100, (secondsRemaining / totalSeconds) * 100));

      return { seconds: secondsRemaining, percentage };
    };

    // Initial calculation
    setTimeRemaining(calculateTimeRemaining());

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      // If expired, show alert
      if (remaining.seconds === 0) {
        clearInterval(interval);
        Alert.alert(
          'Booking Expired',
          'Your booking has expired. Please start a new search.',
          [{ text: 'OK', onPress: () => navigation.navigate('Main' as any) }]
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [booking, navigation, isCabinUpgrade]);

  // Format seconds to MM:SS for countdown
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get progress bar color based on time remaining
  const getProgressBarColor = () => {
    if (timeRemaining.percentage > 50) return colors.success;
    if (timeRemaining.percentage > 25) return '#F59E0B'; // Orange/warning
    return colors.error;
  };

  const isExpiringSoon = timeRemaining.seconds < 300; // Less than 5 minutes

  const loadData = async () => {
    try {
      const [bookingData, cabinsData, mealsData] = await Promise.all([
        bookingService.getBooking(bookingId),
        ferryService.getAllCabins(adults + children + infants),
        ferryService.getAllMeals(),
      ]);
      setBooking(bookingData);
      setCabins(cabinsData);
      setMeals(mealsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate prices (same logic as BookingScreen)
  const calculateJourneyFare = (basePrice: number) => {
    const adultTotal = (basePrice ?? 0) * adults;
    const childTotal = (basePrice ?? 0) * CHILD_PRICE_MULTIPLIER * children;
    const infantTotal = (basePrice ?? 0) * INFANT_PRICE_MULTIPLIER * infants;
    return adultTotal + childTotal + infantTotal;
  };

  const outboundFare = selectedSchedule ? calculateJourneyFare(selectedSchedule.base_price ?? 0) : 0;
  const returnFare = returnSchedule ? calculateJourneyFare(returnSchedule.base_price ?? 0) : 0;
  const outboundVehicleCost = vehicles * VEHICLE_PRICE;
  const returnVehicleCost = returnSchedule ? vehicles * VEHICLE_PRICE : 0;

  // Calculate cabin total from selections
  const cabinTotal = (cabinSelections || []).reduce((sum: number, sel: any) => {
    const cabin = cabins.find(c => String(c.id) === String(sel.cabinId));
    return sum + ((Number(cabin?.price) || sel.price || 0) * sel.quantity);
  }, 0) + (returnCabinSelections || []).reduce((sum: number, sel: any) => {
    const cabin = cabins.find(c => String(c.id) === String(sel.cabinId));
    return sum + ((Number(cabin?.price) || sel.price || 0) * sel.quantity);
  }, 0);

  // Calculate meal total from selections
  const mealTotal = (mealSelections || []).reduce((sum: number, sel: any) => {
    const meal = meals.find(m => String(m.id) === String(sel.mealId));
    return sum + ((Number(meal?.price) || sel.price || 0) * sel.quantity);
  }, 0) + (returnMealSelections || []).reduce((sum: number, sel: any) => {
    const meal = meals.find(m => String(m.id) === String(sel.mealId));
    return sum + ((Number(meal?.price) || sel.price || 0) * sel.quantity);
  }, 0);

  const cancellationCost = hasCancellationProtection ? CANCELLATION_PROTECTION_PRICE : 0;
  const subtotal = outboundFare + returnFare + outboundVehicleCost + returnVehicleCost + cabinTotal + mealTotal + cancellationCost;
  const taxRate = 0.10; // 10% tax
  const taxAmount = subtotal * taxRate;
  const calculatedTotal = subtotal + taxAmount;

  // Use booking's total_amount from backend if available, otherwise use calculated total
  const totalAmount = booking?.total_amount && booking.total_amount > 0 ? booking.total_amount : calculatedTotal;

  const formatTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'HH:mm');
    } catch {
      return '--:--';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'EEE, MMM d');
    } catch {
      return dateString;
    }
  };

  const handlePayment = async () => {
    if (!booking) return;

    // Validate card details
    if (!cardDetails?.complete) {
      Alert.alert('Incomplete Card', 'Please enter your complete card details.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Calculate payment amount based on payment type
      let paymentAmount: number;
      if (isCabinUpgrade && cabinUpgradeData) {
        // For cabin upgrades, use the cabin upgrade total (with tax)
        const cabinSubtotal = cabinUpgradeData.totalAmount;
        const cabinTax = cabinSubtotal * 0.10; // 10% tax
        paymentAmount = cabinSubtotal + cabinTax;
      } else {
        // For regular bookings, use booking's total_amount from backend, or calculated totalAmount as fallback
        paymentAmount = booking.total_amount || totalAmount;
      }

      // Create payment intent and get client secret
      const paymentIntent = await bookingService.createPaymentIntent(bookingId, paymentAmount, 'EUR', isCabinUpgrade);

      if (!paymentIntent.client_secret) {
        throw new Error('Failed to get payment client secret');
      }

      // Confirm payment with Stripe SDK
      const { paymentIntent: confirmedIntent, error: stripeError } = await confirmPayment(
        paymentIntent.client_secret,
        {
          paymentMethodType: 'Card',
          paymentMethodData: {
            billingDetails: {
              email: booking.contact_email,
              name: `${booking.contact_first_name || ''} ${booking.contact_last_name || ''}`.trim(),
            },
          },
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message || 'Payment failed');
      }

      if (confirmedIntent?.status === 'Succeeded') {
        // Confirm on backend
        const result = await bookingService.confirmPayment(bookingId, paymentIntent.payment_intent_id);

        if (result.success) {
          if (isCabinUpgrade && cabinUpgradeData) {
            // Handle cabin upgrade: add cabins to booking
            // Backend handles: adding cabin, marking alert fulfilled, sending invoice email
            try {
              for (const selection of cabinUpgradeData.cabinSelections) {
                await cabinService.addCabinToBooking(
                  bookingId,
                  selection.cabinId,
                  selection.quantity,
                  cabinUpgradeData.journeyType,
                  cabinUpgradeData.alertId // Pass alertId - backend marks it as fulfilled
                );
              }

              Alert.alert(
                'Cabin Added!',
                'Your cabin has been successfully added to your booking. A confirmation email with invoice has been sent.',
                [
                  {
                    text: 'View Booking',
                    onPress: () => navigation.replace('BookingDetails', { bookingId }),
                  },
                ]
              );
            } catch (cabinError: any) {
              console.error('Failed to add cabin:', cabinError);
              Alert.alert(
                'Payment Successful',
                'Payment was successful but there was an issue adding the cabin. Please contact support.',
                [
                  {
                    text: 'View Booking',
                    onPress: () => navigation.replace('BookingDetails', { bookingId }),
                  },
                ]
              );
            }
          } else {
            // Normal booking payment flow
            // Send booking confirmation notification
            await notificationService.sendBookingConfirmation(booking);
            // Schedule departure reminders
            await notificationService.scheduleDepartureReminders(booking);

            navigation.replace('BookingConfirmation', {
              bookingReference: booking.booking_reference,
            });
          }
        } else {
          throw new Error('Payment confirmation failed');
        }
      } else {
        throw new Error(`Payment status: ${confirmedIntent?.status || 'unknown'}`);
      }
    } catch (err: any) {
      setError(err.message);
      Alert.alert('Payment Failed', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading booking details" />;
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={60} color={colors.error} />
          <Text style={styles.errorTitle}>Booking Not Found</Text>
          <Text style={styles.errorMessage}>{error || 'Unable to load booking details'}</Text>
          <Button mode="contained" onPress={() => navigation.goBack()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate cabin upgrade totals
  const cabinUpgradeSubtotal = cabinUpgradeData?.totalAmount || 0;
  const cabinUpgradeTax = cabinUpgradeSubtotal * 0.10;
  const cabinUpgradeTotal = cabinUpgradeSubtotal + cabinUpgradeTax;

  // Render cabin upgrade payment UI
  if (isCabinUpgrade && cabinUpgradeData) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Cabin Upgrade Header */}
          <Card style={styles.section}>
            <Card.Content>
              <View style={styles.upgradeHeader}>
                <View style={styles.upgradeIconContainer}>
                  <Ionicons name="bed-outline" size={28} color={colors.primary} />
                </View>
                <View style={styles.upgradeHeaderText}>
                  <Text style={styles.upgradeTitle}>Add Cabin to Booking</Text>
                  <Text style={styles.upgradeSubtitle}>#{booking.booking_reference}</Text>
                </View>
              </View>

              <View style={styles.journeyBadge}>
                <Ionicons name="boat-outline" size={14} color={colors.primary} />
                <Text style={styles.journeyBadgeText}>
                  {cabinUpgradeData.journeyType === 'return' ? 'Return Journey' : 'Outbound Journey'}
                </Text>
              </View>

              <Text style={styles.routeInfoText}>
                {cabinUpgradeData.journeyType === 'return'
                  ? `${booking.return_departure_port || booking.arrival_port} → ${booking.return_arrival_port || booking.departure_port}`
                  : `${booking.departure_port} → ${booking.arrival_port}`}
              </Text>
            </Card.Content>
          </Card>

          {/* Selected Cabins */}
          <Card style={styles.section}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Selected Cabins</Text>

              {cabinUpgradeData.cabinSelections.map((selection, index) => (
                <View key={index} style={styles.cabinSelectionRow}>
                  <View style={styles.cabinSelectionInfo}>
                    <Ionicons name="bed-outline" size={20} color={colors.textSecondary} />
                    <View>
                      <Text style={styles.cabinSelectionName}>Cabin #{selection.cabinId}</Text>
                      <Text style={styles.cabinSelectionQty}>{selection.quantity}x @ €{selection.unitPrice.toFixed(2)}</Text>
                    </View>
                  </View>
                  <Text style={styles.cabinSelectionPrice}>
                    €{(selection.quantity * selection.unitPrice).toFixed(2)}
                  </Text>
                </View>
              ))}
            </Card.Content>
          </Card>

          {/* Price Summary */}
          <Card style={styles.section}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Price Summary</Text>

              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Cabin(s)</Text>
                <Text style={styles.priceValue}>€{cabinUpgradeSubtotal.toFixed(2)}</Text>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Tax (10%)</Text>
                <Text style={styles.priceValue}>€{cabinUpgradeTax.toFixed(2)}</Text>
              </View>

              <Divider style={styles.totalDivider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>€{cabinUpgradeTotal.toFixed(2)}</Text>
              </View>
            </Card.Content>
          </Card>

          {/* Payment Card */}
          <Card style={styles.section}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Payment Details</Text>

              <CardField
                postalCodeEnabled={false}
                placeholders={{ number: '4242 4242 4242 4242' }}
                cardStyle={{
                  backgroundColor: colors.background,
                  textColor: colors.text,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 8,
                  fontSize: 16,
                  placeholderColor: colors.textSecondary,
                }}
                style={styles.cardFieldContainer}
                onCardChange={(details) => setCardDetails(details)}
              />
            </Card.Content>
          </Card>

          {/* Terms */}
          <View style={styles.termsContainer}>
            <Checkbox
              status={agreedToTerms ? 'checked' : 'unchecked'}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
              color={colors.primary}
              uncheckedColor={colors.textSecondary}
            />
            <TouchableOpacity onPress={() => Linking.openURL('https://example.com/terms')}>
              <Text style={styles.termsText}>
                I agree to the <Text style={styles.termsLink}>Terms & Conditions</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Pay Button */}
          <Button
            mode="contained"
            onPress={handlePayment}
            disabled={!agreedToTerms || !cardDetails?.complete || isProcessing || stripeLoading}
            loading={isProcessing || stripeLoading}
            style={styles.payButton}
            labelStyle={styles.payButtonLabel}
          >
            {isProcessing ? 'Processing...' : `Pay €${cabinUpgradeTotal.toFixed(2)}`}
          </Button>

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Regular booking payment UI
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Booking Summary */}
        <Card style={styles.section}>
          <Card.Content>
            <View style={styles.headerRow}>
              <Text style={styles.sectionTitle}>Booking Summary</Text>
              <Text style={styles.reference}>#{booking.booking_reference}</Text>
            </View>

            {/* Outbound Journey */}
            {selectedSchedule && (
              <View style={styles.journeyCard}>
                <View style={styles.journeyHeader}>
                  <View style={styles.journeyIcon}>
                    <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.journeyTitle}>Outbound</Text>
                </View>
                <Text style={styles.routeText}>
                  {selectedSchedule.departure_port} → {selectedSchedule.arrival_port}
                </Text>
                <Text style={styles.journeyDetails}>
                  {formatDate(selectedSchedule.departure_time)} • {formatTime(selectedSchedule.departure_time)} - {formatTime(selectedSchedule.arrival_time)}
                </Text>
                <Text style={styles.operatorText}>{selectedSchedule.operator} • {selectedSchedule.vessel_name}</Text>
              </View>
            )}

            {/* Return Journey */}
            {returnSchedule && (
              <View style={styles.journeyCard}>
                <View style={styles.journeyHeader}>
                  <View style={[styles.journeyIcon, { backgroundColor: colors.secondary + '20' }]}>
                    <Ionicons name="arrow-back" size={16} color={colors.secondary} />
                  </View>
                  <Text style={styles.journeyTitle}>Return</Text>
                  <View style={styles.roundTripBadge}>
                    <Ionicons name="repeat" size={12} color={colors.primary} />
                    <Text style={styles.roundTripText}>Round Trip</Text>
                  </View>
                </View>
                <Text style={styles.routeText}>
                  {returnSchedule.departure_port} → {returnSchedule.arrival_port}
                </Text>
                <Text style={styles.journeyDetails}>
                  {formatDate(returnSchedule.departure_time)} • {formatTime(returnSchedule.departure_time)} - {formatTime(returnSchedule.arrival_time)}
                </Text>
                <Text style={styles.operatorText}>{returnSchedule.operator} • {returnSchedule.vessel_name}</Text>
              </View>
            )}

            {/* Passengers Summary */}
            <View style={styles.summaryRow}>
              <Ionicons name="people" size={18} color={colors.primary} />
              <Text style={styles.summaryText}>
                {adults} Adult{adults > 1 ? 's' : ''}
                {children > 0 && `, ${children} Child${children > 1 ? 'ren' : ''}`}
                {infants > 0 && `, ${infants} Infant${infants > 1 ? 's' : ''}`}
              </Text>
            </View>

            {vehicles > 0 && (
              <View style={styles.summaryRow}>
                <Ionicons name="car" size={18} color={colors.primary} />
                <Text style={styles.summaryText}>{vehicles} Vehicle{vehicles > 1 ? 's' : ''}</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Cabin Selections */}
        {((cabinSelections && cabinSelections.length > 0) || (returnCabinSelections && returnCabinSelections.length > 0)) && (
          <Card style={styles.section}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Accommodation</Text>

              {cabinSelections && cabinSelections.filter((s: any) => s.quantity > 0).map((sel: any, idx: number) => {
                const cabin = cabins.find(c => String(c.id) === String(sel.cabinId));
                const price = Number(cabin?.price) || sel.price || 0;
                return (
                  <View key={`out-cabin-${idx}`} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{cabin?.name || `Cabin #${sel.cabinId}`}</Text>
                      <Text style={styles.itemMeta}>Outbound • {sel.quantity}x</Text>
                    </View>
                    <Text style={styles.itemPrice}>€{(price * sel.quantity).toFixed(2)}</Text>
                  </View>
                );
              })}

              {returnCabinSelections && returnCabinSelections.filter((s: any) => s.quantity > 0).map((sel: any, idx: number) => {
                const cabin = cabins.find(c => String(c.id) === String(sel.cabinId));
                const price = Number(cabin?.price) || sel.price || 0;
                return (
                  <View key={`ret-cabin-${idx}`} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{cabin?.name || `Cabin #${sel.cabinId}`}</Text>
                      <Text style={styles.itemMeta}>Return • {sel.quantity}x</Text>
                    </View>
                    <Text style={styles.itemPrice}>€{(price * sel.quantity).toFixed(2)}</Text>
                  </View>
                );
              })}
            </Card.Content>
          </Card>
        )}

        {/* Meal Selections */}
        {((mealSelections && mealSelections.length > 0) || (returnMealSelections && returnMealSelections.length > 0)) && (
          <Card style={styles.section}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Meals</Text>

              {mealSelections && mealSelections.filter((s: any) => s.quantity > 0).map((sel: any, idx: number) => {
                const meal = meals.find(m => String(m.id) === String(sel.mealId));
                const price = Number(meal?.price) || sel.price || 0;
                return (
                  <View key={`out-meal-${idx}`} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{meal?.name || `Meal #${sel.mealId}`}</Text>
                      <Text style={styles.itemMeta}>Outbound • {sel.quantity}x</Text>
                    </View>
                    <Text style={styles.itemPrice}>€{(price * sel.quantity).toFixed(2)}</Text>
                  </View>
                );
              })}

              {returnMealSelections && returnMealSelections.filter((s: any) => s.quantity > 0).map((sel: any, idx: number) => {
                const meal = meals.find(m => String(m.id) === String(sel.mealId));
                const price = Number(meal?.price) || sel.price || 0;
                return (
                  <View key={`ret-meal-${idx}`} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{meal?.name || `Meal #${sel.mealId}`}</Text>
                      <Text style={styles.itemMeta}>Return • {sel.quantity}x</Text>
                    </View>
                    <Text style={styles.itemPrice}>€{(price * sel.quantity).toFixed(2)}</Text>
                  </View>
                );
              })}
            </Card.Content>
          </Card>
        )}

        {/* Detailed Price Breakdown - Collapsible */}
        <Card style={styles.section}>
          <Card.Content>
            <TouchableOpacity
              style={styles.priceBreakdownHeader}
              onPress={() => setIsPriceBreakdownExpanded(!isPriceBreakdownExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.priceBreakdownTitleRow}>
                <Ionicons name="receipt-outline" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Price Breakdown</Text>
              </View>
              <View style={styles.priceBreakdownToggle}>
                <Text style={styles.priceBreakdownTotal}>€{totalAmount.toFixed(2)}</Text>
                <Ionicons
                  name={isPriceBreakdownExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.textSecondary}
                />
              </View>
            </TouchableOpacity>

            {isPriceBreakdownExpanded && (
              <View style={styles.priceBreakdownContent}>
                {/* Outbound Fare */}
                {selectedSchedule && (
                  <>
                    <Text style={styles.breakdownCategory}>Outbound Journey</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>{adults} Adult{adults > 1 ? 's' : ''} × €{(selectedSchedule.base_price ?? 0).toFixed(0)}</Text>
                      <Text style={styles.priceValue}>€{((selectedSchedule.base_price ?? 0) * adults).toFixed(2)}</Text>
                    </View>
                    {children > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>{children} Child{children > 1 ? 'ren' : ''} × €{((selectedSchedule.base_price ?? 0) * CHILD_PRICE_MULTIPLIER).toFixed(0)} (50%)</Text>
                        <Text style={styles.priceValue}>€{((selectedSchedule.base_price ?? 0) * CHILD_PRICE_MULTIPLIER * children).toFixed(2)}</Text>
                      </View>
                    )}
                    {infants > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>{infants} Infant{infants > 1 ? 's' : ''} (Free)</Text>
                        <Text style={styles.priceValue}>€0.00</Text>
                      </View>
                    )}
                    {vehicles > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>{vehicles} Vehicle{vehicles > 1 ? 's' : ''} × €{VEHICLE_PRICE}</Text>
                        <Text style={styles.priceValue}>€{outboundVehicleCost.toFixed(2)}</Text>
                      </View>
                    )}
                  </>
                )}

                {/* Return Fare */}
                {returnSchedule && (
                  <>
                    <Text style={[styles.breakdownCategory, { marginTop: spacing.md }]}>Return Journey</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>{adults} Adult{adults > 1 ? 's' : ''} × €{(returnSchedule.base_price ?? 0).toFixed(0)}</Text>
                      <Text style={styles.priceValue}>€{((returnSchedule.base_price ?? 0) * adults).toFixed(2)}</Text>
                    </View>
                    {children > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>{children} Child{children > 1 ? 'ren' : ''} × €{((returnSchedule.base_price ?? 0) * CHILD_PRICE_MULTIPLIER).toFixed(0)} (50%)</Text>
                        <Text style={styles.priceValue}>€{((returnSchedule.base_price ?? 0) * CHILD_PRICE_MULTIPLIER * children).toFixed(2)}</Text>
                      </View>
                    )}
                    {infants > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>{infants} Infant{infants > 1 ? 's' : ''} (Free)</Text>
                        <Text style={styles.priceValue}>€0.00</Text>
                      </View>
                    )}
                    {vehicles > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>{vehicles} Vehicle{vehicles > 1 ? 's' : ''} × €{VEHICLE_PRICE}</Text>
                        <Text style={styles.priceValue}>€{returnVehicleCost.toFixed(2)}</Text>
                      </View>
                    )}
                  </>
                )}

                {/* Extras */}
                {(cabinTotal > 0 || mealTotal > 0 || cancellationCost > 0) && (
                  <>
                    <Text style={[styles.breakdownCategory, { marginTop: spacing.md }]}>Extras</Text>
                    {cabinTotal > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Accommodation</Text>
                        <Text style={styles.priceValue}>€{cabinTotal.toFixed(2)}</Text>
                      </View>
                    )}
                    {mealTotal > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Meals</Text>
                        <Text style={styles.priceValue}>€{mealTotal.toFixed(2)}</Text>
                      </View>
                    )}
                    {cancellationCost > 0 && (
                      <View style={styles.priceRow}>
                        <View style={styles.protectionLabel}>
                          <Ionicons name="shield-checkmark" size={16} color={colors.success} />
                          <Text style={styles.priceLabel}>Cancellation Protection</Text>
                        </View>
                        <Text style={styles.priceValue}>€{cancellationCost.toFixed(2)}</Text>
                      </View>
                    )}
                  </>
                )}

                <View style={styles.divider} />

                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Subtotal</Text>
                  <Text style={styles.priceValue}>€{subtotal.toFixed(2)}</Text>
                </View>

                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Taxes & Fees (10%)</Text>
                  <Text style={styles.priceValue}>€{taxAmount.toFixed(2)}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.priceRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>€{totalAmount.toFixed(2)}</Text>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Payment Method - Stripe Card Input */}
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Card Details</Text>
            <Text style={styles.cardHint}>Enter your card information below</Text>

              <CardField
                postalCodeEnabled={false}
                placeholders={{
                  number: '4242 4242 4242 4242',
                }}
                cardStyle={{
                  backgroundColor: colors.background,
                  textColor: colors.text,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 8,
                  fontSize: 16,
                  placeholderColor: colors.textSecondary,
                }}
                style={styles.cardFieldContainer}
                onCardChange={(details) => {
                  setCardDetails(details);
                }}
              />

            {/* Card validation feedback */}
            {cardDetails && !cardDetails.complete && cardDetails.validNumber === 'Invalid' && (
              <Text style={styles.cardError}>Please enter a valid card number</Text>
            )}

            {/* Accepted cards info */}
            <View style={styles.acceptedCards}>
              <View style={styles.acceptedCardsRow}>
                <Ionicons name="card" size={20} color={colors.textSecondary} />
                <Text style={styles.acceptedCardsText}>
                  Visa, Mastercard, Amex accepted
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Expiry Warning with Countdown */}
        {timeRemaining.seconds > 0 && (
          <View style={[styles.expiryWarning, isExpiringSoon && styles.expiryWarningUrgent]}>
            <View style={styles.expiryContent}>
              <Ionicons
                name="time-outline"
                size={24}
                color={isExpiringSoon ? colors.error : '#92400E'}
              />
              <View style={styles.expiryTextContainer}>
                <Text style={[styles.expiryTitle, isExpiringSoon && styles.expiryTitleUrgent]}>
                  {isExpiringSoon ? 'Hurry! Time is running out' : 'Complete payment to secure booking'}
                </Text>
                <Text style={[styles.expiryTime, isExpiringSoon && styles.expiryTimeUrgent]}>
                  {formatCountdown(timeRemaining.seconds)} remaining
                </Text>
              </View>
            </View>
            {/* Progress bar */}
            <View style={styles.expiryProgressContainer}>
              <View
                style={[
                  styles.expiryProgressBar,
                  {
                    width: `${timeRemaining.percentage}%`,
                    backgroundColor: getProgressBarColor(),
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Pay Button */}
      <View style={styles.bottomBar}>
        {/* Terms and Conditions Checkbox */}
        <TouchableOpacity
          style={styles.termsContainer}
          onPress={() => setAgreedToTerms(!agreedToTerms)}
          activeOpacity={0.7}
        >
          <Checkbox
            status={agreedToTerms ? 'checked' : 'unchecked'}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
            color={colors.primary}
            uncheckedColor={colors.textSecondary}
          />
          <Text style={styles.termsText}>
            I agree to the{' '}
            <Text
              style={styles.termsLink}
              onPress={() => Linking.openURL('https://maritime-reservations.com/terms')}
            >
              Terms & Conditions
            </Text>
            {' '}and{' '}
            <Text
              style={styles.termsLink}
              onPress={() => Linking.openURL('https://maritime-reservations.com/privacy')}
            >
              Privacy Policy
            </Text>
          </Text>
        </TouchableOpacity>

        <Button
          mode="contained"
          onPress={handlePayment}
          loading={isProcessing || stripeLoading}
          disabled={isProcessing || stripeLoading || !cardDetails?.complete || !agreedToTerms}
          style={[
            styles.payButton,
            ((!cardDetails?.complete || !agreedToTerms) && !isProcessing) && styles.payButtonDisabled,
          ]}
          contentStyle={styles.payButtonContent}
          icon="lock"
        >
          {isProcessing ? 'Processing...' : `Pay €${totalAmount.toFixed(2)}`}
        </Button>
        <Text style={styles.secureText}>
          <Ionicons name="shield-checkmark" size={12} color={colors.textSecondary} />
          {' '}Secure payment powered by Stripe
        </Text>
      </View>
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
  content: {
    padding: spacing.md,
    paddingBottom: 150,
  },
  section: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  reference: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  journeyCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  journeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  journeyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  journeyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  journeyDetails: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  operatorText: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 2,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  roundTripBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  roundTripText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  summaryText: {
    fontSize: 14,
    color: colors.text,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  itemMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  // Price breakdown collapsible styles
  priceBreakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceBreakdownTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  priceBreakdownToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  priceBreakdownTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  priceBreakdownContent: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  breakdownCategory: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
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
    fontSize: 14,
    color: colors.text,
  },
  discountValue: {
    color: colors.success,
  },
  protectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  paymentMethodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  paymentMethodSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  expiryWarning: {
    backgroundColor: '#FEF3C7',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  expiryWarningUrgent: {
    backgroundColor: '#FEE2E2',
  },
  expiryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  expiryTextContainer: {
    flex: 1,
  },
  expiryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  expiryTitleUrgent: {
    color: colors.error,
  },
  expiryTime: {
    fontSize: 20,
    fontWeight: '700',
    color: '#B45309',
    marginTop: 2,
  },
  expiryTimeUrgent: {
    color: colors.error,
  },
  expiryProgressContainer: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  expiryProgressBar: {
    height: '100%',
    borderRadius: 2,
  },
  expiryText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  errorBannerText: {
    color: colors.error,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  payButton: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonContent: {
    paddingVertical: spacing.sm,
  },
  secureText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Card input styles
  cardHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  cardFieldContainer: {
    height: 50,
    marginVertical: spacing.sm,
  },
  cardError: {
    fontSize: 13,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  acceptedCards: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  acceptedCardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  acceptedCardsText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingRight: spacing.md,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  // Cabin upgrade styles
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  upgradeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  upgradeHeaderText: {
    flex: 1,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  upgradeSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  journeyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary + '10',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  journeyBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary,
  },
  routeInfoText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  cabinSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cabinSelectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  cabinSelectionName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  cabinSelectionQty: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cabinSelectionPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  totalDivider: {
    marginVertical: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
