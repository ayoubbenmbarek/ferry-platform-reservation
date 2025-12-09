/**
 * Hook for calculating ferry positions based on departure/arrival times
 */

import { useMemo } from 'react';
import { Coordinates, ActiveFerry, FerryPosition } from './types';

/**
 * Calculate the progress of a ferry journey (0 to 1)
 */
export function calculateProgress(departureTime: string, arrivalTime: string): number {
  const now = Date.now();
  const departure = new Date(departureTime).getTime();
  const arrival = new Date(arrivalTime).getTime();

  const totalDuration = arrival - departure;
  const elapsed = now - departure;

  // Clamp between 0 and 1
  return Math.max(0, Math.min(1, elapsed / totalDuration));
}

/**
 * Interpolate position between two coordinates based on progress
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
 * Calculate heading angle from start to end coordinates
 */
export function calculateHeading(start: Coordinates, end: Coordinates): number {
  const dLng = end.lng - start.lng;
  const dLat = end.lat - start.lat;

  // Calculate angle in degrees (0 = North, 90 = East, etc.)
  const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);

  // Normalize to 0-360
  return (angle + 360) % 360;
}

/**
 * Hook that calculates current positions for all active ferries
 */
export function useFerryPositions(ferries: ActiveFerry[]): FerryPosition[] {
  return useMemo(() => {
    return ferries.map((ferry) => {
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
    });
  }, [ferries]);
}
