/**
 * Pattern Matcher Errors
 *
 * Error types for pattern matching and extraction operations.
 * Each error includes a machine-readable error code for programmatic handling.
 *
 * @module patterns/errors
 * @see .context/ADR-P2-1-PATTERN-MATCHER.md
 *
 * @example
 * ```typescript
 * try {
 *   const matcher = getPattern('unknown-framework');
 * } catch (error) {
 *   if (error instanceof PatternNotFoundError) {
 *     console.log(`Code: ${error.code}`); // PATTERN_NOT_FOUND
 *     console.log(`Available: ${error.available.join(', ')}`);
 *   }
 * }
 * ```
 */

import type { SchemaLocation, MatchResult } from './types.js';

/**
 * Error codes for pattern matcher errors.
 * Use these codes for machine-readable error handling.
 */
export const PatternErrorCodes = {
  /** Base registry error */
  REGISTRY_ERROR: 'PATTERN_REGISTRY_ERROR',
  /** Pattern matcher not found in registry */
  NOT_FOUND: 'PATTERN_NOT_FOUND',
  /** Pattern matcher failed validation */
  VALIDATION_FAILED: 'PATTERN_VALIDATION_FAILED',
  /** Pattern matching operation failed */
  MATCH_FAILED: 'PATTERN_MATCH_FAILED',
  /** Schema extraction from pattern failed */
  EXTRACTION_FAILED: 'PATTERN_EXTRACTION_FAILED',
} as const;

/** Type for pattern error codes */
export type PatternErrorCode = typeof PatternErrorCodes[keyof typeof PatternErrorCodes];

/**
 * Base error for pattern registry operations.
 * All pattern-related errors extend this class.
 *
 * @example
 * ```typescript
 * if (error instanceof PatternRegistryError) {
 *   console.log(`Pattern error: ${error.code}`);
 * }
 * ```
 */
export class PatternRegistryError extends Error {
  /** Machine-readable error code */
  readonly code: PatternErrorCode = PatternErrorCodes.REGISTRY_ERROR;

  constructor(message: string) {
    super(message);
    this.name = 'PatternRegistryError';
  }
}

/**
 * Thrown when a pattern matcher is not found in the registry.
 *
 * @example
 * ```typescript
 * try {
 *   getPattern('express');
 * } catch (e) {
 *   if (e instanceof PatternNotFoundError) {
 *     console.log(`'${e.framework}' not found. Try: ${e.available.join(', ')}`);
 *   }
 * }
 * ```
 */
export class PatternNotFoundError extends PatternRegistryError {
  override readonly code = PatternErrorCodes.NOT_FOUND;

  constructor(
    /** The framework name that was requested */
    public readonly framework: string,
    /** List of available pattern matcher names */
    public readonly available: string[]
  ) {
    const availableList = available.length > 0 ? available.join(', ') : 'none';
    super(
      `Pattern matcher '${framework}' not found. Available matchers: ${availableList}`
    );
    this.name = 'PatternNotFoundError';
  }
}

/**
 * Thrown when a pattern matcher fails validation during registration.
 * This typically indicates a malformed matcher implementation.
 *
 * @example
 * ```typescript
 * try {
 *   registerPattern(invalidMatcher);
 * } catch (e) {
 *   if (e instanceof PatternValidationError) {
 *     console.error(`Validation failed: ${e.reason}`);
 *   }
 * }
 * ```
 */
export class PatternValidationError extends PatternRegistryError {
  override readonly code = PatternErrorCodes.VALIDATION_FAILED;

  constructor(
    /** The matcher object that failed validation */
    public readonly matcher: unknown,
    /** Human-readable description of why validation failed */
    public readonly reason: string
  ) {
    super(`Invalid pattern matcher: ${reason}`);
    this.name = 'PatternValidationError';
  }
}

/**
 * Thrown when pattern matching fails during AST analysis.
 * This can occur when the AST structure doesn't match expectations.
 *
 * @example
 * ```typescript
 * try {
 *   matcher.match(node);
 * } catch (e) {
 *   if (e instanceof PatternMatchError) {
 *     console.error(`Match failed in ${e.matcher}: ${e.reason}`);
 *   }
 * }
 * ```
 */
export class PatternMatchError extends PatternRegistryError {
  override readonly code = PatternErrorCodes.MATCH_FAILED;

  constructor(
    /** Name of the matcher that failed */
    public readonly matcher: string,
    /** Summary of the AST node being matched */
    public readonly nodeSummary: string,
    /** Human-readable description of why matching failed */
    public readonly reason: string
  ) {
    super(`Pattern match failed in '${matcher}' for ${nodeSummary}: ${reason}`);
    this.name = 'PatternMatchError';
  }
}

/**
 * Thrown when schema extraction fails from a matched pattern.
 * This occurs when the schema location cannot be resolved.
 *
 * @example
 * ```typescript
 * try {
 *   const schema = await matcher.extract(match);
 * } catch (e) {
 *   if (e instanceof PatternExtractionError) {
 *     console.error(`Cannot extract from ${e.schemaLocation.type}`);
 *   }
 * }
 * ```
 */
export class PatternExtractionError extends PatternRegistryError {
  override readonly code = PatternErrorCodes.EXTRACTION_FAILED;

  constructor(
    /** The match result that extraction was attempted on */
    public readonly match: MatchResult,
    /** The schema location that could not be resolved */
    public readonly schemaLocation: SchemaLocation,
    /** Human-readable description of why extraction failed */
    public readonly reason: string
  ) {
    super(
      `Schema extraction failed for '${match.identifier}' at ${schemaLocation.type}: ${reason}`
    );
    this.name = 'PatternExtractionError';
  }
}
