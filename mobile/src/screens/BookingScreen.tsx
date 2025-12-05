import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Text, TextInput, Card, Button, Switch, Divider, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, parse } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import {
  setContactInfo,
  setPassengers,
  setSelectedCabin,
  setReturnCabin,
  addMeal,
  updateMealQuantity,
  setCancellationProtection,
  createBooking,
  resetBooking,
} from '../store/slices/bookingSlice';
import { ferryService } from '../services/ferryService';
import { RootStackParamList, Passenger, PassengerType, Cabin, Meal, Vehicle, VehicleType } from '../types';
import { colors, spacing, borderRadius } from '../constants/theme';
import { CANCELLATION_PROTECTION_PRICE } from '../constants/config';

// Vehicle type display info
const VEHICLE_TYPE_INFO: Record<string, { icon: string; label: string }> = {
  car: { icon: '🚗', label: 'Car' },
  suv: { icon: '🚙', label: 'SUV / 4x4' },
  van: { icon: '🚐', label: 'Van / Minibus' },
  motorcycle: { icon: '🏍️', label: 'Motorcycle' },
  camper: { icon: '🚌', label: 'Camper / RV' },
  caravan: { icon: '🏕️', label: 'Caravan' },
  truck: { icon: '🚚', label: 'Truck' },
  trailer: { icon: '🚛', label: 'Trailer' },
  jetski: { icon: '🚤', label: 'Jet Ski' },
  boat_trailer: { icon: '⛵', label: 'Boat + Trailer' },
  bicycle: { icon: '🚲', label: 'Bicycle' },
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'Booking'>;

const CABIN_ICONS: Record<string, string> = {
  SEAT: '🪑',
  INSIDE: '🛏️',
  OUTSIDE: '🪟',
  BALCONY: '🌊',
  SUITE: '👑',
};

const MEAL_ICONS: Record<string, string> = {
  BREAKFAST: '🍳',
  LUNCH: '🍽️',
  DINNER: '🍷',
  SNACK: '🍿',
  BUFFET: '🍱',
};

// Map amenity names to icons
const AMENITY_ICONS: Record<string, { icon: string; name: string }> = {
  'Private Bathroom': { icon: 'water', name: 'Private Bathroom' },
  'TV': { icon: 'tv', name: 'TV' },
  'WiFi': { icon: 'wifi', name: 'WiFi' },
  'Air Conditioning': { icon: 'snow', name: 'A/C' },
  'Minibar': { icon: 'wine', name: 'Minibar' },
  'Window': { icon: 'sunny', name: 'Window' },
  'Balcony': { icon: 'boat', name: 'Balcony' },
  'Sea View': { icon: 'water-outline', name: 'Sea View' },
  'Living Area': { icon: 'home', name: 'Living Area' },
  'Premium Amenities': { icon: 'star', name: 'Premium' },
};

export default function BookingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const dispatch = useAppDispatch();
  const { schedule, returnSchedule } = route.params;

  const { passengers: searchPassengers, adults, children, infants, vehicles, vehicleSelections } = useAppSelector((state) => state.search);

  // Price multipliers (consistent with search results)
  const CHILD_PRICE_MULTIPLIER = 0.5;
  const INFANT_PRICE_MULTIPLIER = 0;
  const VEHICLE_PRICE = 50; // Base vehicle price
  const {
    contactInfo,
    passengers,
    selectedCabin,
    cabinQuantity,
    returnCabin,
    returnCabinQuantity,
    selectedMeals,
    hasCancellationProtection,
    isCreatingBooking,
    bookingError,
    currentBooking,
  } = useAppSelector((state) => state.booking);
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // Cabin and Meal data
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isLoadingCabins, setIsLoadingCabins] = useState(false);
  const [isLoadingMeals, setIsLoadingMeals] = useState(false);

  // Journey toggle for round trips
  const [selectedJourney, setSelectedJourney] = useState<'outbound' | 'return'>('outbound');

  // Cabin quantities (for multi-cabin selection)
  const [cabinQuantities, setCabinQuantities] = useState<Record<string, number>>({});
  const [returnCabinQuantities, setReturnCabinQuantities] = useState<Record<string, number>>({});

  // Meal quantities
  const [mealQuantities, setMealQuantities] = useState<Record<string, number>>({});
  const [returnMealQuantities, setReturnMealQuantities] = useState<Record<string, number>>({});

  // Date picker for date of birth
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerPassengerIndex, setDatePickerPassengerIndex] = useState<number | null>(null);
  const [tempDate, setTempDate] = useState(new Date(1990, 0, 1));

  // Track if we're actively creating a booking (to avoid stale redirects)
  const [isActivelyBooking, setIsActivelyBooking] = useState(false);

  // Store selections for passing to PaymentScreen
  const [pendingSelections, setPendingSelections] = useState<{
    cabinSelections: { cabinId: string; quantity: number; price: number }[];
    returnCabinSelections: { cabinId: string; quantity: number; price: number }[];
    mealSelections: { mealId: string; quantity: number; price: number }[];
    returnMealSelections: { mealId: string; quantity: number; price: number }[];
  } | null>(null);

  // Vehicle details state - initialize from vehicleSelections
  const [vehicleDetails, setVehicleDetails] = useState<Vehicle[]>([]);

  // Reset local state when schedule changes (new booking flow)
  useEffect(() => {
    // Reset step to 1 and clear all local selections
    setStep(1);
    setCabinQuantities({});
    setReturnCabinQuantities({});
    setMealQuantities({});
    setReturnMealQuantities({});
    setSelectedJourney('outbound');
  }, [schedule.sailing_id]);

  // Initialize vehicle details from vehicleSelections
  useEffect(() => {
    if (vehicleSelections.length > 0 && vehicleDetails.length === 0) {
      const initialVehicleDetails: Vehicle[] = vehicleSelections.map((vs, index) => ({
        id: vs.id,
        vehicle_type: vs.type,
        license_plate: '',
        make: '',
        model: '',
      }));
      setVehicleDetails(initialVehicleDetails);
    }
  }, [vehicleSelections, vehicleDetails.length]);

  // Load cabins and meals
  useEffect(() => {
    const loadData = async () => {
      setIsLoadingCabins(true);
      setIsLoadingMeals(true);
      try {
        const [cabinsData, mealsData] = await Promise.all([
          ferryService.getAllCabins(searchPassengers),
          ferryService.getAllMeals(),
        ]);
        setCabins(cabinsData);
        setMeals(mealsData);
      } catch (error) {
        console.error('Failed to load accommodation data:', error);
      } finally {
        setIsLoadingCabins(false);
        setIsLoadingMeals(false);
      }
    };
    loadData();
  }, [searchPassengers]);

  // Initialize passengers based on search
  useEffect(() => {
    if (passengers.length === 0) {
      const initialPassengers: Passenger[] = [];

      // Add adults
      for (let i = 0; i < adults; i++) {
        initialPassengers.push({
          passenger_type: 'adult' as PassengerType,
          first_name: '',
          last_name: '',
          date_of_birth: '',
          nationality: 'FR',
        });
      }

      // Add children
      for (let i = 0; i < children; i++) {
        initialPassengers.push({
          passenger_type: 'child' as PassengerType,
          first_name: '',
          last_name: '',
          date_of_birth: '',
          nationality: 'FR',
        });
      }

      // Add infants
      for (let i = 0; i < infants; i++) {
        initialPassengers.push({
          passenger_type: 'infant' as PassengerType,
          first_name: '',
          last_name: '',
          date_of_birth: '',
          nationality: 'FR',
        });
      }

      dispatch(setPassengers(initialPassengers));
    }
  }, [dispatch, passengers.length, adults, children, infants]);

  // Pre-fill contact info from user
  useEffect(() => {
    if (user && !contactInfo.email) {
      dispatch(setContactInfo({
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone || '',
      }));
    }
  }, [user, contactInfo.email, dispatch]);

  // Navigate to payment when booking is created (only if actively booking)
  useEffect(() => {
    if (currentBooking && isActivelyBooking && pendingSelections) {
      setIsActivelyBooking(false);
      navigation.replace('Payment', {
        bookingId: currentBooking.id,
        cabinSelections: pendingSelections.cabinSelections,
        returnCabinSelections: pendingSelections.returnCabinSelections,
        mealSelections: pendingSelections.mealSelections,
        returnMealSelections: pendingSelections.returnMealSelections,
      } as any);
      setPendingSelections(null);
    }
  }, [currentBooking, isActivelyBooking, pendingSelections, navigation]);

  const handleCreateBooking = async () => {
    // Prepare cabin selections with prices
    const cabinSelections = Object.entries(cabinQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([cabinId, quantity]) => {
        const cabin = cabins.find(c => String(c.id) === String(cabinId));
        return {
          cabinId,
          quantity,
          price: Number(cabin?.price) || 0,
        };
      });

    const returnCabinSelections = Object.entries(returnCabinQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([cabinId, quantity]) => {
        const cabin = cabins.find(c => String(c.id) === String(cabinId));
        return {
          cabinId,
          quantity,
          price: Number(cabin?.price) || 0,
        };
      });

    // Prepare meal selections with prices
    const mealSelections = Object.entries(mealQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([mealId, quantity]) => {
        const meal = meals.find(m => String(m.id) === String(mealId));
        return {
          mealId,
          quantity,
          price: Number(meal?.price) || 0,
        };
      });

    const returnMealSelections = Object.entries(returnMealQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([mealId, quantity]) => {
        const meal = meals.find(m => String(m.id) === String(mealId));
        return {
          mealId,
          quantity,
          price: Number(meal?.price) || 0,
        };
      });

    // Store selections for passing to PaymentScreen
    setPendingSelections({
      cabinSelections,
      returnCabinSelections,
      mealSelections,
      returnMealSelections,
    });

    // Mark that we're actively creating a booking
    setIsActivelyBooking(true);

    await dispatch(createBooking({
      cabinSelections,
      returnCabinSelections,
      mealSelections,
      returnMealSelections,
      adults,
      children,
      infants,
      vehicleCount: vehicles,
      vehicleDetails: vehicleDetails.length > 0 ? vehicleDetails : undefined,
    }));
    // Navigation handled by useEffect
  };

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

  // Calculate fare for one journey based on passenger types
  const calculateJourneyFare = (basePrice: number) => {
    const adultTotal = (basePrice ?? 0) * adults;
    const childTotal = (basePrice ?? 0) * CHILD_PRICE_MULTIPLIER * children;
    const infantTotal = (basePrice ?? 0) * INFANT_PRICE_MULTIPLIER * infants;
    return adultTotal + childTotal + infantTotal;
  };

  // Calculate vehicle cost
  const calculateVehicleTotal = () => {
    const outboundVehicles = vehicles * VEHICLE_PRICE;
    const returnVehicles = returnSchedule ? vehicles * VEHICLE_PRICE : 0;
    return outboundVehicles + returnVehicles;
  };

  const calculateCabinTotal = () => {
    let total = 0;
    Object.entries(cabinQuantities).forEach(([cabinId, qty]) => {
      // Handle both string and number IDs from API
      const cabin = cabins.find(c => String(c.id) === String(cabinId));
      if (cabin && qty > 0) total += (Number(cabin.price) || 0) * qty;
    });
    Object.entries(returnCabinQuantities).forEach(([cabinId, qty]) => {
      const cabin = cabins.find(c => String(c.id) === String(cabinId));
      if (cabin && qty > 0) total += (Number(cabin.price) || 0) * qty;
    });
    return total;
  };

  const calculateMealTotal = () => {
    let total = 0;
    Object.entries(mealQuantities).forEach(([mealId, qty]) => {
      // Handle both string and number IDs from API
      const meal = meals.find(m => String(m.id) === String(mealId));
      if (meal && qty > 0) total += (Number(meal.price) || 0) * qty;
    });
    Object.entries(returnMealQuantities).forEach(([mealId, qty]) => {
      const meal = meals.find(m => String(m.id) === String(mealId));
      if (meal && qty > 0) total += (Number(meal.price) || 0) * qty;
    });
    return total;
  };

  const calculateTotal = () => {
    let total = calculateJourneyFare(schedule.base_price ?? 0);
    if (returnSchedule) {
      total += calculateJourneyFare(returnSchedule.base_price ?? 0);
    }
    total += calculateVehicleTotal();
    total += calculateCabinTotal();
    total += calculateMealTotal();
    if (hasCancellationProtection) {
      total += CANCELLATION_PROTECTION_PRICE;
    }
    return total;
  };

  const updatePassenger = (index: number, field: keyof Passenger, value: string) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    dispatch(setPassengers(updated));
  };

  const updateVehicleDetail = (index: number, field: keyof Vehicle, value: string) => {
    const updated = [...vehicleDetails];
    updated[index] = { ...updated[index], [field]: value };
    setVehicleDetails(updated);
  };

  const updateCabinQuantity = (cabinId: string, change: number) => {
    const quantities = selectedJourney === 'outbound' ? cabinQuantities : returnCabinQuantities;
    const setQuantities = selectedJourney === 'outbound' ? setCabinQuantities : setReturnCabinQuantities;

    // Ensure consistent string key
    const key = String(cabinId);
    const current = quantities[key] || 0;
    const newQty = Math.max(0, current + change);

    setQuantities(prev => ({
      ...prev,
      [key]: newQty,
    }));
  };

  const updateMealQuantityLocal = (mealId: string, change: number) => {
    const quantities = selectedJourney === 'outbound' ? mealQuantities : returnMealQuantities;
    const setQuantities = selectedJourney === 'outbound' ? setMealQuantities : setReturnMealQuantities;

    // Ensure consistent string key
    const key = String(mealId);
    const current = quantities[key] || 0;
    const newQty = Math.max(0, current + change);

    setQuantities(prev => ({
      ...prev,
      [key]: newQty,
    }));
  };

  const isFormValid = () => {
    if (!contactInfo.email || !contactInfo.firstName || !contactInfo.lastName || !contactInfo.phone) {
      return false;
    }
    const passengersValid = passengers.every(p => p.first_name && p.last_name && p.date_of_birth);
    // Validate vehicles - license plate is required for all vehicles
    const vehiclesValid = vehicleDetails.length === 0 || vehicleDetails.every(v => v.license_plate && v.license_plate.trim() !== '');
    return passengersValid && vehiclesValid;
  };

  // Step 1: Contact Information
  const renderStep1 = () => {
    const outboundFare = calculateJourneyFare(schedule.base_price ?? 0);
    const returnFare = returnSchedule ? calculateJourneyFare(returnSchedule.base_price ?? 0) : 0;
    const outboundVehicles = vehicles * VEHICLE_PRICE;
    const returnVehicles = returnSchedule ? vehicles * VEHICLE_PRICE : 0;

    return (
    <>
      {/* Trip Summary */}
      <Card style={styles.section}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Trip Summary</Text>

          {/* Outbound */}
          <View style={styles.tripRow}>
            <View style={styles.tripIcon}>
              <Ionicons name="arrow-forward" size={16} color={colors.primary} />
            </View>
            <View style={styles.tripInfo}>
              <Text style={styles.tripRoute}>
                {schedule.departure_port} → {schedule.arrival_port}
              </Text>
              <Text style={styles.tripDate}>
                {formatDate(schedule.departure_time)} • {formatTime(schedule.departure_time)}
              </Text>
              <Text style={styles.tripOperator}>{schedule.operator}</Text>
            </View>
            <Text style={styles.tripPrice}>
              €{outboundFare.toFixed(0)}
            </Text>
          </View>

          {/* Outbound Price Breakdown */}
          <View style={styles.priceBreakdown}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>
                {adults} Adult{adults > 1 ? 's' : ''} × €{(schedule.base_price ?? 0).toFixed(0)}
              </Text>
              <Text style={styles.breakdownValue}>
                €{((schedule.base_price ?? 0) * adults).toFixed(0)}
              </Text>
            </View>
            {children > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  {children} Child{children > 1 ? 'ren' : ''} × €{((schedule.base_price ?? 0) * CHILD_PRICE_MULTIPLIER).toFixed(0)} (50%)
                </Text>
                <Text style={styles.breakdownValue}>
                  €{((schedule.base_price ?? 0) * CHILD_PRICE_MULTIPLIER * children).toFixed(0)}
                </Text>
              </View>
            )}
            {infants > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  {infants} Infant{infants > 1 ? 's' : ''} (Free)
                </Text>
                <Text style={styles.breakdownValue}>€0</Text>
              </View>
            )}
            {vehicles > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  {vehicles} Vehicle{vehicles > 1 ? 's' : ''} × €{VEHICLE_PRICE}
                </Text>
                <Text style={styles.breakdownValue}>€{outboundVehicles}</Text>
              </View>
            )}
          </View>

          {/* Return */}
          {returnSchedule && (
            <>
              <Divider style={styles.tripDivider} />
              <View style={styles.tripRow}>
                <View style={styles.tripIcon}>
                  <Ionicons name="arrow-back" size={16} color={colors.secondary} />
                </View>
                <View style={styles.tripInfo}>
                  <Text style={styles.tripRoute}>
                    {returnSchedule.departure_port} → {returnSchedule.arrival_port}
                  </Text>
                  <Text style={styles.tripDate}>
                    {formatDate(returnSchedule.departure_time)} • {formatTime(returnSchedule.departure_time)}
                  </Text>
                  <Text style={styles.tripOperator}>{returnSchedule.operator}</Text>
                </View>
                <Text style={styles.tripPrice}>
                  €{returnFare.toFixed(0)}
                </Text>
              </View>

              {/* Return Price Breakdown */}
              <View style={styles.priceBreakdown}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    {adults} Adult{adults > 1 ? 's' : ''} × €{(returnSchedule.base_price ?? 0).toFixed(0)}
                  </Text>
                  <Text style={styles.breakdownValue}>
                    €{((returnSchedule.base_price ?? 0) * adults).toFixed(0)}
                  </Text>
                </View>
                {children > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>
                      {children} Child{children > 1 ? 'ren' : ''} × €{((returnSchedule.base_price ?? 0) * CHILD_PRICE_MULTIPLIER).toFixed(0)} (50%)
                    </Text>
                    <Text style={styles.breakdownValue}>
                      €{((returnSchedule.base_price ?? 0) * CHILD_PRICE_MULTIPLIER * children).toFixed(0)}
                    </Text>
                  </View>
                )}
                {infants > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>
                      {infants} Infant{infants > 1 ? 's' : ''} (Free)
                    </Text>
                    <Text style={styles.breakdownValue}>€0</Text>
                  </View>
                )}
                {vehicles > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>
                      {vehicles} Vehicle{vehicles > 1 ? 's' : ''} × €{VEHICLE_PRICE}
                    </Text>
                    <Text style={styles.breakdownValue}>€{returnVehicles}</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Journey Totals Summary */}
          <Divider style={styles.tripDivider} />
          <View style={styles.summaryTotals}>
            <View style={styles.breakdownRow}>
              <Text style={styles.summaryLabel}>Passenger Fares</Text>
              <Text style={styles.summaryValue}>€{(outboundFare + returnFare).toFixed(0)}</Text>
            </View>
            {vehicles > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.summaryLabel}>Vehicles</Text>
                <Text style={styles.summaryValue}>€{(outboundVehicles + returnVehicles).toFixed(0)}</Text>
              </View>
            )}
            <View style={styles.breakdownRow}>
              <Text style={styles.journeyTotalLabel}>Base Journey Total</Text>
              <Text style={styles.journeyTotalValue}>
                €{(outboundFare + returnFare + outboundVehicles + returnVehicles).toFixed(0)}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Contact Info */}
      <Card style={styles.section}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.formRow}>
            <TextInput
              label="First Name"
              value={contactInfo.firstName}
              onChangeText={(text) => dispatch(setContactInfo({ firstName: text }))}
              mode="outlined"
              style={[styles.input, styles.halfInput]}
            />
            <TextInput
              label="Last Name"
              value={contactInfo.lastName}
              onChangeText={(text) => dispatch(setContactInfo({ lastName: text }))}
              mode="outlined"
              style={[styles.input, styles.halfInput]}
            />
          </View>
          <TextInput
            label="Email"
            value={contactInfo.email}
            onChangeText={(text) => dispatch(setContactInfo({ email: text }))}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            label="Phone"
            value={contactInfo.phone}
            onChangeText={(text) => dispatch(setContactInfo({ phone: text }))}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
          />
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        onPress={() => setStep(2)}
        style={styles.nextButton}
        disabled={!contactInfo.email || !contactInfo.firstName || !contactInfo.lastName || !contactInfo.phone}
      >
        Continue to Accommodation
      </Button>
    </>
    );
  };

  // Step 2: Cabin Selection
  const renderStep2 = () => {
    const currentQuantities = selectedJourney === 'outbound' ? cabinQuantities : returnCabinQuantities;

    return (
      <>
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Select Accommodation</Text>
            <Text style={styles.sectionSubtitle}>
              Choose your cabin type for {passengers.length} passenger{passengers.length > 1 ? 's' : ''}
            </Text>

            {/* Journey Toggle for Round Trip */}
            {returnSchedule && (
              <View style={styles.journeyToggle}>
                <TouchableOpacity
                  style={[styles.journeyTab, selectedJourney === 'outbound' && styles.journeyTabActive]}
                  onPress={() => setSelectedJourney('outbound')}
                >
                  <Text style={[styles.journeyTabText, selectedJourney === 'outbound' && styles.journeyTabTextActive]}>
                    🚢 Outbound
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.journeyTab, selectedJourney === 'return' && styles.journeyTabActive]}
                  onPress={() => setSelectedJourney('return')}
                >
                  <Text style={[styles.journeyTabText, selectedJourney === 'return' && styles.journeyTabTextActive]}>
                    🔙 Return
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {isLoadingCabins ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading cabins...</Text>
              </View>
            ) : cabins.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="bed-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No cabins available</Text>
              </View>
            ) : (
              cabins.map((cabin) => {
                // Ensure price is a number
                const cabinPrice = Number(cabin.price) || 0;
                // Find cheapest paid cabin for "Best Price" badge
                const paidCabins = cabins.filter(c => (Number(c.price) || 0) > 0);
                const cheapestPaidPrice = paidCabins.length > 0
                  ? Math.min(...paidCabins.map(c => Number(c.price) || 0))
                  : 0;
                const isBestPrice = cabinPrice > 0 && cabinPrice === cheapestPaidPrice;

                return (
                <View key={cabin.id} style={[styles.accommodationCard, isBestPrice && styles.bestPriceCard]}>
                  {isBestPrice && (
                    <View style={styles.bestPriceBadge}>
                      <Text style={styles.bestPriceBadgeText}>Best Price</Text>
                    </View>
                  )}
                  <View style={styles.accommodationHeader}>
                    <Text style={styles.accommodationIcon}>
                      {CABIN_ICONS[cabin.type] || '🛏️'}
                    </Text>
                    <View style={styles.accommodationInfo}>
                      <Text style={styles.accommodationName}>{cabin.name}</Text>
                      <Text style={styles.accommodationDetails}>
                        Up to {cabin.capacity} guests
                      </Text>
                    </View>
                    <View style={styles.priceBlock}>
                      <Text style={[styles.accommodationPrice, isBestPrice && styles.bestPriceText]}>
                        {cabinPrice === 0 ? 'Free' : `€${cabinPrice}`}
                      </Text>
                      <Text style={styles.perUnit}>per cabin</Text>
                    </View>
                  </View>

                  {/* Centered Amenities */}
                  {cabin.amenities?.length > 0 && (
                    <View style={styles.amenitiesContainer}>
                      {cabin.amenities.map((amenity, i) => {
                        const amenityInfo = AMENITY_ICONS[amenity] || { icon: 'checkmark-circle', name: amenity };
                        return (
                          <View key={i} style={styles.amenityItem}>
                            <Ionicons
                              name={amenityInfo.icon as any}
                              size={14}
                              color={colors.primary}
                            />
                            <Text style={styles.amenityText}>{amenityInfo.name}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  <View style={styles.quantityRow}>
                    <Text style={styles.availabilityText}>
                      {cabin.available} available
                    </Text>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateCabinQuantity(cabin.id, -1)}
                        disabled={(currentQuantities[cabin.id] || 0) <= 0}
                      >
                        <Ionicons
                          name="remove"
                          size={20}
                          color={(currentQuantities[cabin.id] || 0) <= 0 ? colors.disabled : colors.text}
                        />
                      </TouchableOpacity>
                      <Text style={styles.quantityValue}>
                        {currentQuantities[cabin.id] || 0}
                      </Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateCabinQuantity(cabin.id, 1)}
                        disabled={(currentQuantities[cabin.id] || 0) >= cabin.available}
                      >
                        <Ionicons
                          name="add"
                          size={20}
                          color={(currentQuantities[cabin.id] || 0) >= cabin.available ? colors.disabled : colors.text}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                );
              })
            )}

            {/* Cabin Total */}
            {calculateCabinTotal() > 0 && (
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Accommodation Total</Text>
                <Text style={styles.subtotalValue}>€{calculateCabinTotal().toFixed(2)}</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        <View style={styles.buttonRow}>
          <Button mode="outlined" onPress={() => setStep(1)} style={styles.backButton}>
            Back
          </Button>
          <Button mode="contained" onPress={() => setStep(3)} style={styles.nextButtonFlex}>
            Continue to Meals
          </Button>
        </View>
      </>
    );
  };

  // Step 3: Meal Selection
  const renderStep3 = () => {
    const currentQuantities = selectedJourney === 'outbound' ? mealQuantities : returnMealQuantities;

    // Group meals by category
    const mealsByCategory = meals.reduce((acc, meal) => {
      const category = meal.category || 'OTHER';
      if (!acc[category]) acc[category] = [];
      acc[category].push(meal);
      return acc;
    }, {} as Record<string, Meal[]>);

    return (
      <>
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Select Meals</Text>
            <Text style={styles.sectionSubtitle}>
              Pre-order meals for your journey (optional)
            </Text>

            {/* Journey Toggle for Round Trip */}
            {returnSchedule && (
              <View style={styles.journeyToggle}>
                <TouchableOpacity
                  style={[styles.journeyTab, selectedJourney === 'outbound' && styles.journeyTabActive]}
                  onPress={() => setSelectedJourney('outbound')}
                >
                  <Text style={[styles.journeyTabText, selectedJourney === 'outbound' && styles.journeyTabTextActive]}>
                    🚢 Outbound
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.journeyTab, selectedJourney === 'return' && styles.journeyTabActive]}
                  onPress={() => setSelectedJourney('return')}
                >
                  <Text style={[styles.journeyTabText, selectedJourney === 'return' && styles.journeyTabTextActive]}>
                    🔙 Return
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {isLoadingMeals ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading meals...</Text>
              </View>
            ) : meals.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="restaurant-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No meals available</Text>
              </View>
            ) : (
              Object.entries(mealsByCategory).map(([category, categoryMeals]) => (
                <View key={category} style={styles.mealCategory}>
                  <Text style={styles.categoryTitle}>
                    {MEAL_ICONS[category] || '🍽️'} {category.charAt(0) + category.slice(1).toLowerCase()}
                  </Text>
                  {categoryMeals.map((meal) => (
                    <View key={meal.id} style={styles.mealCard}>
                      <View style={styles.mealInfo}>
                        <Text style={styles.mealName}>{meal.name}</Text>
                        <Text style={styles.mealDescription}>{meal.description}</Text>
                        <Text style={styles.mealPrice}>€{meal.price ?? 0}</Text>
                      </View>
                      <View style={styles.quantityControls}>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => updateMealQuantityLocal(meal.id, -1)}
                          disabled={(currentQuantities[meal.id] || 0) <= 0}
                        >
                          <Ionicons
                            name="remove"
                            size={20}
                            color={(currentQuantities[meal.id] || 0) <= 0 ? colors.disabled : colors.text}
                          />
                        </TouchableOpacity>
                        <Text style={styles.quantityValue}>
                          {currentQuantities[meal.id] || 0}
                        </Text>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => updateMealQuantityLocal(meal.id, 1)}
                        >
                          <Ionicons name="add" size={20} color={colors.text} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ))
            )}

            {/* Meal Total */}
            {calculateMealTotal() > 0 && (
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Meals Total</Text>
                <Text style={styles.subtotalValue}>€{calculateMealTotal().toFixed(2)}</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        <View style={styles.buttonRow}>
          <Button mode="outlined" onPress={() => setStep(2)} style={styles.backButton}>
            Back
          </Button>
          <Button mode="contained" onPress={() => setStep(4)} style={styles.nextButtonFlex}>
            Continue to Passengers
          </Button>
        </View>
      </>
    );
  };

  // Step 4: Passenger Details
  const renderStep4 = () => (
    <>
      {/* Passengers */}
      <Card style={styles.section}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Passenger Details</Text>
          <Text style={styles.sectionSubtitle}>
            Enter details for all {passengers.length} passenger{passengers.length > 1 ? 's' : ''}
          </Text>

          {passengers.map((passenger, index) => (
            <View key={index} style={styles.passengerCard}>
              <Text style={styles.passengerTitle}>
                Passenger {index + 1} ({passenger.passenger_type})
              </Text>

              <View style={styles.passengerTypeRow}>
                {(['adult', 'child', 'infant'] as PassengerType[]).map((type) => (
                  <Chip
                    key={type}
                    selected={passenger.passenger_type === type}
                    onPress={() => updatePassenger(index, 'passenger_type', type)}
                    style={styles.typeChip}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Chip>
                ))}
              </View>

              <View style={styles.formRow}>
                <TextInput
                  label="First Name"
                  value={passenger.first_name}
                  onChangeText={(text) => updatePassenger(index, 'first_name', text)}
                  mode="outlined"
                  style={[styles.input, styles.halfInput]}
                />
                <TextInput
                  label="Last Name"
                  value={passenger.last_name}
                  onChangeText={(text) => updatePassenger(index, 'last_name', text)}
                  mode="outlined"
                  style={[styles.input, styles.halfInput]}
                />
              </View>

              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => {
                  setDatePickerPassengerIndex(index);
                  // Parse existing date or use default
                  if (passenger.date_of_birth) {
                    try {
                      const [year, month, day] = passenger.date_of_birth.split('-').map(Number);
                      setTempDate(new Date(year, month - 1, day));
                    } catch {
                      setTempDate(new Date(1990, 0, 1));
                    }
                  } else {
                    setTempDate(new Date(1990, 0, 1));
                  }
                  setShowDatePicker(true);
                }}
              >
                <View style={styles.datePickerContent}>
                  <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                  <Text style={[styles.datePickerText, !passenger.date_of_birth && styles.datePickerPlaceholder]}>
                    {passenger.date_of_birth || 'Select date of birth'}
                  </Text>
                </View>
              </TouchableOpacity>

              {index < passengers.length - 1 && <Divider style={styles.passengerDivider} />}
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Date Picker - Platform specific handling */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={(_, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate && datePickerPassengerIndex !== null) {
              const formattedDate = format(selectedDate, 'yyyy-MM-dd');
              updatePassenger(datePickerPassengerIndex, 'date_of_birth', formattedDate);
            }
          }}
          maximumDate={new Date()}
          minimumDate={new Date(1920, 0, 1)}
        />
      )}

      {/* iOS Date Picker Modal */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerTitle}>Select Date of Birth</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.datePickerWrapper}>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  onChange={(_, selectedDate) => {
                    if (selectedDate) {
                      setTempDate(selectedDate);
                    }
                  }}
                  maximumDate={new Date()}
                  minimumDate={new Date(1920, 0, 1)}
                  textColor={colors.text}
                  themeVariant="light"
                  style={{ height: 200, width: '100%' }}
                />
              </View>
              <Button
                mode="contained"
                onPress={() => {
                  if (datePickerPassengerIndex !== null) {
                    const formattedDate = format(tempDate, 'yyyy-MM-dd');
                    updatePassenger(datePickerPassengerIndex, 'date_of_birth', formattedDate);
                  }
                  setShowDatePicker(false);
                }}
                style={styles.datePickerConfirmButton}
              >
                Confirm
              </Button>
            </View>
          </View>
        </Modal>
      )}

      {/* Vehicle Details */}
      {vehicleDetails.length > 0 && (
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Vehicle Details</Text>
            <Text style={styles.sectionSubtitle}>
              Enter details for your {vehicleDetails.length} vehicle{vehicleDetails.length > 1 ? 's' : ''}
            </Text>

            {vehicleDetails.map((vehicle, index) => {
              const typeInfo = VEHICLE_TYPE_INFO[vehicle.vehicle_type] || { icon: '🚗', label: 'Vehicle' };
              return (
                <View key={vehicle.id || index} style={styles.vehicleCard}>
                  <View style={styles.vehicleCardHeader}>
                    <Text style={styles.vehicleCardIcon}>{typeInfo.icon}</Text>
                    <View style={styles.vehicleCardInfo}>
                      <Text style={styles.vehicleCardTitle}>
                        Vehicle {index + 1}
                      </Text>
                      <Text style={styles.vehicleCardType}>
                        {typeInfo.label}
                      </Text>
                    </View>
                  </View>

                  <TextInput
                    label="License Plate *"
                    value={vehicle.license_plate}
                    onChangeText={(text) => updateVehicleDetail(index, 'license_plate', text.toUpperCase())}
                    mode="outlined"
                    style={styles.input}
                    autoCapitalize="characters"
                    placeholder="e.g., ABC-123"
                  />

                  <View style={styles.formRow}>
                    <TextInput
                      label="Make (optional)"
                      value={vehicle.make || ''}
                      onChangeText={(text) => updateVehicleDetail(index, 'make', text)}
                      mode="outlined"
                      style={[styles.input, styles.halfInput]}
                      placeholder="e.g., Toyota"
                    />
                    <TextInput
                      label="Model (optional)"
                      value={vehicle.model || ''}
                      onChangeText={(text) => updateVehicleDetail(index, 'model', text)}
                      mode="outlined"
                      style={[styles.input, styles.halfInput]}
                      placeholder="e.g., Camry"
                    />
                  </View>

                  {index < vehicleDetails.length - 1 && <Divider style={styles.passengerDivider} />}
                </View>
              );
            })}
          </Card.Content>
        </Card>
      )}

      {/* Cancellation Protection */}
      <Card style={styles.section}>
        <Card.Content>
          <View style={styles.protectionRow}>
            <View style={styles.protectionInfo}>
              <View style={styles.protectionHeader}>
                <Ionicons name="shield-checkmark" size={24} color={colors.success} />
                <Text style={styles.protectionTitle}>Cancellation Protection</Text>
              </View>
              <Text style={styles.protectionDescription}>
                Cancel anytime before departure and get a full refund. Without protection, cancellations within 7 days are not refundable.
              </Text>
              <Text style={styles.protectionPrice}>+€{CANCELLATION_PROTECTION_PRICE}</Text>
            </View>
            <Switch
              value={hasCancellationProtection}
              onValueChange={(value) => { dispatch(setCancellationProtection(value)); }}
              color={colors.success}
            />
          </View>
        </Card.Content>
      </Card>

      <View style={styles.buttonRow}>
        <Button
          mode="outlined"
          onPress={() => setStep(3)}
          style={styles.backButton}
        >
          Back
        </Button>
        <Button
          mode="contained"
          onPress={handleCreateBooking}
          loading={isCreatingBooking}
          disabled={!isFormValid() || isCreatingBooking}
          style={styles.payButton}
        >
          Proceed to Payment
        </Button>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Progress Bar Header */}
          <View style={styles.progressHeader}>
            <Text style={styles.progressHeaderTitle}>
              Step {step} of {totalSteps}
            </Text>
            <Text style={styles.progressHeaderSubtitle}>
              {step === 1 ? 'Contact & Trip Summary' : step === 2 ? 'Select Accommodation' : step === 3 ? 'Select Meals' : 'Passenger Details'}
            </Text>
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            {[
              { label: 'Contact', icon: 'person' },
              { label: 'Cabin', icon: 'bed' },
              { label: 'Meals', icon: 'restaurant' },
              { label: 'Passengers', icon: 'people' },
            ].map((stepInfo, i) => (
              <React.Fragment key={i}>
                <TouchableOpacity
                  style={[
                    styles.progressStep,
                    step >= i + 1 && styles.progressStepActive,
                    step === i + 1 && styles.progressStepCurrent,
                  ]}
                  onPress={() => setStep(i + 1)}
                >
                  {step > i + 1 ? (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  ) : (
                    <Ionicons
                      name={stepInfo.icon as any}
                      size={16}
                      color={step >= i + 1 ? '#fff' : colors.textSecondary}
                    />
                  )}
                </TouchableOpacity>
                {i < totalSteps - 1 && (
                  <View style={[styles.progressLine, step > i + 1 && styles.progressLineActive]} />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* Step Labels */}
          <View style={styles.stepLabels}>
            {[
              { label: 'Contact', step: 1 },
              { label: 'Cabin', step: 2 },
              { label: 'Meals', step: 3 },
              { label: 'Passengers', step: 4 },
            ].map((item) => (
              <TouchableOpacity key={item.step} onPress={() => setStep(item.step)}>
                <Text style={[
                  styles.stepLabel,
                  step === item.step && styles.stepLabelActive,
                  step > item.step && styles.stepLabelCompleted,
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Error */}
          {bookingError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{bookingError}</Text>
            </View>
          )}

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}

          {/* Bottom spacing */}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>

        {/* Total Bar */}
        <View style={styles.totalBar}>
          <View>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>€{calculateTotal().toFixed(2)}</Text>
          </View>
          <Text style={styles.totalDetails}>
            {passengers.length} passenger{passengers.length > 1 ? 's' : ''}
            {returnSchedule ? ' • Round trip' : ' • One way'}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  progressHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.primary,
    marginHorizontal: -spacing.md,
    marginTop: -spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  progressHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
  },
  progressHeaderSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  progressStep: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStepActive: {
    backgroundColor: colors.primary,
  },
  progressStepCurrent: {
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.primary + '40',
    transform: [{ scale: 1.1 }],
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  progressTextActive: {
    color: '#fff',
  },
  progressLine: {
    width: 40,
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  progressLineActive: {
    backgroundColor: colors.primary,
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  stepLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  stepLabelCompleted: {
    color: colors.success,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tripIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  tripInfo: {
    flex: 1,
  },
  tripRoute: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  tripDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tripOperator: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 2,
  },
  tripPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  tripDivider: {
    marginVertical: spacing.md,
  },
  priceBreakdown: {
    marginTop: spacing.sm,
    marginLeft: 44, // Align with trip info (32 icon + 12 margin)
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  breakdownValue: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryTotals: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.text,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  journeyTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  journeyTotalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  halfInput: {
    flex: 1,
  },
  journeyToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  journeyTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  journeyTabActive: {
    backgroundColor: colors.primary,
  },
  journeyTabText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  journeyTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 14,
  },
  accommodationCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  accommodationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  accommodationIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  accommodationInfo: {
    flex: 1,
  },
  accommodationName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  accommodationDetails: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  amenityText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  priceBlock: {
    alignItems: 'flex-end',
  },
  accommodationPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  perUnit: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  bestPriceCard: {
    borderWidth: 2,
    borderColor: colors.success,
    position: 'relative',
  },
  bestPriceBadge: {
    position: 'absolute',
    top: -10,
    right: spacing.md,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    zIndex: 1,
  },
  bestPriceBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bestPriceText: {
    color: colors.success,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  availabilityText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    width: 30,
    textAlign: 'center',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  subtotalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  subtotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  mealCategory: {
    marginBottom: spacing.md,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  mealDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  mealPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 4,
  },
  passengerCard: {
    paddingVertical: spacing.sm,
  },
  passengerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  passengerTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeChip: {
    backgroundColor: colors.background,
  },
  passengerDivider: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  vehicleCard: {
    paddingVertical: spacing.sm,
  },
  vehicleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  vehicleCardIcon: {
    fontSize: 36,
    marginRight: spacing.md,
  },
  vehicleCardInfo: {
    flex: 1,
  },
  vehicleCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  vehicleCardType: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  datePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  datePickerText: {
    fontSize: 16,
    color: colors.text,
  },
  datePickerPlaceholder: {
    color: colors.textSecondary,
  },
  datePickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  datePickerContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  datePickerConfirmButton: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
  },
  datePickerWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  protectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  protectionInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  protectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  protectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  protectionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  protectionPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.success,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
    borderRadius: borderRadius.md,
  },
  payButton: {
    flex: 2,
    borderRadius: borderRadius.md,
  },
  nextButton: {
    borderRadius: borderRadius.md,
  },
  nextButtonFlex: {
    flex: 2,
    borderRadius: borderRadius.md,
  },
  totalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  totalDetails: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
