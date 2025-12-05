import { ferryService } from '../../services/ferryService';
import api from '../../services/api';
import {
  createMockFerrySchedule,
  createMockPort,
  createMockCabin,
  createMockMeal,
} from '../../test-utils/testUtils';

// Mock the api module
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
  getErrorMessage: (error: any) => {
    if (error instanceof Error) return error.message;
    if (error?.response?.data?.detail) return error.response.data.detail;
    if (error?.message) return error.message;
    return 'An error occurred';
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('ferryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchFerries', () => {
    it('should search outbound ferries successfully', async () => {
      const mockResults = [
        {
          sailing_id: 'sail-123',
          operator: 'CTN',
          departure_port: 'Tunis',
          arrival_port: 'Marseille',
          departure_time: '2024-06-15T08:00:00Z',
          arrival_time: '2024-06-15T20:00:00Z',
          duration_minutes: 720,
          vessel_name: 'Carthage',
          prices: { adult: 100 },
          available_spaces: { passengers: 200 },
        },
      ];

      (mockedApi.post as jest.Mock).mockResolvedValueOnce({
        data: { results: mockResults },
      });

      const result = await ferryService.searchFerries({
        departure_port: 'Tunis',
        arrival_port: 'Marseille',
        departure_date: '2024-06-15',
        adults: 2,
        children: 0,
        infants: 0,
        vehicles: 0,
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/ferries/search', expect.objectContaining({
        departure_port: 'Tunis',
        arrival_port: 'Marseille',
        departure_date: '2024-06-15',
        adults: 2,
      }));
      expect(result.outbound).toHaveLength(1);
      expect(result.outbound[0].operator).toBe('CTN');
    });

    it('should search round trip ferries', async () => {
      const outboundResults = [
        {
          sailing_id: 'out-123',
          operator: 'CTN',
          departure_port: 'Tunis',
          arrival_port: 'Marseille',
          departure_time: '2024-06-15T08:00:00Z',
          arrival_time: '2024-06-15T20:00:00Z',
          prices: { adult: 100 },
        },
      ];
      const returnResults = [
        {
          sailing_id: 'ret-123',
          operator: 'CTN',
          departure_port: 'Marseille',
          arrival_port: 'Tunis',
          departure_time: '2024-06-20T08:00:00Z',
          arrival_time: '2024-06-20T20:00:00Z',
          prices: { adult: 100 },
        },
      ];

      (mockedApi.post as jest.Mock)
        .mockResolvedValueOnce({ data: { results: outboundResults } })
        .mockResolvedValueOnce({ data: { results: returnResults } });

      const result = await ferryService.searchFerries({
        departure_port: 'Tunis',
        arrival_port: 'Marseille',
        departure_date: '2024-06-15',
        return_date: '2024-06-20',
        adults: 1,
        children: 0,
        infants: 0,
        vehicles: 0,
      });

      expect(mockedApi.post).toHaveBeenCalledTimes(2);
      expect(result.outbound).toHaveLength(1);
      expect(result.return).toHaveLength(1);
    });

    it('should include vehicle in search if vehicles > 0', async () => {
      (mockedApi.post as jest.Mock).mockResolvedValueOnce({ data: { results: [] } });

      await ferryService.searchFerries({
        departure_port: 'Tunis',
        arrival_port: 'Marseille',
        departure_date: '2024-06-15',
        adults: 1,
        children: 0,
        infants: 0,
        vehicles: 1,
        vehicle_type: 'motorcycle',
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/ferries/search', expect.objectContaining({
        vehicles: [expect.objectContaining({ type: 'motorcycle' })],
      }));
    });

    it('should throw error on search failure', async () => {
      (mockedApi.post as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        ferryService.searchFerries({
          departure_port: 'Tunis',
          arrival_port: 'Marseille',
          departure_date: '2024-06-15',
          adults: 1,
          children: 0,
          infants: 0,
          vehicles: 0,
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('getPorts', () => {
    it('should fetch ports successfully', async () => {
      const mockPorts = [
        createMockPort({ code: 'TUN', name: 'Tunis' }),
        createMockPort({ code: 'MRS', name: 'Marseille' }),
      ];
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockPorts });

      const result = await ferryService.getPorts();

      expect(mockedApi.get).toHaveBeenCalledWith('/ferries/ports');
      expect(result).toHaveLength(2);
    });
  });

  describe('getRoutes', () => {
    it('should fetch and transform routes', async () => {
      const mockRoutes = {
        routes: [
          { departure_port: 'Tunis', arrival_port: 'Marseille' },
          { departure_port: 'Tunis', arrival_port: 'Genoa' },
          { departure_port: 'Marseille', arrival_port: 'Tunis' },
        ],
      };
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockRoutes });

      const result = await ferryService.getRoutes();

      expect(mockedApi.get).toHaveBeenCalledWith('/ferries/routes');
      expect(result['Tunis']).toContain('Marseille');
      expect(result['Tunis']).toContain('Genoa');
      expect(result['Marseille']).toContain('Tunis');
    });
  });

  describe('getOperators', () => {
    it('should fetch operators', async () => {
      const mockOperators = ['CTN', 'Corsica Linea', 'GNV'];
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockOperators });

      const result = await ferryService.getOperators();

      expect(mockedApi.get).toHaveBeenCalledWith('/ferries/operators');
      expect(result).toEqual(mockOperators);
    });
  });

  describe('getScheduleDetails', () => {
    it('should fetch schedule details', async () => {
      const mockSchedule = createMockFerrySchedule();
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockSchedule });

      const result = await ferryService.getScheduleDetails('sail-123');

      expect(mockedApi.get).toHaveBeenCalledWith('/ferries/schedules/sail-123');
      expect(result).toEqual(mockSchedule);
    });
  });

  describe('getCabins', () => {
    it('should fetch cabins for sailing', async () => {
      const mockCabins = [createMockCabin(), createMockCabin({ id: 2, name: 'Suite' })];
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockCabins });

      const result = await ferryService.getCabins('sail-123');

      expect(mockedApi.get).toHaveBeenCalledWith('/ferries/schedules/sail-123/cabins');
      expect(result).toHaveLength(2);
    });
  });

  describe('getAllCabins', () => {
    it('should fetch all cabins with transformation', async () => {
      const mockApiCabins = [
        {
          id: 1,
          name: 'Standard',
          cabin_type: 'INSIDE',
          max_occupancy: 2,
          base_price: 80,
          is_available: true,
          has_private_bathroom: true,
          has_tv: true,
        },
      ];
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockApiCabins });

      const result = await ferryService.getAllCabins(2);

      expect(mockedApi.get).toHaveBeenCalledWith('/cabins', {
        params: { is_available: true, min_occupancy: 1 },
      });
      expect(result[0].name).toBe('Standard');
      expect(result[0].amenities).toContain('Private Bathroom');
    });

    it('should return mock cabins on API failure', async () => {
      (mockedApi.get as jest.Mock).mockRejectedValueOnce(new Error('API error'));

      const result = await ferryService.getAllCabins();

      expect(result).toHaveLength(5); // Mock returns 5 cabins
      expect(result[0].name).toBe('Reclining Seat');
    });
  });

  describe('getMeals', () => {
    it('should fetch meals for sailing', async () => {
      const mockMeals = [createMockMeal()];
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockMeals });

      const result = await ferryService.getMeals('sail-123');

      expect(mockedApi.get).toHaveBeenCalledWith('/ferries/schedules/sail-123/meals');
      expect(result).toHaveLength(1);
    });
  });

  describe('getAllMeals', () => {
    it('should fetch all meals with transformation', async () => {
      const mockApiMeals = [
        {
          id: 1,
          name: 'Breakfast',
          description: 'Continental',
          price: 15,
          meal_type: 'BREAKFAST',
        },
      ];
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockApiMeals });

      const result = await ferryService.getAllMeals();

      expect(mockedApi.get).toHaveBeenCalledWith('/meals', {
        params: { is_available: true },
      });
      expect(result[0].category).toBe('BREAKFAST');
    });

    it('should return mock meals on API failure', async () => {
      (mockedApi.get as jest.Mock).mockRejectedValueOnce(new Error('API error'));

      const result = await ferryService.getAllMeals();

      expect(result).toHaveLength(8); // Mock returns 8 meals
    });
  });

  describe('getDatePrices', () => {
    it('should fetch calendar prices', async () => {
      const mockPrices = {
        '2024-06-15': { min_price: 100, available: true },
        '2024-06-16': { min_price: 120, available: true },
        '2024-06-17': { min_price: 0, available: false },
      };
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockPrices });

      const result = await ferryService.getDatePrices(
        'Tunis',
        'Marseille',
        '2024-06-15',
        '2024-06-30',
        2
      );

      expect(mockedApi.get).toHaveBeenCalledWith('/ferries/prices/calendar', {
        params: {
          departure_port: 'Tunis',
          arrival_port: 'Marseille',
          start_date: '2024-06-15',
          end_date: '2024-06-30',
          passengers: 2,
        },
      });
      expect(result['2024-06-15'].min_price).toBe(100);
    });
  });

  describe('comparePrices', () => {
    it('should compare prices across operators', async () => {
      const mockComparison = [
        { operator: 'CTN', price: 100 },
        { operator: 'Corsica Linea', price: 110 },
      ];
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockComparison });

      const result = await ferryService.comparePrices(
        'Tunis',
        'Marseille',
        '2024-06-15',
        2
      );

      expect(mockedApi.get).toHaveBeenCalledWith('/ferries/prices/compare', {
        params: {
          departure_port: 'Tunis',
          arrival_port: 'Marseille',
          date: '2024-06-15',
          passengers: 2,
        },
      });
      expect(result).toHaveLength(2);
    });
  });
});
