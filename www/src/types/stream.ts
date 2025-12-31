export interface Car {
  name: string;
  model: string;
  horsePower: number;
}

export interface CurrentLocation {
  latitude: number;
  longitude: number;
}

// NavigationData represents the expected route information
export interface NavigationData {
  polyline: [number, number][]; // Array of [lat, long] coordinates e.g. [[12.34, 14.656], [12.44, 15.666]]
  distance: number; // Distance in km e.g. 243.54
  expectedTravelTime: number; // Expected travel time in seconds
}

export interface StreamData {
  navigationData?: NavigationData;
  currentLocation: CurrentLocation;
  currentSpeedKmh: number; // Current speed in km/h e.g. 190.3
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
