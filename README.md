# Velocity - Real-time Drive Streaming

A real-time streaming application that allows mobile apps to stream driving data to web viewers.

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Mobile App     │────▶│   Go Backend     │────▶│   React Frontend │
│    (iOS/Android) │     │   (WebSocket)    │     │   (Mantine UI)   │
└──────────────────┘     └──────────────────┘     └──────────────────┘
        │                        │                        │
        │  1. Request Stream ID  │                        │
        │──────────────────────▶│                        │
        │◀──────────────────────│                        │
        │   Return Stream ID     │                        │
        │                        │                        │
        │  2. Connect WebSocket  │                        │
        │      (broadcaster)     │                        │
        │──────────────────────▶│                        │
        │                        │                        │
        │                        │  3. Connect WebSocket  │
        │                        │◀──────────────────────│
        │                        │      (viewer)          │
        │                        │                        │
        │  4. Stream Data        │  5. Broadcast Data    │
        │──────────────────────▶│──────────────────────▶│
        │                        │                        │
        │  6. Viewer Count       │                        │
        │◀──────────────────────│                        │
```

## Tech Stack

### Backend
- **Go** - High-performance backend
- **Gin** - HTTP web framework
- **Gorilla WebSocket** - WebSocket implementation
- **MongoDB** - Data persistence

### Frontend
- **React** - UI library
- **Mantine UI** - Component library with dark/light mode
- **Leaflet + OpenStreetMap** - Interactive maps
- **Vite** - Build tool

## Quick Start

### Prerequisites
- Go 1.21+
- Node.js 18+
- MongoDB running locally (or remote URI)

### Installation

```bash
# Install all dependencies
make install
```

### Running

```bash
# Run both backend and frontend in development mode
make dev
```

Or run separately:

```bash
# Terminal 1: Backend
make run-backend

# Terminal 2: Frontend  
make run-frontend
```

### Access

- **App URL**: http://localhost:3000/?stream=YOUR_STREAM_ID
- All requests go through port 3000:
  - `/api/*` → proxied to backend (port 8080)
  - `/ws/*` → proxied to backend (port 8080)
  - `/*` → served by frontend

## Docker Deployment

### Prerequisites
- Docker and Docker Compose installed
- MongoDB instance (local or remote like MongoDB Atlas)

### Quick Start with Docker

```bash
# Build and run with docker-compose
MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net" make docker-up
```

Or run directly with Docker:

```bash
# Build the image
docker build -t velocity .

# Run the container
docker run -d \
  --name velocity \
  -p 8080:8080 \
  -e MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net" \
  -e MONGODB_DATABASE="velocity" \
  -e CORS_ALLOWED_ORIGINS="https://yourdomain.com" \
  velocity
```

### Docker Commands

```bash
# Build and start
make docker-up

# Stop the container
make docker-down

# View logs
make docker-logs

# Rebuild without cache
make docker-build
```

### Access (Docker)

- **App URL**: http://localhost:8080/?stream=YOUR_STREAM_ID
- In production mode, the Go backend serves both the API and the static frontend:
  - `/api/*` → API endpoints
  - `/ws/*` → WebSocket endpoints
  - `/*` → Static frontend files

## API Endpoints

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/streams` | Create a new stream ID (64-char secure token) |
| GET | `/api/streams/:streamId` | Get stream info |
| DELETE | `/api/streams/:streamId` | Soft delete stream and close all connections |

> **Note:** Stream IDs are 64-character cryptographically secure tokens generated using `crypto/rand`.

### WebSocket Endpoints

| Endpoint | Description |
|----------|-------------|
| `/ws/mobile/:streamId` | Mobile app connects here to broadcast |
| `/ws/viewer/:streamId` | Web viewers connect here to receive |

## Data Format

### Stream Data (from Mobile App)

```json
{
  "type": "stream_data",
  "payload": {
    "navigationData": {
      "polyline": [[51.5074, -0.1278], [51.5100, -0.1300], [51.7520, -1.2577]],
      "distance": 100.5,
      "expectedTravelTime": 3600
    },
    "currentLocation": {
      "latitude": 51.5074,
      "longitude": -0.1278
    },
    "currentSpeedKmh": 95.5,
    "duration": 1800,
    "distanceKm": 25.5,
    "maxSpeedKmh": 120,
    "startLatitude": 51.5074,
    "startLongitude": -0.1278,
    "endLatitude": 51.7520,
    "endLongitude": -1.2577,
    "expectedDuration": 3600,
    "startAddressLine": "123 Main St",
    "startPostalCode": "SW1A 1AA",
    "startCity": "London",
    "endAddressLine": "456 High St",
    "endPostalCode": "OX1 2JD",
    "endCity": "Oxford",
    "expectedDistanceKm": 100,
    "car": {
      "name": "Tesla",
      "model": "Model S",
      "horsePower": 670
    },
    "isPaused": false
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `navigationData` | object | Route navigation data (optional, cached when not sent) |
| `navigationData.polyline` | array | Array of `[lat, long]` coordinates representing the expected route |
| `navigationData.distance` | number | Total route distance in kilometers (e.g., `243.54`) |
| `navigationData.expectedTravelTime` | number | Expected travel time in seconds |
| `currentSpeedKmh` | number | Current speed in km/h (e.g., `95.5`) - displayed in real-time |
| `currentLocation` | object | Current GPS position with `latitude` and `longitude` |
| `isPaused` | boolean | When `true`, the frontend displays a "Stream Paused" overlay on the map |
| `startAddressLine`, `startPostalCode`, `startCity` | string | Start location details (cached when not sent) |
| `endAddressLine`, `endPostalCode`, `endCity` | string | Destination details (cached when not sent) |

> **Note:** Fields marked as "cached when not sent" will retain their last received value on the frontend. This allows the mobile app to send only changed data in subsequent updates.

### Viewer Count Update (to Mobile App)

```json
{
  "type": "viewer_count",
  "payload": {
    "streamId": "e7f3a9b1c5d2e8f4a0b6c1d7e2f8a3b9c4d0e5f1a6b2c8d3e9f4a1b7c2d8e3f9",
    "viewerCount": 5,
    "newUser": true
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `streamId` | string | The stream ID |
| `viewerCount` | number | Current number of viewers |
| `newUser` | boolean | `true` when a new user just joined, `false` when a user left |

### Delete Stream Response

```json
// Success (200 OK)
{
  "message": "Stream deleted successfully",
  "streamId": "e7f3a9b1c5d2e8f4a0b6c1d7e2f8a3b9c4d0e5f1a6b2c8d3e9f4a1b7c2d8e3f9",
  "deletedAt": "2025-12-30T10:30:00Z"
}

// Stream not found (404)
{ "error": "Stream not found" }

// Already deleted (400)
{ "error": "Stream already deleted" }

// Connecting to deleted stream (410 Gone)
{ "error": "Stream has been closed" }
```

## Environment Variables

### Backend (.env)

```env
PORT=8080
GIN_MODE=debug
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=velocity
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
ENV=development
```

### Frontend (www/.env)

```env
# Leave empty to use relative URLs (goes through Vite proxy)
# Only set these for production or custom deployments
VITE_WS_URL=
VITE_API_URL=
```

## Project Structure

```
velocity-be/
├── config/          # Configuration management
├── db/              # MongoDB connection
├── handlers/        # HTTP and WebSocket handlers
├── hub/             # WebSocket hub for managing connections
├── models/          # Data models
├── main.go          # Entry point
├── www/             # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom hooks
│   │   ├── pages/        # Page components
│   │   └── types/        # TypeScript types
│   └── ...
└── Makefile         # Build and run commands
```

## License

MIT
