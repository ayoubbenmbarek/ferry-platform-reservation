/**
 * Hook for calculating ferry positions based on departure/arrival times
 */

import { useMemo } from 'react';
import { ActiveFerry, Coordinates, FerryPosition } from './types';

/**
 * Calculate progress of ferry along its route (0 to 1)
 */
export function calculateProgress(
  departureTime: string,
  arrivalTime: string,
  currentTime: Date = new Date()
): number {
  const departure = new Date(departureTime).getTime();
  const arrival = new Date(arrivalTime).getTime();
  const now = currentTime.getTime();

  const totalDuration = arrival - departure;
  const elapsed = now - departure;

  return Math.max(0, Math.min(1, elapsed / totalDuration));
}

/**
 * Interpolate position between two coordinates
 */
export function interpolatePosition(
  start: Coordinates,
  end: Coordinates,
  progress: number
): Coordinates {
  return {
    lat: start.lat + (end.lat - start.lat) * progress,
    lng: start.lng + (end.lng - start.lng) * progress,
  };
}

/**
 * Calculate heading angle in degrees (0-360) from start to end
 */
export function calculateHeading(start: Coordinates, end: Coordinates): number {
  const dLng = end.lng - start.lng;
  const dLat = end.lat - start.lat;

  // Calculate angle in radians, then convert to degrees
  let angle = Math.atan2(dLng, dLat) * (180 / Math.PI);

  // Normalize to 0-360
  if (angle < 0) {
    angle += 360;
  }

  return angle;
}

/**
 * Calculate ferry position for a single ferry
 */
export function calculateFerryPosition(ferry: ActiveFerry): FerryPosition {
  const progress = calculateProgress(ferry.departure_time, ferry.arrival_time);
  const position = interpolatePosition(
    ferry.departure_coordinates,
    ferry.arrival_coordinates,
    progress
  );
  const heading = calculateHeading(
    ferry.departure_coordinates,
    ferry.arrival_coordinates
  );

  return {
    ferry,
    position,
    heading,
    progress,
  };
}

/**
 * Hook to calculate positions for all active ferries
 */
export function useFerryPositions(ferries: ActiveFerry[]): FerryPosition[] {
  return useMemo(() => {
    return ferries.map(calculateFerryPosition);
  }, [ferries]);
}

export default useFerryPositions;
