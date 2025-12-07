/**
 * Port marker component for the ferry map
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import { Coordinates } from './types';

interface PortMarkerProps {
  code: string;
  name?: string;
  coordinates: Coordinates;
}

const PortMarker: React.FC<PortMarkerProps> = ({ code, name, coordinates }) => {
  return (
    <Marker
      coordinate={{
        latitude: coordinates.lat,
        longitude: coordinates.lng,
      }}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.markerContainer}>
        <View style={styles.marker} />
      </View>
      <Callout style={styles.callout}>
        <View>
          <Text style={styles.calloutTitle}>{name || code}</Text>
          <Text style={styles.calloutCode}>{code}</Text>
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
  marker: {
    width: 12,
    height: 12,
    backgroundColor: '#1e40af',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  callout: {
    width: 150,
    padding: 8,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#1f2937',
  },
  calloutCode: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
});

export default PortMarker;
