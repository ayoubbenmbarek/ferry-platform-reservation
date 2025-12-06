import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { Provider as ReduxProvider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { StripeProvider } from '@stripe/stripe-react-native';
import './src/i18n'; // Initialize i18n

import { store } from './src/store';
import RootNavigator from './src/navigation/RootNavigator';
import { lightTheme } from './src/constants/theme';
import { STRIPE_PUBLISHABLE_KEY } from './src/constants/config';
import { NotificationProvider } from './src/contexts/NotificationContext';
import { NetworkProvider } from './src/contexts/NetworkContext';
import { LanguageProvider } from './src/contexts/LanguageContext';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <ReduxProvider store={store}>
        <LanguageProvider>
          <StripeProvider
            publishableKey={STRIPE_PUBLISHABLE_KEY}
            merchantIdentifier="merchant.com.maritime.reservations"
          >
            <PaperProvider theme={lightTheme}>
              <SafeAreaProvider>
                <NavigationContainer>
                  <NetworkProvider>
                    <NotificationProvider>
                      <StatusBar style="auto" />
                      <RootNavigator />
                    </NotificationProvider>
                  </NetworkProvider>
                </NavigationContainer>
              </SafeAreaProvider>
            </PaperProvider>
          </StripeProvider>
        </LanguageProvider>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
