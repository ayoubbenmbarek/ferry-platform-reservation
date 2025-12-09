import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { loginUser, clearError, setUser, setToken } from '../store/slices/authSlice';
import { AppDispatch, RootState } from '../store';
import axios from 'axios';
import RunningBear from '../components/UI/RunningBear';

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

const LoginPage: React.FC = () => {
  const { t } = useTranslation(['auth', 'common']);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, error } = useSelector((state: RootState) => state.auth);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleInitializedRef = useRef(false);

  // Get the redirect path from query params or location state, default to home
  const searchParams = new URLSearchParams(location.search);
  const returnTo = searchParams.get('returnTo');
  const from = returnTo || (location.state as any)?.from?.pathname || '/';

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  // Clear error only on initial mount, not on every render
  useEffect(() => {
    // Clear error when component first mounts
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  // Memoize Google response handler to avoid re-renders
  const handleGoogleResponse = useCallback(async (response: any) => {
    try {
      // Send the Google credential to our backend using the configured API URL
      const apiUrl = process.env.REACT_APP_API_URL || '/api/v1';
      const result = await axios.post(`${apiUrl}/auth/google`, {
        credential: response.credential
      });

      // Store token and user data (convert snake_case to camelCase)
      const { access_token, user } = result.data;
      dispatch(setToken(access_token));
      dispatch(setUser(snakeToCamel(user)));

      // Navigate to the original destination
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error('Google login failed:', err);
      dispatch(clearError());
      // Show error message
      alert(err.response?.data?.detail || 'Google login failed. Please try again.');
    }
  }, [dispatch, navigate, from]);

  // Initialize Google Sign-In
  useEffect(() => {
    // Prevent duplicate initialization in React 18 Strict Mode
    if (googleInitializedRef.current) {
      return;
    }

    const initializeGoogleSignIn = () => {
      if (window.google && googleButtonRef.current && !googleInitializedRef.current) {
        googleInitializedRef.current = true;

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
            text: 'signin_with',
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
        if (window.google && !googleInitializedRef.current) {
          clearInterval(checkGoogle);
          initializeGoogleSignIn();
        }
      }, 100);

      return () => clearInterval(checkGoogle);
    }
  }, [handleGoogleResponse]);

  // Check if already authenticated - must be AFTER all hooks
  if (isAuthenticated) {
    return <RunningBear message="Redirecting" size="medium" />;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Clear error when user starts typing
    if (error) {
      dispatch(clearError());
    }
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dispatch(loginUser(formData)).unwrap();
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {t('auth:login.title')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('auth:login.or')}{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
              {t('auth:login.createAccount')}
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                {t('auth:login.email')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder={t('auth:login.emailPlaceholder')}
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                {t('auth:login.password')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder={t('auth:login.passwordPlaceholder')}
                value={formData.password}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                {t('auth:login.rememberMe')}
              </label>
            </div>

            <div className="text-sm">
              <Link to="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500">
                {t('auth:login.forgotPassword')}
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {isLoading ? t('auth:login.signingIn') : t('auth:login.signIn')}
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
              <span className="px-2 bg-gray-50 text-gray-500">Or continue with</span>
            </div>
          </div>
        </div>

        {/* Google Sign-In Button */}
        <div className="mt-6">
          <div ref={googleButtonRef} className="w-full"></div>
        </div>

        {/* Test Credentials Info */}
        <div className="mt-4 p-4 bg-blue-50 rounded-md">
          <p className="text-xs text-blue-800 font-semibold mb-2">Test Credentials:</p>
          <p className="text-xs text-blue-700">Email: demo@maritime.com</p>
          <p className="text-xs text-blue-700">{t('auth:login.password')}: Demo1234</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
