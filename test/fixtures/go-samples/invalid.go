// Package models contains intentionally invalid Go syntax
// This file tests error handling and graceful degradation
package models

// ========================================
// Note: This file contains INTENTIONALLY invalid syntax
// for testing parser error handling. The compiler errors
// are expected and the file should NOT compile.
// ========================================

// InvalidStruct has syntax errors
type InvalidStruct struct {
	// Missing type
	Name
	
	// Invalid tag syntax (unclosed quote)
	BadTag string `json:"bad_tag
	
	// Invalid type name
	Field1 nonexistent_type `json:"field1"`
	
	// Missing field name (anonymous field with invalid type)
	invalid.Type
}

// UnterminatedStruct missing closing brace
type UnterminatedStruct struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
// Missing }

// InvalidInterface has syntax errors
type InvalidInterface interface {
	// Method with invalid signature
	BadMethod(
	
	// Missing return type
	AnotherMethod() 
	
	// Invalid parameter type
	InvalidParam(x nonexistent) error
}

// DuplicateFields has duplicate field names
type DuplicateFields struct {
	Name string `json:"name"`
	Name int    `json:"name2"` // Duplicate field name
}

// InvalidTags has malformed struct tags
type InvalidTags struct {
	// Tag without key
	Field1 string `:"value"`
	
	// Empty tag value
	Field2 string `json:`
	
	// Invalid characters in tag
	Field3 string `json:"field\x00three"`
	
	// Unbalanced quotes
	Field4 string `json:"unbalanced`
	
	// Missing colon
	Field5 string `json"field5"`
}

// InvalidEmbedding has problematic embedded types
type InvalidEmbedding struct {
	*  // Pointer to nothing
	
	[]string // Can't embed slice
	
	map[string]int // Can't embed map
	
	func() // Can't embed function
}

// CircularType references itself (valid but edge case)
type CircularType struct {
	Name     string        `json:"name"`
	Children []CircularType `json:"children"`
	Parent   *CircularType  `json:"parent"`
}

// InvalidGeneric has bad generic syntax (Go 1.18+)
type InvalidGeneric[T] struct { // Missing constraint
	Value T `json:"value"`
}

type BadConstraint[T int | ] struct { // Incomplete constraint
	Value T `json:"value"`
}

// RecursiveTypeAlias creates infinite type
type RecursiveAlias = RecursiveAlias

// InvalidMethodReceiver
func (InvalidStruct) BadReceiver() {} // Missing receiver name

func (*) NoType() {} // No type specified

// MismatchedBraces
type MismatchedBraces struct {
	Field string `json:"field"`
}} // Extra closing brace

// InvalidConstInStruct
type ConstInStruct struct {
	const MaxSize = 100 // Can't have const in struct
	Size int `json:"size"`
}

// PartiallyValid - starts valid, becomes invalid
type PartiallyValid struct {
	ValidField string `json:"valid_field"`
	
	// Then becomes invalid
	func invalidFunction() {} // Can't have function in struct
}

// Truncated file simulation - this comment is the end
// In a real truncated file, there would be no proper ending
// type TruncatedStruct str
