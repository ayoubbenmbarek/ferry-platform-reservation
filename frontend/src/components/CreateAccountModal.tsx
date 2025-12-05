import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { setUser, setToken } from '../store/slices/authSlice';

// Declare global Google type
declare global {
  interface Window {
    google: any;
  }
}

// Helper function to convert snake_case to camelCase
const snakeToCamel = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);

  return Object.keys(obj).reduce((acc: any, key: string) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    acc[camelKey] = snakeToCamel(obj[key]);
    return acc;
  }, {});
};

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingReference: string;
  bookingEmail: string;
  onSuccess?: (token: string, user: any) => void;
}

const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  isOpen,
  onClose,
  bookingReference,
  bookingEmail,
  onSuccess,
}) => {
  const dispatch = useDispatch();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Memoize Google response handler
  const handleGoogleResponse = useCallback(async (response: any) => {
    try {
      setLoading(true);
      // Send the Google credential to our backend
      const result = await axios.post('/api/v1/auth/google', {
        credential: response.credential
      });

      // Store token and user data (convert snake_case to camelCase)
      const { access_token, user } = result.data;
      const camelUser = snakeToCamel(user);
      dispatch(setToken(access_token));
      dispatch(setUser(camelUser));

      // Call success callback
      if (onSuccess) {
        onSuccess(access_token, camelUser);
      }

      // Close modal
      onClose();

      // Show success message
      alert('Account created and logged in successfully!');
    } catch (err: any) {
      console.error('Google sign-up failed:', err);
      setError(err.response?.data?.detail || 'Google sign-up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [dispatch, onSuccess, onClose]);

  // Initialize Google Sign-In when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const initializeGoogleSignIn = () => {
      if (window.google && googleButtonRef.current) {
        window.google.accounts.id.initialize({
          client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: false,
        });

        window.google.accounts.id.renderButton(
          googleButtonRef.current,
          {
            theme: 'outline',
            size: 'large',
            width: '100%',
            text: 'signup_with',
            logo_alignment: 'left',
          }
        );
      }
    };

    // Wait for Google script to load
    if (window.google) {
      initializeGoogleSignIn();
    } else {
      const checkGoogle = setInterval(() => {
        if (window.google) {
          clearInterval(checkGoogle);
          initializeGoogleSignIn();
        }
      }, 100);

      return () => clearInterval(checkGoogle);
    }
  }, [isOpen, handleGoogleResponse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post('/api/v1/auth/register-from-booking', {
        email: bookingEmail,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
      }, {
        params: {
          booking_reference: bookingReference,
        },
      });

      // Save token to localStorage
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }

      // Call success callback
      if (onSuccess) {
        onSuccess(response.data.token, response.data.user);
      }

      // Close modal
      onClose();

      // Show success message
      alert(response.data.message || 'Account created successfully!');
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to create account';

      // Check for specific error cases and provide helpful messages
      if (err.response?.status === 409) {
        setError('This email is already registered. Please log in to link this booking to your existing account.');
      } else if (err.response?.status === 404) {
        setError('Booking not found. Please check your booking reference.');
      } else if (err.response?.status === 400 && errorMessage.includes('email must match')) {
        setError('Email does not match the booking email. Please use the email from your booking.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Create Your Account</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <p className="text-gray-600 mb-6">
            Create an account to easily manage your booking and access exclusive benefits!
          </p>

          {/* Display booking email */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Email:</span> {bookingEmail}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              This email will be linked to your new account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                minLength={8}
              />
              <p className="text-xs text-gray-500 mt-1">
                Must be at least 8 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password *
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                minLength={8}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm text-red-800">{error}</p>
                {error.includes('already registered') && (
                  <a
                    href="/login"
                    className="text-sm text-blue-600 hover:text-blue-700 underline mt-2 block"
                  >
                    Go to Login Page
                  </a>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
              >
                Skip for Now
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or sign up with</span>
              </div>
            </div>
          </div>

          {/* Google Sign-Up Button */}
          <div className="mt-6">
            <div ref={googleButtonRef} className="w-full"></div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Your booking will be automatically linked to your new account
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateAccountModal;
