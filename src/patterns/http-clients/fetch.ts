/**
 * Fetch Pattern Matcher
 * 
 * Pattern matcher for the native fetch() API.
 * Extracts URL patterns, HTTP methods, request/response types,
 * and property access tracking for consumer schema inference.
 * 
 * @module patterns/http-clients/fetch
 * @see .context/ADR-P2-3-HTTP-CLIENT-TRACING.md
 */

import { Node } from 'ts-morph';
import { BasePatternMatcher } from '../base.js';
import type { MatchResult, PatternDef, PatternType, MatchCaptures } from '../types.js';
import type { NormalizedSchema } from '../../core/types.js';
import type { HTTPMethod, TypeInferenceSource, PropertyAccess } from './types.js';
import { extractURL } from './url-extractor.js';
import { findTypeInferenceSources } from './type-inference.js';
import { trackPropertyAccesses } from './property-access.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 🌐 FetchPatternMatcher Class
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Pattern matcher for fetch() API calls.
 * 
 * Detects patterns like:
 * - `fetch('/api/users')`
 * - `fetch(url, { method: 'POST', body: ... })`
 * - `` fetch(`/api/users/${id}`) ``
 * - `response.json()`
 * 
 * @example
 * ```typescript
 * const matcher = new FetchPatternMatcher();
 * const matches = matcher.scan(sourceFile);
 * // Returns matches for all fetch() calls with extracted metadata
 * ```
 */
export class FetchPatternMatcher extends BasePatternMatcher {
  readonly name = 'fetch-client';
  readonly framework = 'fetch';
  readonly supportedTypes: PatternType[] = ['call', 'chain'];

  readonly patterns: PatternDef[] = [
    {
      type: 'call',
      signature: /^fetch$/,
      inputSchemaLocation: { type: 'arg', index: 0 },
    },
  ];

  /* ─────────────────────────────────────────────────────────────────────────
   * Pattern Matching
   * ───────────────────────────────────────────────────────────────────────── */

  /**
   * Match a single pattern against a node.
   * 
   * @param pattern - Pattern definition to match
   * @param node - AST node to test
   * @returns MatchResult if matched, null otherwise
   */
  protected matchPattern(pattern: PatternDef, node: Node): MatchResult | null {
    if (!Node.isCallExpression(node)) {
      return null;
    }

    const expression = node.getExpression();
    
    // Check for direct fetch() call
    if (Node.isIdentifier(expression)) {
      const name = expression.getText();
      if (this.matchesSignature(name, pattern.signature)) {
        return this.buildMatchResult(pattern, node);
      }
    }

    return null;
  }

  /**
   * Build a match result from a fetch call.
   * 
   * @internal
   */
  private buildMatchResult(pattern: PatternDef, callNode: Node): MatchResult {
    if (!Node.isCallExpression(callNode)) {
      throw new Error('Expected call expression');
    }

    const sourceFile = callNode.getSourceFile();
    const args = callNode.getArguments();
    
    // Extract captures
    const captures = this.extractCaptures(callNode, args);

    // Build identifier as "METHOD /path"
    const method = captures.httpMethod || 'GET';
    const url = (captures.url as { raw?: string; static?: string })?.raw ||
                (captures.url as { static?: string })?.static || '/';
    const identifier = `${method} ${url}`;

    return {
      pattern,
      node: callNode,
      framework: this.framework,
      identifier,
      location: this.getLocation(callNode, sourceFile.getFilePath()),
      captures,
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * Capture Extraction
   * ───────────────────────────────────────────────────────────────────────── */

  /**
   * Extract captures from a fetch call.
   * 
   * @internal
   */
  private extractCaptures(callNode: Node, args: Node[]): MatchCaptures {
    if (!Node.isCallExpression(callNode)) {
      return { httpMethod: 'GET' };
    }

    const captures: MatchCaptures = {
      httpMethod: 'GET', // Default method
    };

    // Extract URL from first argument
    if (args.length > 0) {
      const urlNode = args[0];
      const urlResult = extractURL(urlNode);
      if (urlResult) {
        captures.url = urlResult;
        captures.routePath = urlResult.raw || urlResult.static;
      }
    }

    // Extract options from second argument
    if (args.length > 1) {
      const optionsNode = args[1];
      const options = this.parseOptionsObject(optionsNode);
      
      if (options.method) {
        captures.httpMethod = options.method;
      }
      if (options.body !== undefined) {
        captures.requestBody = options.body;
      }
      if (options.headers) {
        captures.requestHeaders = options.headers;
      }
    }

    // Extract type inference sources
    const typeInference = findTypeInferenceSources(callNode);
    if (typeInference.length > 0) {
      captures.typeInference = typeInference;
    }

    // Track property accesses on the response
    const propertyAccesses = trackPropertyAccesses(callNode);
    if (propertyAccesses.length > 0) {
      captures.propertyAccesses = propertyAccesses;
    }

    // Mark as fetch client
    captures.clientLibrary = 'fetch';

    return captures;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * Options Parsing
   * ───────────────────────────────────────────────────────────────────────── */

  /**
   * Parse fetch options object.
   * 
   * @internal
   */
  private parseOptionsObject(node: Node): { 
    method?: HTTPMethod; 
    body?: unknown; 
    headers?: { static?: Record<string, string>; dynamic?: string[] };
  } {
    const result: { 
      method?: HTTPMethod; 
      body?: unknown; 
      headers?: { static?: Record<string, string>; dynamic?: string[] };
    } = {};

    if (!Node.isObjectLiteralExpression(node)) {
      return result;
    }

    for (const prop of node.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) continue;

      const name = prop.getName();
      const initializer = prop.getInitializer();
      
      if (!initializer) continue;

      switch (name) {
        case 'method':
          if (Node.isStringLiteral(initializer)) {
            const method = initializer.getLiteralValue().toUpperCase();
            if (this.isValidMethod(method)) {
              result.method = method;
            }
          }
          break;

        case 'body':
          result.body = this.extractBodyInfo(initializer);
          break;

        case 'headers':
          result.headers = this.extractHeadersInfo(initializer);
          break;
      }
    }

    return result;
  }

  /**
   * Check if a string is a valid HTTP method.
   * 
   * @internal
   */
  private isValidMethod(method: string): method is HTTPMethod {
    return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(method);
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * Request Body & Headers Extraction
   * ───────────────────────────────────────────────────────────────────────── */

  /**
   * Extract body information.
   * 
   * @internal
   */
  private extractBodyInfo(node: Node): unknown {
    // For JSON.stringify() calls
    if (Node.isCallExpression(node)) {
      const expr = node.getExpression();
      if (Node.isPropertyAccessExpression(expr)) {
        const objExpr = expr.getExpression();
        const propName = expr.getName();
        if (Node.isIdentifier(objExpr) && objExpr.getText() === 'JSON' && propName === 'stringify') {
          const args = node.getArguments();
          if (args.length > 0) {
            return { type: 'json', value: args[0].getText() };
          }
        }
      }
    }

    // For object literals
    if (Node.isObjectLiteralExpression(node)) {
      return { type: 'object', value: node.getText() };
    }

    // For identifiers
    if (Node.isIdentifier(node)) {
      return { type: 'reference', name: node.getText() };
    }

    return { type: 'unknown', raw: node.getText() };
  }

  /**
   * Extract headers information.
   * 
   * @internal
   */
  private extractHeadersInfo(node: Node): { static?: Record<string, string>; dynamic?: string[] } {
    const result: { static?: Record<string, string>; dynamic?: string[] } = {};

    if (Node.isObjectLiteralExpression(node)) {
      const staticHeaders: Record<string, string> = {};
      const dynamicHeaders: string[] = [];

      for (const prop of node.getProperties()) {
        if (Node.isPropertyAssignment(prop)) {
          // Get property name - handle both quoted and unquoted
          const nameNode = prop.getNameNode();
          let name: string;
          if (Node.isStringLiteral(nameNode)) {
            name = nameNode.getLiteralValue();
          } else if (Node.isIdentifier(nameNode)) {
            name = nameNode.getText();
          } else {
            // Fallback - strip quotes from getName() if present
            name = prop.getName().replace(/^['"]|['"]$/g, '');
          }
          
          const init = prop.getInitializer();
          
          if (init && Node.isStringLiteral(init)) {
            staticHeaders[name] = init.getLiteralValue();
          } else if (init && Node.isNoSubstitutionTemplateLiteral(init)) {
            // Template literal without substitutions is static
            staticHeaders[name] = init.getLiteralValue();
          } else {
            // Template with substitutions, call expressions, identifiers are dynamic
            dynamicHeaders.push(name);
          }
        }
      }

      if (Object.keys(staticHeaders).length > 0) {
        result.static = staticHeaders;
      }
      if (dynamicHeaders.length > 0) {
        result.dynamic = dynamicHeaders;
      }
    } else {
      // Headers object or variable reference
      result.dynamic = ['*'];
    }

    return result;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * Schema Extraction
   * ───────────────────────────────────────────────────────────────────────── */

  /**
   * Extract schema from a match result.
   * 
   * @param match - The match result to extract schema from
   * @returns NormalizedSchema representing the fetch call
   */
  async extract(match: MatchResult): Promise<NormalizedSchema> {
    const captures = match.captures;
    const url = (captures.url as { raw?: string; static?: string })?.raw ||
                (captures.url as { static?: string })?.static || '';
    const method = captures.httpMethod || 'GET';
    
    // Build a NormalizedSchema from the captures
    // identifier should be "METHOD /path" format
    const schema: NormalizedSchema = {
      name: `${method} ${url}`,
      properties: {
        url: {
          type: { kind: 'primitive', value: 'string' },
          optional: false,
          nullable: false,
          readonly: true,
          deprecated: false,
          description: `URL: ${url}`,
        },
        method: {
          type: { kind: 'literal', value: captures.httpMethod || 'GET' },
          optional: false,
          nullable: false,
          readonly: true,
          deprecated: false,
        },
      },
      required: ['url', 'method'],
      source: {
        source: 'typescript',
        id: match.identifier,
      },
      location: match.location,
    };

    // Add request body if present
    if (captures.requestBody) {
      schema.properties.requestBody = {
        type: { kind: 'any' },
        optional: true,
        nullable: false,
        readonly: false,
        deprecated: false,
      };
    }

    // Add inferred response type from type inference
    const typeInference = captures.typeInference as TypeInferenceSource[] | undefined;
    if (typeInference && typeInference.length > 0) {
      const bestType = typeInference[0];
      schema.properties.responseType = {
        type: { kind: 'ref', name: bestType.typeText || 'unknown' },
        optional: true,
        nullable: false,
        readonly: true,
        deprecated: false,
        description: `Inferred via ${bestType.method}`,
      };
    }

    // Add property accesses as hints
    const propertyAccesses = captures.propertyAccesses as PropertyAccess[] | undefined;
    if (propertyAccesses && propertyAccesses.length > 0) {
      schema.properties.accessedProperties = {
        type: { 
          kind: 'array', 
          element: { kind: 'primitive', value: 'string' } 
        },
        optional: true,
        nullable: false,
        readonly: true,
        deprecated: false,
        description: `Properties accessed: ${propertyAccesses.map(p => p.path).join(', ')}`,
      };
    }

    return schema;
  }
}
