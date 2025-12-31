import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { StreamData } from '../types/stream';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

interface RouteMapProps {
  streamData: StreamData | null;
}

// Custom marker icons
const createPulseIcon = (color: string) => L.divIcon({
  className: 'custom-marker',
  html: `<div class="pulse-marker" style="background: ${color};"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const currentLocationIcon = createPulseIcon('#ff8c00');
const startIcon = createPulseIcon('#22c55e');
const endIcon = createPulseIcon('#ef4444');

// Component to handle map updates
function MapUpdater({ center }: { center: [number, number] | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.flyTo(center, map.getZoom(), {
        duration: 1,
      });
    }
  }, [center, map]);
  
  return null;
}

export function RouteMap({ streamData }: RouteMapProps) {
  const currentPosition = useMemo((): [number, number] | null => {
    if (!streamData?.currentLocation) return null;
    return [streamData.currentLocation.latitude, streamData.currentLocation.longitude];
  }, [streamData?.currentLocation]);

  const startPosition = useMemo((): [number, number] | null => {
    if (!streamData) return null;
    return [streamData.startLatitude, streamData.startLongitude];
  }, [streamData?.startLatitude, streamData?.startLongitude]);

  const endPosition = useMemo((): [number, number] | null => {
    if (!streamData) return null;
    return [streamData.endLatitude, streamData.endLongitude];
  }, [streamData?.endLatitude, streamData?.endLongitude]);

  // Use polyline from navigationData if available, otherwise fallback to straight line
  const routeLine = useMemo((): [number, number][] => {
    // If navigationData has a polyline, use it
    if (streamData?.navigationData?.polyline && streamData.navigationData.polyline.length > 0) {
      return streamData.navigationData.polyline;
    }
    // Fallback to simple straight line between start and end
    if (!startPosition || !endPosition) return [];
    return [startPosition, endPosition];
  }, [streamData?.navigationData?.polyline, startPosition, endPosition]);

  // Calculate traveled path
  // const traveledPath = useMemo((): [number, number][] => {
  //   if (!startPosition || !currentPosition) return [];
  //   return [startPosition, currentPosition];
  // }, [startPosition, currentPosition]);

  // Default center (will update when data comes in)
  const defaultCenter: [number, number] = currentPosition || startPosition || [51.505, -0.09];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={50}
      style={{ height: '100%', width: '100%', borderRadius: '12px' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <MapUpdater center={currentPosition} />
      
      {/* Route line (expected path) */}
      {routeLine.length > 0 && (
        <Polyline
          positions={routeLine}
          color="#3b82f6"
          weight={6}
          opacity={1}
        />
      )}
      
      {/* Traveled path */}
      {/* {traveledPath.length > 0 && (
        <Polyline
          positions={traveledPath}
          color="#ff8c00"
          weight={5}
          opacity={0.9}
        />
      )} */}
      
      {/* Start marker */}
      {/* {startPosition && (
        <Marker position={startPosition} icon={startIcon} />
      )} */}
      
      {/* End marker */}
      {endPosition && (
        <Marker position={endPosition} icon={endIcon} />
      )}
      
      {/* Current location marker */}
      {currentPosition && (
        <Marker position={currentPosition} icon={currentLocationIcon} />
      )}
    </MapContainer>
  );
}
