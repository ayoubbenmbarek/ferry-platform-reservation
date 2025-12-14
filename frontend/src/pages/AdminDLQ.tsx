import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import api from '../services/api';

interface DLQStats {
  redis: {
    email: number;
    payment: number;
    booking: number;
    price_alert: number;
    availability: number;
    sync: number;
    other: number;
  };
  database: {
    pending: number;
    total: number;
  };
  total_pending: number;
}

interface FailedTask {
  id: number;
  task_id: string;
  task_name: string;
  category: string;
  args: any[];
  kwargs: Record<string, any>;
  error_type: string;
  error_message: string;
  traceback: string;
  retry_count: number;
  max_retries: number;
  status: string;
  failed_at: string;
  retried_at: string | null;
  resolved_at: string | null;
  worker_name: string;
  queue_name: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  resolution_notes: string | null;
  resolved_by: string | null;
}

interface RedisTask {
  task_id: string;
  task_name: string;
  category: string;
  args: any[];
  kwargs: Record<string, any>;
  error_type: string;
  error_message: string;
  traceback: string;
  failed_at: string;
  retry_count: number;
  max_retries: number;
  worker_name: string;
  queue_name: string;
  queue_index: number;
}

const CATEGORIES = ['email', 'payment', 'booking', 'price_alert', 'availability', 'sync', 'other'];

const AdminDLQ: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [stats, setStats] = useState<DLQStats | null>(null);
  const [dbTasks, setDbTasks] = useState<FailedTask[]>([]);
  const [redisTasks, setRedisTasks] = useState<RedisTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [activeTab, setActiveTab] = useState<'database' | 'redis'>('database');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.isAdmin) {
      navigate('/');
      return;
    }
    fetchData();
  }, [isAuthenticated, user, navigate]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch stats
      const statsRes = await api.get('/admin/dlq/stats');
      setStats(statsRes.data);

      // Fetch database tasks
      const dbParams = new URLSearchParams();
      if (selectedCategory !== 'all') dbParams.append('category', selectedCategory);
      if (selectedStatus !== 'all') dbParams.append('status', selectedStatus);
      dbParams.append('limit', '50');

      const dbRes = await api.get(`/admin/dlq/database?${dbParams.toString()}`);
      setDbTasks(dbRes.data.tasks || []);

    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load DLQ data');
      console.error('DLQ error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedStatus]);

  const fetchRedisTasks = async (category: string) => {
    try {
      const res = await api.get(`/admin/dlq/redis/${category}`);
      setRedisTasks(res.data.tasks || []);
    } catch (err: any) {
      console.error('Failed to fetch Redis tasks:', err);
      setRedisTasks([]);
    }
  };

  useEffect(() => {
    if (activeTab === 'redis' && selectedCategory !== 'all') {
      fetchRedisTasks(selectedCategory);
    }
  }, [activeTab, selectedCategory]);

  useEffect(() => {
    if (activeTab === 'database') {
      fetchData();
    }
  }, [selectedCategory, selectedStatus, activeTab, fetchData]);

  const handleRetryDbTask = async (taskId: number) => {
    setActionLoading(`db-retry-${taskId}`);
    try {
      await api.post(`/admin/dlq/database/${taskId}/retry`);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to retry task');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryRedisTask = async (category: string, queueIndex: number) => {
    setActionLoading(`redis-retry-${queueIndex}`);
    try {
      await api.post(`/admin/dlq/redis/${category}/retry/${queueIndex}`);
      await fetchRedisTasks(category);
      // Refresh stats
      const statsRes = await api.get('/admin/dlq/stats');
      setStats(statsRes.data);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to retry task');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearRedisCategory = async (category: string) => {
    if (!window.confirm(`Are you sure you want to clear all ${category} tasks from Redis DLQ?`)) {
      return;
    }
    setActionLoading(`clear-${category}`);
    try {
      await api.delete(`/admin/dlq/redis/${category}`);
      await fetchRedisTasks(category);
      const statsRes = await api.get('/admin/dlq/stats');
      setStats(statsRes.data);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to clear category');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTriggerTestFailure = async () => {
    setActionLoading('test-failure');
    try {
      const res = await api.post(`/admin/dlq/test-failure?category=${selectedCategory === 'all' ? 'email' : selectedCategory}`);
      alert(`Test task triggered: ${res.data.task_id}\nIt will fail 3 times and appear in DLQ.`);
      setTimeout(fetchData, 10000); // Refresh after 10s to see the result
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to trigger test failure');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      retried: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      ignored: 'bg-gray-100 text-gray-800',
    };
    return colors[status.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      email: 'bg-purple-100 text-purple-800',
      payment: 'bg-red-100 text-red-800',
      booking: 'bg-blue-100 text-blue-800',
      price_alert: 'bg-orange-100 text-orange-800',
      availability: 'bg-cyan-100 text-cyan-800',
      sync: 'bg-indigo-100 text-indigo-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[category.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  if (loading && !stats) {
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
            <h1 className="text-3xl font-bold text-gray-900">Dead Letter Queue</h1>
            <div className="flex gap-2">
              <button
                onClick={handleTriggerTestFailure}
                disabled={actionLoading === 'test-failure'}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
              >
                {actionLoading === 'test-failure' ? 'Triggering...' : 'Trigger Test Failure'}
              </button>
              <button
                onClick={() => navigate('/admin')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Back to Dashboard
              </button>
            </div>
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
              className="py-4 px-2 border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
            >
              Promo Codes
            </button>
            <button
              onClick={() => navigate('/admin/dlq')}
              className="py-4 px-2 border-b-2 border-blue-600 text-blue-600 font-medium"
            >
              DLQ
            </button>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
            <button
              onClick={fetchData}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Stats Overview */}
        {stats && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {CATEGORIES.map((cat) => (
                <div
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
                    selectedCategory === cat ? 'ring-2 ring-blue-500' : 'hover:shadow-lg'
                  }`}
                >
                  <p className="text-xs text-gray-500 uppercase">{cat.replace('_', ' ')}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.redis[cat as keyof typeof stats.redis]}
                  </p>
                  <p className="text-xs text-gray-400">in Redis</p>
                </div>
              ))}
              <div
                onClick={() => setSelectedCategory('all')}
                className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
                  selectedCategory === 'all' ? 'ring-2 ring-blue-500' : 'hover:shadow-lg'
                }`}
              >
                <p className="text-xs text-gray-500 uppercase">All</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_pending}</p>
                <p className="text-xs text-gray-400">total pending</p>
              </div>
            </div>
            <div className="mt-4 flex gap-4 text-sm text-gray-600">
              <span>Database: {stats.database.pending} pending / {stats.database.total} total</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('database')}
              className={`py-2 px-4 font-medium ${
                activeTab === 'database'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Database ({stats?.database.total || 0})
            </button>
            <button
              onClick={() => setActiveTab('redis')}
              className={`py-2 px-4 font-medium ${
                activeTab === 'redis'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Redis ({stats?.total_pending || 0})
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4 items-center flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          {activeTab === 'database' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="retried">Retried</option>
                <option value="resolved">Resolved</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>
          )}
          {activeTab === 'redis' && selectedCategory !== 'all' && (
            <button
              onClick={() => handleClearRedisCategory(selectedCategory)}
              disabled={actionLoading === `clear-${selectedCategory}`}
              className="mt-6 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              {actionLoading === `clear-${selectedCategory}` ? 'Clearing...' : `Clear All ${selectedCategory}`}
            </button>
          )}
          <button
            onClick={fetchData}
            className="mt-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh
          </button>
        </div>

        {/* Task List */}
        {activeTab === 'database' ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Failed At</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retries</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dbTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No failed tasks found
                    </td>
                  </tr>
                ) : (
                  dbTasks.map((task) => (
                    <React.Fragment key={task.id}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">{task.id}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-gray-900 truncate max-w-xs">
                            {task.task_name.split('.').pop()}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-xs">
                            {task.error_message}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryBadge(task.category)}`}>
                            {task.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(task.status)}`}>
                            {task.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(task.failed_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {task.retry_count}/{task.max_retries}
                        </td>
                        <td className="px-4 py-3">
                          {task.status.toLowerCase() === 'pending' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetryDbTask(task.id);
                              }}
                              disabled={actionLoading === `db-retry-${task.id}`}
                              className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:opacity-50"
                            >
                              {actionLoading === `db-retry-${task.id}` ? '...' : 'Retry'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedTask === task.id && (
                        <tr>
                          <td colSpan={7} className="px-4 py-4 bg-gray-50">
                            <div className="space-y-3">
                              <div>
                                <span className="font-medium text-gray-700">Task ID:</span>
                                <span className="ml-2 text-gray-600 font-mono text-sm">{task.task_id}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Full Name:</span>
                                <span className="ml-2 text-gray-600 font-mono text-sm">{task.task_name}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Worker:</span>
                                <span className="ml-2 text-gray-600">{task.worker_name}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Queue:</span>
                                <span className="ml-2 text-gray-600">{task.queue_name}</span>
                              </div>
                              {task.kwargs && Object.keys(task.kwargs).length > 0 && (
                                <div>
                                  <span className="font-medium text-gray-700">Arguments:</span>
                                  <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(task.kwargs, null, 2)}
                                  </pre>
                                </div>
                              )}
                              <div>
                                <span className="font-medium text-gray-700">Error:</span>
                                <pre className="mt-1 p-2 bg-red-50 rounded text-xs text-red-800 overflow-x-auto whitespace-pre-wrap">
                                  {task.traceback}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Redis Tab */
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {selectedCategory === 'all' ? (
              <div className="p-8 text-center text-gray-500">
                Select a category to view Redis tasks
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Index</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Failed At</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {redisTasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No tasks in this category
                      </td>
                    </tr>
                  ) : (
                    redisTasks.map((task) => (
                      <tr key={task.queue_index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{task.queue_index}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-gray-900">
                            {task.task_name.split('.').pop()}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {task.task_id.slice(0, 8)}...
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-md truncate">
                          {task.error_message}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(task.failed_at)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleRetryRedisTask(selectedCategory, task.queue_index)}
                            disabled={actionLoading === `redis-retry-${task.queue_index}`}
                            className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:opacity-50"
                          >
                            {actionLoading === `redis-retry-${task.queue_index}` ? '...' : 'Retry'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDLQ;
