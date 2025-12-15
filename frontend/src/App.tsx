import React, { Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { RootState } from './store';

import Layout from './components/Layout/Layout';
import LoadingSpinner from './components/UI/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import OfflineIndicator from './components/OfflineIndicator';
import SupportChatbot from './components/SupportChatbot';
import { getCurrentUser } from './store/slices/authSlice';

// Lazy load pages for better performance
const HomePage = React.lazy(() => import('./pages/NewHomePage'));
const SearchPage = React.lazy(() => import('./pages/NewSearchPage'));
const BookingPage = React.lazy(() => import('./pages/BookingPage'));
const PaymentPage = React.lazy(() => import('./pages/PaymentPage'));
const BookingConfirmationPage = React.lazy(() => import('./pages/BookingConfirmationPage'));
const MyBookingsPage = React.lazy(() => import('./pages/MyBookingsPage'));
const BookingDetailsPage = React.lazy(() => import('./pages/BookingDetailsPage'));
const ModifyBookingPage = React.lazy(() => import('./pages/ModifyBookingPage'));
const AddCabinPage = React.lazy(() => import('./pages/AddCabinPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage = React.lazy(() => import('./pages/VerifyEmailPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const SavedRoutesPage = React.lazy(() => import('./pages/SavedRoutesPage'));
const MyAlertsPage = React.lazy(() => import('./pages/MyAlertsPage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const ContactPage = React.lazy(() => import('./pages/ContactPage'));
const HelpCenterPage = React.lazy(() => import('./pages/HelpCenterPage'));
const FindBookingPage = React.lazy(() => import('./pages/FindBookingPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));

// Admin pages
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const AdminUsers = React.lazy(() => import('./pages/AdminUsers'));
const AdminBookings = React.lazy(() => import('./pages/AdminBookings'));
const AdminPromoCodes = React.lazy(() => import('./pages/AdminPromoCodes'));
const AdminDLQ = React.lazy(() => import('./pages/AdminDLQ'));

// Legal pages
const TermsAndConditions = React.lazy(() => import('./pages/legal/TermsAndConditions'));
const PrivacyPolicy = React.lazy(() => import('./pages/legal/PrivacyPolicy'));
const CancellationPolicy = React.lazy(() => import('./pages/legal/CancellationPolicy'));
const CookiePolicy = React.lazy(() => import('./pages/legal/CookiePolicy'));

function App() {
  const dispatch = useDispatch();
  const { i18n } = useTranslation();
  const { user } = useSelector((state: RootState) => state.auth);

  // Validate stored token on app initialization
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      // @ts-ignore - dispatch returns a Promise for async thunks
      dispatch(getCurrentUser());
    }
  }, [dispatch]); // Only run once on mount

  // Apply user's preferred language when user data loads
  useEffect(() => {
    if (user?.preferredLanguage && user.preferredLanguage !== i18n.language) {
      i18n.changeLanguage(user.preferredLanguage);
    }
  }, [user?.preferredLanguage, i18n]);

  // Handle chunk loading errors (outdated cache on mobile)
  useEffect(() => {
    const handleChunkError = async (event: any) => {
      const errorMessage = event.message || event.reason?.message || '';
      const isChunkError = errorMessage.includes('Loading chunk') ||
                          errorMessage.includes('ChunkLoadError') ||
                          errorMessage.includes('Failed to fetch dynamically imported module') ||
                          event.reason?.name === 'ChunkLoadError';

      if (isChunkError) {
        console.warn('Chunk loading failed - clearing cache and reloading...');
        event.preventDefault?.();

        try {
          // Unregister service worker
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(r => r.unregister()));
          }
          // Clear caches
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
          }
        } catch (e) {
          console.error('Failed to clear cache:', e);
        }

        // Reload the page to get fresh chunks
        window.location.reload();
      }
    };

    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleChunkError);

    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleChunkError);
    };
  }, []);

  return (
    <ErrorBoundary>
      <div className="App min-h-screen bg-gray-50">
        <OfflineIndicator showWhenOnline />
        <SupportChatbot />
        <Suspense fallback={<LoadingSpinner />}>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
              {/* Public routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/booking" element={<BookingPage />} />
              <Route path="/payment" element={<PaymentPage />} />
              <Route path="/payment/:bookingId" element={<PaymentPage />} />
              <Route path="/booking/confirmation" element={<BookingConfirmationPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/help" element={<HelpCenterPage />} />
              <Route path="/find-booking" element={<FindBookingPage />} />

              {/* Legal pages */}
              <Route path="/terms" element={<TermsAndConditions />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/cancellation-policy" element={<CancellationPolicy />} />
              <Route path="/cookie-policy" element={<CookiePolicy />} />

              {/* Protected routes */}
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/saved-routes" element={<ProtectedRoute><SavedRoutesPage /></ProtectedRoute>} />
              <Route path="/my-alerts" element={<ProtectedRoute><MyAlertsPage /></ProtectedRoute>} />
              <Route path="/my-bookings" element={<ProtectedRoute><MyBookingsPage /></ProtectedRoute>} />
              <Route path="/modify-booking/:bookingId" element={<ProtectedRoute><ModifyBookingPage /></ProtectedRoute>} />

              {/* Admin routes */}
              <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/bookings" element={<ProtectedRoute><AdminBookings /></ProtectedRoute>} />
              <Route path="/admin/promo-codes" element={<ProtectedRoute><AdminPromoCodes /></ProtectedRoute>} />
              <Route path="/admin/dlq" element={<ProtectedRoute><AdminDLQ /></ProtectedRoute>} />

              {/* Booking details - accessible to both authenticated users and guests */}
              <Route path="/booking/:id" element={<BookingDetailsPage />} />

              {/* Add cabin to existing booking */}
              <Route path="/booking/:bookingId/add-cabin" element={<AddCabinPage />} />

              {/* 404 page */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </Suspense>
          </Layout>
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}

export default App; 