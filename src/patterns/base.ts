/**
 * Pattern Matcher Base Classes
 * 
 * Interface and base class for framework-specific pattern matchers.
 * 
 * @module patterns/base
 * @see .context/ADR-P2-1-PATTERN-MATCHER.md
 */

import type { Node, SourceFile } from 'ts-morph';
import type { NormalizedSchema, SourceLocation } from '../core/types.js';
import type { PatternDef, MatchResult, PatternType } from './types.js';

/**
 * Interface for framework-specific pattern matchers
 * 
 * Implementations detect patterns in AST and extract schema information.
 * Each matcher is responsible for a specific framework or pattern type.
 * 
 * @example
 * ```typescript
 * class ExpressPatternMatcher implements PatternMatcher {
 *   readonly name = 'express';
 *   readonly framework = 'express';
 *   readonly patterns = [
 *     { type: 'call', signature: /^(get|post|put|delete)$/i, ... }
 *   ];
 *   
 *   match(node: Node): MatchResult | null { ... }
 *   extract(match: MatchResult): Promise<NormalizedSchema> { ... }
 * }
 * ```
 */
export interface PatternMatcher {
  /**
   * Unique name for this matcher
   */
  readonly name: string;

  /**
   * Framework this matcher targets
   * Used for grouping and filtering matchers
   */
  readonly framework: string;

  /**
   * Pattern definitions this matcher supports
   * Multiple patterns allow matching different variations
   */
  readonly patterns: readonly PatternDef[];

  /**
   * Supported pattern types (for filtering during scan)
   */
  readonly supportedTypes: readonly PatternType[];

  /**
   * Attempt to match a pattern against an AST node
   * 
   * @param node - The AST node to check
   * @returns MatchResult if pattern matches, null otherwise
   * 
   * @remarks
   * This method should be efficient as it's called for every node
   * during AST traversal. Use early-exit checks.
   */
  match(node: Node): MatchResult | null;

  /**
   * Extract schema from a successful match
   * 
   * @param match - The match result from match()
   * @returns Promise resolving to the normalized schema
   * @throws {PatternExtractionError} If extraction fails
   * 
   * @remarks
   * This method performs deeper AST analysis to extract
   * the actual schema definition.
   */
  extract(match: MatchResult): Promise<NormalizedSchema>;

  /**
   * Optional: Scan entire file for matches
   * 
   * Default implementation traverses AST and calls match().
   * Override for more efficient framework-specific scanning.
   * 
   * @param sourceFile - The source file to scan
   * @returns Array of all matches found
   */
  scan?(sourceFile: SourceFile): MatchResult[];
}

/**
 * Base class providing common pattern matching logic
 */
export abstract class BasePatternMatcher implements PatternMatcher {
  abstract readonly name: string;
  abstract readonly framework: string;
  abstract readonly patterns: readonly PatternDef[];
  abstract readonly supportedTypes: readonly PatternType[];

  /**
   * Default match implementation
   * Subclasses can override for custom matching logic
   */
  match(node: Node): MatchResult | null {
    // Guard against null nodes
    if (!node) return null;
    
    for (const pattern of this.patterns) {
      const result = this.matchPattern(pattern, node);
      if (result) return result;
    }
    return null;
  }

  /**
   * Match a single pattern against a node
   * Subclasses implement pattern-type-specific matching
   */
  protected abstract matchPattern(pattern: PatternDef, node: Node): MatchResult | null;

  /**
   * Extract schema from match
   * Subclasses implement framework-specific extraction
   */
  abstract extract(match: MatchResult): Promise<NormalizedSchema>;

  /**
   * Default scan implementation using AST traversal
   */
  scan(sourceFile: SourceFile): MatchResult[] {
    const matches: MatchResult[] = [];

    sourceFile.forEachDescendant((node) => {
      const result = this.match(node);
      if (result) {
        matches.push(result);
      }
    });

    return matches;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Protected Helper Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if a method name matches a pattern signature.
   *
   * @param name - The actual method name from the AST
   * @param signature - Pattern to match: string for exact match, RegExp for pattern
   * @returns `true` if the name matches the signature
   *
   * @example
   * ```typescript
   * // Exact match
   * this.matchesSignature('get', 'get');           // true
   * this.matchesSignature('GET', 'get');           // false
   *
   * // Pattern match
   * this.matchesSignature('get', /^(get|post)$/i); // true
   * this.matchesSignature('GET', /^(get|post)$/i); // true
   * ```
   */
  protected matchesSignature(name: string, signature: string | RegExp): boolean {
    if (typeof signature === 'string') {
      return name === signature;
    }
    return signature.test(name);
  }

  /**
   * Extract source location information from an AST node.
   *
   * @param node - The AST node to get location for
   * @param filePath - Path to the source file
   * @returns Source location with file, line, and column
   *
   * @example
   * ```typescript
   * const location = this.getLocation(node, sourceFile.getFilePath());
   * // { file: 'src/routes.ts', line: 42, column: 8 }
   * ```
   */
  protected getLocation(node: Node, filePath: string): SourceLocation {
    return {
      file: filePath,
      line: node.getStartLineNumber(),
      column: node.getStart() - node.getStartLinePos(),
    };
  }
}
