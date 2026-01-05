/**
 * Go Language Parser - Type Definitions
 * Defines types for Go struct parsing, route detection, and schema generation
 */

import type { SourceLocation } from '../../types.js';

/**
 * Go struct field definition
 */
export interface GoField {
  /** Original Go field name */
  name: string;
  /** JSON property name (from json tag, or field name if no tag) */
  jsonName: string;
  /** Go type (e.g., 'string', 'int64', '*User') */
  goType: string;
  /** Whether the field is a pointer type */
  isPointer: boolean;
  /** Whether the field has omitempty tag */
  omitempty: boolean;
  /** Whether the field should be skipped (json:"-") */
  skip: boolean;
  /** Whether the field has validate:"required" */
  validateRequired: boolean;
  /** Field documentation comment */
  description?: string;
  /** Source line number */
  line?: number;
}

/**
 * Go struct definition
 */
export interface GoStruct {
  /** Struct name */
  name: string;
  /** Struct fields */
  fields: GoField[];
  /** Embedded struct type names */
  embeddedTypes: string[];
  /** Documentation comment */
  description?: string;
  /** Source location */
  sourceLocation?: SourceLocation;
}

/**
 * Go interface method definition
 */
export interface GoMethod {
  /** Method name */
  name: string;
  /** Parameter names */
  parameters?: string[];
  /** Return type names */
  returnType?: string[];
}

/**
 * Go interface definition
 */
export interface GoInterface {
  /** Interface name */
  name: string;
  /** Interface methods */
  methods: GoMethod[];
  /** Embedded interface names */
  embeddedInterfaces: string[];
  /** Documentation comment */
  description?: string;
  /** Source location */
  sourceLocation?: SourceLocation;
}

/**
 * Go route definition from HTTP framework detection
 */
export interface GoRoute {
  /** Route path (e.g., '/users/{id}') */
  path: string;
  /** HTTP method (GET, POST, etc.) */
  method?: string;
  /** Multiple methods (for stdlib that doesn't specify) */
  methods?: string[];
  /** Extracted path parameters */
  pathParams?: string[];
  /** Handler function name */
  handler?: string;
  /** Source line number */
  line?: number;
}

/**
 * Parsed JSON struct tag
 */
export interface ParsedTag {
  /** JSON property name */
  name: string;
  /** Whether omitempty is present */
  omitempty: boolean;
  /** Whether to skip serialization (json:"-") */
  skip: boolean;
  /** Whether to serialize as string (json:",string") */
  asString: boolean;
}

/**
 * Options for parsing Go source code
 */
export interface GoParseOptions {
  /** Source code content */
  content: string;
  /** File path for source location tracking */
  filePath?: string;
}

/**
 * Go schema (struct/interface) representation for output
 */
export interface GoSchema {
  /** Schema name (struct/interface name) */
  name: string;
  /** Schema type: 'object', 'interface' */
  type?: string;
  /** Description from comments */
  description?: string;
  /** Properties for struct fields */
  properties?: Record<string, GoProperty>;
  /** Required fields (no omitempty) */
  required?: string[];
  /** For composition (embedded structs) */
  allOf?: GoSchema[];
  /** Interface methods */
  methods?: GoMethod[];
  /** Source location */
  sourceLocation?: SourceLocation;
}

/**
 * Property definition for Go struct fields in JSON Schema format
 */
export interface GoProperty {
  type?: string;
  format?: string;
  description?: string;
  items?: GoProperty;
  additionalProperties?: GoProperty | boolean;
  nullable?: boolean;
  default?: unknown;
  enum?: unknown[];
  [key: string]: unknown;
}

/**
 * Type alias definitions found in Go source
 */
export interface GoTypeAlias {
  /** Alias name */
  name: string;
  /** Underlying type */
  underlyingType: string;
}
