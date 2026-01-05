// Package models contains interface definitions
// This file tests interface extraction with method signatures
package models

import (
	"context"
	"io"
	"time"
)

// UserEntity type for interface examples
type UserEntity struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// CreateUserInput for interface examples
type CreateUserInput struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// PaginationParams for list operations
type PaginationParams struct {
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}

// UserRepository defines data access operations
type UserRepository interface {
	// GetByID retrieves a user by their ID
	GetByID(ctx context.Context, id int64) (*UserEntity, error)

	// GetByEmail retrieves a user by email
	GetByEmail(ctx context.Context, email string) (*UserEntity, error)

	// Create stores a new user
	Create(ctx context.Context, user *UserEntity) error

	// Update modifies an existing user
	Update(ctx context.Context, user *UserEntity) error

	// Delete removes a user by ID
	Delete(ctx context.Context, id int64) error

	// List retrieves paginated users
	List(ctx context.Context, params PaginationParams) ([]*UserEntity, int, error)
}

// UserService defines business logic operations
type UserService interface {
	// CreateUser creates a new user with validation
	CreateUser(ctx context.Context, req CreateUserInput) (*UserEntity, error)

	// GetUser retrieves a user by ID
	GetUser(ctx context.Context, id int64) (*UserEntity, error)

	// UpdateUser updates user information
	UpdateUser(ctx context.Context, id int64, updates map[string]interface{}) (*UserEntity, error)

	// DeactivateUser soft-deletes a user
	DeactivateUser(ctx context.Context, id int64) error
}

// AuthService defines authentication operations
type AuthService interface {
	// Login authenticates a user and returns a token
	Login(ctx context.Context, email, password string) (token string, err error)

	// Logout invalidates a user session
	Logout(ctx context.Context, token string) error

	// ValidateToken checks if a token is valid
	ValidateToken(ctx context.Context, token string) (userID int64, err error)

	// RefreshToken generates a new token
	RefreshToken(ctx context.Context, oldToken string) (newToken string, err error)
}

// CacheService defines caching operations
type CacheService interface {
	// Get retrieves a value by key
	Get(ctx context.Context, key string) ([]byte, error)

	// Set stores a value with optional TTL
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error

	// Delete removes a key
	Delete(ctx context.Context, key string) error

	// Exists checks if a key exists
	Exists(ctx context.Context, key string) (bool, error)
}

// EventPublisher defines event publishing operations
type EventPublisher interface {
	// Publish sends an event to a topic
	Publish(ctx context.Context, topic string, payload []byte) error

	// PublishBatch sends multiple events
	PublishBatch(ctx context.Context, topic string, payloads [][]byte) error
}

// EventSubscriber defines event subscription operations
type EventSubscriber interface {
	// Subscribe registers a handler for a topic
	Subscribe(ctx context.Context, topic string, handler func([]byte) error) error

	// Unsubscribe removes a subscription
	Unsubscribe(ctx context.Context, topic string) error
}

// Logger defines logging operations
type Logger interface {
	Debug(msg string, fields ...interface{})
	Info(msg string, fields ...interface{})
	Warn(msg string, fields ...interface{})
	Error(msg string, fields ...interface{})
	Fatal(msg string, fields ...interface{})
	With(fields ...interface{}) Logger
}

// Closer interface for cleanup
type Closer interface {
	Close() error
}

// Healthchecker defines health check operations
type Healthchecker interface {
	// HealthCheck returns nil if healthy, error otherwise
	HealthCheck(ctx context.Context) error

	// ReadinessCheck returns nil if ready to serve traffic
	ReadinessCheck(ctx context.Context) error

	// LivenessCheck returns nil if the service is alive
	LivenessCheck(ctx context.Context) error
}

// Embedded interface demonstrates interface embedding
type ReadWriter interface {
	io.Reader
	io.Writer
}

// Service combines multiple interfaces
type Service interface {
	Closer
	Healthchecker
}

// FullService demonstrates complex interface embedding
type FullService interface {
	UserService
	AuthService
	Closer
	Healthchecker
}

// GenericRepository demonstrates a generic-like interface pattern
type GenericRepository interface {
	FindByID(ctx context.Context, id interface{}) (interface{}, error)
	FindAll(ctx context.Context) ([]interface{}, error)
	Save(ctx context.Context, entity interface{}) error
	Delete(ctx context.Context, id interface{}) error
}

// Empty interface (marker interface)
type Marker interface{}

// Serializable is an empty interface for serialization marker
type Serializable interface{}

// SingleMethod interface
type Stringer interface {
	String() string
}

// NoParamReturn interface with no parameters or return
type Pinger interface {
	Ping()
}

// MultiReturn interface with multiple return values
type Calculator interface {
	Divide(a, b float64) (result float64, remainder float64, err error)
}

// VariadicInterface with variadic parameters
type Formatter interface {
	Format(format string, args ...interface{}) string
}

// unexportedInterface should not be extracted
type unexportedInterface interface {
	hidden()
}
