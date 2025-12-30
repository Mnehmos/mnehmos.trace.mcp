/**
 * Pattern Matcher Module
 *
 * Public API for the pattern matcher abstraction that enables pluggable
 * framework-agnostic API detection.
 *
 * ## Overview
 *
 * The pattern matcher system provides:
 * - **Type Definitions**: Core types for pattern matching ({@link PatternType}, {@link PatternDef})
 * - **Error Handling**: Typed errors with machine-readable codes ({@link PatternErrorCodes})
 * - **Base Classes**: Abstract base for custom matchers ({@link BasePatternMatcher})
 * - **Registry**: Singleton registry for pattern matchers ({@link registerPattern}, {@link scanForPatterns})
 * - **Extractors**: Schema extraction utilities ({@link extractSchemaNode})
 *
 * ## Quick Start
 *
 * ```typescript
 * import {
 *   registerPattern,
 *   scanForPatterns,
 *   BasePatternMatcher
 * } from './patterns';
 *
 * // Register a custom matcher
 * class MyMatcher extends BasePatternMatcher { ... }
 * registerPattern(new MyMatcher());
 *
 * // Scan for patterns
 * const matches = scanForPatterns(sourceFile);
 * ```
 *
 * @module patterns
 * @see .context/ADR-P2-1-PATTERN-MATCHER.md
 */

// ─────────────────────────────────────────────────────────────────────────────
// 📦 Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type {
  PatternType,
  SchemaLocation,
  PatternDef,
  MatchCaptures,
  MatchResult,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ Error Types and Codes
// ─────────────────────────────────────────────────────────────────────────────

export {
  PatternErrorCodes,
  PatternRegistryError,
  PatternNotFoundError,
  PatternValidationError,
  PatternMatchError,
  PatternExtractionError,
} from './errors.js';

export type { PatternErrorCode } from './errors.js';

// ─────────────────────────────────────────────────────────────────────────────
// 🏗️ Base Classes and Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export type { PatternMatcher } from './base.js';
export { BasePatternMatcher } from './base.js';

// ─────────────────────────────────────────────────────────────────────────────
// 📝 Registry Functions
// ─────────────────────────────────────────────────────────────────────────────

export {
  registerPattern,
  getPattern,
  getPatternsByFramework,
  getPatternsByType,
  hasPattern,
  listPatterns,
  listFrameworks,
  scanForPatterns,
} from './registry.js';

export type { ScanOptions } from './registry.js';

// ─────────────────────────────────────────────────────────────────────────────
// 🔍 Schema Extractors
// ─────────────────────────────────────────────────────────────────────────────

export {
  extractSchemaNode,
  extractFromArg,
  extractFromNamedArg,
  extractFromReturn,
  extractFromTypeParam,
  extractFromBody,
  extractFromChainMethod,
  extractFromDecoratorArg,
} from './extractors.js';
