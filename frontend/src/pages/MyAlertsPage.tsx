import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { RootState } from '../store';
import { availabilityAlertAPI, AvailabilityAlert, AlertStatus, AlertType } from '../services/api';
import { format, parseISO, differenceInDays } from 'date-fns';
import RunningBear from '../components/UI/RunningBear';

type FilterValue = 'active' | 'all' | 'notified';

const STATUS_COLORS: Record<AlertStatus, { bg: string; text: string; border: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  notified: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  fulfilled: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
  expired: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
};

const ALERT_TYPE_ICONS: Record<AlertType, string> = {
  passenger: '👤',
  vehicle: '🚗',
  cabin: '🛏️',
};

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  passenger: 'Passenger Seats',
  vehicle: 'Vehicle Space',
  cabin: 'Cabin',
};

const MyAlertsPage: React.FC = () => {
  useTranslation(['common']);
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);

  const [alerts, setAlerts] = useState<AvailabilityAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>('active');
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadAlerts = useCallback(async () => {
    if (!user?.email) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await availabilityAlertAPI.getAlerts({ email: user.email });
      setAlerts(data);
    } catch (err: any) {
      console.error('Error loading alerts:', err);
      setError(err.response?.data?.detail || 'Failed to load alerts');
    } finally {
      setIsLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    if (isAuthenticated && user?.email) {
      loadAlerts();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.email, loadAlerts]);

  const handleCancelAlert = async (alertToCancel: AvailabilityAlert) => {
    if (!window.confirm(`Are you sure you want to cancel this ${ALERT_TYPE_LABELS[alertToCancel.alert_type].toLowerCase()} alert for ${alertToCancel.departure_port} → ${alertToCancel.arrival_port}?`)) {
      return;
    }

    setCancellingId(alertToCancel.id);
    try {
      await availabilityAlertAPI.cancelAlert(alertToCancel.id, alertToCancel.email);
      setAlerts(prev => prev.filter(a => a.id !== alertToCancel.id));
    } catch (err: any) {
      window.alert(err.response?.data?.detail || 'Failed to cancel alert');
    } finally {
      setCancellingId(null);
    }
  };

  const handleMarkFulfilled = async (alertItem: AvailabilityAlert) => {
    try {
      const updated = await availabilityAlertAPI.markAsFulfilled(alertItem.id, alertItem.email);
      setAlerts(prev => prev.map(a => a.id === alertItem.id ? updated : a));
    } catch (err: any) {
      window.alert(err.response?.data?.detail || 'Failed to update alert');
    }
  };

  const handleNotifiedAlertClick = (alertItem: AvailabilityAlert) => {
    if (alertItem.alert_type === 'cabin' && alertItem.booking_id) {
      navigate(`/booking/${alertItem.booking_id}/add-cabin?alertId=${alertItem.id}&journeyType=${alertItem.journey_type || 'outbound'}`);
    } else {
      const confirmed = window.confirm(
        `${ALERT_TYPE_LABELS[alertItem.alert_type]} is now available for ${alertItem.departure_port} → ${alertItem.arrival_port} on ${formatDate(alertItem.departure_date)}.\n\nSearch for this route to book now!\n\nMark as booked?`
      );
      if (confirmed) {
        handleMarkFulfilled(alertItem);
      }
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'active') return alert.status === 'active';
    if (filter === 'notified') return alert.status === 'notified';
    return true;
  });

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'EEE, MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  const getDaysRemaining = (alert: AvailabilityAlert) => {
    try {
      const departure = parseISO(alert.departure_date);
      const days = differenceInDays(departure, new Date());
      if (days < 0) return 'Departed';
      if (days === 0) return 'Today';
      if (days === 1) return 'Tomorrow';
      return `${days} days`;
    } catch {
      return null;
    }
  };

  const hasDeparted = (alert: AvailabilityAlert) => {
    try {
      const departure = parseISO(alert.departure_date);
      return differenceInDays(departure, new Date()) < 0;
    } catch {
      return false;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🔔</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h2>
            <p className="text-gray-600 mb-6">Please sign in to view your availability alerts</p>
            <Link
              to="/login?returnTo=/my-alerts"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <RunningBear message="Loading your alerts" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>🔔</span> My Availability Alerts
          </h1>
          <p className="text-gray-600 mt-1">
            Get notified when seats, vehicles, or cabins become available
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow-sm p-2 mb-4 flex gap-2">
          {(['active', 'notified', 'all'] as FilterValue[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f === 'active' ? 'Active' : f === 'notified' ? 'Notified' : 'All'}
              {f === 'notified' && alerts.filter(a => a.status === 'notified').length > 0 && (
                <span className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {alerts.filter(a => a.status === 'notified').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="text-sm text-gray-500 mb-4">
          {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? 's' : ''}
          {filter !== 'all' && ` (${filter})`}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
            <button
              onClick={loadAlerts}
              className="mt-2 text-red-600 hover:text-red-800 font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!error && filteredAlerts.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🔕</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Alerts Found</h2>
            <p className="text-gray-600 mb-2">
              {filter === 'active'
                ? "You don't have any active availability alerts"
                : filter === 'notified'
                ? "No alerts have been triggered yet"
                : "You haven't created any availability alerts yet"}
            </p>
            <p className="text-sm text-gray-500 italic">
              Create alerts from the search results when availability is limited
            </p>
          </div>
        )}

        {/* Alerts List */}
        <div className="space-y-4">
          {filteredAlerts.map((alertItem) => {
            const statusStyle = STATUS_COLORS[alertItem.status];
            const icon = ALERT_TYPE_ICONS[alertItem.alert_type];
            const typeLabel = ALERT_TYPE_LABELS[alertItem.alert_type];
            const daysRemaining = getDaysRemaining(alertItem);
            const isCancelling = cancellingId === alertItem.id;
            const isNotified = alertItem.status === 'notified';
            const isDeparted = hasDeparted(alertItem);
            const canNavigate = isNotified && alertItem.alert_type === 'cabin' && alertItem.booking_id && !isDeparted;

            return (
              <div
                key={alertItem.id}
                className={`bg-white rounded-xl shadow-sm overflow-hidden ${
                  isNotified ? 'ring-2 ring-amber-400' : ''
                }`}
              >
                {/* Notified Banner */}
                {isNotified && (
                  <div
                    className={`px-4 py-2 flex items-center justify-between ${
                      isDeparted
                        ? 'bg-gray-100 cursor-not-allowed'
                        : 'bg-amber-100 cursor-pointer hover:bg-amber-200'
                    } transition-colors`}
                    onClick={() => !isDeparted && handleNotifiedAlertClick(alertItem)}
                  >
                    <div className={`flex items-center gap-2 ${isDeparted ? 'text-gray-500' : 'text-amber-800'}`}>
                      {isDeparted ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className="font-semibold text-sm">
                        {isDeparted
                          ? 'Ferry has departed - cabin can no longer be added'
                          : canNavigate
                            ? 'Tap to add cabin to your booking'
                            : 'Availability found! Tap for details'}
                      </span>
                    </div>
                    {!isDeparted && (
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                )}

                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">
                        {icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{typeLabel}</h3>
                        <p className="text-sm text-gray-500">{alertItem.operator}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                      {alertItem.status.charAt(0).toUpperCase() + alertItem.status.slice(1)}
                    </span>
                  </div>

                  {/* Route Info */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-gray-700">{alertItem.departure_port} → {alertItem.arrival_port}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-gray-700">
                        {formatDate(alertItem.departure_date)}
                        {alertItem.sailing_time && ` at ${alertItem.sailing_time}`}
                      </span>
                    </div>
                    {daysRemaining && (
                      <div className="flex items-center gap-2 text-sm">
                        <svg className={`w-4 h-4 ${isDeparted ? 'text-red-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className={`font-medium ${isDeparted ? 'text-red-600' : 'text-blue-600'}`}>{daysRemaining}</span>
                      </div>
                    )}
                  </div>

                  {/* Passengers/Vehicle Info */}
                  <div className="text-sm text-gray-600 mb-4">
                    <span>
                      {alertItem.num_adults} adult{alertItem.num_adults !== 1 ? 's' : ''}
                      {alertItem.num_children > 0 && `, ${alertItem.num_children} child${alertItem.num_children !== 1 ? 'ren' : ''}`}
                      {alertItem.num_infants > 0 && `, ${alertItem.num_infants} infant${alertItem.num_infants !== 1 ? 's' : ''}`}
                    </span>
                    {alertItem.vehicle_type && (
                      <span className="block mt-1">
                        Vehicle: {alertItem.vehicle_type}
                        {alertItem.vehicle_length_cm && ` (${(alertItem.vehicle_length_cm / 100).toFixed(1)}m)`}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex gap-3">
                      {alertItem.status === 'active' && (
                        <button
                          onClick={() => handleCancelAlert(alertItem)}
                          disabled={isCancelling}
                          className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {isCancelling ? (
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          Cancel Alert
                        </button>
                      )}

                      {alertItem.status === 'notified' && (
                        <button
                          onClick={() => handleMarkFulfilled(alertItem)}
                          className="flex items-center gap-1 text-sm text-green-600 hover:text-green-800"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Mark as Booked
                        </button>
                      )}
                    </div>

                    <span className="text-xs text-gray-400">
                      Created {format(parseISO(alertItem.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MyAlertsPage;
