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
import SavedRoutesScreen from '../screens/SavedRoutesScreen';
import AddCabinScreen from '../screens/AddCabinScreen';
import PersonalInfoScreen from '../screens/PersonalInfoScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import LanguageSettingsScreen from '../screens/LanguageSettingsScreen';
import CurrencySettingsScreen from '../screens/CurrencySettingsScreen';
import PaymentMethodsScreen from '../screens/PaymentMethodsScreen';
import ContactScreen from '../screens/ContactScreen';
import OfflineIndicator from '../components/OfflineIndicator';
import SupportChatbot from '../components/SupportChatbot';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
  const [initialCheckDone, setInitialCheckDone] = React.useState(false);

  useEffect(() => {
    dispatch(checkAuth()).finally(() => {
      setInitialCheckDone(true);
    });
  }, [dispatch]);

  // Only show loading for initial auth check, not during login/register
  if (!initialCheckDone && isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <OfflineIndicator showWhenOnline />
      <SupportChatbot />
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
        name="SavedRoutes"
        component={SavedRoutesScreen}
        options={{
          headerShown: true,
          title: 'Saved Routes',
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
      <Stack.Screen
        name="PersonalInfo"
        component={PersonalInfoScreen}
        options={{
          headerShown: true,
          title: 'Personal Information',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{
          headerShown: true,
          title: 'Change Password',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="LanguageSettings"
        component={LanguageSettingsScreen}
        options={{
          headerShown: true,
          title: 'Language',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="CurrencySettings"
        component={CurrencySettingsScreen}
        options={{
          headerShown: true,
          title: 'Currency',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="PaymentMethods"
        component={PaymentMethodsScreen}
        options={{
          headerShown: true,
          title: 'Payment Methods',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="Contact"
        component={ContactScreen}
        options={{
          headerShown: true,
          title: 'Contact Us',
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
