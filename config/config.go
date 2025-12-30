package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port               string
	GinMode            string
	MongoDBURI         string
	MongoDBDatabase    string
	CorsAllowedOrigins []string
	Env                string
}

var AppConfig *Config

func Load() {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	AppConfig = &Config{
		Port:               getEnv("PORT", "8080"),
		GinMode:            getEnv("GIN_MODE", "debug"),
		MongoDBURI:         getEnv("MONGODB_URI", "mongodb://localhost:27017"),
		MongoDBDatabase:    getEnv("MONGODB_DATABASE", "velocity"),
		CorsAllowedOrigins: strings.Split(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173"), ","),
		Env:                getEnv("ENV", "development"),
	}

	log.Printf("Configuration loaded for environment: %s", AppConfig.Env)
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
