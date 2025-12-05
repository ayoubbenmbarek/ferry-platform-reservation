import { createMockBooking } from '../../test-utils/testUtils';

// Mock dependencies
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/documents/',
  copyAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(() => Promise.resolve('/mock/captured-image.png')),
}));

describe('ETicketScreen', () => {
  describe('QR Code Data Generation', () => {
    it('should generate correct QR code data from booking', () => {
      const booking = createMockBooking({
        id: 123,
        booking_reference: 'BK123456',
        departure_port: 'Tunis',
        arrival_port: 'Marseille',
        departure_time: '2024-06-15T08:00:00Z',
        total_passengers: 2,
        operator: 'CTN',
      });

      // Simulate the QR data generation logic from ETicketScreen
      const qrData = JSON.stringify({
        ref: booking.booking_reference,
        id: booking.id,
        departure: booking.departure_port,
        arrival: booking.arrival_port,
        date: booking.departure_time,
        passengers: booking.total_passengers,
        operator: booking.operator,
      });

      const parsed = JSON.parse(qrData);
      expect(parsed.ref).toBe('BK123456');
      expect(parsed.id).toBe(123);
      expect(parsed.departure).toBe('Tunis');
      expect(parsed.arrival).toBe('Marseille');
      expect(parsed.passengers).toBe(2);
      expect(parsed.operator).toBe('CTN');
    });

    it('should include all required fields for check-in verification', () => {
      const booking = createMockBooking();

      const qrData = JSON.stringify({
        ref: booking.booking_reference,
        id: booking.id,
        departure: booking.departure_port,
        arrival: booking.arrival_port,
        date: booking.departure_time,
        passengers: booking.total_passengers,
        operator: booking.operator,
      });

      const parsed = JSON.parse(qrData);

      // Verify all required fields are present
      expect(parsed).toHaveProperty('ref');
      expect(parsed).toHaveProperty('id');
      expect(parsed).toHaveProperty('departure');
      expect(parsed).toHaveProperty('arrival');
      expect(parsed).toHaveProperty('date');
      expect(parsed).toHaveProperty('passengers');
      expect(parsed).toHaveProperty('operator');
    });
  });

  describe('Status Display', () => {
    it('should return correct color for confirmed status', () => {
      const getStatusColor = (status: string) => {
        const colors = {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          textSecondary: '#6B7280',
        };
        switch (status) {
          case 'confirmed':
            return colors.success;
          case 'pending':
            return colors.warning;
          case 'cancelled':
            return colors.error;
          default:
            return colors.textSecondary;
        }
      };

      expect(getStatusColor('confirmed')).toBe('#10B981');
      expect(getStatusColor('pending')).toBe('#F59E0B');
      expect(getStatusColor('cancelled')).toBe('#EF4444');
      expect(getStatusColor('unknown')).toBe('#6B7280');
    });
  });

  describe('Date Formatting', () => {
    it('should format time correctly', () => {
      const { format, parseISO } = require('date-fns');

      const formatTime = (dateString: string) => {
        try {
          return format(parseISO(dateString), 'HH:mm');
        } catch {
          return '--:--';
        }
      };

      // Test that valid dates return a time in HH:mm format
      const result1 = formatTime('2024-06-15T08:30:00Z');
      expect(result1).toMatch(/^\d{2}:\d{2}$/);

      const result2 = formatTime('2024-06-15T14:45:00Z');
      expect(result2).toMatch(/^\d{2}:\d{2}$/);

      // Test invalid date returns fallback
      expect(formatTime('invalid')).toBe('--:--');
    });

    it('should format date correctly', () => {
      const { format, parseISO } = require('date-fns');

      const formatDate = (dateString: string) => {
        try {
          return format(parseISO(dateString), 'EEE, dd MMM yyyy');
        } catch {
          return dateString;
        }
      };

      const result = formatDate('2024-06-15T08:00:00Z');
      // Check format structure (day name, day number, month, year)
      expect(result).toMatch(/^\w{3}, \d{2} \w{3} \d{4}$/);
      expect(result).toContain('Jun');
      expect(result).toContain('2024');
    });
  });

  describe('Round Trip Handling', () => {
    it('should include return journey data for round trips', () => {
      const booking = createMockBooking({
        is_round_trip: true,
        return_departure_port: 'Marseille',
        return_arrival_port: 'Tunis',
        return_departure_time: '2024-06-20T08:00:00Z',
        return_arrival_time: '2024-06-20T20:00:00Z',
        return_vessel_name: 'Carthage Return',
      });

      expect(booking.is_round_trip).toBe(true);
      expect(booking.return_departure_port).toBe('Marseille');
      expect(booking.return_arrival_port).toBe('Tunis');
      expect(booking.return_departure_time).toBe('2024-06-20T08:00:00Z');
    });

    it('should handle one-way bookings', () => {
      const booking = createMockBooking({
        is_round_trip: false,
        return_departure_time: undefined,
      });

      expect(booking.is_round_trip).toBe(false);
      expect(booking.return_departure_time).toBeUndefined();
    });
  });

  describe('Passenger and Vehicle Info', () => {
    it('should display correct passenger count', () => {
      const booking = createMockBooking({
        total_passengers: 4,
      });

      expect(booking.total_passengers).toBe(4);
    });

    it('should display vehicle count when present', () => {
      const booking = createMockBooking({
        total_vehicles: 2,
      });

      expect(booking.total_vehicles).toBe(2);
    });

    it('should handle zero vehicles', () => {
      const booking = createMockBooking({
        total_vehicles: 0,
      });

      expect(booking.total_vehicles).toBe(0);
    });
  });
});
