/**
 * LiveFerryMap - Interactive map showing ferry routes and real-time positions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import PortMarker from './PortMarker';
import RoutePolyline from './RoutePolyline';
import FerryMarker from './FerryMarker';
import { useFerryPositions } from './useFerryPositions';
import {
  LiveFerryMapProps,
  ActiveFerriesResponse,
  Coordinates,
} from './types';
import api from '../../services/api';

// Fix Leaflet default marker icon issue
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Map center and zoom based on mode
const MAP_CONFIG = {
  homepage: {
    center: [38.5, 10.0] as [number, number], // Mediterranean Sea
    zoom: 5,
  },
  booking: {
    center: [38.5, 10.0] as [number, number],
    zoom: 6,
  },
};

// Component to auto-fit bounds for booking mode
const FitBounds: React.FC<{
  departure?: Coordinates;
  arrival?: Coordinates;
}> = ({ departure, arrival }) => {
  const map = useMap();

  useEffect(() => {
    if (departure && arrival) {
      const bounds = L.latLngBounds(
        [departure.lat, departure.lng],
        [arrival.lat, arrival.lng]
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, departure, arrival]);

  return null;
};

const LiveFerryMap: React.FC<LiveFerryMapProps> = ({
  mode,
  bookingData,
  height = '400px',
}) => {
  const [data, setData] = useState<ActiveFerriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch active ferries data
  const fetchActiveFerries = useCallback(async () => {
    try {
      const response = await api.get('/ferries/active-ferries');
      setData(response.data);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch active ferries:', err);
      setError('Unable to load ferry data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and refresh every 30 seconds
  useEffect(() => {
    fetchActiveFerries();
    const interval = setInterval(fetchActiveFerries, 30000);
    return () => clearInterval(interval);
  }, [fetchActiveFerries]);

  // Calculate ferry positions
  const ferryPositions = useFerryPositions(data?.ferries || []);

  // Get coordinates for booking mode
  const getBookingCoordinates = () => {
    if (!bookingData || !data?.ports) return { departure: undefined, arrival: undefined };

    const depPort = bookingData.departure_port.toUpperCase();
    const arrPort = bookingData.arrival_port.toUpperCase();

    return {
      departure: data.ports[depPort],
      arrival: data.ports[arrPort],
    };
  };

  const { departure, arrival } = getBookingCoordinates();

  // Filter routes and ferries for booking mode
  const getDisplayData = () => {
    if (mode === 'homepage') {
      return {
        routes: data?.routes || [],
        ferries: ferryPositions,
        highlightedRoute: null,
      };
    }

    // For booking mode, highlight the user's route
    const userRoute = bookingData
      ? {
          from: bookingData.departure_port.toUpperCase(),
          to: bookingData.arrival_port.toUpperCase(),
        }
      : null;

    return {
      routes: data?.routes || [],
      ferries: ferryPositions,
      highlightedRoute: userRoute,
    };
  };

  const displayData = getDisplayData();

  const config = MAP_CONFIG[mode];

  if (loading) {
    return (
      <div
        className="bg-gray-100 rounded-lg flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
          <p className="text-gray-500">Loading ferry map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="bg-gray-100 rounded-lg flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center text-gray-500">
          <p>{error}</p>
          <button
            onClick={fetchActiveFerries}
            className="mt-2 text-blue-600 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden shadow-lg" style={{ height }}>
      <MapContainer
        center={config.center}
        zoom={config.zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={mode === 'homepage' ? false : true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Fit bounds for booking mode */}
        {mode === 'booking' && departure && arrival && (
          <FitBounds departure={departure} arrival={arrival} />
        )}

        {/* Render routes */}
        {displayData.routes.map((route, index) => {
          const isHighlighted =
            displayData.highlightedRoute &&
            route.from === displayData.highlightedRoute.from &&
            route.to === displayData.highlightedRoute.to;

          const isActive = displayData.ferries.some(
            (fp) =>
              fp.ferry.departure_port === route.from &&
              fp.ferry.arrival_port === route.to
          );

          return (
            <RoutePolyline
              key={`${route.from}-${route.to}-${index}`}
              route={route}
              isActive={isActive}
              isHighlighted={isHighlighted || false}
            />
          );
        })}

        {/* Render port markers */}
        {data?.ports &&
          Object.entries(data.ports).map(([code, coords]) => (
            <PortMarker key={code} code={code} coordinates={coords} />
          ))}

        {/* Render ferry markers */}
        {displayData.ferries.map((ferryPosition) => {
          const isUserFerry =
            mode === 'booking' &&
            bookingData &&
            ferryPosition.ferry.departure_port ===
              bookingData.departure_port.toUpperCase() &&
            ferryPosition.ferry.arrival_port ===
              bookingData.arrival_port.toUpperCase();

          return (
            <FerryMarker
              key={ferryPosition.ferry.ferry_id}
              ferryPosition={ferryPosition}
              isUserFerry={isUserFerry}
            />
          );
        })}
      </MapContainer>

      {/* Legend and status */}
      <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-2 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-600 rounded-full" />
            <span>Port</span>
          </div>
          <div className="flex items-center gap-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#2563eb">
              <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z" />
            </svg>
            <span>Ferry</span>
          </div>
          <div className="text-gray-400">
            {displayData.ferries.length} active
          </div>
        </div>
      </div>

      {/* Last update indicator */}
      {lastUpdate && (
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md px-2 py-1 text-xs text-gray-500">
          Updated: {lastUpdate.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default LiveFerryMap;
