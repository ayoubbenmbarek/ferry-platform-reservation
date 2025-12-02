import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Secure storage keys - use different keys from api.ts to avoid conflicts
const STORAGE_KEYS = {
  BIOMETRIC_ENABLED: 'biometric_enabled',
  AUTH_TOKEN: 'biometric_auth_token',  // Different from api.ts 'auth_token'
  USER_EMAIL: 'biometric_user_email',
  REFRESH_TOKEN: 'biometric_refresh_token',  // Different from api.ts 'refresh_token'
};

export type BiometricType = 'face' | 'fingerprint' | 'iris' | 'none';

export interface BiometricStatus {
  isAvailable: boolean;
  biometricType: BiometricType;
  isEnrolled: boolean;
  isEnabled: boolean;
}

class BiometricService {
  /**
   * Check if biometric authentication is available on the device
   */
  async isAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  }

  /**
   * Get the type of biometric authentication available
   */
  async getBiometricType(): Promise<BiometricType> {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'face';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'fingerprint';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        return 'iris';
      }
      return 'none';
    } catch (error) {
      console.error('Error getting biometric type:', error);
      return 'none';
    }
  }

  /**
   * Get a user-friendly name for the biometric type
   */
  getBiometricName(type: BiometricType): string {
    switch (type) {
      case 'face':
        return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
      case 'fingerprint':
        return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
      case 'iris':
        return 'Iris Recognition';
      default:
        return 'Biometric';
    }
  }

  /**
   * Get the current biometric status
   */
  async getStatus(): Promise<BiometricStatus> {
    const [isAvailable, biometricType, isEnrolled, isEnabled] = await Promise.all([
      this.isAvailable(),
      this.getBiometricType(),
      LocalAuthentication.isEnrolledAsync(),
      this.isBiometricEnabled(),
    ]);

    return {
      isAvailable,
      biometricType,
      isEnrolled,
      isEnabled,
    };
  }

  /**
   * Authenticate using biometrics
   */
  async authenticate(reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[BiometricService] Starting authentication...');
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        console.log('[BiometricService] Biometric not available');
        return { success: false, error: 'Biometric authentication not available' };
      }

      const biometricType = await this.getBiometricType();
      const biometricName = this.getBiometricName(biometricType);
      console.log('[BiometricService] Using:', biometricName);

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason || `Sign in with ${biometricName}`,
        cancelLabel: 'Use Password',
        disableDeviceFallback: false,
        fallbackLabel: 'Use Password',
      });

      console.log('[BiometricService] Auth result:', { success: result.success, error: result.error, warning: result.warning });

      if (result.success) {
        console.log('[BiometricService] Authentication successful');
        return { success: true };
      }

      // Handle different error types
      if (result.error === 'user_cancel') {
        console.log('[BiometricService] User cancelled');
        return { success: false, error: 'Authentication cancelled' };
      }
      if (result.error === 'user_fallback') {
        console.log('[BiometricService] User chose fallback (password)');
        return { success: false, error: 'fallback' };
      }
      if (result.error === 'lockout') {
        console.log('[BiometricService] Lockout');
        return { success: false, error: 'Too many attempts. Please try again later.' };
      }

      console.log('[BiometricService] Other error:', result.error);
      return { success: false, error: result.error || 'Authentication failed' };
    } catch (error: any) {
      console.error('Biometric authentication error:', error);
      return { success: false, error: error.message || 'Authentication failed' };
    }
  }

  /**
   * Check if biometric login is enabled for the app
   */
  async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await SecureStore.getItemAsync(STORAGE_KEYS.BIOMETRIC_ENABLED);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking biometric enabled status:', error);
      return false;
    }
  }

  /**
   * Enable biometric login
   */
  async enableBiometric(token: string, email: string, refreshToken?: string): Promise<boolean> {
    try {
      console.log('[BiometricService] enableBiometric - starting with:', {
        tokenLength: token?.length,
        email,
        hasRefreshToken: !!refreshToken
      });

      // First authenticate to confirm identity
      const authResult = await this.authenticate('Confirm your identity to enable biometric login');
      if (!authResult.success) {
        console.log('[BiometricService] enableBiometric - authentication failed');
        return false;
      }

      // Store credentials securely
      // Note: Removing keychainAccessible option for Expo Go compatibility
      console.log('[BiometricService] enableBiometric - storing credentials...');
      try {
        await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
        console.log('[BiometricService] enableBiometric - token stored successfully');
      } catch (tokenError) {
        console.error('[BiometricService] enableBiometric - failed to store token:', tokenError);
        throw tokenError;
      }

      try {
        await SecureStore.setItemAsync(STORAGE_KEYS.USER_EMAIL, email);
        console.log('[BiometricService] enableBiometric - email stored successfully');
      } catch (emailError) {
        console.error('[BiometricService] enableBiometric - failed to store email:', emailError);
        throw emailError;
      }

      if (refreshToken) {
        await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      }
      await SecureStore.setItemAsync(STORAGE_KEYS.BIOMETRIC_ENABLED, 'true');

      // Verify storage
      const storedToken = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      console.log('[BiometricService] enableBiometric - verified storage:', {
        tokenStored: !!storedToken,
        storedTokenLength: storedToken?.length
      });

      return true;
    } catch (error) {
      console.error('Error enabling biometric:', error);
      return false;
    }
  }

  /**
   * Disable biometric login and clear stored credentials
   */
  async disableBiometric(): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_EMAIL);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      await SecureStore.setItemAsync(STORAGE_KEYS.BIOMETRIC_ENABLED, 'false');
      return true;
    } catch (error) {
      console.error('Error disabling biometric:', error);
      return false;
    }
  }

  /**
   * Login using biometrics
   */
  async biometricLogin(): Promise<{
    success: boolean;
    token?: string;
    email?: string;
    refreshToken?: string;
    error?: string;
  }> {
    try {
      // Check if biometric is enabled
      const isEnabled = await this.isBiometricEnabled();
      console.log('[BiometricService] biometricLogin - isEnabled:', isEnabled);
      if (!isEnabled) {
        return { success: false, error: 'Biometric login not enabled' };
      }

      // Authenticate with biometrics
      const authResult = await this.authenticate();
      console.log('[BiometricService] biometricLogin - authResult:', authResult);
      if (!authResult.success) {
        return { success: false, error: authResult.error };
      }

      // Retrieve stored credentials
      const [token, email, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN),
        SecureStore.getItemAsync(STORAGE_KEYS.USER_EMAIL),
        SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
      ]);

      console.log('[BiometricService] biometricLogin - stored credentials:', {
        hasToken: !!token,
        tokenLength: token?.length,
        email,
        hasRefreshToken: !!refreshToken
      });

      if (!token) {
        // Token not found (may have been cleared due to expiration)
        // Don't fully disable biometric - user can restore it by logging in with password
        return { success: false, error: 'Session expired. Please sign in with your password to restore Face ID.' };
      }

      if (!email) {
        // Email not found - this shouldn't happen, fully disable biometric
        await this.disableBiometric();
        return { success: false, error: 'Stored credentials not found' };
      }

      return {
        success: true,
        token,
        email,
        refreshToken: refreshToken || undefined,
      };
    } catch (error: any) {
      console.error('Biometric login error:', error);
      return { success: false, error: error.message || 'Login failed' };
    }
  }

  /**
   * Update stored token (e.g., after token refresh)
   */
  async updateStoredToken(token: string, refreshToken?: string): Promise<boolean> {
    try {
      const isEnabled = await this.isBiometricEnabled();
      console.log('[BiometricService] updateStoredToken - isEnabled:', isEnabled, 'tokenLength:', token?.length);
      if (!isEnabled) {
        return false;
      }

      await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
      console.log('[BiometricService] updateStoredToken - token updated');
      if (refreshToken) {
        await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      }

      // Verify
      const storedToken = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      console.log('[BiometricService] updateStoredToken - verified:', !!storedToken);

      return true;
    } catch (error) {
      console.error('Error updating stored token:', error);
      return false;
    }
  }

  /**
   * Get stored email for display
   */
  async getStoredEmail(): Promise<string | null> {
    try {
      const isEnabled = await this.isBiometricEnabled();
      if (!isEnabled) {
        return null;
      }
      return await SecureStore.getItemAsync(STORAGE_KEYS.USER_EMAIL);
    } catch (error) {
      console.error('Error getting stored email:', error);
      return null;
    }
  }

  /**
   * Clear all stored credentials (used when user explicitly disables biometric)
   */
  async clearCredentials(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_EMAIL);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      await SecureStore.setItemAsync(STORAGE_KEYS.BIOMETRIC_ENABLED, 'false');
    } catch (error) {
      console.error('Error clearing credentials:', error);
    }
  }

  /**
   * Clear only the stored token (used when token expires but we want to keep biometric enabled)
   * This allows the token to be refreshed on next password login
   */
  async clearStoredToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      // Keep BIOMETRIC_ENABLED and USER_EMAIL so biometric can be restored after password login
    } catch (error) {
      console.error('Error clearing stored token:', error);
    }
  }
}

export const biometricService = new BiometricService();
