// Mock Platform before any imports
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (obj: any) => obj.ios || obj.default,
  },
}));

// Mock dependencies before imports
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(() => Promise.resolve(true)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(true)),
  supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([1])), // FINGERPRINT
  authenticateAsync: jest.fn(() => Promise.resolve({ success: true })),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

import { biometricService } from '../../services/biometricService';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

describe('BiometricService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset default implementations
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([1]);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('isAvailable', () => {
    it('should return true when hardware exists and biometric is enrolled', async () => {
      const result = await biometricService.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when hardware does not exist', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(false);
      const result = await biometricService.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when biometric is not enrolled', async () => {
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(false);
      const result = await biometricService.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('getBiometricType', () => {
    it('should return fingerprint type', async () => {
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValueOnce([1]);
      const result = await biometricService.getBiometricType();
      expect(result).toBe('fingerprint');
    });

    it('should return face type', async () => {
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValueOnce([2]);
      const result = await biometricService.getBiometricType();
      expect(result).toBe('face');
    });

    it('should return iris type', async () => {
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValueOnce([3]);
      const result = await biometricService.getBiometricType();
      expect(result).toBe('iris');
    });

    it('should return none when no types available', async () => {
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValueOnce([]);
      const result = await biometricService.getBiometricType();
      expect(result).toBe('none');
    });

    it('should prefer face over fingerprint', async () => {
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValueOnce([1, 2]);
      const result = await biometricService.getBiometricType();
      expect(result).toBe('face');
    });
  });

  describe('getBiometricName', () => {
    it('should return appropriate name for fingerprint', () => {
      const name = biometricService.getBiometricName('fingerprint');
      expect(['Touch ID', 'Fingerprint']).toContain(name);
    });

    it('should return appropriate name for face', () => {
      const name = biometricService.getBiometricName('face');
      expect(['Face ID', 'Face Recognition']).toContain(name);
    });

    it('should return Biometric for unknown type', () => {
      const name = biometricService.getBiometricName('none');
      expect(name).toBe('Biometric');
    });
  });

  describe('authenticate', () => {
    it('should return success when authentication succeeds', async () => {
      const result = await biometricService.authenticate();
      expect(result.success).toBe(true);
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled();
    });

    it('should return error when authentication fails', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'authentication_failed',
      });
      const result = await biometricService.authenticate();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle user cancel', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'user_cancel',
      });
      const result = await biometricService.authenticate();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication cancelled');
    });

    it('should handle fallback request', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'user_fallback',
      });
      const result = await biometricService.authenticate();
      expect(result.success).toBe(false);
      expect(result.error).toBe('fallback');
    });

    it('should return error when biometric not available', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(false);
      const result = await biometricService.authenticate();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Biometric authentication not available');
    });
  });

  describe('isBiometricEnabled', () => {
    it('should return true when enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('true');
      const result = await biometricService.isBiometricEnabled();
      expect(result).toBe(true);
    });

    it('should return false when not enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('false');
      const result = await biometricService.isBiometricEnabled();
      expect(result).toBe(false);
    });

    it('should return false when not set', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
      const result = await biometricService.isBiometricEnabled();
      expect(result).toBe(false);
    });
  });

  describe('enableBiometric', () => {
    it('should store credentials when authentication succeeds', async () => {
      const result = await biometricService.enableBiometric('test-token', 'test@example.com', 'refresh-token');

      expect(result).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'biometric_auth_token',
        'test-token'
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'biometric_user_email',
        'test@example.com'
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'biometric_refresh_token',
        'refresh-token'
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('biometric_enabled', 'true');
    });

    it('should return false when authentication fails', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'user_cancel',
      });

      const result = await biometricService.enableBiometric('test-token', 'test@example.com');
      expect(result).toBe(false);
    });
  });

  describe('disableBiometric', () => {
    it('should clear stored credentials', async () => {
      const result = await biometricService.disableBiometric();

      expect(result).toBe(true);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('biometric_auth_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('biometric_user_email');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('biometric_refresh_token');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('biometric_enabled', 'false');
    });
  });

  describe('biometricLogin', () => {
    it('should return stored credentials on successful auth', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('true') // biometric_enabled check
        .mockResolvedValueOnce('stored-token') // auth_token
        .mockResolvedValueOnce('test@example.com') // user_email
        .mockResolvedValueOnce('refresh-token'); // refresh_token

      const result = await biometricService.biometricLogin();

      expect(result.success).toBe(true);
      expect(result.token).toBe('stored-token');
      expect(result.email).toBe('test@example.com');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('should return error when biometric not enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('false');

      const result = await biometricService.biometricLogin();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Biometric login not enabled');
    });

    it('should return session expired error when token not found', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('true') // biometric_enabled
        .mockResolvedValueOnce(null) // no token
        .mockResolvedValueOnce(null) // no email
        .mockResolvedValueOnce(null); // no refresh token

      const result = await biometricService.biometricLogin();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session expired. Please sign in with your password to restore Face ID.');
    });

    it('should return error and disable when email not found but token exists', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('true') // biometric_enabled
        .mockResolvedValueOnce('valid-token') // token exists
        .mockResolvedValueOnce(null) // no email
        .mockResolvedValueOnce(null); // no refresh token

      const result = await biometricService.biometricLogin();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stored credentials not found');
    });
  });

  describe('updateStoredToken', () => {
    it('should update token when biometric is enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('true');

      const result = await biometricService.updateStoredToken('new-token', 'new-refresh');

      expect(result).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'biometric_auth_token',
        'new-token'
      );
    });

    it('should return false when biometric not enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('false');

      const result = await biometricService.updateStoredToken('new-token');

      expect(result).toBe(false);
    });
  });

  describe('getStoredEmail', () => {
    it('should return email when biometric is enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('true')
        .mockResolvedValueOnce('test@example.com');

      const result = await biometricService.getStoredEmail();

      expect(result).toBe('test@example.com');
    });

    it('should return null when biometric not enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('false');

      const result = await biometricService.getStoredEmail();

      expect(result).toBeNull();
    });
  });

  describe('clearCredentials', () => {
    it('should clear all stored credentials', async () => {
      await biometricService.clearCredentials();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('biometric_auth_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('biometric_user_email');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('biometric_refresh_token');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('biometric_enabled', 'false');
    });
  });

  describe('getStatus', () => {
    it('should return complete status', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('true');

      const status = await biometricService.getStatus();

      expect(status).toEqual({
        isAvailable: true,
        biometricType: 'fingerprint',
        isEnrolled: true,
        isEnabled: true,
      });
    });
  });
});
