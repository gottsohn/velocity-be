package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"velocity-be/config"
	"velocity-be/db"
	"velocity-be/handlers"
	"velocity-be/hub"
	"velocity-be/models"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/testcontainers/testcontainers-go/modules/mongodb"
	"go.mongodb.org/mongo-driver/bson"
)

var (
	testRouter *gin.Engine
	testHub    *hub.Hub
)

// TestMain sets up and tears down the test environment
func TestMain(m *testing.M) {
	// Run tests
	m.Run()
}

// setupTestEnvironment creates a test MongoDB container and initializes the app
func setupTestEnvironment(t *testing.T) func() {
	ctx := context.Background()

	// Start MongoDB container
	mongoContainer, err := mongodb.Run(ctx, "mongo:7.0")
	if err != nil {
		t.Fatalf("Failed to start MongoDB container: %v", err)
	}

	// Get connection string
	connectionString, err := mongoContainer.ConnectionString(ctx)
	if err != nil {
		t.Fatalf("Failed to get MongoDB connection string: %v", err)
	}

	// Configure the app
	config.AppConfig = &config.Config{
		Port:               "8080",
		GinMode:            "test",
		MongoDBURI:         connectionString,
		MongoDBDatabase:    "velocity_test",
		CorsAllowedOrigins: []string{"http://localhost:3000"},
		Env:                "test",
	}

	// Set Gin to test mode
	gin.SetMode(gin.TestMode)

	// Connect to MongoDB
	if err := db.Connect(); err != nil {
		t.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	// Create hub
	testHub = hub.NewHub()
	go testHub.Run()

	// Setup router
	testRouter = setupRouter(testHub)

	// Return cleanup function
	return func() {
		db.Disconnect()
		if err := mongoContainer.Terminate(ctx); err != nil {
			t.Logf("Failed to terminate MongoDB container: %v", err)
		}
	}
}

// setupRouter creates the test router with all routes
func setupRouter(h *hub.Hub) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "healthy"})
	})

	// API routes
	api := router.Group("/api")
	{
		api.POST("/streams", handlers.CreateStreamHandler)
		api.GET("/streams/:streamId", handlers.GetStreamHandler)
		api.DELETE("/streams/:streamId", handlers.DeleteStreamHandler(h))
		api.GET("/feature-flags", handlers.GetFeatureFlagsHandler)
	}

	// WebSocket routes
	ws := router.Group("/ws")
	{
		ws.GET("/mobile/:streamId", handlers.MobileWebSocketHandler(h))
		ws.GET("/viewer/:streamId", handlers.ViewerWebSocketHandler(h))
	}

	return router
}

// cleanupStreams removes all streams from the test database
func cleanupStreams(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := db.StreamsCollection().DeleteMany(ctx, bson.M{})
	if err != nil {
		t.Logf("Failed to cleanup streams: %v", err)
	}

	_, err = db.StreamJoinLogsCollection().DeleteMany(ctx, bson.M{})
	if err != nil {
		t.Logf("Failed to cleanup stream join logs: %v", err)
	}

	_, err = db.FeatureFlagsCollection().DeleteMany(ctx, bson.M{})
	if err != nil {
		t.Logf("Failed to cleanup feature flags: %v", err)
	}
}

// ==================== Health Check Tests ====================

func TestHealthEndpoint(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()

	req, _ := http.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if response["status"] != "healthy" {
		t.Errorf("Expected status 'healthy', got '%s'", response["status"])
	}
}

// ==================== Stream API Tests ====================

func TestCreateStream(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	req, _ := http.NewRequest("POST", "/api/streams", nil)
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response models.StreamIDResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if response.StreamID == "" {
		t.Error("Expected non-empty stream ID")
	}

	if len(response.StreamID) != 64 {
		t.Errorf("Expected stream ID length of 64, got %d", len(response.StreamID))
	}

	if response.Message != "Stream created successfully" {
		t.Errorf("Expected message 'Stream created successfully', got '%s'", response.Message)
	}
}

func TestGetStream(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	// First create a stream
	createReq, _ := http.NewRequest("POST", "/api/streams", nil)
	createW := httptest.NewRecorder()
	testRouter.ServeHTTP(createW, createReq)

	var createResponse models.StreamIDResponse
	json.Unmarshal(createW.Body.Bytes(), &createResponse)

	// Now get the stream
	getReq, _ := http.NewRequest("GET", "/api/streams/"+createResponse.StreamID, nil)
	getW := httptest.NewRecorder()
	testRouter.ServeHTTP(getW, getReq)

	if getW.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, getW.Code)
	}

	var stream models.Stream
	if err := json.Unmarshal(getW.Body.Bytes(), &stream); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if stream.StreamID != createResponse.StreamID {
		t.Errorf("Expected stream ID '%s', got '%s'", createResponse.StreamID, stream.StreamID)
	}

	if !stream.IsActive {
		t.Error("Expected stream to be active")
	}

	if stream.ViewerCount != 0 {
		t.Errorf("Expected viewer count 0, got %d", stream.ViewerCount)
	}
}

func TestGetStreamNotFound(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	req, _ := http.NewRequest("GET", "/api/streams/nonexistent-stream-id", nil)
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, w.Code)
	}

	var response map[string]string
	json.Unmarshal(w.Body.Bytes(), &response)

	if response["error"] != "Stream not found" {
		t.Errorf("Expected error 'Stream not found', got '%s'", response["error"])
	}
}

func TestDeleteStream(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	// First create a stream
	createReq, _ := http.NewRequest("POST", "/api/streams", nil)
	createW := httptest.NewRecorder()
	testRouter.ServeHTTP(createW, createReq)

	var createResponse models.StreamIDResponse
	json.Unmarshal(createW.Body.Bytes(), &createResponse)

	// Now delete the stream
	deleteReq, _ := http.NewRequest("DELETE", "/api/streams/"+createResponse.StreamID, nil)
	deleteW := httptest.NewRecorder()
	testRouter.ServeHTTP(deleteW, deleteReq)

	if deleteW.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, deleteW.Code)
	}

	var deleteResponse map[string]interface{}
	json.Unmarshal(deleteW.Body.Bytes(), &deleteResponse)

	if deleteResponse["message"] != "Stream deleted successfully" {
		t.Errorf("Expected message 'Stream deleted successfully', got '%s'", deleteResponse["message"])
	}

	// Verify the stream is now soft-deleted
	getReq, _ := http.NewRequest("GET", "/api/streams/"+createResponse.StreamID, nil)
	getW := httptest.NewRecorder()
	testRouter.ServeHTTP(getW, getReq)

	var stream models.Stream
	json.Unmarshal(getW.Body.Bytes(), &stream)

	if stream.IsActive {
		t.Error("Expected stream to be inactive after deletion")
	}

	if stream.DeletedAt == nil {
		t.Error("Expected stream to have deletedAt timestamp")
	}
}

func TestDeleteStreamNotFound(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	req, _ := http.NewRequest("DELETE", "/api/streams/nonexistent-stream-id", nil)
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, w.Code)
	}
}

func TestDeleteStreamAlreadyDeleted(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	// Create a stream
	createReq, _ := http.NewRequest("POST", "/api/streams", nil)
	createW := httptest.NewRecorder()
	testRouter.ServeHTTP(createW, createReq)

	var createResponse models.StreamIDResponse
	json.Unmarshal(createW.Body.Bytes(), &createResponse)

	// Delete the stream
	deleteReq1, _ := http.NewRequest("DELETE", "/api/streams/"+createResponse.StreamID, nil)
	deleteW1 := httptest.NewRecorder()
	testRouter.ServeHTTP(deleteW1, deleteReq1)

	// Try to delete again
	deleteReq2, _ := http.NewRequest("DELETE", "/api/streams/"+createResponse.StreamID, nil)
	deleteW2 := httptest.NewRecorder()
	testRouter.ServeHTTP(deleteW2, deleteReq2)

	if deleteW2.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, deleteW2.Code)
	}

	var response map[string]string
	json.Unmarshal(deleteW2.Body.Bytes(), &response)

	if response["error"] != "Stream already deleted" {
		t.Errorf("Expected error 'Stream already deleted', got '%s'", response["error"])
	}
}

// ==================== Feature Flags Tests ====================

func TestGetFeatureFlagsDefault(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	req, _ := http.NewRequest("GET", "/api/feature-flags", nil)
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response models.FeatureFlagsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	// Default values should all be false
	if response.EnableLiveStreams {
		t.Error("Expected EnableLiveStreams to be false by default")
	}
	if response.EnableiCloudStorage {
		t.Error("Expected EnableiCloudStorage to be false by default")
	}
	if response.EnableCarPlay {
		t.Error("Expected EnableCarPlay to be false by default")
	}
}

func TestGetFeatureFlagsFromDB(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	// Insert feature flags into the database
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	featureFlags := models.FeatureFlags{
		EnableLiveStreams:   true,
		EnableiCloudStorage: true,
		EnableCarPlay:       false,
	}

	_, err := db.FeatureFlagsCollection().InsertOne(ctx, featureFlags)
	if err != nil {
		t.Fatalf("Failed to insert feature flags: %v", err)
	}

	req, _ := http.NewRequest("GET", "/api/feature-flags", nil)
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response models.FeatureFlagsResponse
	json.Unmarshal(w.Body.Bytes(), &response)

	if !response.EnableLiveStreams {
		t.Error("Expected EnableLiveStreams to be true")
	}
	if !response.EnableiCloudStorage {
		t.Error("Expected EnableiCloudStorage to be true")
	}
	if response.EnableCarPlay {
		t.Error("Expected EnableCarPlay to be false")
	}
}

// ==================== WebSocket Tests ====================

func TestMobileWebSocketConnection(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	// Create a stream first
	createReq, _ := http.NewRequest("POST", "/api/streams", nil)
	createW := httptest.NewRecorder()
	testRouter.ServeHTTP(createW, createReq)

	var createResponse models.StreamIDResponse
	json.Unmarshal(createW.Body.Bytes(), &createResponse)

	// Start a test HTTP server
	server := httptest.NewServer(testRouter)
	defer server.Close()

	// Connect via WebSocket
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/mobile/" + createResponse.StreamID
	ws, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect WebSocket: %v", err)
	}
	defer ws.Close()

	if resp.StatusCode != http.StatusSwitchingProtocols {
		t.Errorf("Expected status %d, got %d", http.StatusSwitchingProtocols, resp.StatusCode)
	}

	// Give the hub time to register the client
	time.Sleep(100 * time.Millisecond)

	// Verify the stream has a broadcaster
	viewerCount := testHub.GetViewerCount(createResponse.StreamID)
	if viewerCount != 0 {
		t.Errorf("Expected 0 viewers, got %d", viewerCount)
	}
}

func TestViewerWebSocketConnection(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	// Create a stream first
	createReq, _ := http.NewRequest("POST", "/api/streams", nil)
	createW := httptest.NewRecorder()
	testRouter.ServeHTTP(createW, createReq)

	var createResponse models.StreamIDResponse
	json.Unmarshal(createW.Body.Bytes(), &createResponse)

	// Start a test HTTP server
	server := httptest.NewServer(testRouter)
	defer server.Close()

	// Connect via WebSocket as viewer
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/viewer/" + createResponse.StreamID
	ws, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect WebSocket: %v", err)
	}
	defer ws.Close()

	if resp.StatusCode != http.StatusSwitchingProtocols {
		t.Errorf("Expected status %d, got %d", http.StatusSwitchingProtocols, resp.StatusCode)
	}

	// Give the hub time to register the client
	time.Sleep(100 * time.Millisecond)

	// Verify the stream has a viewer
	viewerCount := testHub.GetViewerCount(createResponse.StreamID)
	if viewerCount != 1 {
		t.Errorf("Expected 1 viewer, got %d", viewerCount)
	}
}

func TestWebSocketStreamNotFound(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	// Start a test HTTP server
	server := httptest.NewServer(testRouter)
	defer server.Close()

	// Try to connect to a non-existent stream
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/viewer/nonexistent-stream-id"
	_, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)

	// We expect an error since the stream doesn't exist
	if err == nil {
		t.Error("Expected error connecting to non-existent stream")
	}

	if resp != nil && resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, resp.StatusCode)
	}
}

func TestWebSocketBroadcast(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	// Create a stream first
	createReq, _ := http.NewRequest("POST", "/api/streams", nil)
	createW := httptest.NewRecorder()
	testRouter.ServeHTTP(createW, createReq)

	var createResponse models.StreamIDResponse
	json.Unmarshal(createW.Body.Bytes(), &createResponse)

	// Start a test HTTP server
	server := httptest.NewServer(testRouter)
	defer server.Close()

	// Connect mobile broadcaster
	mobileURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/mobile/" + createResponse.StreamID
	mobileWS, _, err := websocket.DefaultDialer.Dial(mobileURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect mobile WebSocket: %v", err)
	}
	defer mobileWS.Close()

	// Connect viewer
	viewerURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/viewer/" + createResponse.StreamID
	viewerWS, _, err := websocket.DefaultDialer.Dial(viewerURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect viewer WebSocket: %v", err)
	}
	defer viewerWS.Close()

	// Give the hub time to register clients
	time.Sleep(100 * time.Millisecond)

	// Mobile sends stream data
	streamData := models.WebSocketMessage{
		Type: "stream_data",
		Payload: models.StreamData{
			CurrentLocation: models.CurrentLocation{
				Latitude:  37.7749,
				Longitude: -122.4194,
			},
			CurrentSpeedKmh: 65.5,
			Duration:        120.0,
			DistanceKm:      2.5,
			MaxSpeedKmh:     80.0,
			Car: models.Car{
				Name:       "Tesla",
				Model:      "Model 3",
				HorsePower: 450,
			},
		},
	}

	msgBytes, _ := json.Marshal(streamData)
	if err := mobileWS.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
		t.Fatalf("Failed to send message: %v", err)
	}

	// Viewer should receive the broadcast
	viewerWS.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, receivedMsg, err := viewerWS.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to receive message: %v", err)
	}

	var receivedData models.WebSocketMessage
	if err := json.Unmarshal(receivedMsg, &receivedData); err != nil {
		t.Fatalf("Failed to parse received message: %v", err)
	}

	if receivedData.Type != "stream_data" {
		t.Errorf("Expected message type 'stream_data', got '%s'", receivedData.Type)
	}
}

func TestMultipleViewers(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	// Create a stream first
	createReq, _ := http.NewRequest("POST", "/api/streams", nil)
	createW := httptest.NewRecorder()
	testRouter.ServeHTTP(createW, createReq)

	var createResponse models.StreamIDResponse
	json.Unmarshal(createW.Body.Bytes(), &createResponse)

	// Start a test HTTP server
	server := httptest.NewServer(testRouter)
	defer server.Close()

	// Connect multiple viewers
	viewers := make([]*websocket.Conn, 3)
	for i := 0; i < 3; i++ {
		viewerURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/viewer/" + createResponse.StreamID
		ws, _, err := websocket.DefaultDialer.Dial(viewerURL, nil)
		if err != nil {
			t.Fatalf("Failed to connect viewer %d: %v", i, err)
		}
		viewers[i] = ws
		defer ws.Close()
	}

	// Give the hub time to register clients
	time.Sleep(200 * time.Millisecond)

	// Verify viewer count
	viewerCount := testHub.GetViewerCount(createResponse.StreamID)
	if viewerCount != 3 {
		t.Errorf("Expected 3 viewers, got %d", viewerCount)
	}

	// Close one viewer
	viewers[0].Close()
	time.Sleep(200 * time.Millisecond)

	// Verify viewer count decreased
	viewerCount = testHub.GetViewerCount(createResponse.StreamID)
	if viewerCount != 2 {
		t.Errorf("Expected 2 viewers after one left, got %d", viewerCount)
	}
}

func TestViewerCountNotification(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	// Create a stream first
	createReq, _ := http.NewRequest("POST", "/api/streams", nil)
	createW := httptest.NewRecorder()
	testRouter.ServeHTTP(createW, createReq)

	var createResponse models.StreamIDResponse
	json.Unmarshal(createW.Body.Bytes(), &createResponse)

	// Start a test HTTP server
	server := httptest.NewServer(testRouter)
	defer server.Close()

	// Connect mobile broadcaster
	mobileURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/mobile/" + createResponse.StreamID
	mobileWS, _, err := websocket.DefaultDialer.Dial(mobileURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect mobile WebSocket: %v", err)
	}
	defer mobileWS.Close()

	// Give hub time to register broadcaster
	time.Sleep(100 * time.Millisecond)

	// Connect viewer
	viewerURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/viewer/" + createResponse.StreamID
	viewerWS, _, err := websocket.DefaultDialer.Dial(viewerURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect viewer WebSocket: %v", err)
	}
	defer viewerWS.Close()

	// Mobile should receive viewer count notification
	mobileWS.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg, err := mobileWS.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to receive viewer count notification: %v", err)
	}

	var notification models.WebSocketMessage
	if err := json.Unmarshal(msg, &notification); err != nil {
		t.Fatalf("Failed to parse notification: %v", err)
	}

	if notification.Type != "viewer_count" {
		t.Errorf("Expected message type 'viewer_count', got '%s'", notification.Type)
	}
}

func TestDeletedStreamWebSocketRejection(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	// Create and delete a stream
	createReq, _ := http.NewRequest("POST", "/api/streams", nil)
	createW := httptest.NewRecorder()
	testRouter.ServeHTTP(createW, createReq)

	var createResponse models.StreamIDResponse
	json.Unmarshal(createW.Body.Bytes(), &createResponse)

	deleteReq, _ := http.NewRequest("DELETE", "/api/streams/"+createResponse.StreamID, nil)
	deleteW := httptest.NewRecorder()
	testRouter.ServeHTTP(deleteW, deleteReq)

	// Start a test HTTP server
	server := httptest.NewServer(testRouter)
	defer server.Close()

	// Try to connect to deleted stream
	viewerURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/viewer/" + createResponse.StreamID
	_, resp, err := websocket.DefaultDialer.Dial(viewerURL, nil)

	// Should fail with status 410 Gone
	if err == nil {
		t.Error("Expected error connecting to deleted stream")
	}

	if resp != nil && resp.StatusCode != http.StatusGone {
		t.Errorf("Expected status %d, got %d", http.StatusGone, resp.StatusCode)
	}
}

// ==================== Stream Uniqueness Tests ====================

func TestStreamIDsAreUnique(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	streamIDs := make(map[string]bool)
	numStreams := 10

	for i := 0; i < numStreams; i++ {
		createReq, _ := http.NewRequest("POST", "/api/streams", nil)
		createW := httptest.NewRecorder()
		testRouter.ServeHTTP(createW, createReq)

		var createResponse models.StreamIDResponse
		json.Unmarshal(createW.Body.Bytes(), &createResponse)

		if streamIDs[createResponse.StreamID] {
			t.Errorf("Duplicate stream ID generated: %s", createResponse.StreamID)
		}
		streamIDs[createResponse.StreamID] = true
	}

	if len(streamIDs) != numStreams {
		t.Errorf("Expected %d unique stream IDs, got %d", numStreams, len(streamIDs))
	}
}

// ==================== Concurrent Access Tests ====================

func TestConcurrentStreamCreation(t *testing.T) {
	cleanup := setupTestEnvironment(t)
	defer cleanup()
	defer cleanupStreams(t)

	numGoroutines := 20
	results := make(chan string, numGoroutines)
	errors := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func() {
			createReq, _ := http.NewRequest("POST", "/api/streams", nil)
			createW := httptest.NewRecorder()
			testRouter.ServeHTTP(createW, createReq)

			if createW.Code != http.StatusOK {
				errors <- fmt.Errorf("expected status %d, got %d", http.StatusOK, createW.Code)
				return
			}

			var createResponse models.StreamIDResponse
			if err := json.Unmarshal(createW.Body.Bytes(), &createResponse); err != nil {
				errors <- err
				return
			}

			results <- createResponse.StreamID
		}()
	}

	streamIDs := make(map[string]bool)
	for i := 0; i < numGoroutines; i++ {
		select {
		case streamID := <-results:
			if streamIDs[streamID] {
				t.Errorf("Duplicate stream ID in concurrent creation: %s", streamID)
			}
			streamIDs[streamID] = true
		case err := <-errors:
			t.Errorf("Error in concurrent stream creation: %v", err)
		case <-time.After(10 * time.Second):
			t.Fatal("Timeout waiting for concurrent stream creation")
		}
	}
}

// ==================== Helper Functions ====================

// createJSONRequest creates an HTTP request with JSON body
func createJSONRequest(t *testing.T, method, url string, body interface{}) *http.Request {
	t.Helper()
	var bodyBytes []byte
	if body != nil {
		var err error
		bodyBytes, err = json.Marshal(body)
		if err != nil {
			t.Fatalf("Failed to marshal request body: %v", err)
		}
	}

	req, err := http.NewRequest(method, url, bytes.NewBuffer(bodyBytes))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	return req
}

// updateStreamData updates the stream data in the database for testing
func updateStreamData(t *testing.T, streamID string, data models.StreamData) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := db.StreamsCollection().UpdateOne(
		ctx,
		bson.M{"streamId": streamID},
		bson.M{
			"$set": bson.M{
				"latestData": data,
				"updatedAt":  time.Now(),
			},
		},
	)
	if err != nil {
		t.Fatalf("Failed to update stream data: %v", err)
	}
}
