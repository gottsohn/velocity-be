package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"velocity-be/config"
	"velocity-be/db"
	"velocity-be/handlers"
	"velocity-be/hub"

	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	config.Load()

	// Set Gin mode
	gin.SetMode(config.AppConfig.GinMode)

	// Connect to MongoDB
	if err := db.Connect(); err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer db.Disconnect()

	// Create WebSocket hub
	wsHub := hub.NewHub()
	go wsHub.Run()

	// Setup router
	router := gin.Default()

	// CORS middleware
	router.Use(corsMiddleware())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "healthy"})
	})

	// API routes
	api := router.Group("/api")
	{
		// Stream management
		api.POST("/streams", handlers.CreateStreamHandler)
		api.GET("/streams/:streamId", handlers.GetStreamHandler)
		api.DELETE("/streams/:streamId", handlers.DeleteStreamHandler(wsHub))
	}

	// WebSocket routes
	ws := router.Group("/ws")
	{
		// Mobile app connects here to broadcast
		ws.GET("/mobile/:streamId", handlers.MobileWebSocketHandler(wsHub))
		// Web viewers connect here to receive
		ws.GET("/viewer/:streamId", handlers.ViewerWebSocketHandler(wsHub))
	}

	// Graceful shutdown
	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit
		log.Println("Shutting down server...")
		db.Disconnect()
		os.Exit(0)
	}()

	// Start server
	port := config.AppConfig.Port
	log.Printf("Server starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		
		// Check if origin is allowed
		allowed := false
		for _, allowedOrigin := range config.AppConfig.CorsAllowedOrigins {
			if origin == allowedOrigin {
				allowed = true
				break
			}
		}

		if allowed || origin == "" {
			c.Header("Access-Control-Allow-Origin", origin)
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
