package hub

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"velocity-be/db"
	"velocity-be/models"

	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
)

// ReadPump pumps messages from the WebSocket connection to the hub
func (c *Client) ReadPump(h *Hub) {
	defer func() {
		h.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512 * 1024) // 512KB max message size
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		if c.IsMobile {
			// Mobile app is sending stream data - broadcast to all viewers
			var wsMessage models.WebSocketMessage
			if err := json.Unmarshal(message, &wsMessage); err != nil {
				log.Printf("Error parsing message: %v", err)
				continue
			}

			if wsMessage.Type == "stream_data" {
				// Update stream in database
				go updateStreamData(c.StreamID, wsMessage.Payload)

				// Broadcast to all viewers
				h.BroadcastToViewers(c.StreamID, message)
			}
		}
	}
}

// WritePump pumps messages from the hub to the WebSocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func updateStreamData(streamID string, payload interface{}) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := db.StreamsCollection().UpdateOne(
		ctx,
		bson.M{"streamId": streamID},
		bson.M{
			"$set": bson.M{
				"latestData": payload,
				"updatedAt":  time.Now(),
			},
		},
	)
	if err != nil {
		log.Printf("Error updating stream data: %v", err)
	}
}
