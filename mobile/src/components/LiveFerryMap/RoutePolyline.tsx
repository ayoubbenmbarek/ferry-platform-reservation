/**
 * Route polyline component for showing ferry routes on the map
 */

import React from 'react';
import { Polyline } from 'react-native-maps';
import { FerryRoute } from './types';

interface RoutePolylineProps {
  route: FerryRoute;
  isActive?: boolean;
  isHighlighted?: boolean;
}

const RoutePolyline: React.FC<RoutePolylineProps> = ({
  route,
  isActive = false,
  isHighlighted = false,
}) => {
  const coordinates = [
    { latitude: route.from_coords.lat, longitude: route.from_coords.lng },
    { latitude: route.to_coords.lat, longitude: route.to_coords.lng },
  ];

  const strokeColor = isHighlighted ? '#7c3aed' : isActive ? '#3b82f6' : '#94a3b8';
  const strokeWidth = isHighlighted ? 4 : isActive ? 3 : 2;
  const lineDashPattern = isActive ? undefined : [5, 10];

  return (
    <Polyline
      coordinates={coordinates}
      strokeColor={strokeColor}
      strokeWidth={strokeWidth}
      lineDashPattern={lineDashPattern}
    />
  );
};

export default RoutePolyline;
