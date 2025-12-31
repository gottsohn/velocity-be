package db

import (
	"context"
	"log"
	"time"

	"velocity-be/config"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var Client *mongo.Client
var Database *mongo.Database

func Connect() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOptions := options.Client().ApplyURI(config.AppConfig.MongoDBURI)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return err
	}

	// Verify connection
	err = client.Ping(ctx, nil)
	if err != nil {
		return err
	}

	Client = client
	Database = client.Database(config.AppConfig.MongoDBDatabase)

	log.Println("Connected to MongoDB successfully")
	return nil
}

func Disconnect() {
	if Client != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := Client.Disconnect(ctx); err != nil {
			log.Printf("Error disconnecting from MongoDB: %v", err)
		}
		log.Println("Disconnected from MongoDB")
	}
}

// Collections
func StreamsCollection() *mongo.Collection {
	return Database.Collection("streams")
}

func StreamJoinLogsCollection() *mongo.Collection {
	return Database.Collection("stream_join_logs")
}

func FeatureFlagsCollection() *mongo.Collection {
	return Database.Collection("feature_flags")
}
