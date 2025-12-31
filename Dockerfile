# Stage 1: Build the React frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /app/www

# Copy package files first for better caching
COPY www/package.json www/package-lock.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY www/ ./

# Build the frontend
RUN npm run build

# Stage 2: Build the Go backend
FROM golang:1.21-alpine AS backend-builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache gcc musl-dev

# Copy go mod files first for better caching
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o velocity-be .

# Stage 3: Final runtime image
FROM alpine:3.19

WORKDIR /app

# Install CA certificates for HTTPS connections (e.g., to MongoDB Atlas)
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user for security
RUN adduser -D -g '' appuser

# Copy the binary from backend builder
COPY --from=backend-builder /app/velocity-be .

# Copy the built frontend from frontend builder
COPY --from=frontend-builder /app/www/dist ./www/dist

# Change ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose the port
EXPOSE 8080

# Set default environment variables
ENV PORT=8080
ENV GIN_MODE=release
ENV ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the binary
CMD ["./velocity-be"]
