// Package models contains embedded struct definitions
// This file tests embedded struct handling and composition patterns
package models

import (
	"time"
)

// BaseModel provides common fields for all entities
type BaseModel struct {
	ID        int64     `json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// SoftDelete provides soft delete functionality
type SoftDelete struct {
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
	IsDeleted bool       `json:"is_deleted"`
}

// Timestamped provides timestamp-only embedding
type Timestamped struct {
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// User for embedding tests (simple user type)
type User struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email,omitempty"`
}

// Person represents a person with basic info
type Person struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Phone string `json:"phone,omitempty"`
}

// UserResponse embeds User with additional fields
type UserResponse struct {
	User           // Anonymous embedding
	Token string   `json:"token"`
	Roles []string `json:"roles,omitempty"`
}

// ExtendedUser uses pointer embedding
type ExtendedUser struct {
	*User
	Preferences map[string]string `json:"preferences,omitempty"`
}

// CompleteProfile combines multiple embeddings
type CompleteProfile struct {
	User
	*AddressInfo
	Bio string `json:"bio,omitempty"`
}

// OverriddenUser overrides embedded field
type OverriddenUser struct {
	User
	ID   string `json:"id"` // Override int64 ID with string
	Role string `json:"role"`
}

// ComposedType for allOf pattern
type ComposedType struct {
	User
	SoftDelete
	Extra string `json:"extra"`
}

// Employee embeds Person anonymously (composition)
type Employee struct {
	Person               // Anonymous embedding - fields flattened
	EmployeeID string    `json:"employee_id"`
	Department string    `json:"department"`
	HireDate   time.Time `json:"hire_date"`
}

// Manager extends Employee with additional fields
type Manager struct {
	Employee        // Nested anonymous embedding
	TeamSize int    `json:"team_size"`
	Level    string `json:"level"`
}

// Customer embeds multiple types
type Customer struct {
	BaseModel             // Anonymous embedding
	Person                // Anonymous embedding - overlapping would fail in real Go
	CustomerNumber string `json:"customer_number"`
	Tier           string `json:"tier"`
}

// Article with soft delete capability
type Article struct {
	BaseModel         // ID, created_at, updated_at
	SoftDelete        // deleted_at, is_deleted
	Title      string `json:"title"`
	Content    string `json:"content"`
	AuthorID   int64  `json:"author_id"`
}

// AuditLog demonstrates embedding with override
type AuditLog struct {
	BaseModel
	// Override embedded field
	ID         string `json:"id"` // Override int64 ID with string UUID
	Action     string `json:"action"`
	EntityType string `json:"entity_type"`
	EntityID   string `json:"entity_id"`
}

// PointerEmbedding demonstrates pointer embedding
type PointerEmbedding struct {
	*BaseModel        // Pointer embedding
	Name       string `json:"name"`
}

// AddressInfo for embedding test
type AddressInfo struct {
	Street  string `json:"street"`
	City    string `json:"city"`
	State   string `json:"state"`
	ZipCode string `json:"zip_code"`
	Country string `json:"country"`
}

// ContactInfo embeds AddressInfo with pointer
type ContactInfo struct {
	*AddressInfo        // Pointer to embedded struct
	Phone        string `json:"phone"`
	Email        string `json:"email"`
	Website      string `json:"website,omitempty"`
}

// Company demonstrates complex embedding hierarchy
type Company struct {
	BaseModel
	Name      string       `json:"name"`
	LegalName string       `json:"legal_name"`
	Address   AddressInfo  `json:"address"` // Named field (not embedded)
	Contact   *ContactInfo `json:"contact,omitempty"`
}

// UserProfile combines multiple embedded types with explicit fields
type UserProfile struct {
	BaseModel
	SoftDelete
	Username    string            `json:"username"`
	DisplayName string            `json:"display_name"`
	Bio         string            `json:"bio,omitempty"`
	Preferences map[string]string `json:"preferences,omitempty"`
}

// NestedResponse demonstrates response wrapper with embedded data
type NestedResponse struct {
	Data    interface{} `json:"data"`
	Success bool        `json:"success"`
}

// UserResponseWrapper embeds user data
type UserResponseWrapper struct {
	NestedResponse         // Embed response wrapper
	User           *Person `json:"user"`
}

// GenericEntity demonstrates a pattern with generic-like composition
type GenericEntity struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// MultiLevelEmbed tests deep embedding
type Level1 struct {
	L1Field string `json:"l1_field"`
}

type Level2 struct {
	Level1
	L2Field string `json:"l2_field"`
}

type Level3 struct {
	Level2
	L3Field string `json:"l3_field"`
}

type Level4 struct {
	Level3
	L4Field string `json:"l4_field"`
}
