/**
 * Route polyline component for showing ferry routes on the map
 */

import React from 'react';
import { Polyline, Tooltip } from 'react-leaflet';
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
  const positions: [number, number][] = [
    [route.from_coords.lat, route.from_coords.lng],
    [route.to_coords.lat, route.to_coords.lng],
  ];

  const color = isHighlighted ? '#7c3aed' : isActive ? '#3b82f6' : '#94a3b8';
  const weight = isHighlighted ? 4 : isActive ? 3 : 2;
  const opacity = isHighlighted ? 1 : isActive ? 0.8 : 0.4;
  const dashArray = isActive ? undefined : '5, 10';

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color,
        weight,
        opacity,
        dashArray,
      }}
    >
      <Tooltip sticky>
        <span className="text-sm">
          {route.from} → {route.to}
        </span>
      </Tooltip>
    </Polyline>
  );
};

export default RoutePolyline;
