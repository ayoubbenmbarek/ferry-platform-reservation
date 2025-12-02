import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { checkAuth } from '../store/slices/authSlice';
import { RootStackParamList } from '../types';
import { colors } from '../constants/theme';

import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import SearchResultsScreen from '../screens/SearchResultsScreen';
import FerryDetailsScreen from '../screens/FerryDetailsScreen';
import BookingScreen from '../screens/BookingScreen';
import PaymentScreen from '../screens/PaymentScreen';
import BookingConfirmationScreen from '../screens/BookingConfirmationScreen';
import BookingDetailsScreen from '../screens/BookingDetailsScreen';
import ETicketScreen from '../screens/ETicketScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import MyAlertsScreen from '../screens/MyAlertsScreen';
import AddCabinScreen from '../screens/AddCabinScreen';
import OfflineIndicator from '../components/OfflineIndicator';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <OfflineIndicator showWhenOnline />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Main app flow - accessible to all users */}
        <Stack.Screen name="Main" component={MainNavigator} />

      {/* Auth screens - always available as modal */}
      <Stack.Screen
        name="Auth"
        component={AuthNavigator}
        options={{
          presentation: 'modal',
        }}
      />

      {/* Booking flow screens */}
      <Stack.Screen
        name="SearchResults"
        component={SearchResultsScreen}
        options={{
          headerShown: true,
          title: 'Available Ferries',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="FerryDetails"
        component={FerryDetailsScreen}
        options={{
          headerShown: true,
          title: 'Ferry Details',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="Booking"
        component={BookingScreen}
        options={{
          headerShown: true,
          title: 'Complete Booking',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{
          headerShown: true,
          title: 'Payment',
          headerBackTitle: 'Back',
          gestureEnabled: false, // Prevent swipe back during payment
        }}
      />
      <Stack.Screen
        name="BookingConfirmation"
        component={BookingConfirmationScreen}
        options={{
          headerShown: false,
          gestureEnabled: false, // Prevent going back after confirmation
        }}
      />
      <Stack.Screen
        name="BookingDetails"
        component={BookingDetailsScreen}
        options={{
          headerShown: true,
          title: 'Booking Details',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="ETicket"
        component={ETicketScreen}
        options={{
          headerShown: true,
          title: 'E-Ticket',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          headerShown: true,
          title: 'Notifications',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="MyAlerts"
        component={MyAlertsScreen}
        options={{
          headerShown: true,
          title: 'My Alerts',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="AddCabin"
        component={AddCabinScreen}
        options={{
          headerShown: true,
          title: 'Add Cabin',
          headerBackTitle: 'Back',
        }}
      />
    </Stack.Navigator>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
