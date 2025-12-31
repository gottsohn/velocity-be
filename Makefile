.PHONY: all run run-backend run-frontend install build clean help dev docker-build docker-up docker-down docker-logs test test-integration test-verbose

# Default target
all: install

# Install all dependencies
install:
	@echo "📦 Installing Go dependencies..."
	go mod tidy
	@echo "📦 Installing frontend dependencies..."
	cd www && npm install
	@echo "✅ All dependencies installed!"

# Run both backend and frontend (frontend proxies /api and /ws to backend)
run:
	@echo "🚀 Starting Velocity..."
	@echo "📡 Backend running on port 8080 (internal)"
	@echo "🌐 Frontend running on port 3000 (access here)"
	@echo "👉 Open http://localhost:3000/?stream=YOUR_STREAM_ID"
	@echo ""
	@make dev

# Run backend only
run-backend:
	@echo "🔧 Starting Go backend on port 8080..."
	go run main.go

# Run frontend only  
run-frontend:
	@echo "🌐 Starting React frontend on port 3000..."
	@echo "👉 API requests to /api/* are proxied to backend on port 8080"
	@echo "👉 WebSocket requests to /ws/* are proxied to backend on port 8080"
	cd www && npm run dev

# Build backend
build-backend:
	@echo "🔨 Building Go backend..."
	go build -o velocity-be main.go

# Build frontend
build-frontend:
	@echo "🔨 Building React frontend..."
	cd www && npm run build

# Build all
build: build-backend build-frontend
	@echo "✅ Build complete!"

# Clean build artifacts
clean:
	@echo "🧹 Cleaning..."
	rm -f velocity-be
	rm -rf www/dist
	rm -rf www/node_modules
	@echo "✅ Clean complete!"

# Development with hot reload - runs both on single port (3000)
# Backend runs on 8080, frontend proxies /api and /ws to it
dev:
	@echo "🔥 Starting development mode..."
	@echo ""
	@echo "┌─────────────────────────────────────────────────────┐"
	@echo "│  Access the app at: http://localhost:3000          │"
	@echo "│                                                     │"
	@echo "│  All routes served from port 3000:                 │"
	@echo "│    /api/*  → proxied to backend (port 8080)        │"
	@echo "│    /ws/*   → proxied to backend (port 8080)        │"
	@echo "│    /*      → served by frontend                    │"
	@echo "└─────────────────────────────────────────────────────┘"
	@echo ""
	@trap 'kill 0' EXIT; \
	(go run main.go) & \
	sleep 2 && \
	(cd www && npm run dev) & \
	wait

# Test commands
test:
	@echo "🧪 Running all tests..."
	go test ./... -v

test-integration:
	@echo "🧪 Running integration tests..."
	@echo "⚠️  Requires Docker to be running for testcontainers"
	go test ./tests/... -v -timeout 5m

test-short:
	@echo "🧪 Running tests (short mode)..."
	go test ./... -short

test-coverage:
	@echo "🧪 Running tests with coverage..."
	go test ./... -coverprofile=coverage.out
	go tool cover -html=coverage.out -o coverage.html
	@echo "📊 Coverage report generated: coverage.html"

# Docker commands
docker-build:
	@echo "🐳 Building Docker image..."
	docker build -t velocity .

docker-up:
	@echo "🐳 Starting with Docker Compose..."
	docker compose up -d --build
	@echo "✅ Velocity is running at http://localhost:8080"

docker-down:
	@echo "🐳 Stopping Docker containers..."
	docker compose down

docker-logs:
	@echo "📋 Docker logs..."
	docker compose logs -f

# Help
help:
	@echo "Velocity - Real-time Drive Streaming"
	@echo ""
	@echo "Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make install      - Install all dependencies"
	@echo "  make run          - Run backend and frontend (same as 'make dev')"
	@echo "  make run-backend  - Run backend only (port 8080)"
	@echo "  make run-frontend - Run frontend only (port 3000, proxies to 8080)"
	@echo "  make dev          - Run both in development mode"
	@echo "  make build        - Build both backend and frontend"
	@echo "  make clean        - Clean build artifacts"
	@echo ""
	@echo "Testing:"
	@echo "  make test             - Run all tests"
	@echo "  make test-integration - Run integration tests (requires Docker)"
	@echo "  make test-short       - Run tests in short mode"
	@echo "  make test-coverage    - Run tests with coverage report"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-up    - Start with Docker Compose"
	@echo "  make docker-down  - Stop Docker containers"
	@echo "  make docker-logs  - View Docker logs"
	@echo ""
	@echo "  make help         - Show this help message"
	@echo ""
	@echo "Development:"
	@echo "  Access app at http://localhost:3000"
	@echo "  Backend runs internally on port 8080"
	@echo "  Frontend proxies /api/* and /ws/* to backend"
	@echo ""
	@echo "Docker (Production):"
	@echo "  Access app at http://localhost:8080"
	@echo "  Set MONGODB_URI environment variable before running docker-up"
	@echo "  Example: MONGODB_URI='mongodb+srv://...' make docker-up"