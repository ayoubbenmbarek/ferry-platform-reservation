import { bookingService } from '../../services/bookingService';
import api from '../../services/api';
import {
  createMockBooking,
  createMockPassenger,
  createMockPaymentIntent,
} from '../../test-utils/testUtils';

// Mock the api module
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
  },
  getErrorMessage: (error: any) => {
    if (error instanceof Error) return error.message;
    if (error?.response?.data?.detail) return error.response.data.detail;
    if (error?.message) return error.message;
    return 'An error occurred';
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('bookingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createBooking', () => {
    it('should create booking successfully', async () => {
      const mockBooking = createMockBooking();
      (mockedApi.post as jest.Mock).mockResolvedValueOnce({ data: mockBooking });

      const bookingData = {
        sailing_id: 'sail-123',
        operator: 'CTN',
        contact_info: {
          email: 'test@example.com',
          phone: '+1234567890',
          first_name: 'John',
          last_name: 'Doe',
        },
        passengers: [
          {
            type: 'adult' as const,
            first_name: 'John',
            last_name: 'Doe',
            date_of_birth: '1990-01-01',
            nationality: 'US',
          },
        ],
      };

      const result = await bookingService.createBooking(bookingData);

      expect(mockedApi.post).toHaveBeenCalledWith('/bookings/', bookingData);
      expect(result).toEqual(mockBooking);
    });

    it('should throw error on booking creation failure', async () => {
      (mockedApi.post as jest.Mock).mockRejectedValueOnce(
        new Error('No available seats')
      );

      await expect(
        bookingService.createBooking({
          sailing_id: 'sail-123',
          operator: 'CTN',
          contact_info: {
            email: 'test@example.com',
            first_name: 'John',
            last_name: 'Doe',
          },
          passengers: [],
        })
      ).rejects.toThrow('No available seats');
    });
  });

  describe('getBooking', () => {
    it('should get booking by ID', async () => {
      const mockBooking = createMockBooking();
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockBooking });

      const result = await bookingService.getBooking(1);

      expect(mockedApi.get).toHaveBeenCalledWith('/bookings/1');
      expect(result).toEqual(mockBooking);
    });

    it('should throw error when booking not found', async () => {
      (mockedApi.get as jest.Mock).mockRejectedValueOnce(new Error('Booking not found'));

      await expect(bookingService.getBooking(999)).rejects.toThrow('Booking not found');
    });
  });

  describe('getBookingByReference', () => {
    it('should get booking by reference and email', async () => {
      const mockBooking = createMockBooking();
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockBooking });

      const result = await bookingService.getBookingByReference(
        'BK123456',
        'test@example.com'
      );

      expect(mockedApi.get).toHaveBeenCalledWith('/bookings/lookup/BK123456', {
        params: { email: 'test@example.com' },
      });
      expect(result).toEqual(mockBooking);
    });
  });

  describe('listBookings', () => {
    it('should list user bookings with pagination', async () => {
      const mockBookings = [createMockBooking(), createMockBooking({ id: 2 })];
      const mockResponse = {
        bookings: mockBookings,
        total: 2,
        page: 1,
        limit: 10,
      };
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockResponse });

      const result = await bookingService.listBookings(1, 10);

      expect(mockedApi.get).toHaveBeenCalledWith('/bookings/', {
        params: { page: 1, limit: 10 },
      });
      expect(result.bookings).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should use default pagination values', async () => {
      const mockResponse = { bookings: [], total: 0, page: 1, limit: 10 };
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockResponse });

      await bookingService.listBookings();

      expect(mockedApi.get).toHaveBeenCalledWith('/bookings/', {
        params: { page: 1, limit: 10 },
      });
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking successfully', async () => {
      const mockCancelledBooking = createMockBooking({ status: 'cancelled' });
      (mockedApi.post as jest.Mock).mockResolvedValueOnce({ data: mockCancelledBooking });

      const result = await bookingService.cancelBooking(1, { reason: 'Changed plans' });

      expect(mockedApi.post).toHaveBeenCalledWith('/bookings/1/cancel', {
        reason: 'Changed plans',
      });
      expect(result.status).toBe('cancelled');
    });

    it('should cancel booking without reason', async () => {
      const mockCancelledBooking = createMockBooking({ status: 'cancelled' });
      (mockedApi.post as jest.Mock).mockResolvedValueOnce({ data: mockCancelledBooking });

      await bookingService.cancelBooking(1);

      expect(mockedApi.post).toHaveBeenCalledWith('/bookings/1/cancel', {});
    });
  });

  describe('getBookingStatus', () => {
    it('should get booking status', async () => {
      const mockStatus = { status: 'confirmed', message: 'Booking is confirmed' };
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockStatus });

      const result = await bookingService.getBookingStatus(1);

      expect(mockedApi.get).toHaveBeenCalledWith('/bookings/1/status');
      expect(result).toEqual(mockStatus);
    });
  });

  describe('quickUpdateBooking', () => {
    it('should update booking passengers', async () => {
      const mockBooking = createMockBooking();
      (mockedApi.put as jest.Mock).mockResolvedValueOnce({ data: mockBooking });

      const passengers = [createMockPassenger()];
      const result = await bookingService.quickUpdateBooking(1, { passengers });

      expect(mockedApi.put).toHaveBeenCalledWith('/bookings/1/quick-update', {
        passengers,
      });
      expect(result).toEqual(mockBooking);
    });
  });

  describe('applyPromoCode', () => {
    it('should apply promo code successfully', async () => {
      const mockResponse = { discount: 20, new_total: 330 };
      (mockedApi.post as jest.Mock).mockResolvedValueOnce({ data: mockResponse });

      const result = await bookingService.applyPromoCode(1, 'SAVE20');

      expect(mockedApi.post).toHaveBeenCalledWith('/bookings/1/apply-promo', {
        promo_code: 'SAVE20',
      });
      expect(result.discount).toBe(20);
    });

    it('should throw error for invalid promo code', async () => {
      (mockedApi.post as jest.Mock).mockRejectedValueOnce(
        new Error('Invalid promo code')
      );

      await expect(
        bookingService.applyPromoCode(1, 'INVALID')
      ).rejects.toThrow('Invalid promo code');
    });
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent successfully', async () => {
      const mockPaymentIntent = createMockPaymentIntent();
      (mockedApi.post as jest.Mock).mockResolvedValueOnce({ data: mockPaymentIntent });

      const result = await bookingService.createPaymentIntent(1, 385);

      expect(mockedApi.post).toHaveBeenCalledWith('/payments/create-intent', {
        booking_id: 1,
        amount: 385,
        currency: 'EUR',
        payment_method: 'credit_card',
        is_upgrade: false,
        metadata: undefined,
      });
      expect(result.payment_intent_id).toBe('pi_test_123456');
    });

    it('should use custom currency', async () => {
      const mockPaymentIntent = createMockPaymentIntent({ currency: 'USD' });
      (mockedApi.post as jest.Mock).mockResolvedValueOnce({ data: mockPaymentIntent });

      const result = await bookingService.createPaymentIntent(1, 400, 'USD');

      expect(mockedApi.post).toHaveBeenCalledWith('/payments/create-intent', {
        booking_id: 1,
        amount: 400,
        currency: 'USD',
        payment_method: 'credit_card',
        is_upgrade: false,
        metadata: undefined,
      });
    });
  });

  describe('confirmPayment', () => {
    it('should confirm payment successfully', async () => {
      const mockBooking = createMockBooking({ status: 'confirmed' });
      (mockedApi.post as jest.Mock).mockResolvedValueOnce({ data: mockBooking });

      const result = await bookingService.confirmPayment(1, 'pi_test_123');

      expect(mockedApi.post).toHaveBeenCalledWith('/payments/confirm/pi_test_123');
      expect(result.success).toBe(true);
      expect(result.booking).toEqual(mockBooking);
    });

    it('should throw error on payment failure', async () => {
      (mockedApi.post as jest.Mock).mockRejectedValueOnce(
        new Error('Payment declined')
      );

      await expect(
        bookingService.confirmPayment(1, 'pi_test_123')
      ).rejects.toThrow('Payment declined');
    });
  });

  describe('getInvoice', () => {
    it('should get invoice as blob', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockBlob });

      const result = await bookingService.getInvoice(1);

      expect(mockedApi.get).toHaveBeenCalledWith('/bookings/1/invoice', {
        responseType: 'blob',
      });
      expect(result).toBeInstanceOf(Blob);
    });
  });
});
