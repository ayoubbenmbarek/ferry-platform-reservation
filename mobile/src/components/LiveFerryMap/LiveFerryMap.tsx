/**
 * LiveFerryMap - Interactive map showing ferry routes and real-time positions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import MapView, { PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

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

// Map center and zoom based on mode
const MAP_CONFIG = {
  homepage: {
    latitude: 38.5,
    longitude: 10.0,
    latitudeDelta: 15,
    longitudeDelta: 15,
  },
  booking: {
    latitude: 38.5,
    longitude: 10.0,
    latitudeDelta: 8,
    longitudeDelta: 8,
  },
};

const LiveFerryMap: React.FC<LiveFerryMapProps> = ({
  mode,
  bookingData,
  height = 400,
}) => {
  const [data, setData] = useState<ActiveFerriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [region, setRegion] = useState<Region>(MAP_CONFIG[mode]);

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

  // Fit map to booking route when in booking mode
  useEffect(() => {
    if (mode === 'booking' && bookingData && data?.ports) {
      const depPort = bookingData.departure_port.toUpperCase();
      const arrPort = bookingData.arrival_port.toUpperCase();
      const departure = data.ports[depPort];
      const arrival = data.ports[arrPort];

      if (departure && arrival) {
        const midLat = (departure.lat + arrival.lat) / 2;
        const midLng = (departure.lng + arrival.lng) / 2;
        const latDelta = Math.abs(departure.lat - arrival.lat) * 1.5;
        const lngDelta = Math.abs(departure.lng - arrival.lng) * 1.5;

        setRegion({
          latitude: midLat,
          longitude: midLng,
          latitudeDelta: Math.max(latDelta, 2),
          longitudeDelta: Math.max(lngDelta, 2),
        });
      }
    }
  }, [mode, bookingData, data?.ports]);

  // Get coordinates for booking mode
  const getBookingCoordinates = (): { departure?: Coordinates; arrival?: Coordinates } => {
    if (!bookingData || !data?.ports) return { departure: undefined, arrival: undefined };

    const depPort = bookingData.departure_port.toUpperCase();
    const arrPort = bookingData.arrival_port.toUpperCase();

    return {
      departure: data.ports[depPort],
      arrival: data.ports[arrPort],
    };
  };

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

  if (loading) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading ferry map...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#6b7280" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchActiveFerries}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        region={region}
        onRegionChangeComplete={setRegion}
        scrollEnabled={mode !== 'homepage'}
        zoomEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}
      >
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
      </MapView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.portDot} />
          <Text style={styles.legendText}>Port</Text>
        </View>
        <View style={styles.legendItem}>
          <Ionicons name="boat" size={16} color="#2563eb" />
          <Text style={styles.legendText}>Ferry</Text>
        </View>
        <Text style={styles.legendCount}>{displayData.ferries.length} active</Text>
      </View>

      {/* Last update indicator */}
      {lastUpdate && (
        <View style={styles.updateIndicator}>
          <Text style={styles.updateText}>
            Updated: {lastUpdate.toLocaleTimeString()}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  legend: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  portDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
  },
  legendText: {
    fontSize: 11,
    color: '#374151',
  },
  legendCount: {
    fontSize: 11,
    color: '#9ca3af',
  },
  updateIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  updateText: {
    fontSize: 10,
    color: '#6b7280',
  },
});

export default LiveFerryMap;
