import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import api from '../services/api';

interface DashboardStats {
  today: {
    bookings: number;
    revenue: number;
    new_users: number;
    active_users: number;
  };
  total: {
    bookings: number;
    users: number;
    revenue: number;
  };
  pending: {
    refunds: number;
    bookings: number;
  };
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is admin
    if (!isAuthenticated || !user?.isAdmin) {
      navigate('/');
      return;
    }

    // Fetch dashboard stats
    fetchDashboardStats();
  }, [isAuthenticated, user, navigate]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/dashboard');
      setStats(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load dashboard stats');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={fetchDashboardStats}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
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
              className="py-4 px-2 border-b-2 border-blue-600 text-blue-600 font-medium"
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
              className="py-4 px-2 border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
            >
              Promo Codes
            </button>
            <button
              onClick={() => navigate('/admin/analytics')}
              className="py-4 px-2 border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
            >
              Analytics
            </button>
            <button
              onClick={() => navigate('/admin/dlq')}
              className="py-4 px-2 border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
            >
              DLQ
            </button>
          </nav>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Today's Stats */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Today's Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard
              title="Bookings"
              value={stats?.today.bookings || 0}
              icon="📊"
              color="blue"
            />
            <StatCard
              title="Revenue"
              value={`€${(stats?.today.revenue || 0).toFixed(2)}`}
              icon="💰"
              color="green"
            />
            <StatCard
              title="New Users"
              value={stats?.today.new_users || 0}
              icon="👥"
              color="purple"
            />
            <StatCard
              title="Active Users"
              value={stats?.today.active_users || 0}
              icon="⚡"
              color="orange"
            />
          </div>
        </div>

        {/* Total Stats */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Total Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Total Bookings"
              value={stats?.total.bookings || 0}
              icon="🚢"
              color="indigo"
            />
            <StatCard
              title="Total Users"
              value={stats?.total.users || 0}
              icon="👤"
              color="pink"
            />
            <StatCard
              title="Total Revenue"
              value={`€${(stats?.total.revenue || 0).toFixed(2)}`}
              icon="💵"
              color="emerald"
            />
          </div>
        </div>

        {/* Pending Actions */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Pending Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ActionCard
              title="Pending Refunds"
              count={stats?.pending.refunds || 0}
              icon="💳"
              color="yellow"
              onClick={() => navigate('/admin/bookings?pending_refund=true')}
            />
            <ActionCard
              title="Pending Bookings"
              count={stats?.pending.bookings || 0}
              icon="⏳"
              color="cyan"
              onClick={() => navigate('/admin/bookings?status=pending')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
interface StatCardProps {
  title: string;
  value: number | string;
  icon: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    indigo: 'bg-indigo-500',
    pink: 'bg-pink-500',
    emerald: 'bg-emerald-500',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`${colorClasses[color as keyof typeof colorClasses]} p-4 rounded-lg text-4xl`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

// Action Card Component
interface ActionCardProps {
  title: string;
  count: number;
  icon: string;
  color: string;
  onClick: () => void;
}

const ActionCard: React.FC<ActionCardProps> = ({ title, count, icon, color, onClick }) => {
  const colorClasses = {
    yellow: 'bg-yellow-50 border-yellow-200',
    cyan: 'bg-cyan-50 border-cyan-200',
    red: 'bg-red-50 border-red-200',
  };

  const textColorClasses = {
    yellow: 'text-yellow-900',
    cyan: 'text-cyan-900',
    red: 'text-red-900',
  };

  return (
    <button
      onClick={onClick}
      className={`${colorClasses[color as keyof typeof colorClasses]} border rounded-lg p-6 text-left hover:shadow-lg transition-shadow`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm ${textColorClasses[color as keyof typeof textColorClasses]} mb-1`}>
            {title}
          </p>
          <p className={`text-4xl font-bold ${textColorClasses[color as keyof typeof textColorClasses]}`}>
            {count}
          </p>
          {count > 0 && (
            <p className="text-sm text-gray-600 mt-2">Click to view →</p>
          )}
        </div>
        <div className="text-5xl">{icon}</div>
      </div>
    </button>
  );
};

export default AdminDashboard;
