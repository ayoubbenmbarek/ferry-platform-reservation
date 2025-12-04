import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { priceAlertAPI } from '../services/api';
import { RootState } from '../store';
import { format, addDays, addMonths } from 'date-fns';

interface SaveRouteButtonProps {
  departurePort: string;
  arrivalPort: string;
  price?: number;
  searchDate?: string;
  variant?: 'button' | 'icon' | 'compact';
  className?: string;
  onSaveSuccess?: () => void;
  onRemoveSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function SaveRouteButton({
  departurePort,
  arrivalPort,
  price,
  searchDate,
  variant = 'button',
  className = '',
  onSaveSuccess,
  onRemoveSuccess,
  onError,
}: SaveRouteButtonProps) {
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [isSaved, setIsSaved] = useState(false);
  const [alertId, setAlertId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Modal state for date range selection
  const [showModal, setShowModal] = useState(false);
  const [useDateRange, setUseDateRange] = useState(true);
  const [dateFrom, setDateFrom] = useState(searchDate || format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(searchDate ? format(addDays(new Date(searchDate), 14), 'yyyy-MM-dd') : format(addDays(new Date(), 15), 'yyyy-MM-dd'));

  // Ref to prevent duplicate API calls in React 18 Strict Mode
  const checkingRef = useRef(false);

  // Check if route is already saved
  useEffect(() => {
    const checkSaved = async () => {
      if (!departurePort || !arrivalPort) {
        setIsChecking(false);
        return;
      }

      // If not authenticated, don't check - route can't be saved
      if (!isAuthenticated) {
        setIsSaved(false);
        setAlertId(null);
        setIsChecking(false);
        return;
      }

      // Prevent duplicate calls in Strict Mode
      if (checkingRef.current) {
        return;
      }
      checkingRef.current = true;

      try {
        const result = await priceAlertAPI.checkRouteSaved(
          departurePort,
          arrivalPort,
          user?.email
        );
        setIsSaved(result.is_saved);
        setAlertId(result.alert_id);
      } catch (error) {
        setIsSaved(false);
        setAlertId(null);
      } finally {
        setIsChecking(false);
        checkingRef.current = false;
      }
    };

    checkSaved();
  }, [departurePort, arrivalPort, user?.email, isAuthenticated]);

  // State for options dropdown when already saved
  const [showOptions, setShowOptions] = useState(false);

  const handleButtonClick = useCallback(() => {
    if (!isAuthenticated) {
      onError?.('Please log in to save routes');
      return;
    }

    if (isSaved && alertId) {
      // If already saved, show options dropdown
      setShowOptions(true);
    } else {
      // Show modal for date selection
      setShowModal(true);
    }
  }, [isSaved, alertId, isAuthenticated, onError]);

  const handleChangeDates = async () => {
    setShowOptions(false);
    if (!alertId) return;

    setIsLoading(true);
    try {
      await priceAlertAPI.delete(alertId);
      setIsSaved(false);
      setAlertId(null);
      setIsLoading(false);
      // Show modal to save with new dates
      setShowModal(true);
    } catch (error: any) {
      setIsLoading(false);
      const message = error.response?.data?.detail || error.message || 'Failed to update route';
      onError?.(message);
    }
  };

  const handleRemove = async () => {
    setShowOptions(false);
    if (!alertId) return;

    setIsLoading(true);
    try {
      await priceAlertAPI.delete(alertId);
      setIsSaved(false);
      setAlertId(null);
      onRemoveSuccess?.();
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to remove route';
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Options dropdown for saved routes
  const renderOptionsDropdown = () => {
    if (!showOptions) return null;

    return (
      <>
        {/* Backdrop to close dropdown */}
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowOptions(false)}
        />
        <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[160px]">
          <button
            onClick={handleChangeDates}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Change Dates
          </button>
          <button
            onClick={handleRemove}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Remove
          </button>
        </div>
      </>
    );
  };

  const handleSave = async () => {
    setShowModal(false);
    setIsLoading(true);

    try {
      const alert = await priceAlertAPI.create({
        departure_port: departurePort,
        arrival_port: arrivalPort,
        initial_price: price,
        date_from: useDateRange ? dateFrom : undefined,
        date_to: useDateRange ? dateTo : undefined,
        notify_on_drop: true,
        notify_on_increase: true,
        price_threshold_percent: 5.0,
      });
      setIsSaved(true);
      setAlertId(alert.id);
      onSaveSuccess?.();
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to save route';
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPortName = (port: string) => port.charAt(0).toUpperCase() + port.slice(1);

  // Modal component
  const renderModal = () => {
    if (!showModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Save Route for Price Alerts</h3>
            <button
              onClick={() => setShowModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 mb-2">
              We'll notify you when the price drops or increases by 5% or more. Never miss a deal!
            </p>
            <div className="bg-white rounded-lg p-3">
              <p className="font-medium text-gray-900">
                {formatPortName(departurePort)} → {formatPortName(arrivalPort)}
              </p>
              {price && (
                <p className="text-sm text-gray-500 mt-1">Current price: €{price}</p>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-gray-700">Track specific travel dates</span>
              <input
                type="checkbox"
                checked={useDateRange}
                onChange={(e) => setUseDateRange(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
            </label>
            <p className="text-xs text-gray-500 mt-1">
              {useDateRange
                ? 'Get alerts for the best price within your travel window'
                : 'Track general route prices (any date)'}
            </p>
          </div>

          {useDateRange && (
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  max={format(addMonths(new Date(), 12), 'yyyy-MM-dd')}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    if (e.target.value > dateTo) {
                      setDateTo(format(addDays(new Date(e.target.value), 7), 'yyyy-MM-dd'));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  max={format(addMonths(new Date(), 12), 'yyyy-MM-dd')}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setShowModal(false)}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save & Track Prices'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isChecking) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400" />
      </div>
    );
  }

  // Icon-only variant (heart icon)
  if (variant === 'icon') {
    return (
      <div className="relative">
        <button
          onClick={handleButtonClick}
          disabled={isLoading}
          className={`p-2 rounded-full transition-all duration-200 ${
            isSaved
              ? 'text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100'
              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
          title={isSaved ? 'Manage saved route' : 'Save route for price alerts'}
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg
              className="h-5 w-5"
              fill={isSaved ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          )}
        </button>
        {renderOptionsDropdown()}
        {renderModal()}
      </div>
    );
  }

  // Compact variant (small button with icon and short text)
  if (variant === 'compact') {
    return (
      <div className="relative">
        <button
          onClick={handleButtonClick}
          disabled={isLoading}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
            isSaved
              ? 'text-red-600 bg-red-50 hover:bg-red-100 border border-red-200'
              : 'text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-red-200 hover:text-red-500'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        >
          {isLoading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg
              className="h-4 w-4"
              fill={isSaved ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          )}
          <span>{isSaved ? 'Saved' : 'Save'}</span>
        </button>
        {renderOptionsDropdown()}
        {renderModal()}
      </div>
    );
  }

  // Full button variant (default)
  return (
    <div className="relative">
      <button
        onClick={handleButtonClick}
        disabled={isLoading}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2 font-medium rounded-lg transition-all duration-200 ${
          isSaved
            ? 'text-white bg-red-500 hover:bg-red-600'
            : 'text-blue-600 bg-white border border-blue-600 hover:bg-blue-50'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        {isLoading ? (
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg
            className="h-5 w-5"
            fill={isSaved ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        )}
        <span>{isSaved ? 'Tracking Price' : 'Save & Get Price Alerts'}</span>
      </button>
      {renderOptionsDropdown()}
      {renderModal()}
    </div>
  );
}
