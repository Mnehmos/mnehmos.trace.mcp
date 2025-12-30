/**
 * 🚨 Adapter Registry Errors
 * Custom error types for the adapter registry system
 * 
 * @module adapters/errors
 */

import type { SchemaAdapter, SchemaSourceKind } from '../core/types.js';

/**
 * Base error class for all adapter registry operations.
 * 
 * All adapter-specific errors inherit from this class, allowing
 * consumers to catch all adapter errors with a single catch block.
 * 
 * @example
 * ```typescript
 * try {
 *   const adapter = getAdapter('unknown-kind');
 * } catch (error) {
 *   if (error instanceof AdapterRegistryError) {
 *     console.error('Adapter operation failed:', error.message);
 *   }
 * }
 * ```
 */
export class AdapterRegistryError extends Error {
  /**
   * Creates a new AdapterRegistryError.
   * 
   * @param message - Human-readable error description
   */
  constructor(message: string) {
    super(message);
    this.name = 'AdapterRegistryError';
  }
}

/**
 * Error thrown when a requested adapter is not found in the registry.
 * 
 * This error provides context about what kind was requested and
 * what kinds are currently available, aiding in debugging.
 * 
 * @example
 * ```typescript
 * try {
 *   const adapter = getAdapter('graphql');
 * } catch (error) {
 *   if (error instanceof AdapterNotFoundError) {
 *     console.log(`Requested: ${error.kind}`);
 *     console.log(`Available: ${error.available.join(', ')}`);
 *   }
 * }
 * ```
 */
export class AdapterNotFoundError extends AdapterRegistryError {
  /** The kind that was requested but not found */
  readonly kind: SchemaSourceKind;
  
  /** List of currently registered adapter kinds */
  readonly available: SchemaSourceKind[];

  /**
   * Creates a new AdapterNotFoundError.
   * 
   * @param kind - The schema source kind that was requested
   * @param available - List of currently registered adapter kinds
   */
  constructor(kind: SchemaSourceKind, available: SchemaSourceKind[]) {
    const availableStr = available.length > 0 ? available.join(', ') : 'none';
    super(`No adapter found for kind "${kind}". Available: ${availableStr}`);
    this.name = 'AdapterNotFoundError';
    this.kind = kind;
    this.available = available;
  }
}

/**
 * Error thrown when adapter validation fails during registration.
 * 
 * This error is thrown when an adapter doesn't meet the required
 * interface contract (missing kind, supports, or extract methods).
 * 
 * @example
 * ```typescript
 * try {
 *   registerAdapter({ kind: 'test' } as SchemaAdapter);
 * } catch (error) {
 *   if (error instanceof AdapterValidationError) {
 *     console.log(`Validation failed: ${error.reason}`);
 *   }
 * }
 * ```
 */
export class AdapterValidationError extends AdapterRegistryError {
  /** The partial adapter object that failed validation */
  readonly adapter: Partial<SchemaAdapter>;
  
  /** Human-readable reason for validation failure */
  readonly reason: string;

  /**
   * Creates a new AdapterValidationError.
   * 
   * @param adapter - The adapter object that failed validation
   * @param reason - Human-readable explanation of why validation failed
   */
  constructor(adapter: Partial<SchemaAdapter>, reason: string) {
    super(`Invalid adapter: ${reason}`);
    this.name = 'AdapterValidationError';
    this.adapter = adapter;
    this.reason = reason;
  }
}
