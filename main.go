/*
Go Service - Golang Backend
Part of Win11 Development Environment
*/

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/cors"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	pgPool      *pgxpool.Pool
	mongoClient *mongo.Client
	mongoDb     *mongo.Database
	redisClient *redis.Client
	ctx         = context.Background()
)

// Response structures
type HealthResponse struct {
	Service   string            `json:"service"`
	Status    string            `json:"status"`
	Timestamp string            `json:"timestamp"`
	Version   string            `json:"version"`
	Databases map[string]string `json:"databases"`
}

type Item struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Price       float64   `json:"price"`
	Quantity    int       `json:"quantity"`
	CreatedAt   time.Time `json:"created_at"`
}

type Document struct {
	ID        primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	Title     string             `json:"title" bson:"title"`
	Content   string             `json:"content" bson:"content"`
	CreatedAt string             `json:"created_at" bson:"created_at"`
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func initDatabases() {
	// PostgreSQL
	databaseURL := getEnv("DATABASE_URL", "postgresql://devuser:devpassword@localhost:5432/devdb")
	var err error
	pgPool, err = pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Printf("⚠️ PostgreSQL connection failed: %v", err)
	} else {
		if err = pgPool.Ping(ctx); err != nil {
			log.Printf("⚠️ PostgreSQL ping failed: %v", err)
			pgPool = nil
		} else {
			log.Println("✅ Connected to PostgreSQL")
		}
	}

	// MongoDB
	mongoURL := getEnv("MONGODB_URL", "mongodb://devuser:devpassword@localhost:27017/devdb?authSource=admin")
	mongoClient, err = mongo.Connect(ctx, options.Client().ApplyURI(mongoURL))
	if err != nil {
		log.Printf("⚠️ MongoDB connection failed: %v", err)
	} else {
		if err = mongoClient.Ping(ctx, nil); err != nil {
			log.Printf("⚠️ MongoDB ping failed: %v", err)
			mongoClient = nil
		} else {
			mongoDb = mongoClient.Database("devdb")
			log.Println("✅ Connected to MongoDB")
		}
	}

	// Redis
	redisURL := getEnv("REDIS_URL", "redis://:devpassword@localhost:6379/0")
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Printf("⚠️ Redis URL parse failed: %v", err)
	} else {
		redisClient = redis.NewClient(opt)
		if _, err = redisClient.Ping(ctx).Result(); err != nil {
			log.Printf("⚠️ Redis ping failed: %v", err)
			redisClient = nil
		} else {
			log.Println("✅ Connected to Redis")
		}
	}
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"service": "Go Service",
		"message": "Welcome to the Golang backend!",
		"endpoints": map[string]string{
			"health":    "/health",
			"items":     "/api/items",
			"documents": "/api/documents",
			"cache":     "/api/cache/:key",
		},
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	dbStatus := map[string]string{
		"postgresql": "disconnected",
		"mongodb":    "disconnected",
		"redis":      "disconnected",
	}

	// Check PostgreSQL
	if pgPool != nil {
		if err := pgPool.Ping(ctx); err == nil {
			dbStatus["postgresql"] = "connected"
		}
	}

	// Check MongoDB
	if mongoClient != nil {
		if err := mongoClient.Ping(ctx, nil); err == nil {
			dbStatus["mongodb"] = "connected"
		}
	}

	// Check Redis
	if redisClient != nil {
		if _, err := redisClient.Ping(ctx).Result(); err == nil {
			dbStatus["redis"] = "connected"
		}
	}

	response := HealthResponse{
		Service:   "go",
		Status:    "healthy",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Version:   "1.0.0",
		Databases: dbStatus,
	}

	writeJSON(w, http.StatusOK, response)
}

func getItemsHandler(w http.ResponseWriter, r *http.Request) {
	if pgPool == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database not available"})
		return
	}

	// Create table if not exists
	_, err := pgPool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS items (
			id SERIAL PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			price DECIMAL(10, 2) NOT NULL,
			quantity INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	rows, err := pgPool.Query(ctx, "SELECT id, name, description, price, quantity, created_at FROM items ORDER BY id DESC")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	var items []Item
	for rows.Next() {
		var item Item
		var desc *string
		if err := rows.Scan(&item.ID, &item.Name, &desc, &item.Price, &item.Quantity, &item.CreatedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if desc != nil {
			item.Description = *desc
		}
		items = append(items, item)
	}

	if items == nil {
		items = []Item{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}

func createItemHandler(w http.ResponseWriter, r *http.Request) {
	if pgPool == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database not available"})
		return
	}

	var item Item
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON"})
		return
	}

	if item.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Name is required"})
		return
	}

	// Create table if not exists
	_, _ = pgPool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS items (
			id SERIAL PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			price DECIMAL(10, 2) NOT NULL,
			quantity INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)

	err := pgPool.QueryRow(ctx,
		"INSERT INTO items (name, description, price, quantity) VALUES ($1, $2, $3, $4) RETURNING id, created_at",
		item.Name, item.Description, item.Price, item.Quantity,
	).Scan(&item.ID, &item.CreatedAt)

	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Invalidate cache
	if redisClient != nil {
		redisClient.Del(ctx, "items_cache")
	}

	writeJSON(w, http.StatusCreated, item)
}

func getDocumentsHandler(w http.ResponseWriter, r *http.Request) {
	if mongoDb == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "MongoDB not available"})
		return
	}

	cursor, err := mongoDb.Collection("documents").Find(ctx, bson.M{})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer cursor.Close(ctx)

	var documents []Document
	if err = cursor.All(ctx, &documents); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if documents == nil {
		documents = []Document{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"documents": documents})
}

func createDocumentHandler(w http.ResponseWriter, r *http.Request) {
	if mongoDb == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "MongoDB not available"})
		return
	}

	var doc Document
	if err := json.NewDecoder(r.Body).Decode(&doc); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON"})
		return
	}

	doc.CreatedAt = time.Now().UTC().Format(time.RFC3339)

	result, err := mongoDb.Collection("documents").InsertOne(ctx, doc)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":      result.InsertedID,
		"message": "Document created successfully",
	})
}

func getCacheHandler(w http.ResponseWriter, r *http.Request) {
	if redisClient == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Redis not available"})
		return
	}

	vars := mux.Vars(r)
	key := vars["key"]

	value, err := redisClient.Get(ctx, key).Result()
	if err == redis.Nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Key not found"})
		return
	} else if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"key": key, "value": value})
}

func setCacheHandler(w http.ResponseWriter, r *http.Request) {
	if redisClient == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Redis not available"})
		return
	}

	vars := mux.Vars(r)
	key := vars["key"]

	var body struct {
		Value string `json:"value"`
		TTL   int    `json:"ttl"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON"})
		return
	}

	if body.Value == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Value is required"})
		return
	}

	ttl := body.TTL
	if ttl == 0 {
		ttl = 3600
	}

	if err := redisClient.SetEX(ctx, key, body.Value, time.Duration(ttl)*time.Second).Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"key":   key,
		"value": body.Value,
		"ttl":   ttl,
	})
}

func main() {
	initDatabases()

	r := mux.NewRouter()

	// Routes
	r.HandleFunc("/", rootHandler).Methods("GET")
	r.HandleFunc("/health", healthHandler).Methods("GET")
	r.HandleFunc("/api/items", getItemsHandler).Methods("GET")
	r.HandleFunc("/api/items", createItemHandler).Methods("POST")
	r.HandleFunc("/api/documents", getDocumentsHandler).Methods("GET")
	r.HandleFunc("/api/documents", createDocumentHandler).Methods("POST")
	r.HandleFunc("/api/cache/{key}", getCacheHandler).Methods("GET")
	r.HandleFunc("/api/cache/{key}", setCacheHandler).Methods("POST")

	// CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	handler := c.Handler(r)

	port := getEnv("PORT", "8080")
	fmt.Printf("\n🚀 Go Service running on port %s\n", port)
	fmt.Printf("   Health: http://localhost:%s/health\n", port)
	fmt.Printf("   API: http://localhost:%s/api\n\n", port)

	log.Fatal(http.ListenAndServe(":"+port, handler))
}
