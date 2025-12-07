/**
 * Port marker component for the ferry map
 */

import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Coordinates } from './types';

interface PortMarkerProps {
  code: string;
  name?: string;
  coordinates: Coordinates;
}

// Create a custom icon for ports
const portIcon = L.divIcon({
  className: 'port-marker',
  html: `
    <div style="
      width: 12px;
      height: 12px;
      background-color: #1e40af;
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>
  `,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const PortMarker: React.FC<PortMarkerProps> = ({ code, name, coordinates }) => {
  return (
    <Marker position={[coordinates.lat, coordinates.lng]} icon={portIcon}>
      <Popup>
        <div className="text-sm">
          <strong>{name || code}</strong>
          <br />
          <span className="text-gray-500">{code}</span>
        </div>
      </Popup>
    </Marker>
  );
};

export default PortMarker;
