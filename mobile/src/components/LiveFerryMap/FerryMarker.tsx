/**
 * Ferry marker component showing ferry position on the map
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { FerryPosition } from './types';

interface FerryMarkerProps {
  ferryPosition: FerryPosition;
  isUserFerry?: boolean;
}

// Generate MarineTraffic URL for live tracking
const getMarineTrafficUrl = (mmsi?: string, imo?: string) => {
  if (mmsi) {
    return `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`;
  }
  if (imo) {
    return `https://www.marinetraffic.com/en/ais/details/ships/imo:${imo}`;
  }
  return null;
};

const FerryMarker: React.FC<FerryMarkerProps> = ({
  ferryPosition,
  isUserFerry = false,
}) => {
  const { ferry, position, heading, progress } = ferryPosition;
  const progressPercent = Math.round(progress * 100);

  const color = isUserFerry ? '#7c3aed' : '#2563eb';
  const size = isUserFerry ? 32 : 24;

  const marineTrafficUrl = getMarineTrafficUrl(ferry.mmsi, ferry.imo);

  const handleTrackLive = () => {
    if (marineTrafficUrl) {
      Linking.openURL(marineTrafficUrl);
    }
  };

  return (
    <Marker
      coordinate={{
        latitude: position.lat,
        longitude: position.lng,
      }}
      anchor={{ x: 0.5, y: 0.5 }}
      rotation={heading}
    >
      <View style={[styles.markerContainer, { width: size, height: size }]}>
        <Ionicons name="boat" size={size} color={color} />
      </View>
      <Callout style={styles.callout} onPress={handleTrackLive}>
        <View style={styles.calloutContent}>
          <View style={styles.headerRow}>
            <Text style={styles.vesselName}>{ferry.vessel_name}</Text>
            {ferry.mmsi && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>
          <Text style={styles.operator}>{ferry.operator}</Text>

          <View style={styles.routeInfo}>
            <Text style={styles.portText}>{ferry.departure_port}</Text>
            <Ionicons name="arrow-forward" size={12} color="#9ca3af" />
            <Text style={styles.portText}>{ferry.arrival_port}</Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${progressPercent}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{progressPercent}% complete</Text>
          </View>

          <View style={styles.timeInfo}>
            <Text style={styles.timeLabel}>
              Departed: {new Date(ferry.departure_time).toLocaleTimeString()}
            </Text>
            <Text style={styles.timeLabel}>
              ETA: {new Date(ferry.arrival_time).toLocaleTimeString()}
            </Text>
          </View>

          {/* Live Tracking Button */}
          {marineTrafficUrl && (
            <View style={styles.trackingButton}>
              <Ionicons name="locate" size={14} color="#ffffff" />
              <Text style={styles.trackingButtonText}>Track Live on MarineTraffic</Text>
            </View>
          )}

          {/* MMSI info */}
          {ferry.mmsi && (
            <Text style={styles.mmsiText}>MMSI: {ferry.mmsi}</Text>
          )}
        </View>
      </Callout>
    </Marker>
  );
};

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  callout: {
    width: 240,
  },
  calloutContent: {
    padding: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  vesselName: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#2563eb',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#15803d',
  },
  operator: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 8,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  portText: {
    fontWeight: '600',
    fontSize: 12,
    color: '#374151',
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
  },
  timeInfo: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  timeLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  trackingButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  mmsiText: {
    fontSize: 9,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 6,
  },
});

export default FerryMarker;
