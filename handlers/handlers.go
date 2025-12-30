package handlers

import (
	"context"
	"log"
	"net/http"
	"time"

	"velocity-be/db"
	"velocity-be/hub"
	"velocity-be/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// CreateStreamHandler generates a unique stream ID for mobile app
func CreateStreamHandler(c *gin.Context) {
	streamID := uuid.New().String()[:8] // Short 8-char ID for easy sharing

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	stream := models.Stream{
		StreamID:    streamID,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		IsActive:    true,
		ViewerCount: 0,
	}

	_, err := db.StreamsCollection().InsertOne(ctx, stream)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create stream"})
		return
	}

	c.JSON(http.StatusOK, models.StreamIDResponse{
		StreamID: streamID,
		Message:  "Stream created successfully",
	})
}

// GetStreamHandler returns stream info
func GetStreamHandler(c *gin.Context) {
	streamID := c.Param("streamId")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var stream models.Stream
	err := db.StreamsCollection().FindOne(ctx, bson.M{"streamId": streamID}).Decode(&stream)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}

	c.JSON(http.StatusOK, stream)
}

// MobileWebSocketHandler handles WebSocket connections from mobile app (broadcaster)
func MobileWebSocketHandler(h *hub.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		streamID := c.Param("streamId")
		if streamID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Stream ID required"})
			return
		}

		// Verify stream exists
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		var stream models.Stream
		err := db.StreamsCollection().FindOne(ctx, bson.M{"streamId": streamID}).Decode(&stream)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
			return
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}

		client := &hub.Client{
			ID:       uuid.New().String(),
			StreamID: streamID,
			Conn:     conn,
			Send:     make(chan []byte, 256),
			IsMobile: true,
			Hub:      h,
		}

		h.Register <- client

		go client.WritePump()
		go client.ReadPump(h)
	}
}

// ViewerWebSocketHandler handles WebSocket connections from web viewers
func ViewerWebSocketHandler(h *hub.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		streamID := c.Param("streamId")
		if streamID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Stream ID required"})
			return
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}

		client := &hub.Client{
			ID:        uuid.New().String(),
			StreamID:  streamID,
			Conn:      conn,
			Send:      make(chan []byte, 256),
			IsMobile:  false,
			Hub:       h,
			UserAgent: c.Request.UserAgent(),
			IPAddress: c.ClientIP(),
		}

		h.Register <- client

		go client.WritePump()
		go client.ReadPump(h)
	}
}
