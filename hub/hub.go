package hub

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"velocity-be/db"
	"velocity-be/models"

	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
)

// Client represents a connected WebSocket client
type Client struct {
	ID        string
	StreamID  string
	Conn      *websocket.Conn
	Send      chan []byte
	IsMobile  bool // true if this is the mobile app (broadcaster), false if viewer
	Hub       *Hub
	UserAgent string
	IPAddress string
	JoinLogID interface{}
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	// Registered clients grouped by stream ID
	Streams map[string]*StreamHub
	
	// Register requests from clients
	Register chan *Client
	
	// Unregister requests from clients
	Unregister chan *Client
	
	// Mutex for thread-safe access
	mu sync.RWMutex
}

// StreamHub manages clients for a specific stream
type StreamHub struct {
	StreamID   string
	Broadcaster *Client
	Viewers    map[*Client]bool
	mu         sync.RWMutex
}

// NewHub creates a new Hub instance
func NewHub() *Hub {
	return &Hub{
		Streams:    make(map[string]*StreamHub),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.registerClient(client)
		case client := <-h.Unregister:
			h.unregisterClient(client)
		}
	}
}

func (h *Hub) registerClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	streamHub, exists := h.Streams[client.StreamID]
	if !exists {
		streamHub = &StreamHub{
			StreamID: client.StreamID,
			Viewers:  make(map[*Client]bool),
		}
		h.Streams[client.StreamID] = streamHub
	}

	if client.IsMobile {
		streamHub.Broadcaster = client
		log.Printf("Mobile broadcaster registered for stream: %s", client.StreamID)
	} else {
		streamHub.mu.Lock()
		streamHub.Viewers[client] = true
		viewerCount := len(streamHub.Viewers)
		streamHub.mu.Unlock()

		// Log the join in the database
		go logStreamJoin(client)

		// Notify broadcaster about viewer count
		h.notifyBroadcasterViewerCount(streamHub, viewerCount)
		
		log.Printf("Viewer joined stream %s (total viewers: %d)", client.StreamID, viewerCount)
	}
}

func (h *Hub) unregisterClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	streamHub, exists := h.Streams[client.StreamID]
	if !exists {
		return
	}

	if client.IsMobile {
		streamHub.Broadcaster = nil
		log.Printf("Mobile broadcaster disconnected from stream: %s", client.StreamID)
		
		// Close all viewer connections when broadcaster leaves
		streamHub.mu.Lock()
		for viewer := range streamHub.Viewers {
			close(viewer.Send)
			delete(streamHub.Viewers, viewer)
		}
		streamHub.mu.Unlock()
	} else {
		streamHub.mu.Lock()
		if _, ok := streamHub.Viewers[client]; ok {
			delete(streamHub.Viewers, client)
			close(client.Send)
		}
		viewerCount := len(streamHub.Viewers)
		streamHub.mu.Unlock()

		// Log the leave in the database
		go logStreamLeave(client)

		// Notify broadcaster about viewer count
		h.notifyBroadcasterViewerCount(streamHub, viewerCount)
		
		log.Printf("Viewer left stream %s (total viewers: %d)", client.StreamID, viewerCount)
	}

	// Clean up empty stream hubs
	streamHub.mu.RLock()
	isEmpty := streamHub.Broadcaster == nil && len(streamHub.Viewers) == 0
	streamHub.mu.RUnlock()
	
	if isEmpty {
		delete(h.Streams, client.StreamID)
		log.Printf("Stream hub %s removed (no clients)", client.StreamID)
	}
}

func (h *Hub) notifyBroadcasterViewerCount(streamHub *StreamHub, count int) {
	if streamHub.Broadcaster == nil {
		return
	}

	msg := models.WebSocketMessage{
		Type: "viewer_count",
		Payload: models.ViewerCountUpdate{
			StreamID:    streamHub.StreamID,
			ViewerCount: count,
		},
	}

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling viewer count: %v", err)
		return
	}

	select {
	case streamHub.Broadcaster.Send <- data:
	default:
		log.Printf("Failed to send viewer count to broadcaster")
	}
}

// BroadcastToViewers sends data to all viewers of a stream
func (h *Hub) BroadcastToViewers(streamID string, data []byte) {
	h.mu.RLock()
	streamHub, exists := h.Streams[streamID]
	h.mu.RUnlock()

	if !exists {
		return
	}

	streamHub.mu.RLock()
	defer streamHub.mu.RUnlock()

	for viewer := range streamHub.Viewers {
		select {
		case viewer.Send <- data:
		default:
			// Client buffer full, skip
		}
	}
}

// GetViewerCount returns the number of viewers for a stream
func (h *Hub) GetViewerCount(streamID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if streamHub, exists := h.Streams[streamID]; exists {
		streamHub.mu.RLock()
		defer streamHub.mu.RUnlock()
		return len(streamHub.Viewers)
	}
	return 0
}

func logStreamJoin(client *Client) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	joinLog := models.StreamJoinLog{
		StreamID:  client.StreamID,
		JoinedAt:  time.Now(),
		UserAgent: client.UserAgent,
		IPAddress: client.IPAddress,
	}

	result, err := db.StreamJoinLogsCollection().InsertOne(ctx, joinLog)
	if err != nil {
		log.Printf("Error logging stream join: %v", err)
		return
	}
	client.JoinLogID = result.InsertedID
}

func logStreamLeave(client *Client) {
	if client.JoinLogID == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := time.Now()
	_, err := db.StreamJoinLogsCollection().UpdateOne(
		ctx,
		bson.M{"_id": client.JoinLogID},
		bson.M{"$set": bson.M{"leftAt": now}},
	)
	if err != nil {
		log.Printf("Error logging stream leave: %v", err)
	}
}
