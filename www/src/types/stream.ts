export interface Car {
  name: string;
  model: string;
  horsePower: number;
}

export interface CurrentLocation {
  latitude: number;
  longitude: number;
}

export interface StreamData {
  navigationData?: unknown;
  currentLocation: CurrentLocation;
  duration: number;
  distanceKm: number;
  maxSpeedKmh: number;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  expectedDuration: number;
  startAddressLine: string;
  startPostalCode: string;
  startCity: string;
  endAddressLine: string;
  endCity: string;
  expectedDistanceKm?: number;
  car: Car;
  isPaused: boolean;
}

export interface WebSocketMessage {
  type: 'stream_data' | 'viewer_count' | 'error' | 'stream_closed';
  payload: StreamData | { viewerCount: number } | { message: string };
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'closed';
