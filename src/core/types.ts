/**
 * Trace Contracts - Core Types
 * Language-agnostic intermediate representation for schemas
 *
 * This file defines the normalized schema IR that all adapters convert to.
 * Based on .context/TYPES.md
 */

// ============================================================================
// Schema Source Reference
// ============================================================================

/**
 * All supported schema source types
 */
export type SchemaSourceKind =
  // API Layer
  | "openapi"
  | "graphql"
  | "grpc"
  | "trpc"
  | "asyncapi"
  // Validation Layer
  | "zod"
  | "yup"
  | "joi"
  | "json_schema"
  | "typebox"
  // Database Layer
  | "sql_ddl"
  | "prisma"
  | "drizzle"
  | "typeorm"
  // Language Types
  | "typescript"
  | "python"
  // Runtime
  | "mcp"
  | "json_sample"
  // Escape hatch
  | "custom";

/**
 * Reference to a schema source (adapter-specific)
 */
export interface SchemaRef {
  source: SchemaSourceKind;
  id: string; // Format depends on source (e.g., "tool:my_tool" for MCP)
  options?: AdapterOptions;
}

export interface AdapterOptions {
  [key: string]: unknown;
}

// ============================================================================
// Source Location
// ============================================================================

export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
}

// ============================================================================
// Normalized Schema (Language-Agnostic IR)
// ============================================================================

/**
 * Language-agnostic schema representation
 * All adapters convert their native formats to this
 */
export interface NormalizedSchema {
  name?: string;
  properties: Record<string, PropertyDef>;
  required: string[];
  additionalProperties?: boolean | NormalizedType;
  source: SchemaRef;
  location?: SourceLocation;
}

/**
 * Property definition with all metadata
 */
export interface PropertyDef {
  type: NormalizedType;
  optional: boolean;
  nullable: boolean;
  readonly: boolean;
  deprecated: boolean;
  description?: string;
  constraints?: Constraints;
}

/**
 * Normalized type system
 */
export type NormalizedType =
  | { kind: "primitive"; value: "string" | "number" | "boolean" | "null" }
  | { kind: "literal"; value: string | number | boolean }
  | { kind: "array"; element: NormalizedType }
  | { kind: "object"; schema: NormalizedSchema }
  | { kind: "union"; variants: NormalizedType[] }
  | { kind: "intersection"; members: NormalizedType[] }
  | { kind: "ref"; name: string }
  | { kind: "any" }
  | { kind: "unknown" };

/**
 * Validation constraints
 */
export interface Constraints {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  enum?: unknown[];
}

// ============================================================================
// Data Flow Direction
// ============================================================================

/**
 * Direction of data flow for compatibility checking
 *
 * - producer_to_consumer: Producer response → Consumer (e.g., API response)
 *   Extra producer fields are OK (consumer ignores them)
 *   Missing producer fields are errors (consumer expects them)
 *
 * - consumer_to_producer: Consumer request → Producer (e.g., API request)
 *   Extra consumer fields are OK (producer ignores them)
 *   Missing consumer fields are errors (producer expects them)
 *
 * - bidirectional: Must match exactly both ways
 */
export type DataFlowDirection =
  | "producer_to_consumer"
  | "consumer_to_producer"
  | "bidirectional";

// ============================================================================
// Comparison Types
// ============================================================================

/**
 * Options for schema comparison
 */
export interface CompareOptions {
  direction: DataFlowDirection;
  semanticMatching?: boolean;
  aliases?: string[][];
  caseNormalization?: "none" | "camel_snake" | "all";
  ignoreProperties?: string[];
  strict?: boolean; // For backwards compatibility with existing code
}

/**
 * Result of comparing two schemas
 */
export interface ComparisonResult {
  compatible: boolean;
  score: number; // 0-100 compatibility score
  producer: SchemaRef;
  consumer: SchemaRef;
  errors: Mismatch[];
  warnings: Warning[];
}

/**
 * Types of mismatches that can occur
 */
export type Mismatch =
  | {
      kind: "missing_property";
      property: string;
      existsIn: "producer" | "consumer";
      producerLocation?: SourceLocation;
      consumerLocation?: SourceLocation;
    }
  | {
      kind: "type_mismatch";
      property: string;
      producerType: NormalizedType;
      consumerType: NormalizedType;
      producerLocation?: SourceLocation;
      consumerLocation?: SourceLocation;
    }
  | {
      kind: "required_mismatch";
      property: string;
      producerRequired: boolean;
      consumerRequired: boolean;
      producerLocation?: SourceLocation;
      consumerLocation?: SourceLocation;
    }
  | {
      kind: "constraint_violation";
      property: string;
      constraint: string;
      producerValue: unknown;
      consumerValue: unknown;
      producerLocation?: SourceLocation;
      consumerLocation?: SourceLocation;
    };

/**
 * Non-critical issues
 */
export interface Warning {
  kind: "deprecated" | "extra_property" | "loose_type" | "typo_suggestion";
  property?: string;
  message: string;
  suggestion?: string;
}

// ============================================================================
// Adapter Interface
// ============================================================================

/**
 * Interface that all schema adapters must implement
 */
export interface SchemaAdapter {
  readonly kind: SchemaSourceKind;

  /**
   * Check if this adapter can handle a given schema reference
   */
  supports(ref: SchemaRef): boolean;

  /**
   * Extract a schema and convert to normalized format
   */
  extract(ref: SchemaRef): Promise<NormalizedSchema>;

  /**
   * Optional: List all available schemas in a directory/file
   */
  list?(basePath: string): Promise<SchemaRef[]>;
}
