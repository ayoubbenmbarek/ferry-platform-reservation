import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Text, TextInput, Button, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';

import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { login, googleLogin, appleLogin, biometricLogin, clearError } from '../../store/slices/authSlice';
import { biometricService, BiometricType } from '../../services/biometricService';
import { AuthStackParamList, RootStackParamList } from '../../types';
import { colors, spacing, borderRadius } from '../../constants/theme';
import { GOOGLE_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID } from '../../constants/config';

WebBrowser.maybeCompleteAuthSession();

type NavigationProp = NativeStackNavigationProp<AuthStackParamList & RootStackParamList>;

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { isLoading } = useAppSelector((state) => state.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const [storedEmail, setStoredEmail] = useState<string | null>(null);

  // Check biometric availability and clear error when screen mounts
  React.useEffect(() => {
    dispatch(clearError());
    setLocalError(null);

    const checkBiometric = async () => {
      const status = await biometricService.getStatus();
      setBiometricAvailable(status.isAvailable && status.isEnabled);
      setBiometricType(status.biometricType);

      if (status.isEnabled) {
        const email = await biometricService.getStoredEmail();
        setStoredEmail(email);
      }
    };
    checkBiometric();
  }, [dispatch]);

  // Google Auth - webClientId is used for Expo Go development
  const [_, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID, // Web client ID for Expo Go
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  React.useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { id_token } = googleResponse.params;
      dispatch(googleLogin(id_token));
    }
  }, [googleResponse, dispatch]);

  const navigateAfterAuth = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        })
      );
    }
  };

  // Email validation helper
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    // Validate empty fields
    if (!email.trim()) {
      setLocalError('Please enter your email address');
      return;
    }

    // Validate email format
    if (!isValidEmail(email.trim())) {
      setLocalError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setLocalError('Please enter your password');
      return;
    }

    setLocalError(null);
    dispatch(clearError());

    try {
      const result = await dispatch(login({ email: email.trim(), password }));
      console.log('Login result:', {
        type: result.type,
        payload: result.payload,
        meta: result.meta
      });

      if (login.fulfilled.match(result)) {
        navigateAfterAuth();
      } else if (login.rejected.match(result)) {
        // Get error message from the rejected action
        const errorMessage = result.payload as string || 'Login failed. Please try again.';
        console.log('Setting login error:', errorMessage);
        setLocalError(errorMessage);
      }
    } catch (error: any) {
      console.error('Login catch error:', error);
      setLocalError(error.message || 'An unexpected error occurred. Please try again.');
    }
  };

  const handleGoogleLogin = () => {
    promptGoogleAsync();
  };

  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const result = await dispatch(appleLogin({
          identityToken: credential.identityToken,
          fullName: credential.fullName ? {
            givenName: credential.fullName.givenName || undefined,
            familyName: credential.fullName.familyName || undefined,
          } : undefined,
        }));
        if (appleLogin.fulfilled.match(result)) {
          navigateAfterAuth();
        }
      }
    } catch (e: any) {
      if (e.code !== 'ERR_CANCELED') {
        console.error('Apple Sign In Error:', e);
      }
    }
  };

  const handleBiometricLogin = async () => {
    console.log('[LoginScreen] Starting biometric login...');
    setLocalError(null);
    dispatch(clearError());

    // Small delay to ensure the UI is stable before showing system biometric prompt
    await new Promise(resolve => setTimeout(resolve, 100));

    const result = await dispatch(biometricLogin());
    console.log('[LoginScreen] Biometric login result:', { type: result.type, payload: result.payload, meta: result.meta });

    if (biometricLogin.fulfilled.match(result)) {
      console.log('[LoginScreen] Biometric login succeeded, navigating...');
      navigateAfterAuth();
    } else if (biometricLogin.rejected.match(result)) {
      const error = result.payload as string;
      console.log('[LoginScreen] Biometric login rejected:', error);
      if (error !== 'fallback' && error !== 'Authentication cancelled') {
        setLocalError(error);
      }
    }
  };

  const getBiometricIcon = () => {
    switch (biometricType) {
      case 'face':
        return Platform.OS === 'ios' ? 'scan' : 'happy';
      case 'fingerprint':
        return 'finger-print';
      default:
        return 'lock-closed';
    }
  };

  const getBiometricLabel = () => {
    return biometricService.getBiometricName(biometricType);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.dispatch(
                    CommonActions.reset({
                      index: 0,
                      routes: [{ name: 'Main' }],
                    })
                  );
                }
              }}
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.logoContainer}>
              <Ionicons name="boat" size={60} color={colors.primary} />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to manage your bookings</Text>
          </View>

          {/* Error Message */}
          {localError && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={colors.error} style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{localError}</Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              left={<TextInput.Icon icon="email" />}
              style={styles.input}
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              left={<TextInput.Icon icon="lock" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              style={styles.input}
            />

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading || !email || !password}
              style={styles.loginButton}
              contentStyle={styles.buttonContent}
            >
              Sign In
            </Button>
          </View>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <Divider style={styles.divider} />
            <Text style={styles.dividerText}>or continue with</Text>
            <Divider style={styles.divider} />
          </View>

          {/* Biometric Login */}
          {biometricAvailable && storedEmail && (
            <View style={styles.biometricSection}>
              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleBiometricLogin}
                disabled={isLoading}
              >
                <View style={styles.biometricIconContainer}>
                  <Ionicons name={getBiometricIcon() as any} size={32} color={colors.primary} />
                </View>
                <View style={styles.biometricTextContainer}>
                  <Text style={styles.biometricTitle}>Sign in with {getBiometricLabel()}</Text>
                  <Text style={styles.biometricEmail}>{storedEmail}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Social Login */}
          <View style={styles.socialButtons}>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={handleGoogleLogin}
            >
              <Ionicons name="logo-google" size={24} color="#DB4437" />
              <Text style={styles.socialButtonText}>Google</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleAppleLogin}
              >
                <Ionicons name="logo-apple" size={24} color="#000" />
                <Text style={styles.socialButtonText}>Apple</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: spacing.sm,
  },
  logoContainer: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    marginBottom: spacing.lg,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 14,
  },
  loginButton: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  divider: {
    flex: 1,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    color: colors.textSecondary,
    fontSize: 14,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  socialButtonText: {
    fontSize: 16,
    color: colors.text,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  registerText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  registerLink: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  biometricSection: {
    marginBottom: spacing.lg,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  biometricIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  biometricTextContainer: {
    flex: 1,
  },
  biometricTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  biometricEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
