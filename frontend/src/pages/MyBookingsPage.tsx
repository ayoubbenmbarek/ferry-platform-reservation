import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingAPI, Booking } from '../services/api';

// Helper to convert snake_case to camelCase
const snakeToCamel = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  return Object.keys(obj).reduce((acc: any, key: string) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    acc[camelKey] = snakeToCamel(obj[key]);
    return acc;
  }, {});
};

const MyBookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchBookings();
  }, [filterStatus]);

  const fetchBookings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Build params object
      const params: any = {};
      if (filterStatus && filterStatus !== 'all') {
        params.status_filter = filterStatus.toUpperCase();
      }

      const response = await bookingAPI.getAll(params);
      // Convert snake_case to camelCase
      const convertedBookings = response.bookings.map(snakeToCamel);
      setBookings(convertedBookings);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.message || 'Failed to load bookings');
      console.error('Fetch bookings error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Bookings</h1>
          <p className="mt-2 text-gray-600">View and manage your ferry reservations</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Filter by status:</span>
            <div className="flex space-x-2">
              {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    filterStatus === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading your bookings...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <p className="text-red-800 font-medium">{error}</p>
            <button
              onClick={fetchBookings}
              className="mt-2 text-red-600 hover:text-red-700 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Bookings List */}
        {!isLoading && !error && (
          <>
            {bookings.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <svg
                  className="mx-auto h-16 w-16 text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
                <p className="text-gray-600 mb-4">
                  {filterStatus !== 'all'
                    ? `You don't have any ${filterStatus} bookings.`
                    : "You haven't made any ferry reservations yet."}
                </p>
                <button
                  onClick={() => navigate('/search')}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                >
                  Search Ferries
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 cursor-pointer"
                    onClick={() => navigate(`/booking/${booking.id}`)}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                            {booking.status}
                          </span>
                          <span className="text-sm text-gray-500">
                            Ref: {booking.bookingReference}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-sm text-gray-600">Operator</p>
                            <p className="font-semibold text-gray-900">{booking.operator}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Route</p>
                            <p className="font-semibold text-gray-900">
                              {booking.departurePort} → {booking.arrivalPort}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Departure</p>
                            <p className="font-semibold text-gray-900">
                              {formatDate(booking.departureTime)} at {formatTime(booking.departureTime)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-6 text-sm text-gray-600">
                          <span>
                            {booking.totalPassengers} passenger{booking.totalPassengers !== 1 ? 's' : ''}
                          </span>
                          {booking.totalVehicles > 0 && (
                            <span>
                              {booking.totalVehicles} vehicle{booking.totalVehicles !== 1 ? 's' : ''}
                            </span>
                          )}
                          <span>Booked on {formatDate(booking.createdAt)}</span>
                          {booking.status === 'PENDING' && booking.expiresAt && (
                            <span className="text-orange-600 font-medium">
                              ⏰ Expires {formatDate(booking.expiresAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 md:mt-0 md:ml-6 md:text-right">
                        <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {booking.currency} {booking.totalAmount.toFixed(2)}
                        </p>
                        {booking.status === 'PENDING' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/booking/${booking.id}`);
                            }}
                            className="mt-2 bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 text-sm font-medium"
                          >
                            Complete Payment →
                          </button>
                        ) : (
                          <button className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
                            View Details →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MyBookingsPage; 