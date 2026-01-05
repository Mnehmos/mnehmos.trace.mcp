// Package models contains Chi router patterns
// This file tests Chi router detection with path parameters
package models

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// ChiUser for response examples
type ChiUser struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// ChiProduct for response examples
type ChiProduct struct {
	SKU   string  `json:"sku"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
}

// SetupChiRouter demonstrates basic Chi router setup
func SetupChiRouter() *chi.Mux {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)

	// Basic routes with different HTTP methods
	r.Get("/", homeHandler)
	r.Get("/health", healthCheck)
	r.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("pong"))
	})

	// User routes with path parameters
	r.Get("/users", listUsers)
	r.Post("/users", createUser)
	r.Get("/users/{id}", getUser) // Chi uses {param} syntax
	r.Put("/users/{id}", updateUser)
	r.Delete("/users/{id}", deleteUser)
	r.Patch("/users/{id}", patchUser)

	// Path parameters with regex constraints
	r.Get("/users/{id:[0-9]+}", getUserNumeric)      // Numeric ID only
	r.Get("/users/{uuid:[a-f0-9-]+}", getUserByUUID) // UUID pattern
	r.Get("/users/{slug:[a-z-]+}", getUserBySlug)    // Slug pattern

	// Nested path parameters
	r.Get("/users/{userId}/posts/{postId}", getUserPost)
	r.Get("/users/{userId}/posts/{postId}/comments/{commentId}", getUserPostComment)

	// Product routes
	r.Get("/products", listProducts)
	r.Post("/products", createProduct)
	r.Get("/products/{sku}", getProduct)

	return r
}

// SetupChiRouteGroups demonstrates Chi route grouping
func SetupChiRouteGroups() *chi.Mux {
	r := chi.NewRouter()

	// Route groups with r.Route()
	r.Route("/api", func(r chi.Router) {
		r.Get("/status", apiStatus)
		r.Get("/version", apiVersion)

		// Nested group
		r.Route("/v1", func(r chi.Router) {
			r.Get("/users", listUsersV1)
			r.Post("/users", createUserV1)
			r.Get("/users/{id}", getUserV1)
		})

		// Another nested group
		r.Route("/v2", func(r chi.Router) {
			r.Get("/users", listUsersV2)
			r.Post("/users", createUserV2)
			r.Get("/users/{id}", getUserV2)
		})
	})

	// Admin routes with middleware
	r.Route("/admin", func(r chi.Router) {
		r.Use(adminAuth)
		r.Get("/dashboard", adminDashboard)
		r.Get("/users", adminListUsers)
		r.Delete("/users/{id}", adminDeleteUser)
	})

	return r
}

// SetupChiMount demonstrates Chi mount functionality
func SetupChiMount() *chi.Mux {
	r := chi.NewRouter()

	// Mount sub-routers
	r.Mount("/api/users", userRouter())
	r.Mount("/api/products", productRouter())
	r.Mount("/api/orders", orderRouter())

	return r
}

func userRouter() http.Handler {
	r := chi.NewRouter()
	r.Get("/", listUsers)
	r.Post("/", createUser)
	r.Get("/{id}", getUser)
	r.Put("/{id}", updateUser)
	r.Delete("/{id}", deleteUser)
	return r
}

func productRouter() http.Handler {
	r := chi.NewRouter()
	r.Get("/", listProducts)
	r.Post("/", createProduct)
	r.Get("/{sku}", getProduct)
	return r
}

func orderRouter() http.Handler {
	r := chi.NewRouter()
	r.Get("/", listOrders)
	r.Post("/", createOrder)
	r.Get("/{id}", getOrder)
	return r
}

// SetupChiMethodFunc demonstrates MethodFunc usage
func SetupChiMethodFunc() *chi.Mux {
	r := chi.NewRouter()

	// Using MethodFunc for explicit HTTP method
	r.MethodFunc("GET", "/items", listItems)
	r.MethodFunc("POST", "/items", createItem)
	r.MethodFunc("PUT", "/items/{id}", updateItem)
	r.MethodFunc("DELETE", "/items/{id}", deleteItem)

	return r
}

// SetupChiOptions demonstrates less common HTTP methods
func SetupChiOptions() *chi.Mux {
	r := chi.NewRouter()

	r.Options("/api/resources", optionsResources)
	r.Head("/api/resources", headResources)
	r.Connect("/tunnel", connectHandler)
	r.Trace("/debug", traceHandler)

	return r
}

// Handler implementations
func chiHomeHandler(w http.ResponseWriter, r *http.Request) { w.Write([]byte("Home")) }
func healthCheck(w http.ResponseWriter, r *http.Request)    { w.Write([]byte("OK")) }
func listUsers(w http.ResponseWriter, r *http.Request)      { json.NewEncoder(w).Encode([]ChiUser{}) }
func createUser(w http.ResponseWriter, r *http.Request)     { w.WriteHeader(http.StatusCreated) }
func getUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	json.NewEncoder(w).Encode(ChiUser{Name: id})
}
func updateUser(w http.ResponseWriter, r *http.Request)         { w.WriteHeader(http.StatusOK) }
func deleteUser(w http.ResponseWriter, r *http.Request)         { w.WriteHeader(http.StatusNoContent) }
func patchUser(w http.ResponseWriter, r *http.Request)          { w.WriteHeader(http.StatusOK) }
func getUserNumeric(w http.ResponseWriter, r *http.Request)     { w.Write([]byte("numeric user")) }
func getUserByUUID(w http.ResponseWriter, r *http.Request)      { w.Write([]byte("uuid user")) }
func getUserBySlug(w http.ResponseWriter, r *http.Request)      { w.Write([]byte("slug user")) }
func getUserPost(w http.ResponseWriter, r *http.Request)        { w.Write([]byte("user post")) }
func getUserPostComment(w http.ResponseWriter, r *http.Request) { w.Write([]byte("user post comment")) }
func listProducts(w http.ResponseWriter, r *http.Request)       { json.NewEncoder(w).Encode([]ChiProduct{}) }
func createProduct(w http.ResponseWriter, r *http.Request)      { w.WriteHeader(http.StatusCreated) }
func getProduct(w http.ResponseWriter, r *http.Request) {
	sku := chi.URLParam(r, "sku")
	json.NewEncoder(w).Encode(ChiProduct{SKU: sku})
}
func listOrders(w http.ResponseWriter, r *http.Request)       { w.Write([]byte("[]")) }
func createOrder(w http.ResponseWriter, r *http.Request)      { w.WriteHeader(http.StatusCreated) }
func getOrder(w http.ResponseWriter, r *http.Request)         { w.Write([]byte("{}")) }
func apiStatus(w http.ResponseWriter, r *http.Request)        { w.Write([]byte("OK")) }
func apiVersion(w http.ResponseWriter, r *http.Request)       { w.Write([]byte("1.0.0")) }
func listUsersV1(w http.ResponseWriter, r *http.Request)      { w.Write([]byte("[]")) }
func createUserV1(w http.ResponseWriter, r *http.Request)     { w.WriteHeader(http.StatusCreated) }
func getUserV1(w http.ResponseWriter, r *http.Request)        { w.Write([]byte("{}")) }
func listUsersV2(w http.ResponseWriter, r *http.Request)      { w.Write([]byte("[]")) }
func createUserV2(w http.ResponseWriter, r *http.Request)     { w.WriteHeader(http.StatusCreated) }
func getUserV2(w http.ResponseWriter, r *http.Request)        { w.Write([]byte("{}")) }
func adminAuth(next http.Handler) http.Handler                { return next }
func adminDashboard(w http.ResponseWriter, r *http.Request)   { w.Write([]byte("dashboard")) }
func adminListUsers(w http.ResponseWriter, r *http.Request)   { w.Write([]byte("[]")) }
func adminDeleteUser(w http.ResponseWriter, r *http.Request)  { w.WriteHeader(http.StatusNoContent) }
func listItems(w http.ResponseWriter, r *http.Request)        { w.Write([]byte("[]")) }
func createItem(w http.ResponseWriter, r *http.Request)       { w.WriteHeader(http.StatusCreated) }
func updateItem(w http.ResponseWriter, r *http.Request)       { w.WriteHeader(http.StatusOK) }
func deleteItem(w http.ResponseWriter, r *http.Request)       { w.WriteHeader(http.StatusNoContent) }
func optionsResources(w http.ResponseWriter, r *http.Request) { w.Header().Set("Allow", "GET, POST") }
func headResources(w http.ResponseWriter, r *http.Request)    { w.WriteHeader(http.StatusOK) }
func connectHandler(w http.ResponseWriter, r *http.Request)   { w.WriteHeader(http.StatusOK) }
func traceHandler(w http.ResponseWriter, r *http.Request)     { w.WriteHeader(http.StatusOK) }
