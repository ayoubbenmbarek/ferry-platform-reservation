import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Layout from './components/Layout/Layout';
import LoadingSpinner from './components/UI/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';

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
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const ContactPage = React.lazy(() => import('./pages/ContactPage'));
const FindBookingPage = React.lazy(() => import('./pages/FindBookingPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));

// Admin pages
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const AdminUsers = React.lazy(() => import('./pages/AdminUsers'));
const AdminBookings = React.lazy(() => import('./pages/AdminBookings'));

function App() {
  const { i18n } = useTranslation();

  // Set document direction based on language
  React.useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <ErrorBoundary>
      <div className="App min-h-screen bg-gray-50">
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

              {/* Booking details - accessible to both authenticated users and guests */}
              <Route path="/booking/:id" element={<BookingDetailsPage />} />
              
              {/* 404 page */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </Layout>
      </div>
    </ErrorBoundary>
  );
}

export default App; 