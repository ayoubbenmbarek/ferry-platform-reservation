import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RootState } from '../store';
import axios from 'axios';

interface Booking {
  id: number;
  booking_reference: string;
  operator: string | null;
  departure_port: string | null;
  arrival_port: string | null;
  departure_time: string | null;
  status: string;
  total_amount: number;
  currency: string;
  contact_email: string;
  contact_first_name: string;
  contact_last_name: string;
  total_passengers: number;
  total_vehicles: number;
  created_at: string;
  refund_amount: number | null;
  refund_processed: boolean;
}

const AdminBookings: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [filterOperator, setFilterOperator] = useState('');
  const [pendingRefund, setPendingRefund] = useState(searchParams.get('pending_refund') === 'true');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const params: any = {
        skip: page * limit,
        limit,
      };

      if (searchTerm) params.search = searchTerm;
      if (filterStatus) params.status = filterStatus;
      if (filterOperator) params.operator = filterOperator;
      if (pendingRefund) params.pending_refund = true;

      const response = await axios.get('/api/v1/admin/bookings', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setBookings(response.data.bookings);
      setTotal(response.data.total);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load bookings');
      console.error('Bookings error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, filterStatus, filterOperator, pendingRefund]);

  useEffect(() => {
    if (!isAuthenticated || !user?.isAdmin) {
      navigate('/');
      return;
    }

    fetchBookings();
  }, [isAuthenticated, user, navigate, fetchBookings]);

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      CONFIRMED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
      COMPLETED: 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const processRefund = async (bookingId: number, amount: number) => {
    if (!window.confirm(`Process refund of €${amount.toFixed(2)} for this booking?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `/api/v1/admin/bookings/${bookingId}/refund`,
        { amount, reason: 'Admin processed refund' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Refund processed successfully!');
      fetchBookings();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to process refund');
      console.error('Refund error:', err);
    }
  };

  const cancelBooking = async (bookingId: number, reference: string) => {
    const reason = window.prompt(`Enter cancellation reason for ${reference}:`);
    if (!reason) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `/api/v1/admin/bookings/${bookingId}/cancel`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(response.data.message);
      fetchBookings();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to cancel booking');
      console.error('Cancel error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Booking Management</h1>
            <button
              onClick={() => navigate('/admin')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <input
              type="text"
              placeholder="Search by reference, email, or name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPendingRefund(false);
                setPage(0);
              }}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Status Filter */}
            <select
              value={pendingRefund ? 'pending_refund' : filterStatus}
              onChange={(e) => {
                if (e.target.value === 'pending_refund') {
                  setPendingRefund(true);
                  setFilterStatus('');
                } else {
                  setPendingRefund(false);
                  setFilterStatus(e.target.value);
                }
                setPage(0);
              }}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="COMPLETED">Completed</option>
              <option value="pending_refund">Pending Refunds</option>
            </select>

            {/* Operator Filter */}
            <input
              type="text"
              placeholder="Filter by operator..."
              value={filterOperator}
              onChange={(e) => {
                setFilterOperator(e.target.value);
                setPendingRefund(false);
                setPage(0);
              }}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Results Count */}
            <div className="flex items-center text-sm text-gray-600">
              Showing {bookings.length} of {total} bookings
              {pendingRefund && <span className="ml-2 text-yellow-600">(Pending Refunds)</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        ) : (
          <>
            {/* Bookings Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {booking.booking_reference}
                        </div>
                        <div className="text-sm text-gray-500">{booking.operator || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {booking.departure_port || '—'} → {booking.arrival_port || '—'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {booking.departure_time ? new Date(booking.departure_time).toLocaleDateString() : '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {booking.contact_first_name} {booking.contact_last_name}
                        </div>
                        <div className="text-sm text-gray-500">{booking.contact_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {booking.total_passengers} pax
                        {booking.total_vehicles > 0 && `, ${booking.total_vehicles} veh`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(booking.status)}`}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {booking.currency} {booking.total_amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(booking.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => navigate(`/booking/${booking.id}`)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </button>
                        {booking.status !== 'CANCELLED' && (
                          <button
                            onClick={() => cancelBooking(booking.id, booking.booking_reference)}
                            className="text-red-600 hover:text-red-900 ml-2"
                          >
                            Cancel
                          </button>
                        )}
                        {booking.refund_amount && booking.refund_amount > 0 && (
                          <>
                            {!booking.refund_processed ? (
                              <button
                                onClick={() => processRefund(booking.id, booking.refund_amount!)}
                                className="text-green-600 hover:text-green-900 ml-2"
                              >
                                Refund €{booking.refund_amount.toFixed(2)}
                              </button>
                            ) : (
                              <span className="text-green-700 font-medium ml-2" title="Refund has been processed">
                                ✓ Refunded €{booking.refund_amount.toFixed(2)}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > limit && (
              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {page + 1} of {Math.ceil(total / limit)}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={(page + 1) * limit >= total}
                  className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminBookings;
