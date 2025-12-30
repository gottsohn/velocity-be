.PHONY: all run run-backend run-frontend install build clean help

# Default target
all: install

# Install all dependencies
install:
	@echo "📦 Installing Go dependencies..."
	go mod tidy
	@echo "📦 Installing frontend dependencies..."
	cd www && npm install
	@echo "✅ All dependencies installed!"

# Run both backend and frontend
run:
	@echo "🚀 Starting Velocity..."
	@make run-backend &
	@sleep 2
	@make run-frontend

# Run backend only
run-backend:
	@echo "🔧 Starting Go backend on port 8080..."
	go run main.go

# Run frontend only  
run-frontend:
	@echo "🌐 Starting React frontend on port 3000..."
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

# Development with hot reload
dev:
	@echo "🔥 Starting development mode..."
	@trap 'kill 0' EXIT; \
	(go run main.go) & \
	(cd www && npm run dev) & \
	wait

# Help
help:
	@echo "Velocity - Real-time Drive Streaming"
	@echo ""
	@echo "Available commands:"
	@echo "  make install      - Install all dependencies"
	@echo "  make run          - Run backend and frontend"
	@echo "  make run-backend  - Run backend only"
	@echo "  make run-frontend - Run frontend only"
	@echo "  make dev          - Run both in development mode"
	@echo "  make build        - Build both backend and frontend"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make help         - Show this help message"
