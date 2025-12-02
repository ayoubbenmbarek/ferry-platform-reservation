import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { Text, TextInput, Button, Switch, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, addDays, parseISO, isBefore, startOfDay } from 'date-fns';

import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import {
  setDeparturePort,
  setArrivalPort,
  setDepartureDate,
  setReturnDate,
  setReturnDeparturePort,
  setReturnArrivalPort,
  setSameReturnRoute,
  setAdults,
  setChildren,
  setInfants,
  setVehicles,
  setVehicleType,
  updateVehicleSelection,
  setIsRoundTrip,
  swapPorts,
  searchFerries,
  fetchPorts,
  fetchRoutes,
} from '../../store/slices/searchSlice';
import { resetBooking } from '../../store/slices/bookingSlice';
import { RootStackParamList, MainTabParamList } from '../../types';
import { colors, spacing, borderRadius } from '../../constants/theme';
import VoiceSearchButton from '../../components/VoiceSearchButton';
import { ParsedSearchQuery, getQuerySummary } from '../../utils/voiceSearchParser';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type SearchRouteProp = RouteProp<MainTabParamList, 'Search'>;

const vehicleTypes = [
  { value: 'car', label: 'Car', icon: '🚗', dimensions: '4.5m × 1.8m × 1.5m' },
  { value: 'suv', label: 'SUV / 4x4', icon: '🚙', dimensions: '5.0m × 2.0m × 1.8m' },
  { value: 'van', label: 'Van / Minibus', icon: '🚐', dimensions: '5.5m × 2.0m × 2.2m' },
  { value: 'motorcycle', label: 'Motorcycle', icon: '🏍️', dimensions: '2.2m × 0.8m × 1.2m' },
  { value: 'camper', label: 'Camper / RV', icon: '🚌', dimensions: '7.0m × 2.3m × 3.0m' },
  { value: 'caravan', label: 'Caravan', icon: '🏕️', dimensions: '7.0m × 2.3m × 2.7m' },
  { value: 'trailer', label: 'Trailer', icon: '🚛', dimensions: '3.5m × 2.0m × 1.5m' },
  { value: 'jetski', label: 'Jet Ski', icon: '🚤', dimensions: '3.0m × 1.2m × 1.0m' },
  { value: 'boat_trailer', label: 'Boat + Trailer', icon: '⛵', dimensions: '6.0m × 2.5m × 2.0m' },
  { value: 'bicycle', label: 'Bicycle', icon: '🚲', dimensions: '1.8m × 0.6m × 1.0m' },
];

export default function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SearchRouteProp>();
  const dispatch = useAppDispatch();
  const {
    departurePort,
    arrivalPort,
    departureDate,
    returnDate,
    returnDeparturePort,
    returnArrivalPort,
    sameReturnRoute,
    passengers,
    adults,
    children,
    infants,
    vehicles,
    vehicleType,
    vehicleSelections,
    isRoundTrip,
    ports,
    routes,
    isSearching,
    searchError,
  } = useAppSelector((state) => state.search);

  const [showPortPicker, setShowPortPicker] = useState<'departure' | 'arrival' | 'returnDeparture' | 'returnArrival' | null>(null);
  const [showDeparturePicker, setShowDeparturePicker] = useState(false);
  const [showReturnPicker, setShowReturnPicker] = useState(false);
  const [showPassengerPicker, setShowPassengerPicker] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [voiceSearchFeedback, setVoiceSearchFeedback] = useState<string | null>(null);

  const [tempDepartureDate, setTempDepartureDate] = useState(new Date());
  const [tempReturnDate, setTempReturnDate] = useState(addDays(new Date(), 7));

  // Handle voice search result
  const handleVoiceSearchResult = (result: ParsedSearchQuery) => {
    // Set departure port if detected
    if (result.departurePort) {
      // Try to find a matching port
      const matchedDeparture = ports.find(
        p => p.code.toLowerCase() === result.departurePort?.toLowerCase() ||
             p.name.toLowerCase().includes(result.departurePort?.toLowerCase() || '')
      );
      if (matchedDeparture) {
        dispatch(setDeparturePort(matchedDeparture.code));
      }
    }

    // Set arrival port if detected
    if (result.arrivalPort) {
      const matchedArrival = ports.find(
        p => p.code.toLowerCase() === result.arrivalPort?.toLowerCase() ||
             p.name.toLowerCase().includes(result.arrivalPort?.toLowerCase() || '')
      );
      if (matchedArrival) {
        dispatch(setArrivalPort(matchedArrival.code));
      }
    }

    // Set departure date if detected
    if (result.departureDate) {
      dispatch(setDepartureDate(result.departureDate));
      setTempDepartureDate(parseISO(result.departureDate));
    }

    // Set round trip and return date if detected
    if (result.isRoundTrip) {
      dispatch(setIsRoundTrip(true));
      if (result.returnDate) {
        dispatch(setReturnDate(result.returnDate));
        setTempReturnDate(parseISO(result.returnDate));
      }
    }

    // Set passengers
    if (result.adults > 0) {
      dispatch(setAdults(result.adults));
    }
    if (result.children > 0) {
      dispatch(setChildren(result.children));
    }
    if (result.infants > 0) {
      dispatch(setInfants(result.infants));
    }

    // Set vehicle if detected
    if (result.hasVehicle) {
      dispatch(setVehicles(1));
    }

    // Show feedback
    const summary = getQuerySummary(result);
    setVoiceSearchFeedback(summary);

    // Clear feedback after 4 seconds
    setTimeout(() => {
      setVoiceSearchFeedback(null);
    }, 4000);
  };

  const handleVoiceSearchError = (error: string) => {
    console.error('Voice search error:', error);
  };

  useEffect(() => {
    if (ports.length === 0) {
      dispatch(fetchPorts());
      dispatch(fetchRoutes());
    }
  }, [dispatch, ports.length]);

  // Handle prefilled params from SavedRoutes navigation
  useEffect(() => {
    const params = route.params;
    if (params?.prefillDeparture || params?.prefillArrival) {
      // Set departure port - need to find matching port code
      if (params.prefillDeparture) {
        const matchedDeparture = ports.find(
          p => p.code.toLowerCase() === params.prefillDeparture?.toLowerCase() ||
               p.name.toLowerCase() === params.prefillDeparture?.toLowerCase()
        );
        if (matchedDeparture) {
          dispatch(setDeparturePort(matchedDeparture.code));
        } else {
          // Try using the port name directly if no match (it might be the code)
          dispatch(setDeparturePort(params.prefillDeparture.toUpperCase()));
        }
      }

      // Set arrival port
      if (params.prefillArrival) {
        const matchedArrival = ports.find(
          p => p.code.toLowerCase() === params.prefillArrival?.toLowerCase() ||
               p.name.toLowerCase() === params.prefillArrival?.toLowerCase()
        );
        if (matchedArrival) {
          dispatch(setArrivalPort(matchedArrival.code));
        } else {
          dispatch(setArrivalPort(params.prefillArrival.toUpperCase()));
        }
      }

      // Set date if provided
      if (params.prefillDate) {
        dispatch(setDepartureDate(params.prefillDate));
        setTempDepartureDate(parseISO(params.prefillDate));
      } else {
        // Default to tomorrow if no date provided
        const tomorrow = addDays(new Date(), 1);
        dispatch(setDepartureDate(format(tomorrow, 'yyyy-MM-dd')));
        setTempDepartureDate(tomorrow);
      }

      // Clear the params after processing so they don't trigger again
      navigation.setParams({ prefillDeparture: undefined, prefillArrival: undefined, prefillDate: undefined, autoSearch: undefined } as any);
    }
  }, [route.params, ports, dispatch, navigation]);

  const availableDestinations = departurePort && routes[departurePort]
    ? ports.filter(p => routes[departurePort].includes(p.code))
    : ports;

  const handleSearch = async () => {
    if (!departurePort || !arrivalPort || !departureDate) {
      return;
    }

    // Reset booking state to start fresh
    dispatch(resetBooking());

    // Determine return ports
    const effectiveReturnDeparture = sameReturnRoute ? arrivalPort : (returnDeparturePort || arrivalPort);
    const effectiveReturnArrival = sameReturnRoute ? departurePort : (returnArrivalPort || departurePort);

    const result = await dispatch(searchFerries({
      departure_port: departurePort,
      arrival_port: arrivalPort,
      departure_date: departureDate,
      return_date: isRoundTrip && returnDate ? returnDate : undefined,
      return_departure_port: isRoundTrip ? effectiveReturnDeparture : undefined,
      return_arrival_port: isRoundTrip ? effectiveReturnArrival : undefined,
      passengers,
      adults,
      children,
      infants,
      vehicles,
      vehicle_type: vehicles > 0 ? vehicleType : undefined,
    }));

    if (searchFerries.fulfilled.match(result)) {
      navigation.navigate('SearchResults', {
        params: {
          departure_port: departurePort,
          arrival_port: arrivalPort,
          departure_date: departureDate,
          return_date: isRoundTrip && returnDate ? returnDate : undefined,
          return_departure_port: isRoundTrip ? effectiveReturnDeparture : undefined,
          return_arrival_port: isRoundTrip ? effectiveReturnArrival : undefined,
          passengers,
          adults,
          children,
          infants,
          vehicles,
          vehicle_type: vehicles > 0 ? vehicleType : undefined,
        },
      });
    }
  };

  const handleSwapPorts = () => {
    dispatch(swapPorts());
  };

  const getPortPickerTitle = () => {
    switch (showPortPicker) {
      case 'departure': return 'Departure Port';
      case 'arrival': return 'Arrival Port';
      case 'returnDeparture': return 'Return Departure Port';
      case 'returnArrival': return 'Return Arrival Port';
      default: return 'Select Port';
    }
  };

  const renderPortPicker = () => (
    <Modal
      visible={showPortPicker !== null}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            Select {getPortPickerTitle()}
          </Text>
          <TouchableOpacity onPress={() => setShowPortPicker(null)}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={showPortPicker === 'arrival' ? availableDestinations : ports}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.portItem}
              onPress={() => {
                switch (showPortPicker) {
                  case 'departure':
                    dispatch(setDeparturePort(item.code));
                    break;
                  case 'arrival':
                    dispatch(setArrivalPort(item.code));
                    break;
                  case 'returnDeparture':
                    dispatch(setReturnDeparturePort(item.code));
                    break;
                  case 'returnArrival':
                    dispatch(setReturnArrivalPort(item.code));
                    break;
                }
                setShowPortPicker(null);
              }}
            >
              <View style={styles.portInfo}>
                <Text style={styles.portName}>{item.name}</Text>
                <Text style={styles.portCountry}>{item.country}</Text>
              </View>
              <Text style={styles.portCode}>{item.code}</Text>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </Modal>
  );

  const renderPassengerPicker = () => (
    <Modal
      visible={showPassengerPicker}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Passengers & Vehicles</Text>
          <TouchableOpacity onPress={() => setShowPassengerPicker(false)}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.pickerContent}>
          {/* Adults */}
          <View style={styles.counterRow}>
            <View>
              <Text style={styles.counterLabel}>Adults</Text>
              <Text style={styles.counterHint}>12+ years</Text>
            </View>
            <View style={styles.counter}>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() => dispatch(setAdults(adults - 1))}
                disabled={adults <= 1}
              >
                <Ionicons
                  name="remove"
                  size={24}
                  color={adults <= 1 ? colors.disabled : colors.text}
                />
              </TouchableOpacity>
              <Text style={styles.counterValue}>{adults}</Text>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() => dispatch(setAdults(adults + 1))}
                disabled={adults >= 9}
              >
                <Ionicons
                  name="add"
                  size={24}
                  color={adults >= 9 ? colors.disabled : colors.text}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Children */}
          <View style={styles.counterRow}>
            <View>
              <Text style={styles.counterLabel}>Children</Text>
              <Text style={styles.counterHint}>2-11 years</Text>
            </View>
            <View style={styles.counter}>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() => dispatch(setChildren(children - 1))}
                disabled={children <= 0}
              >
                <Ionicons
                  name="remove"
                  size={24}
                  color={children <= 0 ? colors.disabled : colors.text}
                />
              </TouchableOpacity>
              <Text style={styles.counterValue}>{children}</Text>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() => dispatch(setChildren(children + 1))}
                disabled={children >= 8}
              >
                <Ionicons
                  name="add"
                  size={24}
                  color={children >= 8 ? colors.disabled : colors.text}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Infants */}
          <View style={styles.counterRow}>
            <View>
              <Text style={styles.counterLabel}>Infants</Text>
              <Text style={styles.counterHint}>Under 2 years (1 per adult)</Text>
            </View>
            <View style={styles.counter}>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() => dispatch(setInfants(infants - 1))}
                disabled={infants <= 0}
              >
                <Ionicons
                  name="remove"
                  size={24}
                  color={infants <= 0 ? colors.disabled : colors.text}
                />
              </TouchableOpacity>
              <Text style={styles.counterValue}>{infants}</Text>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() => dispatch(setInfants(infants + 1))}
                disabled={infants >= adults}
              >
                <Ionicons
                  name="add"
                  size={24}
                  color={infants >= adults ? colors.disabled : colors.text}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Vehicles */}
          <View style={styles.counterRow}>
            <View>
              <Text style={styles.counterLabel}>Vehicles</Text>
              <Text style={styles.counterHint}>Max 3 vehicles</Text>
            </View>
            <View style={styles.counter}>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() => dispatch(setVehicles(vehicles - 1))}
                disabled={vehicles <= 0}
              >
                <Ionicons
                  name="remove"
                  size={24}
                  color={vehicles <= 0 ? colors.disabled : colors.text}
                />
              </TouchableOpacity>
              <Text style={styles.counterValue}>{vehicles}</Text>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() => dispatch(setVehicles(vehicles + 1))}
                disabled={vehicles >= 3}
              >
                <Ionicons
                  name="add"
                  size={24}
                  color={vehicles >= 3 ? colors.disabled : colors.text}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Vehicle Type Selection for Each Vehicle */}
          {vehicles > 0 && (
            <View style={styles.vehicleTypeSection}>
              <Text style={styles.counterLabel}>Vehicle Types</Text>
              <Text style={styles.counterHint}>Select type for each vehicle</Text>

              {vehicleSelections.map((vehicleSelection, index) => {
                const selectedType = vehicleTypes.find(t => t.value === vehicleSelection.type);
                return (
                  <View key={vehicleSelection.id} style={styles.vehicleItemContainer}>
                    <Text style={styles.vehicleItemTitle}>
                      Vehicle {index + 1}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.vehicleTypeScrollView}
                    >
                      <View style={styles.vehicleTypeRow}>
                        {vehicleTypes.map((type) => (
                          <TouchableOpacity
                            key={type.value}
                            style={[
                              styles.vehicleTypeCardCompact,
                              vehicleSelection.type === type.value && styles.vehicleTypeCardSelected,
                            ]}
                            onPress={() => dispatch(updateVehicleSelection({ index, type: type.value as any }))}
                          >
                            <Text style={styles.vehicleTypeIcon}>{type.icon}</Text>
                            <Text style={[
                              styles.vehicleTypeLabelCompact,
                              vehicleSelection.type === type.value && styles.vehicleTypeLabelSelected,
                            ]}>
                              {type.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                    {selectedType && (
                      <Text style={styles.vehicleSelectedInfo}>
                        Selected: {selectedType.icon} {selectedType.label} ({selectedType.dimensions})
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <Button
            mode="contained"
            onPress={() => setShowPassengerPicker(false)}
            style={styles.doneButton}
          >
            Done
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Search Ferries</Text>
          <VoiceSearchButton
            onResult={handleVoiceSearchResult}
            onError={handleVoiceSearchError}
            size="medium"
          />
        </View>

        {/* Voice Search Feedback */}
        {voiceSearchFeedback && (
          <View style={styles.voiceFeedback}>
            <Ionicons name="mic" size={16} color={colors.primary} />
            <Text style={styles.voiceFeedbackText}>{voiceSearchFeedback}</Text>
          </View>
        )}

        {/* Ports Selection */}
        <View style={styles.portsContainer}>
          <TouchableOpacity
            style={styles.portInput}
            onPress={() => setShowPortPicker('departure')}
          >
            <View style={styles.portInputIcon}>
              <Ionicons name="location" size={20} color={colors.primary} />
            </View>
            <View style={styles.portInputContent}>
              <Text style={styles.portInputLabel}>From</Text>
              <Text style={styles.portInputValue}>
                {departurePort || 'Select departure'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.swapButton} onPress={handleSwapPorts}>
            <Ionicons name="swap-vertical" size={24} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.portInput}
            onPress={() => setShowPortPicker('arrival')}
          >
            <View style={styles.portInputIcon}>
              <Ionicons name="location-outline" size={20} color={colors.secondary} />
            </View>
            <View style={styles.portInputContent}>
              <Text style={styles.portInputLabel}>To</Text>
              <Text style={styles.portInputValue}>
                {arrivalPort || 'Select destination'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Round Trip Toggle */}
        <View style={styles.roundTripRow}>
          <Text style={styles.roundTripLabel}>Round Trip</Text>
          <Switch
            value={isRoundTrip}
            onValueChange={(value) => { dispatch(setIsRoundTrip(value)); }}
            color={colors.primary}
          />
        </View>

        {/* Different Return Route Option */}
        {isRoundTrip && (
          <>
            <View style={styles.roundTripRow}>
              <Text style={styles.roundTripLabel}>Same return route</Text>
              <Switch
                value={sameReturnRoute}
                onValueChange={(value) => { dispatch(setSameReturnRoute(value)); }}
                color={colors.primary}
              />
            </View>

            {!sameReturnRoute && (
              <View style={styles.portsContainer}>
                <TouchableOpacity
                  style={styles.portInput}
                  onPress={() => setShowPortPicker('returnDeparture')}
                >
                  <View style={styles.portInputIcon}>
                    <Ionicons name="return-up-back" size={20} color={colors.secondary} />
                  </View>
                  <View style={styles.portInputContent}>
                    <Text style={styles.portInputLabel}>Return From</Text>
                    <Text style={styles.portInputValue}>
                      {returnDeparturePort || arrivalPort || 'Select port'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.portInput, { borderBottomWidth: 0 }]}
                  onPress={() => setShowPortPicker('returnArrival')}
                >
                  <View style={styles.portInputIcon}>
                    <Ionicons name="return-down-forward" size={20} color={colors.secondary} />
                  </View>
                  <View style={styles.portInputContent}>
                    <Text style={styles.portInputLabel}>Return To</Text>
                    <Text style={styles.portInputValue}>
                      {returnArrivalPort || departurePort || 'Select port'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Date Selection */}
        <View style={styles.dateContainer}>
          <TouchableOpacity
            style={[styles.dateInput, !isRoundTrip && styles.dateInputFull]}
            onPress={() => {
              // Sync temp date with current selection or today
              if (departureDate) {
                setTempDepartureDate(parseISO(departureDate));
              } else {
                setTempDepartureDate(new Date());
              }
              setShowDeparturePicker(true);
            }}
          >
            <Ionicons name="calendar" size={20} color={colors.primary} />
            <View style={styles.dateInputContent}>
              <Text style={styles.dateInputLabel}>Departure</Text>
              <Text style={styles.dateInputValue}>
                {departureDate || 'Select date'}
              </Text>
            </View>
          </TouchableOpacity>

          {isRoundTrip && (
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => {
                // Sync temp date with current selection, or departure date, or today + 7 days
                if (returnDate) {
                  setTempReturnDate(parseISO(returnDate));
                } else if (departureDate) {
                  setTempReturnDate(addDays(parseISO(departureDate), 1));
                } else {
                  setTempReturnDate(addDays(new Date(), 7));
                }
                setShowReturnPicker(true);
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.secondary} />
              <View style={styles.dateInputContent}>
                <Text style={styles.dateInputLabel}>Return</Text>
                <Text style={styles.dateInputValue}>
                  {returnDate || 'Select date'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Date Pickers - iOS uses modal, Android uses default */}
        {Platform.OS === 'ios' ? (
          <Modal
            visible={showDeparturePicker || showReturnPicker}
            animationType="slide"
            transparent={true}
          >
            <View style={styles.dateModalOverlay}>
              <View style={styles.dateModalContent}>
                <View style={styles.dateModalHeader}>
                  <Text style={styles.dateModalTitle}>
                    {showDeparturePicker ? 'Select Departure Date' : 'Select Return Date'}
                  </Text>
                  <TouchableOpacity onPress={() => {
                    setShowDeparturePicker(false);
                    setShowReturnPicker(false);
                  }}>
                    <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.datePickerWrapper}>
                  <DateTimePicker
                    value={showDeparturePicker ? tempDepartureDate : tempReturnDate}
                    mode="date"
                    display="spinner"
                    minimumDate={showDeparturePicker
                      ? startOfDay(new Date())
                      : startOfDay(departureDate ? parseISO(departureDate) : new Date())
                    }
                    textColor={colors.text}
                    themeVariant="light"
                    onChange={(event, date) => {
                      if (date) {
                        if (showDeparturePicker) {
                          setTempDepartureDate(date);
                        } else {
                          setTempReturnDate(date);
                        }
                      }
                    }}
                    style={{ height: 200 }}
                  />
                </View>
                <Button
                  mode="contained"
                  onPress={() => {
                    if (showDeparturePicker) {
                      const newDepartureDate = format(tempDepartureDate, 'yyyy-MM-dd');
                      dispatch(setDepartureDate(newDepartureDate));
                      // Reset return date if it's before the new departure date
                      if (returnDate && isBefore(parseISO(returnDate), tempDepartureDate)) {
                        dispatch(setReturnDate(newDepartureDate));
                        setTempReturnDate(tempDepartureDate);
                      }
                      setShowDeparturePicker(false);
                    } else {
                      dispatch(setReturnDate(format(tempReturnDate, 'yyyy-MM-dd')));
                      setShowReturnPicker(false);
                    }
                  }}
                  style={styles.confirmDateButton}
                >
                  Confirm
                </Button>
              </View>
            </View>
          </Modal>
        ) : (
          <>
            {showDeparturePicker && (
              <DateTimePicker
                value={tempDepartureDate}
                mode="date"
                display="default"
                minimumDate={startOfDay(new Date())}
                onChange={(event, date) => {
                  setShowDeparturePicker(false);
                  if (date) {
                    setTempDepartureDate(date);
                    const newDepartureDate = format(date, 'yyyy-MM-dd');
                    dispatch(setDepartureDate(newDepartureDate));
                    // Reset return date if it's before the new departure date
                    if (returnDate && isBefore(parseISO(returnDate), date)) {
                      dispatch(setReturnDate(newDepartureDate));
                      setTempReturnDate(date);
                    }
                  }
                }}
              />
            )}
            {showReturnPicker && (
              <DateTimePicker
                value={tempReturnDate}
                mode="date"
                display="default"
                minimumDate={departureDate ? startOfDay(parseISO(departureDate)) : startOfDay(new Date())}
                onChange={(event, date) => {
                  setShowReturnPicker(false);
                  if (date) {
                    setTempReturnDate(date);
                    dispatch(setReturnDate(format(date, 'yyyy-MM-dd')));
                  }
                }}
              />
            )}
          </>
        )}

        {/* Passengers & Vehicles */}
        <TouchableOpacity
          style={styles.passengerInput}
          onPress={() => setShowPassengerPicker(true)}
        >
          <Ionicons name="people" size={20} color={colors.primary} />
          <View style={styles.passengerInputContent}>
            <Text style={styles.passengerInputLabel}>Travelers</Text>
            <Text style={styles.passengerInputValue}>
              {adults} Adult{adults > 1 ? 's' : ''}
              {children > 0 && `, ${children} Child${children > 1 ? 'ren' : ''}`}
              {infants > 0 && `, ${infants} Infant${infants > 1 ? 's' : ''}`}
              {vehicleSelections.length > 0 && `, ${vehicleSelections.length} Vehicle${vehicleSelections.length > 1 ? 's' : ''}`}
              {vehicleSelections.length > 0 && ` (${vehicleSelections.map(v => vehicleTypes.find(t => t.value === v.type)?.icon || '🚗').join('')})`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Error Message */}
        {searchError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{searchError}</Text>
          </View>
        )}

        {/* Search Button */}
        <Button
          mode="contained"
          onPress={handleSearch}
          loading={isSearching}
          disabled={isSearching || !departurePort || !arrivalPort || !departureDate}
          style={styles.searchButton}
          contentStyle={styles.searchButtonContent}
          icon="magnify"
        >
          Search Ferries
        </Button>
      </ScrollView>

      {/* Modals */}
      {renderPortPicker()}
      {renderPassengerPicker()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  voiceFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  voiceFeedbackText: {
    flex: 1,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  portsContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    position: 'relative',
  },
  portInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  portInputIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  portInputContent: {
    flex: 1,
  },
  portInputLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  portInputValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  swapButton: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 1,
  },
  roundTripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  roundTripLabel: {
    fontSize: 16,
    color: colors.text,
  },
  dateContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  dateInputFull: {
    flex: 1,
  },
  dateInputContent: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  dateInputValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  passengerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  passengerInputContent: {
    flex: 1,
  },
  passengerInputLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  passengerInputValue: {
    fontSize: 16,
    color: colors.text,
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
  searchButton: {
    borderRadius: borderRadius.md,
  },
  searchButtonContent: {
    paddingVertical: spacing.sm,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  portItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  portInfo: {
    flex: 1,
  },
  portName: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  portCountry: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  portCode: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  pickerContent: {
    padding: spacing.lg,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  counterLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  counterHint: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    width: 30,
    textAlign: 'center',
  },
  vehicleTypeSection: {
    marginTop: spacing.lg,
  },
  vehicleTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  vehicleTypeCard: {
    width: '48%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  vehicleTypeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  vehicleTypeIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  vehicleTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  vehicleTypeLabelSelected: {
    color: colors.primary,
  },
  vehicleTypeDimensions: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  vehicleItemContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  vehicleItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  vehicleTypeScrollView: {
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  vehicleTypeCardCompact: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    minWidth: 80,
  },
  vehicleTypeLabelCompact: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
    marginTop: 4,
  },
  vehicleSelectedInfo: {
    fontSize: 12,
    color: colors.primary,
    marginTop: spacing.sm,
    fontWeight: '500',
  },
  doneButton: {
    marginTop: spacing.xl,
    borderRadius: borderRadius.md,
  },
  datePickerContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  confirmDateButton: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dateModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  dateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dateModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  datePickerWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
});
