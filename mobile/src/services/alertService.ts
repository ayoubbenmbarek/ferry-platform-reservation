import api from './api';

// Types
export type AlertType = 'vehicle' | 'cabin' | 'passenger';
export type AlertStatus = 'active' | 'notified' | 'expired' | 'cancelled' | 'fulfilled';
export type JourneyType = 'outbound' | 'return';

export interface AvailabilityAlert {
  id: number;
  user_id?: number;
  email: string;
  alert_type: AlertType;
  departure_port: string;
  arrival_port: string;
  departure_date: string;
  is_round_trip: boolean;
  return_date?: string;
  operator?: string;
  sailing_time?: string;
  num_adults: number;
  num_children: number;
  num_infants: number;
  vehicle_type?: string;
  vehicle_length_cm?: number;
  cabin_type?: string;
  num_cabins?: number;
  booking_id?: number;
  journey_type?: JourneyType;
  status: AlertStatus;
  last_checked_at?: string;
  notified_at?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAlertRequest {
  alert_type: AlertType;
  email: string;
  departure_port: string;
  arrival_port: string;
  departure_date: string;
  is_round_trip?: boolean;
  return_date?: string;
  operator?: string;
  sailing_time?: string;
  num_adults?: number;
  num_children?: number;
  num_infants?: number;
  vehicle_type?: string;
  vehicle_length_cm?: number;
  cabin_type?: string;
  num_cabins?: number;
  booking_id?: number;
  journey_type?: JourneyType;
  alert_duration_days?: number;
}

export interface UpdateAlertRequest {
  status?: AlertStatus;
}

export interface AlertStats {
  total_alerts: number;
  active_alerts: number;
  notified_alerts: number;
  success_rate: number;
}

export interface GetAlertsParams {
  email?: string;
  status?: AlertStatus;
  limit?: number;
}

class AlertService {
  private readonly basePath = '/availability-alerts';

  /**
   * Create a new availability alert
   */
  async createAlert(data: CreateAlertRequest): Promise<AvailabilityAlert> {
    const response = await api.post<AvailabilityAlert>(this.basePath, {
      ...data,
      is_round_trip: data.is_round_trip ?? false,
      num_adults: data.num_adults ?? 1,
      num_children: data.num_children ?? 0,
      num_infants: data.num_infants ?? 0,
      num_cabins: data.num_cabins ?? 1,
      alert_duration_days: data.alert_duration_days ?? 30,
    });
    return response.data;
  }

  /**
   * Get all alerts for the current user or by email
   */
  async getAlerts(params?: GetAlertsParams): Promise<AvailabilityAlert[]> {
    const queryParams = new URLSearchParams();

    if (params?.email) {
      queryParams.append('email', params.email);
    }
    if (params?.status) {
      queryParams.append('status', params.status);
    }
    if (params?.limit) {
      queryParams.append('limit', params.limit.toString());
    }

    const queryString = queryParams.toString();
    const url = queryString ? `${this.basePath}?${queryString}` : this.basePath;

    const response = await api.get<AvailabilityAlert[]>(url);
    return response.data;
  }

  /**
   * Get a specific alert by ID
   */
  async getAlert(alertId: number): Promise<AvailabilityAlert> {
    const response = await api.get<AvailabilityAlert>(`${this.basePath}/${alertId}`);
    return response.data;
  }

  /**
   * Update an alert (e.g., change status)
   */
  async updateAlert(alertId: number, data: UpdateAlertRequest, email?: string): Promise<AvailabilityAlert> {
    const queryParams = email ? `?email=${encodeURIComponent(email)}` : '';
    const response = await api.patch<AvailabilityAlert>(
      `${this.basePath}/${alertId}${queryParams}`,
      data
    );
    return response.data;
  }

  /**
   * Cancel/delete an alert
   */
  async deleteAlert(alertId: number, email?: string): Promise<void> {
    const queryParams = email ? `?email=${encodeURIComponent(email)}` : '';
    await api.delete(`${this.basePath}/${alertId}${queryParams}`);
  }

  /**
   * Get alert statistics for the current user
   */
  async getAlertStats(): Promise<AlertStats> {
    const response = await api.get<AlertStats>(`${this.basePath}/stats/summary`);
    return response.data;
  }

  /**
   * Check if user has an existing active alert for a specific route/type
   */
  async hasExistingAlert(
    email: string,
    departurePort: string,
    arrivalPort: string,
    departureDate: string,
    alertType: AlertType
  ): Promise<AvailabilityAlert | null> {
    try {
      const alerts = await this.getAlerts({ email, status: 'active' });

      return alerts.find(
        (alert) =>
          alert.departure_port.toLowerCase() === departurePort.toLowerCase() &&
          alert.arrival_port.toLowerCase() === arrivalPort.toLowerCase() &&
          alert.departure_date === departureDate &&
          alert.alert_type === alertType
      ) || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if user has an existing active cabin alert for a booking
   */
  async hasExistingBookingAlert(
    email: string,
    bookingId: number,
    journeyType: JourneyType
  ): Promise<AvailabilityAlert | null> {
    try {
      const alerts = await this.getAlerts({ email, status: 'active' });

      return alerts.find(
        (alert) =>
          alert.booking_id === bookingId &&
          alert.journey_type === journeyType &&
          alert.alert_type === 'cabin'
      ) || null;
    } catch {
      return null;
    }
  }

  /**
   * Mark an alert as fulfilled (user completed the action)
   */
  async markAsFulfilled(alertId: number, email?: string): Promise<AvailabilityAlert> {
    return this.updateAlert(alertId, { status: 'fulfilled' }, email);
  }

  /**
   * Cancel an alert
   */
  async cancelAlert(alertId: number, email?: string): Promise<void> {
    await this.deleteAlert(alertId, email);
  }
}

export const alertService = new AlertService();
