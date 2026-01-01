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

		// Notify broadcaster about viewer count (newUser: true because a user just joined)
		h.notifyBroadcasterViewerCount(streamHub, viewerCount, true)
		
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

		// Notify broadcaster about viewer count (newUser: false because a user left)
		h.notifyBroadcasterViewerCount(streamHub, viewerCount, false)
		
		log.Printf("Viewer left stream %s (total viewers: %d)", client.StreamID, viewerCount)
	}

	// Clean up empty stream hubs
	streamHub.mu.RLock()
	isEmpty := streamHub.Broadcaster == nil && len(streamHub.Viewers) == 0
	streamHub.mu.RUnlock()
	
	if isEmpty {
		delete(h.Streams, client.StreamID)
		log.Printf("Stream hub %s removed (no clients)", client.StreamID)
		
		// Update LastConnectionAt in database when all clients disconnect
		go updateLastConnectionTime(client.StreamID)
	}
}

func (h *Hub) notifyBroadcasterViewerCount(streamHub *StreamHub, count int, newUser bool) {
	if streamHub.Broadcaster == nil {
		return
	}

	msg := models.WebSocketMessage{
		Type: "viewer_count",
		Payload: models.ViewerCountUpdate{
			StreamID:    streamHub.StreamID,
			ViewerCount: count,
			NewUser:     newUser,
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

// CloseStream closes all connections for a specific stream
func (h *Hub) CloseStream(streamID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	streamHub, exists := h.Streams[streamID]
	if !exists {
		return
	}

	log.Printf("Closing stream %s and disconnecting all clients", streamID)

	// Close broadcaster connection
	if streamHub.Broadcaster != nil {
		close(streamHub.Broadcaster.Send)
		streamHub.Broadcaster.Conn.Close()
		streamHub.Broadcaster = nil
	}

	// Close all viewer connections
	streamHub.mu.Lock()
	for viewer := range streamHub.Viewers {
		close(viewer.Send)
		viewer.Conn.Close()
		delete(streamHub.Viewers, viewer)
	}
	streamHub.mu.Unlock()

	// Remove the stream hub
	delete(h.Streams, streamID)
	log.Printf("Stream %s closed successfully", streamID)
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

func updateLastConnectionTime(streamID string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := time.Now()
	_, err := db.StreamsCollection().UpdateOne(
		ctx,
		bson.M{"streamId": streamID},
		bson.M{"$set": bson.M{"lastConnectionAt": now}},
	)
	if err != nil {
		log.Printf("Error updating last connection time for stream %s: %v", streamID, err)
	}
}

// InactiveStreamCleanupInterval is how often the cleanup job runs
const InactiveStreamCleanupInterval = 15 * time.Minute

// InactiveStreamTimeout is how long a stream can be without connections before auto-cancellation
const InactiveStreamTimeout = 6 * time.Hour

// StartInactiveStreamCleanup starts a background goroutine that periodically
// checks for and cancels streams that have had no connections for 6 hours
func (h *Hub) StartInactiveStreamCleanup(ctx context.Context) {
	ticker := time.NewTicker(InactiveStreamCleanupInterval)
	defer ticker.Stop()

	log.Printf("Starting inactive stream cleanup job (interval: %v, timeout: %v)", InactiveStreamCleanupInterval, InactiveStreamTimeout)

	for {
		select {
		case <-ctx.Done():
			log.Println("Stopping inactive stream cleanup job")
			return
		case <-ticker.C:
			h.cleanupInactiveStreams()
		}
	}
}

func (h *Hub) cleanupInactiveStreams() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cutoffTime := time.Now().Add(-InactiveStreamTimeout)

	// Find streams that:
	// 1. Are still active (isActive: true)
	// 2. Haven't been manually deleted (deletedAt: null)
	// 3. Have lastConnectionAt older than 6 hours OR lastConnectionAt is null and createdAt is older than 6 hours
	filter := bson.M{
		"isActive":  true,
		"deletedAt": nil,
		"$or": []bson.M{
			{"lastConnectionAt": bson.M{"$lt": cutoffTime}},
			{
				"lastConnectionAt": nil,
				"createdAt":        bson.M{"$lt": cutoffTime},
			},
		},
	}

	cursor, err := db.StreamsCollection().Find(ctx, filter)
	if err != nil {
		log.Printf("Error finding inactive streams: %v", err)
		return
	}
	defer cursor.Close(ctx)

	var streamsToCancel []models.Stream
	if err := cursor.All(ctx, &streamsToCancel); err != nil {
		log.Printf("Error decoding inactive streams: %v", err)
		return
	}

	for _, stream := range streamsToCancel {
		// Double-check that there are no active connections in the hub
		if h.HasActiveConnections(stream.StreamID) {
			// Stream has active connections, update lastConnectionAt and skip
			go updateLastConnectionTime(stream.StreamID)
			continue
		}

		// Auto-cancel the stream
		if err := h.autoCancelStream(ctx, stream.StreamID); err != nil {
			log.Printf("Error auto-cancelling stream %s: %v", stream.StreamID, err)
			continue
		}

		log.Printf("Auto-cancelled inactive stream: %s (no connections for 6+ hours)", stream.StreamID)
	}

	if len(streamsToCancel) > 0 {
		log.Printf("Inactive stream cleanup completed: checked %d streams", len(streamsToCancel))
	}
}

// HasActiveConnections checks if a stream has any active connections (broadcaster or viewers)
func (h *Hub) HasActiveConnections(streamID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	streamHub, exists := h.Streams[streamID]
	if !exists {
		return false
	}

	streamHub.mu.RLock()
	defer streamHub.mu.RUnlock()

	return streamHub.Broadcaster != nil || len(streamHub.Viewers) > 0
}

func (h *Hub) autoCancelStream(ctx context.Context, streamID string) error {
	now := time.Now()

	_, err := db.StreamsCollection().UpdateOne(
		ctx,
		bson.M{"streamId": streamID},
		bson.M{
			"$set": bson.M{
				"isActive":      false,
				"autoCancelled": true,
				"deletedAt":     now,
				"updatedAt":     now,
			},
		},
	)
	if err != nil {
		return err
	}

	// Close any remaining connections (shouldn't be any, but just in case)
	h.CloseStream(streamID)

	return nil
}
