import { alertService } from '../../services/alertService';
import api from '../../services/api';
import { createMockAvailabilityAlert, createMockAlertStats } from '../../test-utils/testUtils';

// Mock the api module
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  getErrorMessage: (error: any) => {
    if (error instanceof Error) return error.message;
    if (error?.response?.data?.detail) return error.response.data.detail;
    if (error?.message) return error.message;
    return 'An error occurred';
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('alertService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAlert', () => {
    it('should create alert successfully', async () => {
      const mockAlert = createMockAvailabilityAlert();
      (mockedApi.post as jest.Mock).mockResolvedValueOnce({ data: mockAlert });

      const alertData = {
        alert_type: 'cabin' as const,
        email: 'test@example.com',
        departure_port: 'Tunis',
        arrival_port: 'Marseille',
        departure_date: '2024-06-15',
        is_round_trip: false,
        operator: 'CTN',
        sailing_time: '08:00',
        num_adults: 2,
        num_children: 1,
        num_infants: 0,
        alert_duration_days: 30,
      };

      const result = await alertService.createAlert(alertData);

      // The service adds default values to the data
      expect(mockedApi.post).toHaveBeenCalledWith('/availability-alerts', {
        ...alertData,
        is_round_trip: false,
        num_adults: 2,
        num_children: 1,
        num_infants: 0,
        num_cabins: 1,
        alert_duration_days: 30,
      });
      expect(result).toEqual(mockAlert);
    });

    it('should throw error on alert creation failure', async () => {
      (mockedApi.post as jest.Mock).mockRejectedValueOnce(
        new Error('Duplicate alert exists')
      );

      await expect(
        alertService.createAlert({
          alert_type: 'cabin',
          email: 'test@example.com',
          departure_port: 'Tunis',
          arrival_port: 'Marseille',
          departure_date: '2024-06-15',
          is_round_trip: false,
          operator: 'CTN',
          num_adults: 2,
          num_children: 0,
          num_infants: 0,
          alert_duration_days: 30,
        })
      ).rejects.toThrow('Duplicate alert exists');
    });
  });

  describe('getAlerts', () => {
    it('should get alerts without params', async () => {
      const mockAlerts = [createMockAvailabilityAlert(), createMockAvailabilityAlert({ id: 2 })];
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockAlerts });

      const result = await alertService.getAlerts();

      // URL is constructed without query params when none provided
      expect(mockedApi.get).toHaveBeenCalledWith('/availability-alerts');
      expect(result).toHaveLength(2);
    });

    it('should get alerts with email filter', async () => {
      const mockAlerts = [createMockAvailabilityAlert()];
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockAlerts });

      const result = await alertService.getAlerts({ email: 'test@example.com' });

      // URL includes email query param
      expect(mockedApi.get).toHaveBeenCalledWith(
        '/availability-alerts?email=test%40example.com'
      );
      expect(result).toHaveLength(1);
    });

    it('should get alerts with status filter', async () => {
      const mockAlerts = [createMockAvailabilityAlert({ status: 'notified' })];
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockAlerts });

      const result = await alertService.getAlerts({ status: 'notified' });

      // URL includes status query param
      expect(mockedApi.get).toHaveBeenCalledWith('/availability-alerts?status=notified');
      expect(result[0].status).toBe('notified');
    });
  });

  describe('getAlert', () => {
    it('should get alert by ID', async () => {
      const mockAlert = createMockAvailabilityAlert();
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockAlert });

      const result = await alertService.getAlert(1);

      expect(mockedApi.get).toHaveBeenCalledWith('/availability-alerts/1');
      expect(result).toEqual(mockAlert);
    });

    it('should throw error when alert not found', async () => {
      (mockedApi.get as jest.Mock).mockRejectedValueOnce(new Error('Alert not found'));

      await expect(alertService.getAlert(999)).rejects.toThrow('Alert not found');
    });
  });

  describe('updateAlert', () => {
    it('should update alert successfully', async () => {
      const mockAlert = createMockAvailabilityAlert({ status: 'cancelled' });
      (mockedApi.patch as jest.Mock).mockResolvedValueOnce({ data: mockAlert });

      const result = await alertService.updateAlert(1, { status: 'cancelled' });

      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/availability-alerts/1',
        { status: 'cancelled' }
      );
      expect(result.status).toBe('cancelled');
    });

    it('should update alert with email verification', async () => {
      const mockAlert = createMockAvailabilityAlert({ status: 'fulfilled' });
      (mockedApi.patch as jest.Mock).mockResolvedValueOnce({ data: mockAlert });

      await alertService.updateAlert(1, { status: 'fulfilled' }, 'test@example.com');

      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/availability-alerts/1?email=test%40example.com',
        { status: 'fulfilled' }
      );
    });
  });

  describe('deleteAlert', () => {
    it('should delete alert successfully', async () => {
      (mockedApi.delete as jest.Mock).mockResolvedValueOnce({});

      await expect(alertService.deleteAlert(1)).resolves.not.toThrow();

      expect(mockedApi.delete).toHaveBeenCalledWith('/availability-alerts/1');
    });

    it('should delete alert with email verification', async () => {
      (mockedApi.delete as jest.Mock).mockResolvedValueOnce({});

      await alertService.deleteAlert(1, 'test@example.com');

      expect(mockedApi.delete).toHaveBeenCalledWith(
        '/availability-alerts/1?email=test%40example.com'
      );
    });
  });

  describe('getAlertStats', () => {
    it('should get alert stats', async () => {
      const mockStats = createMockAlertStats();
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockStats });

      const result = await alertService.getAlertStats();

      expect(mockedApi.get).toHaveBeenCalledWith('/availability-alerts/stats/summary');
      expect(result.total_alerts).toBe(5);
      expect(result.active_alerts).toBe(3);
    });
  });

  describe('hasExistingAlert', () => {
    it('should return alert if exists', async () => {
      const mockAlert = createMockAvailabilityAlert();
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: [mockAlert] });

      const result = await alertService.hasExistingAlert(
        'test@example.com',
        'Tunis',
        'Marseille',
        '2024-06-15',
        'cabin'
      );

      expect(result).toEqual(mockAlert);
    });

    it('should return null if no matching alert', async () => {
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: [] });

      const result = await alertService.hasExistingAlert(
        'test@example.com',
        'Tunis',
        'Marseille',
        '2024-06-15',
        'cabin'
      );

      expect(result).toBeNull();
    });
  });

  describe('markAsFulfilled', () => {
    it('should mark alert as fulfilled', async () => {
      const mockAlert = createMockAvailabilityAlert({ status: 'fulfilled' });
      (mockedApi.patch as jest.Mock).mockResolvedValueOnce({ data: mockAlert });

      const result = await alertService.markAsFulfilled(1);

      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/availability-alerts/1',
        { status: 'fulfilled' }
      );
      expect(result.status).toBe('fulfilled');
    });
  });

  describe('cancelAlert', () => {
    it('should cancel alert by deleting it', async () => {
      (mockedApi.delete as jest.Mock).mockResolvedValueOnce({});

      await alertService.cancelAlert(1);

      expect(mockedApi.delete).toHaveBeenCalledWith('/availability-alerts/1');
    });

    it('should cancel alert with email by deleting it', async () => {
      (mockedApi.delete as jest.Mock).mockResolvedValueOnce({});

      await alertService.cancelAlert(1, 'test@example.com');

      expect(mockedApi.delete).toHaveBeenCalledWith(
        '/availability-alerts/1?email=test%40example.com'
      );
    });
  });
});
