/**
 * Tests for BookingExpirationTimer component.
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import BookingExpirationTimer from '../../components/BookingExpirationTimer';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const translations: Record<string, string> = {
        'payment:timer.expired': 'Session Expired',
        'payment:timer.expiredMessage': 'Your booking session has expired.',
        'payment:timer.criticalTitle': 'Time Running Out!',
        'payment:timer.warningTitle': 'Complete Soon',
        'payment:timer.normalTitle': 'Time Remaining',
        'payment:timer.urgent': 'URGENT',
        'payment:timer.criticalMessage': `Complete your booking in the next ${params?.time || ''}`,
        'payment:timer.normalMessage': `Complete by ${params?.time || ''} (${params?.minutes || ''} minutes)`,
      };
      return translations[key] || key;
    },
  }),
}));

describe('BookingExpirationTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Time Display', () => {
    it('displays time in minutes and seconds format', () => {
      const futureTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      render(<BookingExpirationTimer expiresAt={futureTime} />);

      // Should show minutes and seconds
      expect(screen.getByText(/\d+m \d+s/)).toBeInTheDocument();
    });

    it('displays time in hours format when over 60 minutes', () => {
      const futureTime = new Date(Date.now() + 90 * 60 * 1000); // 90 minutes
      render(<BookingExpirationTimer expiresAt={futureTime} />);

      // Should show hours
      expect(screen.getByText(/1h \d+m \d+s/)).toBeInTheDocument();
    });

    it('displays only seconds when under 1 minute', () => {
      const futureTime = new Date(Date.now() + 45 * 1000); // 45 seconds
      render(<BookingExpirationTimer expiresAt={futureTime} />);

      // Should show just seconds
      expect(screen.getByText(/^\d+s$/)).toBeInTheDocument();
    });

    it('accepts string date format', () => {
      const futureTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      render(<BookingExpirationTimer expiresAt={futureTime} />);

      expect(screen.getByText(/\d+m \d+s/)).toBeInTheDocument();
    });
  });

  describe('Urgency Levels', () => {
    it('shows normal state when more than 15 minutes remaining', () => {
      const futureTime = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes
      const { container } = render(<BookingExpirationTimer expiresAt={futureTime} />);

      expect(screen.getByText('Time Remaining')).toBeInTheDocument();
      expect(container.querySelector('.bg-blue-50')).toBeInTheDocument();
    });

    it('shows warning state when 5-15 minutes remaining', () => {
      const futureTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      const { container } = render(<BookingExpirationTimer expiresAt={futureTime} />);

      expect(screen.getByText('Complete Soon')).toBeInTheDocument();
      expect(container.querySelector('.bg-orange-50')).toBeInTheDocument();
    });

    it('shows critical state when under 5 minutes remaining', () => {
      const futureTime = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes
      const { container } = render(<BookingExpirationTimer expiresAt={futureTime} />);

      expect(screen.getByText('Time Running Out!')).toBeInTheDocument();
      expect(container.querySelector('.bg-red-50')).toBeInTheDocument();
    });
  });

  describe('Countdown Behavior', () => {
    it('updates every second', () => {
      const futureTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      render(<BookingExpirationTimer expiresAt={futureTime} />);

      const initialTimeElements = screen.getAllByText(/\d+m \d+s/);
      const initialTime = initialTimeElements[0].textContent;

      // Advance time by 1 second
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      const updatedTimeElements = screen.getAllByText(/\d+m \d+s/);
      const updatedTime = updatedTimeElements[0].textContent;
      expect(updatedTime).not.toBe(initialTime);
    });

    it('transitions from warning to critical as time decreases', () => {
      const futureTime = new Date(Date.now() + 6 * 60 * 1000); // 6 minutes
      const { container, rerender } = render(<BookingExpirationTimer expiresAt={futureTime} />);

      // Should start in warning state
      expect(container.querySelector('.bg-orange-50')).toBeInTheDocument();

      // Advance time by 2 minutes (to 4 minutes remaining)
      act(() => {
        jest.advanceTimersByTime(2 * 60 * 1000);
      });

      // Should now be in critical state
      expect(container.querySelector('.bg-red-50')).toBeInTheDocument();
    });
  });

  describe('Expiration Handling', () => {
    it('shows expired message when time runs out', () => {
      const pastTime = new Date(Date.now() - 1000); // 1 second ago
      render(<BookingExpirationTimer expiresAt={pastTime} />);

      expect(screen.getByText('Session Expired')).toBeInTheDocument();
      expect(screen.getByText('Your booking session has expired.')).toBeInTheDocument();
    });

    it('calls onExpired callback when timer expires', () => {
      const onExpired = jest.fn();
      const futureTime = new Date(Date.now() + 2000); // 2 seconds

      render(<BookingExpirationTimer expiresAt={futureTime} onExpired={onExpired} />);

      // Should not be called yet
      expect(onExpired).not.toHaveBeenCalled();

      // Advance past expiration
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(onExpired).toHaveBeenCalledTimes(1);
    });

    it('only calls onExpired once', () => {
      const onExpired = jest.fn();
      const futureTime = new Date(Date.now() + 1000); // 1 second

      render(<BookingExpirationTimer expiresAt={futureTime} onExpired={onExpired} />);

      // Advance past expiration multiple times
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Should still only be called once
      expect(onExpired).toHaveBeenCalledTimes(1);
    });

    it('transitions to expired state when countdown reaches zero', () => {
      const futureTime = new Date(Date.now() + 2000); // 2 seconds
      render(<BookingExpirationTimer expiresAt={futureTime} />);

      // Should not show expired yet
      expect(screen.queryByText('Session Expired')).not.toBeInTheDocument();

      // Advance past expiration
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Should now show expired
      expect(screen.getByText('Session Expired')).toBeInTheDocument();
    });
  });

  describe('Progress Bar', () => {
    it('renders progress bar element', () => {
      const futureTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      const { container } = render(<BookingExpirationTimer expiresAt={futureTime} />);

      // Progress bar should exist
      const progressContainer = container.querySelector('.bg-white.rounded-full.h-2');
      expect(progressContainer).toBeInTheDocument();
    });

    it('progress bar width decreases as time passes', () => {
      const futureTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes (max)
      const { container } = render(<BookingExpirationTimer expiresAt={futureTime} />);

      const progressBar = container.querySelector('.bg-white.rounded-full.h-2 > div');
      const initialWidth = progressBar?.getAttribute('style');

      // Advance time
      act(() => {
        jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
      });

      const newWidth = progressBar?.getAttribute('style');
      // Width should have changed (decreased)
      expect(newWidth).not.toBe(initialWidth);
    });
  });

  describe('Edge Cases', () => {
    it('handles exactly 0 time remaining', () => {
      const exactlyNow = new Date(Date.now());
      const onExpired = jest.fn();

      render(<BookingExpirationTimer expiresAt={exactlyNow} onExpired={onExpired} />);

      // Should immediately show expired
      expect(screen.getByText('Session Expired')).toBeInTheDocument();
      expect(onExpired).toHaveBeenCalled();
    });

    it('handles very long durations', () => {
      const farFuture = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      render(<BookingExpirationTimer expiresAt={farFuture} />);

      // Should show hours
      expect(screen.getByText(/\d+h \d+m \d+s/)).toBeInTheDocument();
    });
  });
});
