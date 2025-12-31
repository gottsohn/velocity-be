package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Car represents the vehicle information
type Car struct {
	Name       string `json:"name" bson:"name"`
	Model      string `json:"model" bson:"model"`
	HorsePower int    `json:"horsePower" bson:"horsePower"`
}

// CurrentLocation represents the current GPS position
type CurrentLocation struct {
	Latitude  float64 `json:"latitude" bson:"latitude"`
	Longitude float64 `json:"longitude" bson:"longitude"`
}

// NavigationData represents the expected route information
type NavigationData struct {
	Polyline           [][]float64 `json:"polyline" bson:"polyline"`                     // Array of [lat, long] coordinates e.g. [[12.34, 14.656], [12.44, 15.666]]
	Distance           float64     `json:"distance" bson:"distance"`                     // Distance in km e.g. 243.54
	ExpectedTravelTime float64     `json:"expectedTravelTime" bson:"expectedTravelTime"` // Expected travel time in seconds
}

// StreamData represents the data sent from the mobile app
type StreamData struct {
	NavigationData     *NavigationData `json:"navigationData,omitempty" bson:"navigationData,omitempty"`
	CurrentLocation    CurrentLocation `json:"currentLocation" bson:"currentLocation"`
	CurrentSpeedKmh    float64         `json:"currentSpeedKmh" bson:"currentSpeedKmh"` // Current speed in km/h e.g. 190.3
	Duration           float64         `json:"duration" bson:"duration"`
	DistanceKm         float64         `json:"distanceKm" bson:"distanceKm"`
	MaxSpeedKmh        float64         `json:"maxSpeedKmh" bson:"maxSpeedKmh"`
	StartLatitude      float64         `json:"startLatitude" bson:"startLatitude"`
	StartLongitude     float64         `json:"startLongitude" bson:"startLongitude"`
	EndLatitude        float64         `json:"endLatitude" bson:"endLatitude"`
	EndLongitude       float64         `json:"endLongitude" bson:"endLongitude"`
	ExpectedDuration   float64         `json:"expectedDuration" bson:"expectedDuration"`
	StartAddressLine   string          `json:"startAddressLine" bson:"startAddressLine"`
	StartPostalCode    string          `json:"startPostalCode" bson:"startPostalCode"`
	StartCity          string          `json:"startCity" bson:"startCity"`
	EndAddressLine     string          `json:"endAddressLine" bson:"endAddressLine"`
	EndPostalCode      string          `json:"endPostalCode" bson:"endPostalCode"`
	EndCity            string          `json:"endCity" bson:"endCity"`
	ExpectedDistanceKm *float64        `json:"expectedDistanceKm,omitempty" bson:"expectedDistanceKm,omitempty"`
	Car                Car             `json:"car" bson:"car"`
	IsPaused           bool            `json:"isPaused" bson:"isPaused"`
}

// Stream represents an active streaming session
type Stream struct {
	ID          primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	StreamID    string             `json:"streamId" bson:"streamId"`
	CreatedAt   time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt   time.Time          `json:"updatedAt" bson:"updatedAt"`
	DeletedAt   *time.Time         `json:"deletedAt,omitempty" bson:"deletedAt,omitempty"`
	IsActive    bool               `json:"isActive" bson:"isActive"`
	LatestData  *StreamData        `json:"latestData,omitempty" bson:"latestData,omitempty"`
	ViewerCount int                `json:"viewerCount" bson:"viewerCount"`
}

// StreamJoinLog represents a log entry when someone joins a stream
type StreamJoinLog struct {
	ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	StreamID  string             `json:"streamId" bson:"streamId"`
	JoinedAt  time.Time          `json:"joinedAt" bson:"joinedAt"`
	LeftAt    *time.Time         `json:"leftAt,omitempty" bson:"leftAt,omitempty"`
	UserAgent string             `json:"userAgent,omitempty" bson:"userAgent,omitempty"`
	IPAddress string             `json:"ipAddress,omitempty" bson:"ipAddress,omitempty"`
}

// WebSocketMessage represents messages sent over WebSocket
type WebSocketMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// ViewerCountUpdate represents the viewer count update sent to mobile app
type ViewerCountUpdate struct {
	StreamID    string `json:"streamId"`
	ViewerCount int    `json:"viewerCount"`
	NewUser     bool   `json:"newUser"` // true when a new user just joined, false otherwise
}

// StreamIDResponse represents the response when creating a new stream
type StreamIDResponse struct {
	StreamID string `json:"streamId"`
	Message  string `json:"message"`
}

// FeatureFlags represents the feature flags configuration
type FeatureFlags struct {
	ID                  primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	EnableLiveStreams   bool               `json:"enableLiveStreams" bson:"enableLiveStreams"`
	EnableiCloudStorage bool               `json:"enableiCloudStorage" bson:"enableiCloudStorage"`
	EnableCarPlay       bool               `json:"enableCarPlay" bson:"enableCarPlay"`
}

// FeatureFlagsResponse represents the API response for feature flags
type FeatureFlagsResponse struct {
	EnableLiveStreams   bool `json:"enableLiveStreams"`
	EnableiCloudStorage bool `json:"enableiCloudStorage"`
	EnableCarPlay       bool `json:"enableCarPlay"`
}
