import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import axios from 'axios';

interface PromoCode {
  id: number;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  max_uses_per_user: number;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  minimum_amount: number | null;
  maximum_discount: number | null;
  first_booking_only: boolean;
  is_active: boolean;
  created_at: string;
}

interface PromoCodeStats {
  code: string;
  total_uses: number;
  total_discount_given: number;
  unique_users: number;
  average_discount: number;
  last_used: string | null;
}

interface SuspiciousActivity {
  type: string;
  ip_address?: string;
  device_fingerprint?: string;
  email_count?: number;
  count_last_hour?: number;
  severity: string;
}

const AdminPromoCodes: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);

  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<PromoCode | null>(null);
  const [promoStats, setPromoStats] = useState<PromoCodeStats | null>(null);
  const [suspiciousActivity, setSuspiciousActivity] = useState<SuspiciousActivity[]>([]);
  const [activeOnly, setActiveOnly] = useState(false);

  // Form state for creating promo code
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'PERCENTAGE',
    discount_value: 10,
    max_uses: '',
    max_uses_per_user: 1,
    valid_from: new Date().toISOString().slice(0, 16),
    valid_until: '',
    minimum_amount: '',
    maximum_discount: '',
    first_booking_only: false,
  });

  const fetchPromoCodes = React.useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/v1/promo-codes?active_only=${activeOnly}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPromoCodes(response.data.promo_codes);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    if (!isAuthenticated || !user?.isAdmin) {
      navigate('/');
      return;
    }
    fetchPromoCodes();
  }, [isAuthenticated, user, navigate, fetchPromoCodes]);

  const handleCreatePromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/v1/promo-codes', {
        code: formData.code.toUpperCase(),
        description: formData.description || null,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        max_uses_per_user: formData.max_uses_per_user,
        valid_from: formData.valid_from,
        valid_until: formData.valid_until || null,
        minimum_amount: formData.minimum_amount ? parseFloat(formData.minimum_amount) : null,
        maximum_discount: formData.maximum_discount ? parseFloat(formData.maximum_discount) : null,
        first_booking_only: formData.first_booking_only,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowCreateModal(false);
      resetForm();
      fetchPromoCodes();
    } catch (err: any) {
      // Handle different error formats
      const errorData = err.response?.data;
      let errorMessage = 'Failed to create promo code';

      if (errorData?.detail) {
        errorMessage = errorData.detail;
      } else if (errorData?.details && Array.isArray(errorData.details)) {
        // Validation errors - extract clean messages
        const messages = errorData.details.map((d: any) => {
          // Extract the actual error message from "Value error, ..." format
          let msg = d.msg || '';
          if (msg.startsWith('Value error, ')) {
            msg = msg.replace('Value error, ', '');
          }
          return msg;
        });
        errorMessage = messages.join('. ');
      } else if (errorData?.message && errorData.message !== 'Validation error') {
        errorMessage = errorData.message;
      }

      setError(errorMessage);
    }
  };

  const handleDeactivate = async (promoId: number) => {
    if (!window.confirm('Are you sure you want to deactivate this promo code?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/v1/promo-codes/${promoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchPromoCodes();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to deactivate promo code');
    }
  };

  const handleViewStats = async (promo: PromoCode) => {
    setSelectedPromo(promo);
    try {
      const token = localStorage.getItem('token');
      const [statsResponse, suspiciousResponse] = await Promise.all([
        axios.get(`/api/v1/promo-codes/${promo.id}/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/v1/promo-codes/${promo.id}/suspicious-activity`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setPromoStats(statsResponse.data);
      setSuspiciousActivity(suspiciousResponse.data.suspicious_patterns || []);
      setShowStatsModal(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load stats');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      discount_type: 'PERCENTAGE',
      discount_value: 10,
      max_uses: '',
      max_uses_per_user: 1,
      valid_from: new Date().toISOString().slice(0, 16),
      valid_until: '',
      minimum_amount: '',
      maximum_discount: '',
      first_booking_only: false,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Back to Site
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <nav className="flex space-x-6">
            <button
              onClick={() => navigate('/admin')}
              className="py-4 px-2 border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate('/admin/users')}
              className="py-4 px-2 border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
            >
              Users
            </button>
            <button
              onClick={() => navigate('/admin/bookings')}
              className="py-4 px-2 border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
            >
              Bookings
            </button>
            <button
              onClick={() => navigate('/admin/promo-codes')}
              className="py-4 px-2 border-b-2 border-blue-600 text-blue-600 font-medium"
            >
              Promo Codes
            </button>
            <button
              onClick={() => navigate('/admin/analytics')}
              className="py-4 px-2 border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
            >
              Analytics
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Promo Codes</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="rounded"
              />
              Active only
            </label>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            + Create Promo Code
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Promo Codes Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Discount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Validity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {promoCodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No promo codes found. Create your first one!
                  </td>
                </tr>
              ) : (
                promoCodes.map((promo) => (
                  <tr key={promo.id} className={!promo.is_active ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-lg">{promo.code}</div>
                      {promo.description && (
                        <div className="text-sm text-gray-500">{promo.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold">
                        {promo.discount_type === 'PERCENTAGE'
                          ? `${promo.discount_value}%`
                          : `€${promo.discount_value}`}
                      </div>
                      {promo.minimum_amount && (
                        <div className="text-xs text-gray-500">Min: €{promo.minimum_amount}</div>
                      )}
                      {promo.maximum_discount && (
                        <div className="text-xs text-gray-500">Max: €{promo.maximum_discount}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold">
                        {promo.current_uses} / {promo.max_uses || '∞'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {promo.max_uses_per_user}x per user
                      </div>
                      {promo.first_booking_only && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded">
                          First booking only
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div>From: {formatDate(promo.valid_from)}</div>
                      {promo.valid_until && (
                        <div>Until: {formatDate(promo.valid_until)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {promo.is_active ? (
                        <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-800 rounded-full">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewStats(promo)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Stats
                        </button>
                        {promo.is_active && (
                          <button
                            onClick={() => handleDeactivate(promo.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold">Create Promo Code</h3>
            </div>
            <form onSubmit={handleCreatePromoCode} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-md uppercase"
                    required
                    placeholder="SUMMER2024"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Summer discount"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Type *
                  </label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED_AMOUNT">Fixed Amount (€)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Value * {formData.discount_type === 'PERCENTAGE' && <span className="text-xs text-gray-500">(max 90%)</span>}
                  </label>
                  <input
                    type="number"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                    min="0.01"
                    max={formData.discount_type === 'PERCENTAGE' ? 90 : undefined}
                    step="0.01"
                  />
                  {formData.discount_type === 'PERCENTAGE' && formData.discount_value > 90 && (
                    <p className="text-xs text-red-500 mt-1">Percentage discount cannot exceed 90%</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Total Uses
                    <span className="block text-xs text-gray-500 font-normal">Total redemptions across all users</span>
                  </label>
                  <input
                    type="number"
                    value={formData.max_uses}
                    onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Unlimited"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Per User/Email *
                    <span className="block text-xs text-gray-500 font-normal">How many times each email can use</span>
                  </label>
                  <input
                    type="number"
                    value={formData.max_uses_per_user}
                    onChange={(e) => setFormData({ ...formData, max_uses_per_user: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid From *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.valid_from}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid Until
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Amount (€)
                  </label>
                  <input
                    type="number"
                    value={formData.minimum_amount}
                    onChange={(e) => setFormData({ ...formData, minimum_amount: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="No minimum"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Maximum Discount (€)
                  </label>
                  <input
                    type="number"
                    value={formData.maximum_discount}
                    onChange={(e) => setFormData({ ...formData, maximum_discount: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="No cap"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.first_booking_only}
                    onChange={(e) => setFormData({ ...formData, first_booking_only: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    First booking only (new customers)
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create Promo Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {showStatsModal && selectedPromo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full m-4">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold">
                Stats for <span className="font-mono">{selectedPromo.code}</span>
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {promoStats && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-blue-600">Total Uses</p>
                    <p className="text-2xl font-bold text-blue-900">{promoStats.total_uses}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-green-600">Total Discount Given</p>
                    <p className="text-2xl font-bold text-green-900">€{promoStats.total_discount_given.toFixed(2)}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm text-purple-600">Unique Users</p>
                    <p className="text-2xl font-bold text-purple-900">{promoStats.unique_users}</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <p className="text-sm text-orange-600">Avg Discount</p>
                    <p className="text-2xl font-bold text-orange-900">€{promoStats.average_discount.toFixed(2)}</p>
                  </div>
                </div>
              )}

              {promoStats?.last_used && (
                <p className="text-sm text-gray-600">
                  Last used: {formatDate(promoStats.last_used)}
                </p>
              )}

              {/* Suspicious Activity */}
              {suspiciousActivity.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-red-600 mb-2">Suspicious Activity Detected</h4>
                  <div className="space-y-2">
                    {suspiciousActivity.map((activity, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg ${
                          activity.severity === 'high'
                            ? 'bg-red-50 border border-red-200'
                            : 'bg-yellow-50 border border-yellow-200'
                        }`}
                      >
                        <p className="text-sm font-medium">
                          {activity.type === 'multiple_emails_same_ip' && (
                            <>Multiple emails from same IP ({activity.email_count} emails)</>
                          )}
                          {activity.type === 'multiple_emails_same_device' && (
                            <>Multiple emails from same device ({activity.email_count} emails)</>
                          )}
                          {activity.type === 'rapid_usage' && (
                            <>Rapid usage detected ({activity.count_last_hour} in last hour)</>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Severity: {activity.severity}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {suspiciousActivity.length === 0 && promoStats && promoStats.total_uses > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">No suspicious activity detected</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t">
              <button
                onClick={() => {
                  setShowStatsModal(false);
                  setSelectedPromo(null);
                  setPromoStats(null);
                  setSuspiciousActivity([]);
                }}
                className="w-full px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPromoCodes;
