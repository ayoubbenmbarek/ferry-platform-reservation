import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { priceAlertAPI, PriceAlert } from '../services/api';
import { RootState } from '../store';
import { format, parseISO } from 'date-fns';

interface RouteStats {
  total_alerts: number;
  active_alerts: number;
  paused_alerts: number;
  triggered_alerts: number;
  routes_with_price_drops: number;
}

export default function SavedRoutesPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [routes, setRoutes] = useState<PriceAlert[]>([]);
  const [stats, setStats] = useState<RouteStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const [routesResponse, statsResponse] = await Promise.all([
        priceAlertAPI.getMyRoutes(),
        priceAlertAPI.getStats(),
      ]);
      setRoutes(routesResponse.routes);
      setStats(statsResponse);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load saved routes');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (route: PriceAlert) => {
    if (!window.confirm(`Remove ${route.departure_port} to ${route.arrival_port} from saved routes?`)) {
      return;
    }

    setDeletingId(route.id);
    try {
      await priceAlertAPI.delete(route.id);
      setRoutes((prev) => prev.filter((r) => r.id !== route.id));
      if (stats) {
        setStats({
          ...stats,
          total_alerts: stats.total_alerts - 1,
          active_alerts: route.status === 'active' ? stats.active_alerts - 1 : stats.active_alerts,
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to remove route');
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePause = async (route: PriceAlert) => {
    try {
      let updatedRoute: PriceAlert;
      if (route.status === 'paused') {
        updatedRoute = await priceAlertAPI.resume(route.id);
      } else {
        updatedRoute = await priceAlertAPI.pause(route.id);
      }
      setRoutes((prev) => prev.map((r) => (r.id === route.id ? updatedRoute : r)));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update route');
    }
  };

  const handleSearch = (route: PriceAlert) => {
    navigate(`/search?from=${route.departure_port}&to=${route.arrival_port}`);
  };

  const formatPortName = (port: string) => {
    return port.charAt(0).toUpperCase() + port.slice(1);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Sign in Required</h2>
          <p className="text-gray-600 mb-6">Please sign in to view your saved routes.</p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-maritime-600 to-maritime-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-white">Saved Routes</h1>
          <p className="text-maritime-100 mt-2">
            Get notified when prices change on your favorite routes
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-gray-900">{stats.total_alerts}</p>
              <p className="text-sm text-gray-500">Total Routes</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-maritime-600">{stats.active_alerts}</p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-gray-400">{stats.paused_alerts}</p>
              <p className="text-sm text-gray-500">Paused</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{stats.routes_with_price_drops}</p>
              <p className="text-sm text-gray-500">Price Drops</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-maritime-600 mb-4" />
            <p className="text-gray-600">Loading saved routes...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
            <button
              onClick={loadData}
              className="text-red-600 underline mt-2"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && routes.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-300 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Saved Routes</h3>
            <p className="text-gray-600 mb-6">
              Save routes from search results to get notified when prices change.
            </p>
            <button
              onClick={() => navigate('/search')}
              className="btn-primary"
            >
              Search Ferries
            </button>
          </div>
        )}

        {/* Routes List */}
        {!isLoading && routes.length > 0 && (
          <div className="space-y-4">
            {routes.map((route) => {
              const hasPriceDrop = route.price_change_percent && route.price_change_percent < 0;
              const hasPriceIncrease = route.price_change_percent && route.price_change_percent > 0;
              const isPaused = route.status === 'paused';

              return (
                <div
                  key={route.id}
                  className={`bg-white rounded-lg shadow p-6 ${isPaused ? 'opacity-60' : ''}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Route Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {formatPortName(route.departure_port)} → {formatPortName(route.arrival_port)}
                        </h3>
                        {isPaused && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                            Paused
                          </span>
                        )}
                        {hasPriceDrop && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {Math.abs(route.price_change_percent!).toFixed(1)}% drop
                          </span>
                        )}
                      </div>

                      {/* Price Info */}
                      {route.initial_price && (
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500">
                            Initial: <span className="font-medium text-gray-700">{route.initial_price.toFixed(0)}</span>
                          </span>
                          {route.current_price && route.current_price !== route.initial_price && (
                            <span className={hasPriceDrop ? 'text-green-600' : hasPriceIncrease ? 'text-red-600' : 'text-gray-500'}>
                              Current: <span className="font-medium">{route.current_price.toFixed(0)}</span>
                            </span>
                          )}
                          {route.lowest_price && route.lowest_price < route.initial_price && (
                            <span className="text-green-600">
                              Lowest: <span className="font-medium">{route.lowest_price.toFixed(0)}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Settings */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {route.notify_on_drop && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                            </svg>
                            Price drops
                          </span>
                        )}
                        {route.target_price && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded">
                            Target: {route.target_price}
                          </span>
                        )}
                      </div>

                      {/* Meta */}
                      <p className="text-xs text-gray-400 mt-2">
                        Saved {format(parseISO(route.created_at), 'MMM d, yyyy')}
                        {route.last_checked_at && (
                          <> &bull; Last checked {format(parseISO(route.last_checked_at), 'MMM d')}</>
                        )}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSearch(route)}
                        className="px-4 py-2 text-sm font-medium text-maritime-600 border border-maritime-600 rounded-lg hover:bg-maritime-50 transition-colors"
                      >
                        Search
                      </button>
                      <button
                        onClick={() => handleTogglePause(route)}
                        className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {isPaused ? 'Resume' : 'Pause'}
                      </button>
                      <button
                        onClick={() => handleDelete(route)}
                        disabled={deletingId === route.id}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        {deletingId === route.id ? (
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
