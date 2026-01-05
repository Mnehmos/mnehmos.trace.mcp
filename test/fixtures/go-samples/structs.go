// Package models contains struct definitions with various JSON tags
// This file tests struct extraction with field types and JSON tag parsing
package models

import (
	"time"
)

// User represents a basic user with JSON tags
type User struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email,omitempty"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	PasswordHash string    `json:"-"` // Skip serialization
}

// Address represents a physical address
type Address struct {
	Street  string `json:"street"`
	City    string `json:"city"`
	Country string `json:"country"`
	ZipCode string `json:"zip_code,omitempty"`
}

// Product represents a product with various tag options
type Product struct {
	SKU         string  `json:"sku"`
	Name        string  `json:"name"`
	Description string  `json:"description,omitempty"`
	Price       float64 `json:"price"`
	InStock     bool    `json:"in_stock"`
	// Private field - should not be exported
	internalID int
}

// CreateUserRequest represents user creation payload
type CreateUserRequest struct {
	Name     string `json:"name" validate:"required"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
	Age      int    `json:"age,omitempty" validate:"gte=0,lte=150"`
}

// UpdateUserRequest represents user update payload with optional fields
type UpdateUserRequest struct {
	Name  *string `json:"name,omitempty"`
	Email *string `json:"email,omitempty"`
}

// UserResponse represents the API response with skip and string tags
type UserResponse struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	Password   string `json:"-"` // Skip serialization
	APIKey     string `json:"-"` // Another skip field
	IsActive   bool   `json:"is_active"`
	LoginCount int64  `json:"login_count,string"` // Serialize as string
}

// Settings demonstrates multiple tag types
type Settings struct {
	UserID   int64  `json:"user_id" db:"user_id" xml:"userId"`
	Theme    string `json:"theme" db:"theme" xml:"theme,attr"`
	Language string `json:"language" db:"language"`
	Timezone string `json:"timezone,omitempty" db:"tz,omitempty"`
}

// Order demonstrates pointer and slice fields
type Order struct {
	ID           int64     `json:"id"`
	UserID       int64     `json:"user_id"`
	Items        []string  `json:"items"`
	ShippingAddr *Address  `json:"shipping_address,omitempty"`
	BillingAddr  *Address  `json:"billing_address,omitempty"`
	Total        float64   `json:"total"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
}

// Metadata demonstrates nested struct types
type Metadata struct {
	Key        string                 `json:"key"`
	Value      string                 `json:"value"`
	Tags       map[string]string      `json:"tags,omitempty"`
	Properties map[string]interface{} `json:"properties,omitempty"`
	Counts     map[string]int         `json:"counts,omitempty"`
}

// MultiFieldRow demonstrates multiple fields on single line (less common but valid)
type MultiFieldRow struct {
	X, Y, Z int `json:"x"` // Only first field gets the tag in standard practice
}

// EmptyStruct represents an empty struct (marker type)
type EmptyStruct struct{}

// unexportedStruct should not be extracted (lowercase name)
type unexportedStruct struct {
	field string
}
