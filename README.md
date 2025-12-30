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

- **Frontend**: http://localhost:3000/?stream=YOUR_STREAM_ID
- **Backend API**: http://localhost:8080

## API Endpoints

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/streams` | Create a new stream ID |
| GET | `/api/streams/:streamId` | Get stream info |
| DELETE | `/api/streams/:streamId` | Soft delete stream and close all connections |

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
    "navigationData": {},
    "currentLocation": {
      "latitude": 51.5074,
      "longitude": -0.1278
    },
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
    "endCity": "Oxford",
    "expectedDistanceKm": 100,
    "car": {
      "name": "Tesla",
      "model": "Model S",
      "horsePower": 670
    }
  }
}
```

### Viewer Count Update (to Mobile App)

```json
{
  "type": "viewer_count",
  "payload": {
    "streamId": "abc12345",
    "viewerCount": 5
  }
}
```

### Delete Stream Response

```json
// Success (200 OK)
{
  "message": "Stream deleted successfully",
  "streamId": "abc12345",
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
VITE_WS_URL=ws://localhost:8080
VITE_API_URL=http://localhost:8080
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
