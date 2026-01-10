/**
 * Pattern Registry
 *
 * Registry for pattern matchers, following the same design as AdapterRegistry.
 * Provides registration, lookup, and scanning capabilities.
 *
 * The registry uses a module-scoped singleton pattern with exported wrapper
 * functions for a clean, functional API.
 *
 * @module patterns/registry
 * @see .context/ADR-P2-1-PATTERN-MATCHER.md
 *
 * @example
 * ```typescript
 * import { registerPattern, scanForPatterns } from './patterns';
 *
 * // Register a custom pattern matcher
 * registerPattern(myExpressMatcher);
 *
 * // Scan source file for patterns
 * const matches = scanForPatterns(sourceFile, {
 *   frameworks: ['express'],
 *   types: ['call']
 * });
 * ```
 */

import type { SourceFile } from 'ts-morph';
import type { PatternMatcher } from './base.js';
import type { MatchResult, PatternType } from './types.js';
import {
  PatternNotFoundError,
  PatternValidationError,
} from './errors.js';

/**
 * Options for filtering pattern matchers during source file scanning.
 *
 * @example
 * ```typescript
 * const options: ScanOptions = {
 *   frameworks: ['express', 'nestjs'],
 *   types: ['call', 'decorator']
 * };
 * ```
 */
export interface ScanOptions {
  /**
   * Filter matchers by framework name.
   * Only matchers matching these frameworks will be used.
   */
  frameworks?: string[];
  
  /**
   * Filter matchers by supported pattern type.
   * Only matchers supporting at least one of these types will be used.
   */
  types?: PatternType[];
}

/**
 * Registry of pattern matchers
 * 
 * Follows the same design as AdapterRegistry from Phase 1,
 * with module-scoped singleton and exported wrapper functions.
 */
class PatternRegistry {
  private matchers = new Map<string, PatternMatcher>();
  private matchersByFramework = new Map<string, PatternMatcher[]>();

  /**
   * Register a pattern matcher
   * @throws {PatternValidationError} if matcher is invalid
   */
  register(matcher: PatternMatcher): void {
    this.validate(matcher);

    // Warn on overwrite in debug mode
    if (this.matchers.has(matcher.name) && process.env.DEBUG_TRACE_MCP) {
      console.error(
        `[PatternRegistry] Overwriting matcher: ${matcher.name}`
      );
    }

    this.matchers.set(matcher.name, matcher);

    // Index by framework
    const existing = this.matchersByFramework.get(matcher.framework) || [];
    this.matchersByFramework.set(
      matcher.framework,
      [...existing.filter(m => m.name !== matcher.name), matcher]
    );

    if (process.env.DEBUG_TRACE_MCP) {
      console.error(`[PatternRegistry] Registered: ${matcher.name} (${matcher.framework})`);
    }
  }

  /**
   * Get matcher by name
   * @throws {PatternNotFoundError} if not found
   */
  get(name: string): PatternMatcher {
    const matcher = this.matchers.get(name);
    if (!matcher) {
      throw new PatternNotFoundError(name, this.names());
    }
    return matcher;
  }

  /**
   * Get all matchers for a framework
   */
  getByFramework(framework: string): PatternMatcher[] {
    return this.matchersByFramework.get(framework) || [];
  }

  /**
   * Get all matchers supporting a pattern type
   */
  getByType(type: PatternType): PatternMatcher[] {
    return Array.from(this.matchers.values())
      .filter(m => m.supportedTypes.includes(type));
  }

  /**
   * Check if a matcher exists
   */
  has(name: string): boolean {
    return this.matchers.has(name);
  }

  /**
   * List all matcher names
   */
  names(): string[] {
    return Array.from(this.matchers.keys());
  }

  /**
   * List all frameworks
   */
  frameworks(): string[] {
    return Array.from(this.matchersByFramework.keys());
  }

  /**
   * Scan a source file with all registered matchers
   * 
   * @param sourceFile - The file to scan
   * @param options - Optional filtering options
   * @returns All matches found across all matchers
   */
  scan(
    sourceFile: SourceFile,
    options?: ScanOptions
  ): MatchResult[] {
    let matchers = Array.from(this.matchers.values());

    // Filter by framework
    if (options?.frameworks?.length) {
      matchers = matchers.filter(m => options.frameworks!.includes(m.framework));
    }

    // Filter by pattern type
    if (options?.types?.length) {
      matchers = matchers.filter(m =>
        m.supportedTypes.some(t => options.types!.includes(t))
      );
    }

    const allMatches: MatchResult[] = [];

    for (const matcher of matchers) {
      const matches = matcher.scan
        ? matcher.scan(sourceFile)
        : this.defaultScan(matcher, sourceFile);
      allMatches.push(...matches);
    }

    return allMatches;
  }

  private defaultScan(matcher: PatternMatcher, sourceFile: SourceFile): MatchResult[] {
    const matches: MatchResult[] = [];
    sourceFile.forEachDescendant((node) => {
      const result = matcher.match(node);
      if (result) {
        matches.push(result);
      }
    });
    return matches;
  }

  private validate(matcher: unknown): asserts matcher is PatternMatcher {
    const m = matcher as Partial<PatternMatcher>;
    
    if (!m.name || typeof m.name !== 'string') {
      throw new PatternValidationError(matcher, "Matcher must have 'name' property");
    }

    if (!m.framework || typeof m.framework !== 'string') {
      throw new PatternValidationError(matcher, "Matcher must have 'framework' property");
    }

    if (!Array.isArray(m.patterns) || m.patterns.length === 0) {
      throw new PatternValidationError(matcher, "Matcher must have at least one pattern");
    }

    if (!Array.isArray(m.supportedTypes) || m.supportedTypes.length === 0) {
      throw new PatternValidationError(matcher, "Matcher must declare supportedTypes");
    }

    if (typeof m.match !== 'function') {
      throw new PatternValidationError(matcher, "Matcher must implement match()");
    }

    if (typeof m.extract !== 'function') {
      throw new PatternValidationError(matcher, "Matcher must implement extract()");
    }
  }
}

// Module-scoped singleton
const registry = new PatternRegistry();

// ─────────────────────────────────────────────────────────────────────────────
// Public API - Wrapper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a pattern matcher with the global registry.
 *
 * The matcher is validated before registration. If validation fails,
 * a {@link PatternValidationError} is thrown with details.
 *
 * @param matcher - The pattern matcher to register
 * @throws {PatternValidationError} If the matcher fails validation
 *
 * @example
 * ```typescript
 * import { registerPattern, BasePatternMatcher } from './patterns';
 *
 * class MyMatcher extends BasePatternMatcher {
 *   readonly name = 'my-matcher';
 *   readonly framework = 'express';
 *   // ... implementation
 * }
 *
 * registerPattern(new MyMatcher());
 * ```
 */
export function registerPattern(matcher: PatternMatcher): void {
  registry.register(matcher);
}

/**
 * Get a pattern matcher by its unique name.
 *
 * @param name - The unique name of the matcher to retrieve
 * @returns The registered pattern matcher
 * @throws {PatternNotFoundError} If no matcher with that name exists
 *
 * @example
 * ```typescript
 * const matcher = getPattern('express-router');
 * const matches = matcher.scan(sourceFile);
 * ```
 */
export function getPattern(name: string): PatternMatcher {
  return registry.get(name);
}

/**
 * Get all pattern matchers for a specific framework.
 *
 * @param framework - The framework name to filter by
 * @returns Array of matchers for that framework (empty if none)
 *
 * @example
 * ```typescript
 * const expressMatchers = getPatternsByFramework('express');
 * console.log(`Found ${expressMatchers.length} Express matchers`);
 * ```
 */
export function getPatternsByFramework(framework: string): PatternMatcher[] {
  return registry.getByFramework(framework);
}

/**
 * Get all pattern matchers supporting a specific pattern type.
 *
 * @param type - The pattern type to filter by
 * @returns Array of matchers supporting that type
 *
 * @example
 * ```typescript
 * const decoratorMatchers = getPatternsByType('decorator');
 * // Returns matchers like NestJS that use decorators
 * ```
 */
export function getPatternsByType(type: PatternType): PatternMatcher[] {
  return registry.getByType(type);
}

/**
 * Check if a pattern matcher is registered by name.
 *
 * @param name - The name to check
 * @returns `true` if a matcher with that name exists
 *
 * @example
 * ```typescript
 * if (!hasPattern('express-router')) {
 *   registerPattern(new ExpressRouterMatcher());
 * }
 * ```
 */
export function hasPattern(name: string): boolean {
  return registry.has(name);
}

/**
 * List all registered pattern matcher names.
 *
 * @returns Array of all registered matcher names
 *
 * @example
 * ```typescript
 * console.log('Available matchers:', listPatterns().join(', '));
 * ```
 */
export function listPatterns(): string[] {
  return registry.names();
}

/**
 * List all unique framework names from registered matchers.
 *
 * @returns Array of unique framework names
 *
 * @example
 * ```typescript
 * const frameworks = listFrameworks();
 * // ['express', 'nestjs', 'trpc', ...]
 * ```
 */
export function listFrameworks(): string[] {
  return registry.frameworks();
}

/**
 * Scan a source file for patterns using all registered matchers.
 *
 * This is the primary entry point for pattern detection. It applies
 * all registered matchers (or a filtered subset) to find API patterns.
 *
 * @param sourceFile - The ts-morph SourceFile to scan
 * @param options - Optional filtering options
 * @returns Array of all matches found across all matchers
 *
 * @example
 * ```typescript
 * import { Project } from 'ts-morph';
 *
 * const project = new Project();
 * const sourceFile = project.addSourceFileAtPath('./src/routes.ts');
 *
 * // Scan with all matchers
 * const allMatches = scanForPatterns(sourceFile);
 *
 * // Scan with filters
 * const expressMatches = scanForPatterns(sourceFile, {
 *   frameworks: ['express'],
 *   types: ['call']
 * });
 * ```
 */
export function scanForPatterns(
  sourceFile: SourceFile,
  options?: ScanOptions
): MatchResult[] {
  return registry.scan(sourceFile, options);
}
