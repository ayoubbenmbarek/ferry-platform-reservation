import api from './api';

// Types
export type PriceAlertStatus = 'active' | 'triggered' | 'paused' | 'expired' | 'cancelled';

export interface PriceAlert {
  id: number;
  email: string;
  departure_port: string;
  arrival_port: string;
  date_from?: string;
  date_to?: string;
  initial_price?: number;
  current_price?: number;
  lowest_price?: number;
  highest_price?: number;
  target_price?: number;
  best_price_date?: string;  // Date with the lowest price in the range
  notify_on_drop: boolean;
  notify_on_increase: boolean;
  notify_any_change: boolean;
  price_threshold_percent: number;
  status: PriceAlertStatus;
  last_checked_at?: string;
  last_notified_at?: string;
  notification_count: number;
  expires_at?: string;
  created_at: string;
  // Computed fields
  price_change_percent?: number;
  price_change_amount?: number;
}

export interface CreatePriceAlertRequest {
  email?: string; // Optional if authenticated
  departure_port: string;
  arrival_port: string;
  date_from?: string;
  date_to?: string;
  target_price?: number;
  notify_on_drop?: boolean;
  notify_on_increase?: boolean;
  notify_any_change?: boolean;
  price_threshold_percent?: number;
  initial_price?: number;
  expiration_days?: number;
}

export interface UpdatePriceAlertRequest {
  notify_on_drop?: boolean;
  notify_on_increase?: boolean;
  notify_any_change?: boolean;
  price_threshold_percent?: number;
  target_price?: number;
  status?: 'active' | 'paused' | 'cancelled';
}

export interface PriceAlertListResponse {
  routes: PriceAlert[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface PriceAlertStats {
  total_alerts: number;
  active_alerts: number;
  paused_alerts: number;
  triggered_alerts: number;
  routes_with_price_drops: number;
}

export interface CheckRouteResponse {
  is_saved: boolean;
  alert_id: number | null;
  status: PriceAlertStatus | null;
}

export interface GetPriceAlertsParams {
  email?: string;
  status?: PriceAlertStatus;
  page?: number;
  per_page?: number;
}

class PriceAlertService {
  private readonly basePath = '/price-alerts';

  /**
   * Create a new price alert (save a route)
   */
  async createAlert(data: CreatePriceAlertRequest): Promise<PriceAlert> {
    const response = await api.post<PriceAlert>(this.basePath, {
      ...data,
      notify_on_drop: data.notify_on_drop ?? true,
      notify_on_increase: data.notify_on_increase ?? true,  // Notify on both drop and increase
      notify_any_change: data.notify_any_change ?? false,
      price_threshold_percent: data.price_threshold_percent ?? 5.0,
    });
    return response.data;
  }

  /**
   * Get all saved routes (price alerts)
   */
  async getAlerts(params?: GetPriceAlertsParams): Promise<PriceAlertListResponse> {
    const queryParams = new URLSearchParams();

    if (params?.email) {
      queryParams.append('email', params.email);
    }
    if (params?.status) {
      queryParams.append('status', params.status);
    }
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.per_page) {
      queryParams.append('per_page', params.per_page.toString());
    }

    const queryString = queryParams.toString();
    const url = queryString ? `${this.basePath}?${queryString}` : this.basePath;

    const response = await api.get<PriceAlertListResponse>(url);
    return response.data;
  }

  /**
   * Get authenticated user's saved routes
   */
  async getMyRoutes(params?: { status?: PriceAlertStatus; page?: number; per_page?: number }): Promise<PriceAlertListResponse> {
    const queryParams = new URLSearchParams();

    if (params?.status) {
      queryParams.append('status', params.status);
    }
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.per_page) {
      queryParams.append('per_page', params.per_page.toString());
    }

    const queryString = queryParams.toString();
    const url = queryString ? `${this.basePath}/my-routes?${queryString}` : `${this.basePath}/my-routes`;

    const response = await api.get<PriceAlertListResponse>(url);
    return response.data;
  }

  /**
   * Get a specific price alert by ID
   */
  async getAlert(alertId: number): Promise<PriceAlert> {
    const response = await api.get<PriceAlert>(`${this.basePath}/${alertId}`);
    return response.data;
  }

  /**
   * Update a price alert
   */
  async updateAlert(alertId: number, data: UpdatePriceAlertRequest, email?: string): Promise<PriceAlert> {
    const queryParams = email ? `?email=${encodeURIComponent(email)}` : '';
    const response = await api.patch<PriceAlert>(
      `${this.basePath}/${alertId}${queryParams}`,
      data
    );
    return response.data;
  }

  /**
   * Delete/cancel a price alert
   */
  async deleteAlert(alertId: number, email?: string): Promise<void> {
    const queryParams = email ? `?email=${encodeURIComponent(email)}` : '';
    await api.delete(`${this.basePath}/${alertId}${queryParams}`);
  }

  /**
   * Pause a price alert
   */
  async pauseAlert(alertId: number): Promise<PriceAlert> {
    const response = await api.post<PriceAlert>(`${this.basePath}/${alertId}/pause`);
    return response.data;
  }

  /**
   * Resume a paused price alert
   */
  async resumeAlert(alertId: number): Promise<PriceAlert> {
    const response = await api.post<PriceAlert>(`${this.basePath}/${alertId}/resume`);
    return response.data;
  }

  /**
   * Check if a route is saved
   */
  async checkRouteSaved(departurePort: string, arrivalPort: string, email?: string): Promise<CheckRouteResponse> {
    const queryParams = email ? `?email=${encodeURIComponent(email)}` : '';
    const response = await api.get<CheckRouteResponse>(
      `${this.basePath}/check/${encodeURIComponent(departurePort)}/${encodeURIComponent(arrivalPort)}${queryParams}`
    );
    return response.data;
  }

  /**
   * Get price alert statistics
   */
  async getStats(): Promise<PriceAlertStats> {
    const response = await api.get<PriceAlertStats>(`${this.basePath}/stats/summary`);
    return response.data;
  }

  /**
   * Quick save a route with default settings
   */
  async quickSaveRoute(
    departurePort: string,
    arrivalPort: string,
    initialPrice?: number,
    email?: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<PriceAlert> {
    return this.createAlert({
      departure_port: departurePort,
      arrival_port: arrivalPort,
      initial_price: initialPrice,
      email,
      date_from: dateFrom,
      date_to: dateTo,
      notify_on_drop: true,
      notify_on_increase: true,
      price_threshold_percent: 5.0,
    });
  }

  /**
   * Save route with price drop notification
   */
  async saveRouteForPriceDrop(
    departurePort: string,
    arrivalPort: string,
    initialPrice: number,
    targetPrice?: number,
    email?: string
  ): Promise<PriceAlert> {
    return this.createAlert({
      departure_port: departurePort,
      arrival_port: arrivalPort,
      initial_price: initialPrice,
      target_price: targetPrice,
      email,
      notify_on_drop: true,
      notify_on_increase: false,
      price_threshold_percent: targetPrice ? 0 : 5.0, // If target price set, notify on any drop to that price
    });
  }
}

export const priceAlertService = new PriceAlertService();
