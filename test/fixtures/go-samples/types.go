// Package models contains various Go type definitions
// This file tests type conversion from Go types to NormalizedSchema
package models

import (
	"encoding/json"
	"time"
)

// ========================================
// Primitive Types
// ========================================

// PrimitiveTypes demonstrates basic Go primitives
type PrimitiveTypes struct {
	// String types
	StringVal string `json:"string_val"`
	ByteVal   byte   `json:"byte_val"`
	RuneVal   rune   `json:"rune_val"`

	// Integer types - signed
	IntVal   int   `json:"int_val"`
	Int8Val  int8  `json:"int8_val"`
	Int16Val int16 `json:"int16_val"`
	Int32Val int32 `json:"int32_val"`
	Int64Val int64 `json:"int64_val"`

	// Integer types - unsigned
	UintVal    uint    `json:"uint_val"`
	Uint8Val   uint8   `json:"uint8_val"`
	Uint16Val  uint16  `json:"uint16_val"`
	Uint32Val  uint32  `json:"uint32_val"`
	Uint64Val  uint64  `json:"uint64_val"`
	UintptrVal uintptr `json:"uintptr_val"`

	// Floating point types
	Float32Val float32 `json:"float32_val"`
	Float64Val float64 `json:"float64_val"`

	// Complex types (typically not serialized to JSON)
	Complex64Val  complex64  `json:"complex64_val,omitempty"`
	Complex128Val complex128 `json:"complex128_val,omitempty"`

	// Boolean
	BoolVal bool `json:"bool_val"`
}

// ========================================
// Pointer Types
// ========================================

// PointerTypes demonstrates pointer fields (nullable in JSON)
type PointerTypes struct {
	// Pointer to primitives -> union with null
	StringPtr  *string  `json:"string_ptr"`
	IntPtr     *int     `json:"int_ptr"`
	Int64Ptr   *int64   `json:"int64_ptr"`
	Float64Ptr *float64 `json:"float64_ptr"`
	BoolPtr    *bool    `json:"bool_ptr"`

	// Pointer to struct
	UserPtr *SimpleUser `json:"user_ptr"`

	// Double pointer (rare but valid)
	DoublePtr **string `json:"double_ptr"`
}

// SimpleUser for pointer examples
type SimpleUser struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

// ========================================
// Slice Types
// ========================================

// SliceTypes demonstrates slice/array fields
type SliceTypes struct {
	// Slice of primitives -> array
	StringSlice  []string  `json:"string_slice"`
	IntSlice     []int     `json:"int_slice"`
	Int64Slice   []int64   `json:"int64_slice"`
	Float64Slice []float64 `json:"float64_slice"`
	BoolSlice    []bool    `json:"bool_slice"`

	// Slice of bytes (special case - often base64)
	ByteSlice []byte `json:"byte_slice"`

	// Slice of pointers
	StringPtrSlice []*string `json:"string_ptr_slice"`

	// Slice of structs
	UserSlice []SimpleUser `json:"user_slice"`

	// Slice of struct pointers
	UserPtrSlice []*SimpleUser `json:"user_ptr_slice"`

	// Nested slices
	StringMatrix [][]string `json:"string_matrix"`
	IntMatrix    [][]int    `json:"int_matrix"`
}

// ========================================
// Array Types (Fixed Size)
// ========================================

// ArrayTypes demonstrates fixed-size arrays
type ArrayTypes struct {
	// Fixed size arrays -> tuple or array with constraints
	FixedStringArray [3]string `json:"fixed_string_array"`
	FixedIntArray    [5]int    `json:"fixed_int_array"`
	ByteArray32      [32]byte  `json:"byte_array_32"`
}

// ========================================
// Map Types
// ========================================

// MapTypes demonstrates map fields
type MapTypes struct {
	// String key maps -> object with additionalProperties
	StringStringMap map[string]string `json:"string_string_map"`
	StringIntMap    map[string]int    `json:"string_int_map"`
	StringBoolMap   map[string]bool   `json:"string_bool_map"`

	// String to struct map
	StringUserMap map[string]SimpleUser `json:"string_user_map"`

	// String to pointer map
	StringUserPtrMap map[string]*SimpleUser `json:"string_user_ptr_map"`

	// String to any map
	StringAnyMap map[string]interface{} `json:"string_any_map"`

	// Integer key maps (JSON keys must be strings)
	IntStringMap map[int]string `json:"int_string_map"`
	Int64IntMap  map[int64]int  `json:"int64_int_map"`

	// Nested maps
	NestedMap map[string]map[string]int `json:"nested_map"`
}

// ========================================
// Interface Types
// ========================================

// InterfaceTypes demonstrates interface fields
type InterfaceTypes struct {
	// Empty interface -> any type
	AnyValue interface{} `json:"any_value"`

	// Using 'any' (Go 1.18+) alias
	AnyAlias any `json:"any_alias"`

	// Slice of interface
	AnySlice []interface{} `json:"any_slice"`

	// Map with interface values
	AnyMap map[string]interface{} `json:"any_map"`
}

// ========================================
// Time Types
// ========================================

// TimeTypes demonstrates time.Time handling
type TimeTypes struct {
	// time.Time -> string (ISO 8601)
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DeletedAt time.Time `json:"deleted_at,omitempty"`

	// Pointer to time (nullable)
	ExpiresAt *time.Time `json:"expires_at"`

	// Duration (typically serialized as int64 nanoseconds or string)
	Timeout time.Duration `json:"timeout"`
}

// ========================================
// JSON-specific Types
// ========================================

// JSONTypes demonstrates json.RawMessage and similar
type JSONTypes struct {
	// json.RawMessage -> passthrough JSON
	RawData   json.RawMessage `json:"raw_data"`
	RawConfig json.RawMessage `json:"raw_config,omitempty"`

	// Pointer to RawMessage
	OptionalRaw *json.RawMessage `json:"optional_raw"`

	// json.Number -> string or number
	NumericVal json.Number `json:"numeric_val"`
}

// ========================================
// Struct Tags Variations
// ========================================

// TagVariations demonstrates different struct tag patterns
type TagVariations struct {
	// Standard json tag
	Normal string `json:"normal"`

	// With omitempty
	Optional string `json:"optional,omitempty"`

	// Skip field (not serialized)
	Skipped string `json:"-"`

	// Empty name (use field name)
	UseFieldName string `json:",omitempty"`

	// Multiple tags
	MultiTag string `json:"multi_tag" db:"multi_tag_col" xml:"MultiTag"`

	// Validation tags
	Validated string `json:"validated" validate:"required,min=3,max=100"`

	// BSON tag (MongoDB)
	MongoID string `json:"mongo_id" bson:"_id"`

	// Form binding tag
	FormField string `json:"form_field" form:"form_field" binding:"required"`
}

// ========================================
// Type Aliases
// ========================================

// Type aliases
type UserID int64
type EmailAddr string
type TagsList []string
type MetaMap map[string]interface{}

// AliasedTypes uses custom type aliases
type AliasedTypes struct {
	ID       UserID    `json:"id"`
	Email    EmailAddr `json:"email"`
	Tags     TagsList  `json:"tags"`
	MetaInfo MetaMap   `json:"metadata"`
}

// ========================================
// Struct Embedding with Types
// ========================================

// TypedEmbedding demonstrates embedded types
type TypedEmbedding struct {
	PrimitiveTypes        // Anonymous embedding
	TimeTypes             // Another embedding
	CustomField    string `json:"custom_field"`
}

// ========================================
// Channel and Function Types (not JSON serializable)
// ========================================

// NonSerializable contains types that cannot be JSON serialized
type NonSerializable struct {
	// These should be skipped or cause warnings
	Channel   chan int     `json:"-"` // Channels can't serialize
	Function  func() error `json:"-"` // Functions can't serialize
	UnsafePtr uintptr      `json:"-"` // Unsafe pointers

	// Normal field for comparison
	Name string `json:"name"`
}

// ========================================
// Generic Types (Go 1.18+)
// ========================================

// Generic container type
type Container[T any] struct {
	Value    T      `json:"value"`
	Metadata string `json:"metadata"`
}

// Generic with constraints
type NumericContainer[T int | int64 | float64] struct {
	Value T `json:"value"`
}

// Multiple type parameters
type Pair[K comparable, V any] struct {
	Key   K `json:"key"`
	Value V `json:"value"`
}

// Instantiated generic types
type StringContainer = Container[string]
type IntContainer = Container[int]
type UserContainer = Container[SimpleUser]

// CircularType demonstrates self-referential types
type CircularType struct {
	ID       int64          `json:"id"`
	Name     string         `json:"name"`
	Parent   *CircularType  `json:"parent,omitempty"`
	Children []CircularType `json:"children,omitempty"`
}
