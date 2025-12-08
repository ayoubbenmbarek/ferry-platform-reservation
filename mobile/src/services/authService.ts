import api, { saveToken, removeToken, getErrorMessage } from './api';
import { User } from '../types';

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

interface LoginData {
  email: string;
  password: string;
}

export const authService = {
  // Login with email/password
  async login(data: LoginData): Promise<LoginResponse> {
    try {
      const formData = new URLSearchParams();
      formData.append('username', data.email);
      formData.append('password', data.password);

      const response = await api.post<{ access_token: string; token_type: string }>('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      await saveToken(response.data.access_token);

      // Fetch user data after login
      const userResponse = await api.get<User>('/auth/me');

      return {
        access_token: response.data.access_token,
        token_type: response.data.token_type,
        user: userResponse.data,
      };
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      throw new Error(errorMessage);
    }
  },

  // Register new user
  async register(data: RegisterData): Promise<LoginResponse> {
    try {
      // Register the user
      await api.post('/auth/register', data);

      // Then login to get the token
      const formData = new URLSearchParams();
      formData.append('username', data.email);
      formData.append('password', data.password);

      const loginResponse = await api.post<{ access_token: string; token_type: string }>('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      await saveToken(loginResponse.data.access_token);

      // Fetch user data
      const userResponse = await api.get<User>('/auth/me');

      return {
        access_token: loginResponse.data.access_token,
        token_type: loginResponse.data.token_type,
        user: userResponse.data,
      };
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Google OAuth login
  async googleLogin(idToken: string): Promise<LoginResponse> {
    try {
      const response = await api.post<LoginResponse>('/auth/google', {
        id_token: idToken,
      });
      await saveToken(response.data.access_token);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Apple login
  async appleLogin(identityToken: string, fullName?: { givenName?: string; familyName?: string }): Promise<LoginResponse> {
    try {
      const response = await api.post<LoginResponse>('/auth/apple', {
        identity_token: identityToken,
        first_name: fullName?.givenName,
        last_name: fullName?.familyName,
      });
      await saveToken(response.data.access_token);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Get current user
  async getCurrentUser(): Promise<User> {
    try {
      const response = await api.get<User>('/auth/me');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Logout
  async logout(): Promise<void> {
    await removeToken();
  },

  // Request password reset
  async requestPasswordReset(email: string): Promise<void> {
    try {
      await api.post('/auth/forgot-password', { email });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Update profile
  async updateProfile(data: Partial<User>): Promise<User> {
    try {
      const response = await api.put<User>('/auth/me', data);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Change password
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Register push notification token
  async registerPushToken(pushToken: string): Promise<void> {
    try {
      await api.post('/auth/push-token', { push_token: pushToken });
      console.log('Push token registered with backend');
    } catch (error) {
      console.error('Failed to register push token:', getErrorMessage(error));
      // Don't throw - push token registration is not critical
    }
  },

  // Remove push notification token
  async removePushToken(): Promise<void> {
    try {
      await api.delete('/auth/push-token');
      console.log('Push token removed from backend');
    } catch (error) {
      console.error('Failed to remove push token:', getErrorMessage(error));
      // Don't throw - push token removal is not critical
    }
  },
};
