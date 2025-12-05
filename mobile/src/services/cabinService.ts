import api from './api';

export interface Cabin {
  id: number;
  name: string;
  description: string;
  cabin_type: string;
  bed_type: string;
  max_occupancy: number;
  has_private_bathroom: boolean;
  has_tv: boolean;
  has_minibar: boolean;
  has_air_conditioning: boolean;
  has_wifi: boolean;
  is_accessible: boolean;
  base_price: number;
  currency: string;
  cabin_number?: string;
  is_available: boolean;
  operator?: string;
}

export interface CabinSelection {
  cabinId: number;
  quantity: number;
  cabin: Cabin;
}

export interface AddCabinRequest {
  cabin_id: number;
  quantity: number;
  journey_type: 'outbound' | 'return';
}

export interface GetCabinsParams {
  cabin_type?: string;
  operator?: string;
  min_occupancy?: number;
  max_price?: number;
  is_available?: boolean;
}

class CabinService {
  private readonly basePath = '/cabins';

  /**
   * Get all available cabins with optional filters
   */
  async getCabins(params?: GetCabinsParams): Promise<Cabin[]> {
    const queryParams = new URLSearchParams();

    if (params?.cabin_type) {
      queryParams.append('cabin_type', params.cabin_type);
    }
    if (params?.operator) {
      queryParams.append('operator', params.operator);
    }
    if (params?.min_occupancy) {
      queryParams.append('min_occupancy', params.min_occupancy.toString());
    }
    if (params?.max_price) {
      queryParams.append('max_price', params.max_price.toString());
    }
    if (params?.is_available !== undefined) {
      queryParams.append('is_available', params.is_available.toString());
    }

    const queryString = queryParams.toString();
    const url = queryString ? `${this.basePath}?${queryString}` : this.basePath;

    const response = await api.get<Cabin[]>(url);
    return response.data;
  }

  /**
   * Get a specific cabin by ID
   */
  async getCabin(cabinId: number): Promise<Cabin> {
    const response = await api.get<Cabin>(`${this.basePath}/${cabinId}`);
    return response.data;
  }

  /**
   * Add a cabin to an existing booking
   * Uses the bookings endpoint which sends confirmation email with invoice
   */
  async addCabinToBooking(
    bookingId: number,
    cabinId: number,
    quantity: number,
    journeyType: 'outbound' | 'return',
    alertId?: number
  ): Promise<any> {
    // Use bookings endpoint which handles email sending
    const response = await api.post(`/bookings/${bookingId}/add-cabin`, {
      cabin_id: cabinId,
      quantity,
      journey_type: journeyType,
      alert_id: alertId,
    });
    return response.data;
  }

  /**
   * Get cabin type icon name
   */
  getCabinTypeIcon(cabinType: string): string {
    const icons: Record<string, string> = {
      inside: 'bed-outline',
      outside: 'sunny-outline',
      balcony: 'boat-outline',
      suite: 'star-outline',
      deluxe: 'diamond-outline',
    };
    return icons[cabinType.toLowerCase()] || 'bed-outline';
  }

  /**
   * Get cabin type display name
   */
  getCabinTypeName(cabinType: string): string {
    const names: Record<string, string> = {
      inside: 'Inside Cabin',
      outside: 'Outside Cabin',
      balcony: 'Balcony Cabin',
      suite: 'Suite',
      deluxe: 'Deluxe Suite',
    };
    return names[cabinType.toLowerCase()] || cabinType;
  }

  /**
   * Get amenities list from cabin
   */
  getAmenities(cabin: Cabin): string[] {
    const amenities: string[] = [];
    if (cabin.has_private_bathroom) amenities.push('Private Bathroom');
    if (cabin.has_tv) amenities.push('TV');
    if (cabin.has_minibar) amenities.push('Minibar');
    if (cabin.has_air_conditioning) amenities.push('A/C');
    if (cabin.has_wifi) amenities.push('WiFi');
    if (cabin.is_accessible) amenities.push('Accessible');
    return amenities;
  }
}

export const cabinService = new CabinService();
