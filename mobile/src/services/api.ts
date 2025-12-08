import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/config';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 second timeout to handle slower network/server responses
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token storage keys
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Get token from secure storage
export const getToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
};

// Save token to secure storage
export const saveToken = async (token: string): Promise<void> => {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
};

// Alias for saveToken (used by biometric login)
export const setToken = saveToken;

// Remove token from secure storage
export const removeToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
};

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    // Handle 401 errors (token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Clear token and redirect to login
      await removeToken();
      // Navigation to login will be handled by the auth state
    }

    return Promise.reject(error);
  }
);

export default api;

// User-friendly error messages
const ERROR_MESSAGES: Record<string, string> = {
  // Password errors
  'Incorrect password. Please try again.': 'The password you entered is incorrect. Please try again.',
  'Incorrect email or password': 'The email or password you entered is incorrect. Please try again.',
  'Invalid credentials': 'The email or password you entered is incorrect. Please try again.',
  // Account errors
  'User not found': 'No account found with this email address. Please check your email or sign up.',
  'Email not verified': 'Please verify your email address before logging in. Check your inbox for the verification link.',
  'Account disabled': 'Your account has been disabled. Please contact support for assistance.',
  // Rate limiting
  'Too many attempts': 'Too many login attempts. Please wait a few minutes and try again.',
  // Network errors
  'Network Error': 'Unable to connect to the server. Please check your internet connection.',
  // General errors
  'Not Found': 'The requested resource was not found. Please try again.',
};

// API Error Helper
export const getErrorMessage = (error: any): string => {
  if (axios.isAxiosError(error)) {
    const rawMessage = error.response?.data?.message ||
                       error.response?.data?.detail ||
                       error.message ||
                       'An error occurred';

    // Return user-friendly message if available
    return ERROR_MESSAGES[rawMessage] || rawMessage;
  }

  const rawMessage = error.message || 'An unexpected error occurred';
  return ERROR_MESSAGES[rawMessage] || rawMessage;
};
