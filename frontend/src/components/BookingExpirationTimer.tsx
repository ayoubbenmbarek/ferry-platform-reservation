import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface BookingExpirationTimerProps {
  expiresAt: string | Date;
  onExpired?: () => void;
}

const BookingExpirationTimer: React.FC<BookingExpirationTimerProps> = ({
  expiresAt,
  onExpired,
}) => {
  const { t } = useTranslation(['payment', 'common']);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);
  const hasCalledExpired = useRef(false);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const expirationTime = new Date(expiresAt).getTime();
      const currentTime = new Date().getTime();
      const remaining = expirationTime - currentTime;

      if (remaining <= 0) {
        setIsExpired(true);
        setTimeRemaining(0);
        // Only call onExpired once
        if (onExpired && !hasCalledExpired.current) {
          hasCalledExpired.current = true;
          onExpired();
        }
        return;
      }

      setTimeRemaining(remaining);
    };

    // Calculate immediately
    calculateTimeRemaining();

    // Update every second
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getUrgencyLevel = () => {
    const totalMinutes = Math.floor(timeRemaining / 60000);
    if (totalMinutes <= 5) return 'critical'; // Red
    if (totalMinutes <= 15) return 'warning'; // Orange
    return 'normal'; // Blue/Green
  };

  const getFormattedExpiration = () => {
    const date = new Date(expiresAt);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (isExpired) {
    return (
      <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-red-900">{t('payment:timer.expired')}</h3>
            <p className="text-sm text-red-700 mt-1">
              {t('payment:timer.expiredMessage')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const urgencyLevel = getUrgencyLevel();
  const totalMinutes = Math.floor(timeRemaining / 60000);

  return (
    <div
      className={`rounded-lg p-4 border-2 ${
        urgencyLevel === 'critical'
          ? 'bg-red-50 border-red-500'
          : urgencyLevel === 'warning'
          ? 'bg-orange-50 border-orange-500'
          : 'bg-blue-50 border-blue-500'
      }`}
    >
      <div className="flex items-start">
        <svg
          className={`w-6 h-6 mr-3 mt-0.5 ${
            urgencyLevel === 'critical'
              ? 'text-red-600 animate-pulse'
              : urgencyLevel === 'warning'
              ? 'text-orange-600'
              : 'text-blue-600'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3
              className={`font-bold ${
                urgencyLevel === 'critical'
                  ? 'text-red-900'
                  : urgencyLevel === 'warning'
                  ? 'text-orange-900'
                  : 'text-blue-900'
              }`}
            >
              {urgencyLevel === 'critical'
                ? t('payment:timer.criticalTitle')
                : urgencyLevel === 'warning'
                ? t('payment:timer.warningTitle')
                : t('payment:timer.normalTitle')}
            </h3>
            <div
              className={`text-2xl font-mono font-bold ${
                urgencyLevel === 'critical'
                  ? 'text-red-700'
                  : urgencyLevel === 'warning'
                  ? 'text-orange-700'
                  : 'text-blue-700'
              }`}
            >
              {formatTime(timeRemaining)}
            </div>
          </div>
          <p
            className={`text-sm ${
              urgencyLevel === 'critical'
                ? 'text-red-700'
                : urgencyLevel === 'warning'
                ? 'text-orange-700'
                : 'text-blue-700'
            }`}
          >
            {urgencyLevel === 'critical' ? (
              <>
                <strong>{t('payment:timer.urgent')}:</strong> {t('payment:timer.criticalMessage', { time: formatTime(timeRemaining) })}
              </>
            ) : (
              <>
                {t('payment:timer.normalMessage', { time: getFormattedExpiration(), minutes: totalMinutes })}
              </>
            )}
          </p>

          {/* Progress bar */}
          <div className="mt-3 bg-white rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                urgencyLevel === 'critical'
                  ? 'bg-red-600'
                  : urgencyLevel === 'warning'
                  ? 'bg-orange-600'
                  : 'bg-blue-600'
              }`}
              style={{
                width: `${Math.min(100, (timeRemaining / (30 * 60 * 1000)) * 100)}%`, // Assuming 30 min max
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingExpirationTimer;
