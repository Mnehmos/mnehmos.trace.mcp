/**
 * Pattern Matcher Types
 * 
 * Core types for the pattern matcher abstraction that enables pluggable
 * framework-agnostic API detection.
 * 
 * @module patterns/types
 * @see .context/ADR-P2-1-PATTERN-MATCHER.md
 */

import type { Node } from 'ts-morph';
import type { SourceLocation } from '../core/types.js';

/**
 * Types of AST patterns that can be matched
 */
export type PatternType =
  | 'call'       // Method calls: app.get(), server.tool()
  | 'decorator'  // Decorators: @Get(), @Body(), @Query()
  | 'property'   // Object properties: Query: { user: ... }
  | 'export'     // Exported declarations: export const schema = ...
  | 'chain';     // Method chains: t.procedure.input().query()

/**
 * Where to find the schema in the matched pattern
 */
export type SchemaLocation =
  | { type: 'arg'; index: number }           // Positional argument: arg[0], arg[1]
  | { type: 'arg-named'; name: string }      // Named argument: { schema: z.object() }
  | { type: 'return' }                       // Return type annotation
  | { type: 'type-param'; index: number }    // Generic type parameter: Foo<T>
  | { type: 'body' }                         // Function body (inferred from return)
  | { type: 'chain-method'; method: string } // Method in chain: .input(schema)
  | { type: 'decorator-arg'; index: number }; // Decorator argument

/**
 * Definition of a single matchable pattern
 */
export interface PatternDef {
  /** Pattern type identifier */
  readonly type: PatternType;

  /**
   * Signature to match against
   * - String: exact method/decorator name (e.g., 'get', 'Get')
   * - RegExp: pattern match (e.g., /^(get|post|put|delete)$/i)
   */
  readonly signature: string | RegExp;

  /**
   * Optional: Object path prefix (e.g., 'app', 'router', 'server')
   * For method calls, matches the receiver object
   */
  readonly receiver?: string | RegExp;

  /**
   * Where to extract the input schema from
   */
  readonly inputSchemaLocation?: SchemaLocation;

  /**
   * Where to extract the output schema from
   */
  readonly outputSchemaLocation?: SchemaLocation;

  /**
   * Optional: Additional validation predicates
   */
  readonly validate?: (node: Node) => boolean;
}

/**
 * Data captured during pattern matching
 */
export interface MatchCaptures {
  /** HTTP method for REST endpoints */
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD' | 'ALL';

  /** Route path for REST endpoints */
  routePath?: string;

  /** Procedure type for tRPC */
  procedureType?: 'query' | 'mutation' | 'subscription';

  /** Description from JSDoc or argument */
  description?: string;

  /** Input schema AST node (for extraction) */
  inputSchemaNode?: Node;

  /** Output schema AST node (for extraction) */
  outputSchemaNode?: Node;

  /** Additional framework-specific captures */
  [key: string]: unknown;
}

/**
 * Result of a successful pattern match
 */
export interface MatchResult {
  /** The pattern that matched */
  readonly pattern: PatternDef;

  /** The AST node that was matched */
  readonly node: Node;

  /** Framework that produced this match */
  readonly framework: string;

  /** Extracted identifier (tool name, route path, etc.) */
  readonly identifier: string;

  /** Source location for error reporting */
  readonly location: SourceLocation;

  /** Captured data from the match */
  readonly captures: MatchCaptures;
}
