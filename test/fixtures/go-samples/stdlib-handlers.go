// Package models contains standard library HTTP handler patterns
// This file tests stdlib http.HandleFunc() and http.Handle() detection
package models

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// User for response examples
type UserData struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// Simple handler using http.HandleFunc with anonymous function
func SetupBasicRoutes() {
	// Basic GET handler with anonymous function
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Hello, World!"))
	})

	// Health check endpoint
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// User list endpoint
	http.HandleFunc("/users", handleUsers)

	// Single user endpoint
	http.HandleFunc("/users/", handleUser)

	// API versioned endpoint
	http.HandleFunc("/api/v1/status", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{
			"version": "1.0.0",
			"status":  "running",
		})
	})
}

// Named handler function for users
func handleUsers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		users := []UserData{
			{ID: 1, Name: "Alice", Email: "alice@example.com"},
			{ID: 2, Name: "Bob", Email: "bob@example.com"},
		}
		json.NewEncoder(w).Encode(users)
	case http.MethodPost:
		var user UserData
		json.NewDecoder(r.Body).Decode(&user)
		user.ID = 3
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(user)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// Named handler function for single user
func handleUser(w http.ResponseWriter, r *http.Request) {
	// Parse user ID from path
	id := r.URL.Path[len("/users/"):]

	switch r.Method {
	case http.MethodGet:
		user := UserData{ID: 1, Name: "Alice", Email: "alice@example.com"}
		json.NewEncoder(w).Encode(user)
	case http.MethodPut:
		var user UserData
		json.NewDecoder(r.Body).Decode(&user)
		json.NewEncoder(w).Encode(user)
	case http.MethodDelete:
		w.WriteHeader(http.StatusNoContent)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
	_ = id // Suppress unused warning
}

// Using http.ServeMux explicitly
func SetupMuxRoutes() *http.ServeMux {
	mux := http.NewServeMux()

	// Register handlers on the mux
	mux.HandleFunc("/", homeHandler)
	mux.HandleFunc("/about", aboutHandler)
	mux.HandleFunc("/contact", contactHandler)
	mux.HandleFunc("/api/items", itemsHandler)
	mux.HandleFunc("/api/items/", itemHandler)

	return mux
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Home Page")
}

func aboutHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "About Page")
}

func contactHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Contact Page")
}

func itemsHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode([]string{"item1", "item2", "item3"})
}

func itemHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Path[len("/api/items/"):]
	json.NewEncoder(w).Encode(map[string]string{"id": id})
}

// Using http.Handle with a handler type
type healthHandler struct{}

func (h *healthHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

type metricsHandler struct{}

func (m *metricsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# HELP requests_total Total requests\n")
	fmt.Fprintf(w, "requests_total 100\n")
}

func SetupHandlerTypes() {
	// Using http.Handle with custom handler types
	http.Handle("/healthz", &healthHandler{})
	http.Handle("/metrics", &metricsHandler{})

	// Using http.Handle with http.HandlerFunc adapter
	http.Handle("/ready", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
}

// Server struct with method handlers
type APIServer struct {
	mux *http.ServeMux
}

func NewAPIServer() *APIServer {
	s := &APIServer{
		mux: http.NewServeMux(),
	}
	s.setupRoutes()
	return s
}

func (s *APIServer) setupRoutes() {
	s.mux.HandleFunc("/api/users", s.handleUsersEndpoint)
	s.mux.HandleFunc("/api/products", s.handleProductsEndpoint)
	s.mux.HandleFunc("/api/orders", s.handleOrdersEndpoint)
}

func (s *APIServer) handleUsersEndpoint(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode([]string{"user1", "user2"})
}

func (s *APIServer) handleProductsEndpoint(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode([]string{"product1", "product2"})
}

func (s *APIServer) handleOrdersEndpoint(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode([]string{"order1", "order2"})
}

func (s *APIServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

// Multiple paths registered in a loop (harder to detect)
func SetupLoopRoutes() {
	paths := []string{"/path1", "/path2", "/path3"}
	for _, p := range paths {
		path := p // Capture for closure
		http.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
			fmt.Fprintf(w, "Path: %s", path)
		})
	}
}

// FileServer example
func SetupFileServer() {
	// Static file serving
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))

	// Single file serving
	http.HandleFunc("/favicon.ico", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/favicon.ico")
	})
}
