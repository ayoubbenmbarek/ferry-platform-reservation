import React, { Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useDispatch } from 'react-redux';

import Layout from './components/Layout/Layout';
import LoadingSpinner from './components/UI/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import { getCurrentUser } from './store/slices/authSlice';

// Lazy load pages for better performance
const HomePage = React.lazy(() => import('./pages/NewHomePage'));
const SearchPage = React.lazy(() => import('./pages/NewSearchPage'));
const BookingPage = React.lazy(() => import('./pages/BookingPage'));
const PaymentPage = React.lazy(() => import('./pages/PaymentPage'));
const BookingConfirmationPage = React.lazy(() => import('./pages/BookingConfirmationPage'));
const MyBookingsPage = React.lazy(() => import('./pages/MyBookingsPage'));
const BookingDetailsPage = React.lazy(() => import('./pages/BookingDetailsPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage = React.lazy(() => import('./pages/VerifyEmailPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const ContactPage = React.lazy(() => import('./pages/ContactPage'));
const FindBookingPage = React.lazy(() => import('./pages/FindBookingPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));

// Admin pages
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const AdminUsers = React.lazy(() => import('./pages/AdminUsers'));
const AdminBookings = React.lazy(() => import('./pages/AdminBookings'));
const AdminPromoCodes = React.lazy(() => import('./pages/AdminPromoCodes'));

function App() {
  const dispatch = useDispatch();

  // Validate stored token on app initialization
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      // @ts-ignore - dispatch returns a Promise for async thunks
      dispatch(getCurrentUser());
    }
  }, [dispatch]); // Only run once on mount

  // Handle chunk loading errors (outdated cache on mobile)
  useEffect(() => {
    const handleChunkError = (event: any) => {
      const isChunkError = event.message?.includes('Loading chunk') ||
                          event.message?.includes('ChunkLoadError') ||
                          event.reason?.name === 'ChunkLoadError';

      if (isChunkError) {
        console.warn('Chunk loading failed - likely outdated cache. Reloading page...');
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
              <Route path="/find-booking" element={<FindBookingPage />} />
              
              {/* Protected routes */}
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/my-bookings" element={<ProtectedRoute><MyBookingsPage /></ProtectedRoute>} />

              {/* Admin routes */}
              <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/bookings" element={<ProtectedRoute><AdminBookings /></ProtectedRoute>} />
              <Route path="/admin/promo-codes" element={<ProtectedRoute><AdminPromoCodes /></ProtectedRoute>} />

              {/* Booking details - accessible to both authenticated users and guests */}
              <Route path="/booking/:id" element={<BookingDetailsPage />} />
              
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