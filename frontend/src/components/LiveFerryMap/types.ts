/**
 * Types for LiveFerryMap components
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ActiveFerry {
  ferry_id: string;
  vessel_name: string;
  operator: string;
  mmsi?: string;  // Maritime Mobile Service Identity for live tracking
  imo?: string;   // International Maritime Organization number
  departure_port: string;
  arrival_port: string;
  departure_time: string;
  arrival_time: string;
  departure_coordinates: Coordinates;
  arrival_coordinates: Coordinates;
  route_duration_hours: number;
}

export interface FerryRoute {
  from: string;
  to: string;
  from_coords: Coordinates;
  to_coords: Coordinates;
}

export interface ActiveFerriesResponse {
  ferries: ActiveFerry[];
  timestamp: string;
  routes: FerryRoute[];
  ports: Record<string, Coordinates>;
}

export interface FerryPosition {
  ferry: ActiveFerry;
  position: Coordinates;
  heading: number;
  progress: number;
}

export interface LiveFerryMapProps {
  mode: 'homepage' | 'booking';
  bookingData?: {
    departure_port: string;
    arrival_port: string;
    departure_time: string;
    arrival_time: string;
  };
  height?: string;
}
