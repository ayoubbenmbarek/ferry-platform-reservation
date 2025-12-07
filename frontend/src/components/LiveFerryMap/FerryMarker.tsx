/**
 * Ferry marker component showing ferry position on the map
 */

import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { FerryPosition } from './types';

interface FerryMarkerProps {
  ferryPosition: FerryPosition;
  isUserFerry?: boolean;
}

// Create ferry icon with rotation support
const createFerryIcon = (heading: number, isUserFerry: boolean) => {
  const color = isUserFerry ? '#7c3aed' : '#2563eb';
  const size = isUserFerry ? 32 : 24;

  return L.divIcon({
    className: 'ferry-marker',
    html: `
      <div style="
        transform: rotate(${heading}deg);
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg
          width="${size}"
          height="${size}"
          viewBox="0 0 24 24"
          fill="${color}"
          style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"
        >
          <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

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

// Generate VesselFinder URL as backup
const getVesselFinderUrl = (mmsi?: string) => {
  if (mmsi) {
    return `https://www.vesselfinder.com/vessels?mmsi=${mmsi}`;
  }
  return null;
};

const FerryMarker: React.FC<FerryMarkerProps> = ({
  ferryPosition,
  isUserFerry = false,
}) => {
  const { ferry, position, heading, progress } = ferryPosition;
  const icon = createFerryIcon(heading, isUserFerry);

  const progressPercent = Math.round(progress * 100);
  const marineTrafficUrl = getMarineTrafficUrl(ferry.mmsi, ferry.imo);
  const vesselFinderUrl = getVesselFinderUrl(ferry.mmsi);

  return (
    <Marker position={[position.lat, position.lng]} icon={icon}>
      <Popup>
        <div className="text-sm min-w-[220px]">
          <div className="flex items-center justify-between mb-1">
            <div className="font-bold text-blue-600">{ferry.vessel_name}</div>
            {ferry.mmsi && (
              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                LIVE
              </span>
            )}
          </div>
          <div className="text-gray-600 text-xs mb-2">{ferry.operator}</div>

          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium">{ferry.departure_port}</span>
            <span className="text-gray-400">→</span>
            <span className="font-medium">{ferry.arrival_port}</span>
          </div>

          <div className="bg-gray-100 rounded-full h-2 mb-1">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 text-center">
            {progressPercent}% complete
          </div>

          <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
            <div>
              Departed: {new Date(ferry.departure_time).toLocaleTimeString()}
            </div>
            <div>ETA: {new Date(ferry.arrival_time).toLocaleTimeString()}</div>
          </div>

          {/* Live Tracking Links */}
          {(marineTrafficUrl || vesselFinderUrl) && (
            <div className="mt-3 pt-2 border-t border-gray-200 flex gap-2">
              {marineTrafficUrl && (
                <a
                  href={marineTrafficUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center text-xs bg-emerald-600 text-white py-2 px-3 rounded-md font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  🛰️ Track Live
                </a>
              )}
              {vesselFinderUrl && (
                <a
                  href={vesselFinderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center text-xs bg-orange-500 text-white py-2 px-3 rounded-md font-semibold hover:bg-orange-600 transition-colors shadow-sm"
                >
                  📍 VesselFinder
                </a>
              )}
            </div>
          )}

          {/* MMSI info for debugging */}
          {ferry.mmsi && (
            <div className="mt-2 text-[10px] text-gray-400 text-center">
              MMSI: {ferry.mmsi}
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
};

export default FerryMarker;
