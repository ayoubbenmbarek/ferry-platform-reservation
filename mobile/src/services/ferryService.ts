import api, { getErrorMessage } from './api';
import { FerrySchedule, SearchParams, Port, Cabin, Meal } from '../types';

interface SearchResponse {
  outbound: FerrySchedule[];
  return?: FerrySchedule[];
}

interface DatePricesResponse {
  [date: string]: {
    min_price: number;
    available: boolean;
  };
}

export const ferryService = {
  // Search ferries
  async searchFerries(params: SearchParams): Promise<SearchResponse> {
    try {
      // Helper function to transform results
      const transformResults = (results: any[]): FerrySchedule[] => {
        return results.map((result: any) => ({
          id: result.sailing_id || result.id || `${result.operator}-${result.departure_time}`,
          sailing_id: result.sailing_id || result.id || `${result.operator}-${result.departure_time}`,
          operator: result.operator || 'Unknown',
          departure_port: result.departure_port,
          arrival_port: result.arrival_port,
          departure_time: result.departure_time,
          arrival_time: result.arrival_time,
          duration_minutes: result.duration_minutes || (result.duration_hours ? result.duration_hours * 60 : 0),
          vessel_name: result.vessel_name || result.vessel || 'Ferry',
          base_price: result.prices?.adult || result.base_price || result.price || 0,
          currency: result.currency || 'EUR',
          available_capacity: result.available_spaces?.passengers || result.available_capacity || result.available_seats || 100,
          vehicle_capacity: result.available_spaces?.vehicles || result.vehicle_capacity || 50,
          amenities: result.amenities || ['WiFi', 'Restaurant'],
        }));
      };

      // Search outbound
      const outboundResponse = await api.post('/ferries/search', {
        departure_port: params.departure_port,
        arrival_port: params.arrival_port,
        departure_date: params.departure_date,
        adults: params.adults || params.passengers || 1,
        children: params.children || 0,
        infants: params.infants || 0,
        vehicles: params.vehicles > 0 ? [{
          type: params.vehicle_type || 'car',
          length: 4.5,
          height: 1.8
        }] : [],
      });

      const outbound = transformResults(outboundResponse.data.results || []);
      console.log('[FerryService] Outbound results:', outbound.length);

      // Search return if return_date provided
      let returnSchedules: FerrySchedule[] = [];
      if (params.return_date) {
        // Use custom return ports if provided, otherwise swap outbound ports
        const returnDeparture = params.return_departure_port || params.arrival_port;
        const returnArrival = params.return_arrival_port || params.departure_port;
        console.log('[FerryService] Searching return trips:', returnDeparture, '->', returnArrival, 'on', params.return_date);
        const returnResponse = await api.post('/ferries/search', {
          departure_port: returnDeparture,
          arrival_port: returnArrival,
          departure_date: params.return_date,
          adults: params.adults || params.passengers || 1,
          children: params.children || 0,
          infants: params.infants || 0,
          vehicles: params.vehicles > 0 ? [{
            type: params.vehicle_type || 'car',
            length: 4.5,
            height: 1.8
          }] : [],
        });
        returnSchedules = transformResults(returnResponse.data.results || []);
        console.log('[FerryService] Return results:', returnSchedules.length);
      }

      return { outbound, return: returnSchedules };
    } catch (error) {
      console.error('[FerryService] Search error:', error);
      throw new Error(getErrorMessage(error));
    }
  },

  // Get ports
  async getPorts(): Promise<Port[]> {
    try {
      const response = await api.get<Port[]>('/ferries/ports');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Get routes (departure ports with their destinations)
  async getRoutes(): Promise<{ [departure: string]: string[] }> {
    try {
      const response = await api.get('/ferries/routes');
      // Transform backend routes response to mobile format
      const routes: { [departure: string]: string[] } = {};
      if (response.data.routes) {
        for (const route of response.data.routes) {
          const dep = route.departure_port;
          const arr = route.arrival_port;
          if (!routes[dep]) {
            routes[dep] = [];
          }
          if (!routes[dep].includes(arr)) {
            routes[dep].push(arr);
          }
        }
      }
      return routes;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Get operators
  async getOperators(): Promise<string[]> {
    try {
      const response = await api.get<string[]>('/ferries/operators');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Get schedule details
  async getScheduleDetails(sailingId: string): Promise<FerrySchedule> {
    try {
      const response = await api.get<FerrySchedule>(`/ferries/schedules/${sailingId}`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Get cabins for a sailing
  async getCabins(sailingId: string): Promise<Cabin[]> {
    try {
      const response = await api.get<Cabin[]>(`/ferries/schedules/${sailingId}/cabins`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Get all available cabins
  async getAllCabins(passengerCount: number = 1): Promise<Cabin[]> {
    try {
      const response = await api.get<any[]>('/cabins', {
        params: {
          is_available: true,
          min_occupancy: Math.min(passengerCount, 1),
        },
      });
      // Transform backend response to match mobile Cabin type
      return response.data.map(cabin => ({
        id: String(cabin.id),
        name: cabin.name,
        type: cabin.cabin_type || cabin.type || 'STANDARD',
        capacity: cabin.max_occupancy || cabin.capacity || 2,
        price: cabin.base_price ?? cabin.price ?? 0,
        available: cabin.is_available ? 10 : 0,
        amenities: [
          cabin.has_private_bathroom && 'Private Bathroom',
          cabin.has_tv && 'TV',
          cabin.has_wifi && 'WiFi',
          cabin.has_air_conditioning && 'Air Conditioning',
          cabin.has_minibar && 'Minibar',
        ].filter(Boolean) as string[],
      }));
    } catch (error) {
      // Return mock cabins if API fails
      console.warn('Failed to fetch cabins, using mock data');
      return [
        { id: '1', name: 'Reclining Seat', type: 'SEAT', capacity: 1, price: 0, available: 100, amenities: [] },
        { id: '2', name: 'Inside Cabin', type: 'INSIDE', capacity: 2, price: 45, available: 20, amenities: ['Private Bathroom'] },
        { id: '3', name: 'Outside Cabin', type: 'OUTSIDE', capacity: 2, price: 65, available: 15, amenities: ['Private Bathroom', 'Window'] },
        { id: '4', name: 'Balcony Cabin', type: 'BALCONY', capacity: 2, price: 95, available: 10, amenities: ['Private Bathroom', 'Balcony', 'Sea View'] },
        { id: '5', name: 'Suite', type: 'SUITE', capacity: 4, price: 150, available: 5, amenities: ['Private Bathroom', 'Living Area', 'Premium Amenities'] },
      ];
    }
  },

  // Get meals for a sailing
  async getMeals(sailingId: string): Promise<Meal[]> {
    try {
      const response = await api.get<Meal[]>(`/ferries/schedules/${sailingId}/meals`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Get all available meals
  async getAllMeals(): Promise<Meal[]> {
    try {
      const response = await api.get<any[]>('/meals', {
        params: {
          is_available: true,
        },
      });
      // Transform backend response to match mobile Meal type
      return response.data.map(meal => ({
        id: String(meal.id),
        name: meal.name,
        description: meal.description || '',
        price: meal.price ?? 0,
        category: meal.meal_type || meal.category || 'OTHER',
      }));
    } catch (error) {
      // Return mock meals if API fails
      console.warn('Failed to fetch meals, using mock data');
      return [
        { id: '1', name: 'Continental Breakfast', description: 'Fresh pastries, fruits, coffee and juice', price: 12, category: 'BREAKFAST' },
        { id: '2', name: 'Full English Breakfast', description: 'Eggs, bacon, sausage, beans, toast', price: 18, category: 'BREAKFAST' },
        { id: '3', name: 'Mediterranean Lunch', description: 'Grilled fish, salad, rice', price: 22, category: 'LUNCH' },
        { id: '4', name: 'Pasta Lunch', description: 'Fresh pasta with choice of sauce', price: 16, category: 'LUNCH' },
        { id: '5', name: 'Gourmet Dinner', description: '3-course meal with wine', price: 45, category: 'DINNER' },
        { id: '6', name: 'Captain\'s Dinner', description: 'Premium 4-course dining experience', price: 65, category: 'DINNER' },
        { id: '7', name: 'Snack Box', description: 'Sandwiches, chips, drink', price: 8, category: 'SNACK' },
        { id: '8', name: 'Seafood Buffet', description: 'All-you-can-eat seafood selection', price: 55, category: 'BUFFET' },
      ];
    }
  },

  // Get prices for date range (calendar view)
  async getDatePrices(
    departurePort: string,
    arrivalPort: string,
    startDate: string,
    endDate: string,
    passengers: number = 1
  ): Promise<DatePricesResponse> {
    try {
      const response = await api.get<DatePricesResponse>('/ferries/prices/calendar', {
        params: {
          departure_port: departurePort,
          arrival_port: arrivalPort,
          start_date: startDate,
          end_date: endDate,
          passengers,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Compare prices across operators
  async comparePrices(
    departurePort: string,
    arrivalPort: string,
    date: string,
    passengers: number = 1
  ): Promise<{ operator: string; price: number }[]> {
    try {
      const response = await api.get('/ferries/prices/compare', {
        params: {
          departure_port: departurePort,
          arrival_port: arrivalPort,
          date,
          passengers,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },
};
