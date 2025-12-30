/**
 * Axios Pattern Matcher
 * 
 * Pattern matcher for axios HTTP client calls.
 * Supports both direct axios usage and custom axios instances.
 * Extracts URL patterns, HTTP methods, request/response types,
 * and property access tracking for consumer schema inference.
 * 
 * @module patterns/http-clients/axios
 * @see .context/ADR-P2-3-HTTP-CLIENT-TRACING.md
 */

import { Node, SyntaxKind, SourceFile } from 'ts-morph';
import { BasePatternMatcher } from '../base.js';
import type { MatchResult, PatternDef, PatternType, MatchCaptures } from '../types.js';
import type { NormalizedSchema } from '../../core/types.js';
import type { HTTPMethod, TypeInferenceSource, PropertyAccess, AxiosInstanceConfig } from './types.js';
import { extractURL, composeURL } from './url-extractor.js';
import { findTypeInferenceSources } from './type-inference.js';
import { trackPropertyAccesses } from './property-access.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 🌐 AxiosPatternMatcher Class
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Pattern matcher for axios library calls.
 * 
 * Detects patterns like:
 * - `axios.get('/api/users')`
 * - `axios.post('/api/users', data)`
 * - `axios.get<User>('/api/user/1')` (with type inference)
 * - `api.get('/users')` (custom instances)
 * 
 * @example
 * ```typescript
 * const matcher = new AxiosPatternMatcher();
 * const matches = matcher.scan(sourceFile);
 * // Returns matches for all axios calls with extracted metadata
 * ```
 */
export class AxiosPatternMatcher extends BasePatternMatcher {
  readonly name = 'axios-client';
  readonly framework = 'axios';
  readonly supportedTypes: PatternType[] = ['call', 'property'];

  /** Map of instance variable names to their configurations */
  private instanceConfigs: Map<string, AxiosInstanceConfig> = new Map();
  
  /** Track which source files have been scanned for instances */
  private instancesCollectedForFiles: Set<string> = new Set();

  readonly patterns: PatternDef[] = [
    // axios.get(), axios.post(), etc.
    {
      type: 'property',
      signature: /^axios\.(get|post|put|delete|patch|head|options|request)$/,
    },
    // axios(config) or axios(url, config)
    {
      type: 'call',
      signature: /^axios$/,
    },
    // axios.create()
    {
      type: 'property',
      signature: /^axios\.create$/,
    },
  ];

  /* ─────────────────────────────────────────────────────────────────────────
   * Source File Scanning
   * ───────────────────────────────────────────────────────────────────────── */

  /**
   * Scan a source file for axios patterns.
   *
   * First collects axios instance configurations, then matches call patterns.
   *
   * @param sourceFile - The source file to scan
   * @returns Array of match results
   */
  scan(sourceFile: SourceFile): MatchResult[] {
    // First pass: collect axios instance configurations
    this.collectAxiosInstances(sourceFile);
    
    // Second pass: match patterns
    return super.scan(sourceFile);
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * Instance Configuration Collection
   * ───────────────────────────────────────────────────────────────────────── */

  /**
   * Collect axios.create() instance configurations.
   * 
   * @internal
   */
  private collectAxiosInstances(sourceFile: Node): void {
    this.instanceConfigs.clear();
    
    // Find all call expressions
    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expr = node.getExpression();
        
        // Check for axios.create()
        if (Node.isPropertyAccessExpression(expr)) {
          const objExpr = expr.getExpression();
          const propName = expr.getName();
          
          if (Node.isIdentifier(objExpr) && 
              objExpr.getText() === 'axios' && 
              propName === 'create') {
            this.extractAxiosInstanceConfig(node);
          }
        }
      }
    });
  }

  /**
   * Extract configuration from axios.create() call.
   * 
   * @internal
   */
  private extractAxiosInstanceConfig(callNode: Node): void {
    if (!Node.isCallExpression(callNode)) return;

    // Find the variable name
    const parent = callNode.getParent();
    let varName: string | undefined;
    
    if (parent && Node.isVariableDeclaration(parent)) {
      const nameNode = parent.getNameNode();
      if (Node.isIdentifier(nameNode)) {
        varName = nameNode.getText();
      }
    }
    
    if (!varName) return;

    const config: AxiosInstanceConfig = { name: varName };
    
    // Parse config argument
    const args = callNode.getArguments();
    if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
      const configObj = args[0];
      
      for (const prop of configObj.getProperties()) {
        if (!Node.isPropertyAssignment(prop)) continue;
        
        const propName = prop.getName();
        const init = prop.getInitializer();
        
        if (!init) continue;
        
        switch (propName) {
          case 'baseURL':
            if (Node.isStringLiteral(init)) {
              config.baseURL = init.getLiteralValue();
            }
            break;
          case 'timeout':
            if (Node.isNumericLiteral(init)) {
              config.timeout = Number(init.getLiteralValue());
            }
            break;
          case 'headers':
            config.headers = this.extractHeadersObject(init);
            break;
        }
      }
    }
    
    this.instanceConfigs.set(varName, config);
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * Pattern Matching
   * ───────────────────────────────────────────────────────────────────────── */

  /**
   * Match patterns against a node, with lazy instance collection.
   *
   * Ensures axios.create() instances are collected before matching
   * when called directly (bypassing scan()).
   *
   * @param node - AST node to test
   * @returns MatchResult if matched, null otherwise
   */
  match(node: Node): MatchResult | null {
    // Lazy initialization: collect instances from the source file if not already done
    const sourceFile = node.getSourceFile();
    const filePath = sourceFile.getFilePath();
    
    if (!this.instancesCollectedForFiles.has(filePath)) {
      this.collectAxiosInstances(sourceFile);
      this.instancesCollectedForFiles.add(filePath);
    }
    
    return super.match(node);
  }

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
    
    // Pattern: axios.method() or instance.method()
    if (Node.isPropertyAccessExpression(expression)) {
      const objExpr = expression.getExpression();
      const methodName = expression.getName();
      
      // Skip axios.create() - it's for configuration, not requests
      if (Node.isIdentifier(objExpr) && 
          objExpr.getText() === 'axios' && 
          methodName === 'create') {
        return null;
      }
      
      // Check for axios.method()
      if (Node.isIdentifier(objExpr)) {
        const objName = objExpr.getText();
        
        // Direct axios usage
        if (objName === 'axios') {
          const signature = `axios.${methodName}`;
          if (this.matchesSignature(signature, pattern.signature)) {
            return this.buildMatchResult(pattern, node, methodName.toUpperCase() as HTTPMethod);
          }
        }
        
        // Custom instance usage (e.g., api.get())
        if (this.instanceConfigs.has(objName)) {
          const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'request'];
          if (httpMethods.includes(methodName.toLowerCase())) {
            return this.buildMatchResult(
              pattern, 
              node, 
              methodName.toUpperCase() as HTTPMethod,
              objName
            );
          }
        }
      }
    }
    
    // Pattern: axios(config) or axios(url, config)
    if (Node.isIdentifier(expression)) {
      const name = expression.getText();
      if (name === 'axios' && this.matchesSignature(name, pattern.signature)) {
        return this.buildAxiosCallResult(pattern, node);
      }
    }

    return null;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * Match Result Building
   * ───────────────────────────────────────────────────────────────────────── */

  /**
   * Build a match result from an axios method call.
   * 
   * @internal
   */
  private buildMatchResult(
    pattern: PatternDef, 
    callNode: Node, 
    method: HTTPMethod,
    instanceName?: string
  ): MatchResult {
    if (!Node.isCallExpression(callNode)) {
      throw new Error('Expected call expression');
    }

    const sourceFile = callNode.getSourceFile();
    const args = callNode.getArguments();
    
    // Extract captures
    const captures = this.extractCaptures(callNode, args, method, instanceName);

    // Build identifier as "METHOD /path"
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

  /**
   * Build a match result from axios(config) style call.
   * 
   * @internal
   */
  private buildAxiosCallResult(pattern: PatternDef, callNode: Node): MatchResult {
    if (!Node.isCallExpression(callNode)) {
      throw new Error('Expected call expression');
    }

    const sourceFile = callNode.getSourceFile();
    const args = callNode.getArguments();
    
    let method: HTTPMethod = 'GET';
    let url: string | undefined;
    
    // Check if first arg is URL string or config object
    if (args.length > 0) {
      if (Node.isStringLiteral(args[0]) || Node.isTemplateExpression(args[0])) {
        // axios(url, config?)
        const urlResult = extractURL(args[0]);
        url = urlResult?.raw || urlResult?.static;
        
        if (args.length > 1 && Node.isObjectLiteralExpression(args[1])) {
          const configMethod = this.extractMethodFromConfig(args[1]);
          if (configMethod) method = configMethod;
        }
      } else if (Node.isObjectLiteralExpression(args[0])) {
        // axios(config)
        const config = this.parseAxiosConfig(args[0]);
        method = config.method || 'GET';
        url = config.url;
      }
    }

    const captures = this.extractCaptures(callNode, args, method);
    const identifier = `${method} ${url || '/'}`;

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
   * Extract captures from an axios call.
   * 
   * @internal
   */
  private extractCaptures(
    callNode: Node, 
    args: Node[], 
    method: HTTPMethod,
    instanceName?: string
  ): MatchCaptures {
    if (!Node.isCallExpression(callNode)) {
      return { httpMethod: method };
    }

    const captures: MatchCaptures = {
      httpMethod: method,
    };

    // Get instance config if using a custom instance
    const instanceConfig = instanceName ? this.instanceConfigs.get(instanceName) : undefined;

    // Extract URL from first argument
    if (args.length > 0) {
      const urlNode = args[0];
      
      // Check if it's a config object (axios(config) style)
      if (Node.isObjectLiteralExpression(urlNode)) {
        const config = this.parseAxiosConfig(urlNode);
        if (config.url) {
          // Build URL result with baseURL if present
          const fullUrl = config.baseURL
            ? composeURL(config.baseURL, config.url)
            : config.url;
          const urlResult: Record<string, unknown> = {
            raw: fullUrl,
            isDynamic: false,
            static: config.url,
          };
          if (config.baseURL) {
            urlResult.baseURL = config.baseURL;
          }
          captures.url = urlResult;
          captures.routePath = fullUrl;
        }
        if (config.method) {
          captures.httpMethod = config.method;
        }
        if (config.data !== undefined) {
          captures.requestBody = config.data;
        }
        if (config.headers) {
          captures.requestHeaders = { static: config.headers };
        }
      } else {
        // URL as first argument
        let urlResult = extractURL(urlNode);
        
        // Compose with baseURL if using instance
        if (urlResult && instanceConfig?.baseURL) {
          const composedUrl = composeURL(
            instanceConfig.baseURL, 
            urlResult.raw || urlResult.static || ''
          );
          urlResult = {
            ...urlResult,
            raw: composedUrl,
            baseURL: instanceConfig.baseURL,
          };
        }
        
        if (urlResult) {
          captures.url = urlResult;
          captures.routePath = urlResult.raw || urlResult.static;
        }
      }
    }

    // Extract request body from second argument (for post, put, patch)
    if (['POST', 'PUT', 'PATCH'].includes(method) && args.length > 1) {
      captures.requestBody = this.extractBodyInfo(args[1]);
    }

    // Extract config from third argument (or second for get/delete)
    const configIndex = ['POST', 'PUT', 'PATCH'].includes(method) ? 2 : 1;
    if (args.length > configIndex) {
      const configNode = args[configIndex];
      if (Node.isObjectLiteralExpression(configNode)) {
        const headers = this.extractHeadersFromConfig(configNode);
        if (headers) {
          captures.requestHeaders = headers;
        }
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

    // Mark as axios client
    captures.clientLibrary = 'axios';
    
    // Record instance name if using custom instance
    if (instanceName) {
      captures.axiosInstance = instanceName;
    }

    return captures;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * Config Parsing
   * ───────────────────────────────────────────────────────────────────────── */

  /**
   * Parse axios config object.
   *
   * @internal
   */
  private parseAxiosConfig(node: Node): {
    method?: HTTPMethod;
    url?: string;
    baseURL?: string;
    data?: unknown;
    headers?: Record<string, string>;
  } {
    const result: {
      method?: HTTPMethod;
      url?: string;
      baseURL?: string;
      data?: unknown;
      headers?: Record<string, string>;
    } = {};

    if (!Node.isObjectLiteralExpression(node)) {
      return result;
    }

    for (const prop of node.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) continue;

      const name = prop.getName();
      const init = prop.getInitializer();
      
      if (!init) continue;

      switch (name) {
        case 'method':
          if (Node.isStringLiteral(init)) {
            const method = init.getLiteralValue().toUpperCase();
            if (this.isValidMethod(method)) {
              result.method = method;
            }
          }
          break;
        case 'url':
          if (Node.isStringLiteral(init)) {
            result.url = init.getLiteralValue();
          }
          break;
        case 'baseURL':
          if (Node.isStringLiteral(init)) {
            result.baseURL = init.getLiteralValue();
          }
          break;
        case 'data':
          result.data = this.extractBodyInfo(init);
          break;
        case 'headers':
          result.headers = this.extractHeadersObject(init);
          break;
      }
    }

    return result;
  }

  /**
   * Extract method from config object.
   * 
   * @internal
   */
  private extractMethodFromConfig(node: Node): HTTPMethod | undefined {
    if (!Node.isObjectLiteralExpression(node)) return undefined;
    
    const methodProp = node.getProperty('method');
    if (methodProp && Node.isPropertyAssignment(methodProp)) {
      const init = methodProp.getInitializer();
      if (init && Node.isStringLiteral(init)) {
        const method = init.getLiteralValue().toUpperCase();
        if (this.isValidMethod(method)) {
          return method;
        }
      }
    }
    
    return undefined;
  }

  /**
   * Extract headers from config object.
   * 
   * @internal
   */
  private extractHeadersFromConfig(node: Node): { 
    static?: Record<string, string>; 
    dynamic?: string[]; 
  } | undefined {
    if (!Node.isObjectLiteralExpression(node)) return undefined;
    
    const headersProp = node.getProperty('headers');
    if (headersProp && Node.isPropertyAssignment(headersProp)) {
      const init = headersProp.getInitializer();
      if (init) {
        return this.extractHeadersInfo(init);
      }
    }
    
    return undefined;
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
    if (Node.isObjectLiteralExpression(node)) {
      return { type: 'object', value: node.getText() };
    }
    if (Node.isIdentifier(node)) {
      return { type: 'reference', name: node.getText() };
    }
    return { type: 'unknown', raw: node.getText() };
  }

  /**
   * Extract headers object as static Record.
   * 
   * @internal
   */
  private extractHeadersObject(node: Node): Record<string, string> | undefined {
    if (!Node.isObjectLiteralExpression(node)) return undefined;
    
    const headers: Record<string, string> = {};
    
    for (const prop of node.getProperties()) {
      if (Node.isPropertyAssignment(prop)) {
        const name = prop.getName();
        const init = prop.getInitializer();
        
        if (init && Node.isStringLiteral(init)) {
          headers[name] = init.getLiteralValue();
        }
      }
    }
    
    return Object.keys(headers).length > 0 ? headers : undefined;
  }

  /**
   * Extract headers information with static/dynamic classification.
   * 
   * @internal
   */
  private extractHeadersInfo(node: Node): { 
    static?: Record<string, string>; 
    dynamic?: string[]; 
  } {
    const result: { static?: Record<string, string>; dynamic?: string[] } = {};

    if (Node.isObjectLiteralExpression(node)) {
      const staticHeaders: Record<string, string> = {};
      const dynamicHeaders: string[] = [];

      for (const prop of node.getProperties()) {
        if (Node.isPropertyAssignment(prop)) {
          const name = prop.getName();
          const init = prop.getInitializer();
          
          if (init && Node.isStringLiteral(init)) {
            staticHeaders[name] = init.getLiteralValue();
          } else {
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
   * @returns NormalizedSchema representing the axios call
   */
  async extract(match: MatchResult): Promise<NormalizedSchema> {
    const captures = match.captures;
    const url = (captures.url as { raw?: string; static?: string })?.raw ||
                (captures.url as { static?: string })?.static || '';
    const method = captures.httpMethod || 'GET';
    
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

    // Add inferred response type
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

    // Add property accesses
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

    // Add instance info if using custom axios instance
    if (captures.axiosInstance) {
      schema.properties.axiosInstance = {
        type: { kind: 'literal', value: captures.axiosInstance as string },
        optional: true,
        nullable: false,
        readonly: true,
        deprecated: false,
      };
    }

    return schema;
  }
}
