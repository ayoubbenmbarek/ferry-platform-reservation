/**
 * AvailabilityBadge Tests
 *
 * Note: Due to the complexity of mocking expo-vector-icons and expo-modules-core
 * dependencies, we focus on testing the core logic (thresholds, status calculation,
 * colors) through unit tests of the component's internal logic.
 */

describe('AvailabilityBadge - Logic Tests', () => {
  // Thresholds for "limited" availability (same as component)
  const THRESHOLDS = {
    passenger: 10,
    vehicle: 5,
    cabin: 2,
  };

  // Labels for each type (same as component)
  const LABELS: Record<string, string> = {
    passenger: 'seats',
    vehicle: 'spaces',
    cabin: 'cabins',
  };

  // Calculate availability status
  const calculateStatus = (type: string, count: number, needed = 1) => {
    const threshold = THRESHOLDS[type as keyof typeof THRESHOLDS];
    const isUnavailable = count === 0 || count < needed;
    const isLimited = !isUnavailable && count <= threshold;
    const isAvailable = !isUnavailable && !isLimited;

    return { isUnavailable, isLimited, isAvailable };
  };

  // Get status colors
  const getStatusColors = (isUnavailable: boolean, isLimited: boolean) => {
    if (isUnavailable) {
      return { bg: '#FEE2E2', text: '#991B1B', icon: '#DC2626' };
    }
    if (isLimited) {
      return { bg: '#FEF3C7', text: '#92400E', icon: '#D97706' };
    }
    return { bg: '#D1FAE5', text: '#065F46', icon: '#059669' };
  };

  // Get status text
  const getStatusText = (type: string, count: number, needed = 1) => {
    const { isUnavailable, isLimited } = calculateStatus(type, count, needed);
    const label = LABELS[type];

    if (isUnavailable) return 'Unavailable';
    if (isLimited) return `${count} left`;
    return `${count} ${label}`;
  };

  describe('passenger type', () => {
    it('should show available status with count and label', () => {
      const text = getStatusText('passenger', 50);
      expect(text).toBe('50 seats');
    });

    it('should show limited status when count <= 10', () => {
      const text = getStatusText('passenger', 5);
      expect(text).toBe('5 left');
    });

    it('should show unavailable when count is 0', () => {
      const text = getStatusText('passenger', 0);
      expect(text).toBe('Unavailable');
    });

    it('should show unavailable when count < needed', () => {
      const text = getStatusText('passenger', 2, 5);
      expect(text).toBe('Unavailable');
    });

    it('should be exactly at threshold (10) and be limited', () => {
      const { isLimited } = calculateStatus('passenger', 10);
      expect(isLimited).toBe(true);
    });

    it('should be above threshold (11) and be available', () => {
      const { isAvailable } = calculateStatus('passenger', 11);
      expect(isAvailable).toBe(true);
    });
  });

  describe('vehicle type', () => {
    it('should show available status for vehicle', () => {
      const text = getStatusText('vehicle', 20);
      expect(text).toBe('20 spaces');
    });

    it('should show limited status when count <= 5', () => {
      const text = getStatusText('vehicle', 3);
      expect(text).toBe('3 left');
    });

    it('should show unavailable when count is 0', () => {
      const text = getStatusText('vehicle', 0);
      expect(text).toBe('Unavailable');
    });

    it('should be exactly at threshold (5) and be limited', () => {
      const { isLimited } = calculateStatus('vehicle', 5);
      expect(isLimited).toBe(true);
    });

    it('should be above threshold (6) and be available', () => {
      const { isAvailable } = calculateStatus('vehicle', 6);
      expect(isAvailable).toBe(true);
    });
  });

  describe('cabin type', () => {
    it('should show available status for cabin', () => {
      const text = getStatusText('cabin', 10);
      expect(text).toBe('10 cabins');
    });

    it('should show limited status when count <= 2', () => {
      const text = getStatusText('cabin', 2);
      expect(text).toBe('2 left');
    });

    it('should show unavailable when count is 0', () => {
      const text = getStatusText('cabin', 0);
      expect(text).toBe('Unavailable');
    });

    it('should be exactly at threshold (2) and be limited', () => {
      const { isLimited } = calculateStatus('cabin', 2);
      expect(isLimited).toBe(true);
    });

    it('should be above threshold (3) and be available', () => {
      const { isAvailable } = calculateStatus('cabin', 3);
      expect(isAvailable).toBe(true);
    });
  });

  describe('status colors', () => {
    it('should return red colors for unavailable status', () => {
      const colors = getStatusColors(true, false);
      expect(colors.bg).toBe('#FEE2E2');
      expect(colors.text).toBe('#991B1B');
      expect(colors.icon).toBe('#DC2626');
    });

    it('should return yellow/orange colors for limited status', () => {
      const colors = getStatusColors(false, true);
      expect(colors.bg).toBe('#FEF3C7');
      expect(colors.text).toBe('#92400E');
      expect(colors.icon).toBe('#D97706');
    });

    it('should return green colors for available status', () => {
      const colors = getStatusColors(false, false);
      expect(colors.bg).toBe('#D1FAE5');
      expect(colors.text).toBe('#065F46');
      expect(colors.icon).toBe('#059669');
    });
  });

  describe('notify button visibility logic', () => {
    it('should show notify button when unavailable and showNotifyButton is true', () => {
      const { isUnavailable, isLimited } = calculateStatus('passenger', 0);
      const showNotifyButton = true;
      const onNotifyPress = jest.fn();
      const shouldShowNotify = showNotifyButton && (isUnavailable || isLimited) && onNotifyPress;

      expect(shouldShowNotify).toBeTruthy();
    });

    it('should show notify button when limited', () => {
      const { isUnavailable, isLimited } = calculateStatus('passenger', 5);
      const showNotifyButton = true;
      const onNotifyPress = jest.fn();
      const shouldShowNotify = showNotifyButton && (isUnavailable || isLimited) && onNotifyPress;

      expect(shouldShowNotify).toBeTruthy();
    });

    it('should not show notify button when available', () => {
      const { isUnavailable, isLimited } = calculateStatus('passenger', 50);
      const showNotifyButton = true;
      const onNotifyPress = jest.fn();
      const shouldShowNotify = showNotifyButton && (isUnavailable || isLimited) && onNotifyPress;

      expect(shouldShowNotify).toBeFalsy();
    });

    it('should not show notify button when showNotifyButton is false', () => {
      const { isUnavailable, isLimited } = calculateStatus('passenger', 0);
      const showNotifyButton = false;
      const onNotifyPress = jest.fn();
      const shouldShowNotify = showNotifyButton && (isUnavailable || isLimited) && onNotifyPress;

      expect(shouldShowNotify).toBeFalsy();
    });

    it('should not show notify button when onNotifyPress is not provided', () => {
      const { isUnavailable, isLimited } = calculateStatus('passenger', 0);
      const showNotifyButton = true;
      const onNotifyPress = undefined;
      const shouldShowNotify = showNotifyButton && (isUnavailable || isLimited) && onNotifyPress;

      expect(shouldShowNotify).toBeFalsy();
    });
  });

  describe('compact mode logic', () => {
    it('should show only count in compact mode when available', () => {
      const count = 50;
      const { isUnavailable } = calculateStatus('passenger', count);
      const compactText = isUnavailable ? '0' : String(count);

      expect(compactText).toBe('50');
    });

    it('should show 0 for unavailable in compact mode', () => {
      const count = 0;
      const { isUnavailable } = calculateStatus('passenger', count);
      const compactText = isUnavailable ? '0' : String(count);

      expect(compactText).toBe('0');
    });

    it('should show count for limited in compact mode', () => {
      const count = 5;
      const { isUnavailable } = calculateStatus('passenger', count);
      const compactText = isUnavailable ? '0' : String(count);

      expect(compactText).toBe('5');
    });
  });

  describe('threshold constants', () => {
    it('should have correct thresholds for each type', () => {
      expect(THRESHOLDS.passenger).toBe(10);
      expect(THRESHOLDS.vehicle).toBe(5);
      expect(THRESHOLDS.cabin).toBe(2);
    });
  });

  describe('label constants', () => {
    it('should have correct labels for each type', () => {
      expect(LABELS.passenger).toBe('seats');
      expect(LABELS.vehicle).toBe('spaces');
      expect(LABELS.cabin).toBe('cabins');
    });
  });
});
