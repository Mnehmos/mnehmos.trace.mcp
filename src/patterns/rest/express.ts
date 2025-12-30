/**
 * Express Pattern Matcher
 * 
 * Detects Express.js route patterns including:
 * - app.get(), app.post(), etc.
 * - router.get(), router.post(), etc.
 * - app.route().get().post()
 * - app.all(), app.use()
 * 
 * @module patterns/rest/express
 * @see .context/ADR-P2-2-REST-DETECTION.md
 */

import { Node, CallExpression, SourceFile, PropertyAccessExpression } from 'ts-morph';
import type { NormalizedSchema, SourceLocation } from '../../core/types.js';
import { BasePatternMatcher } from '../base.js';
import type { PatternDef, MatchResult, PatternType } from '../types.js';
import type { HTTPMethod, RESTMatchCaptures } from './types.js';
import { parsePath } from './path-parser.js';
import { detectExpressMiddleware } from './middleware.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 📋 Constants
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * HTTP methods supported by Express
 */
const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'all'] as const;
type ExpressMethod = typeof HTTP_METHODS[number];

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔍 ExpressPatternMatcher Class
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Pattern matcher for Express.js routes.
 *
 * Detects patterns:
 * - `app.get()`, `app.post()`, etc.
 * - `router.get()`, `router.post()`, etc.
 * - `app.route('/path').get().post()`
 * - `app.all()`, `app.use()`
 *
 * @example
 * ```typescript
 * const matcher = new ExpressPatternMatcher();
 * const result = matcher.match(callExpressionNode);
 * if (result) {
 *   console.log(result.captures.httpMethod); // 'GET'
 *   console.log(result.captures.routePath);  // '/users/:id'
 * }
 * ```
 */
export class ExpressPatternMatcher extends BasePatternMatcher {
  readonly name = 'express';
  readonly framework = 'express';
  readonly supportedTypes: PatternType[] = ['call', 'chain'];

  readonly patterns: PatternDef[] = [
    // app.get(), router.post(), etc.
    {
      type: 'call',
      signature: /^(get|post|put|delete|patch|options|head|all)$/i,
      inputSchemaLocation: { type: 'body' },
    },
    // app.route().get().post()
    {
      type: 'chain',
      signature: /\.route\s*\([^)]+\)\s*\./,
      inputSchemaLocation: { type: 'chain-method', method: 'route' },
    },
  ];

  /**
   * Match an AST node against Express patterns
   */
  match(node: Node): MatchResult | null {
    if (!node) return null;
    
    // Must be a call expression
    if (!Node.isCallExpression(node)) {
      return null;
    }
    
    // Check for route chain (app.route('/path').get())
    const routeChainResult = this.matchRouteChain(node);
    if (routeChainResult) {
      return routeChainResult;
    }
    
    // Check for direct method call (app.get('/path', handler))
    return this.matchDirectMethod(node);
  }

  /**
   * Match direct HTTP method calls: app.get(), router.post(), etc.
   */
  private matchDirectMethod(call: CallExpression): MatchResult | null {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) {
      return null;
    }

    const methodName = expression.getName().toLowerCase();
    if (!this.isHttpMethod(methodName)) {
      return null;
    }

    // Get the receiver (app, router, userRouter, etc.)
    const receiver = expression.getExpression();
    const routerName = this.getRouterName(receiver);
    
    // First argument should be the path
    const args = call.getArguments();
    if (args.length === 0) {
      return null;
    }

    const pathArg = args[0];
    const routePath = this.extractPathString(pathArg);
    if (!routePath) {
      return null;
    }

    // Parse path parameters
    const pathParams = parsePath(routePath);
    
    // Detect validation middleware
    const middlewareArgs = args.slice(1, -1); // All but first (path) and last (handler)
    const validationMiddleware = detectExpressMiddleware(middlewareArgs);
    
    // Get handler (last argument)
    const handler = args[args.length - 1];
    const handlerNode = args.length > 1 ? handler : undefined;

    const httpMethod = methodName.toUpperCase() as HTTPMethod;
    const sourceFile = call.getSourceFile();

    const captures: RESTMatchCaptures = {
      httpMethod,
      routePath,
      pathParameters: pathParams,
      routerName,
      validationMiddleware: validationMiddleware.length > 0 ? validationMiddleware : undefined,
      handlerNode,
    };

    return {
      pattern: this.patterns[0],
      node: call,
      framework: this.framework,
      identifier: `${httpMethod} ${routePath}`,
      location: this.getLocation(call, sourceFile.getFilePath()),
      captures,
    };
  }

  /**
   * Match route chain: app.route('/path').get().post()
   */
  private matchRouteChain(call: CallExpression): MatchResult | null {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) {
      return null;
    }

    const methodName = expression.getName().toLowerCase();
    if (!this.isHttpMethod(methodName)) {
      return null;
    }

    // Check if this is part of a route() chain
    const routeInfo = this.findRouteCall(expression.getExpression());
    if (!routeInfo) {
      return null;
    }

    // Get handler (first argument for chained methods)
    const args = call.getArguments();
    const handlerNode = args.length > 0 ? args[0] : undefined;

    const httpMethod = methodName.toUpperCase() as HTTPMethod;
    const pathParams = parsePath(routeInfo.path);
    const sourceFile = call.getSourceFile();

    const captures: RESTMatchCaptures = {
      httpMethod,
      routePath: routeInfo.path,
      pathParameters: pathParams,
      routerName: routeInfo.routerName,
      handlerNode,
    };

    return {
      pattern: this.patterns[1],
      node: call,
      framework: this.framework,
      identifier: `${httpMethod} ${routeInfo.path}`,
      location: this.getLocation(call, sourceFile.getFilePath()),
      captures,
    };
  }

  /**
   * Find app.route('/path') in a chain
   */
  private findRouteCall(node: Node): { path: string; routerName?: string } | null {
    // Could be: app.route('/path') directly
    if (Node.isCallExpression(node)) {
      const expr = node.getExpression();
      if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'route') {
        const args = node.getArguments();
        if (args.length > 0) {
          const path = this.extractPathString(args[0]);
          if (path) {
            const routerName = this.getRouterName(expr.getExpression());
            return { path, routerName };
          }
        }
      }
      
      // Could be chained: app.route('/path').get().post()
      // Walk up the chain
      return this.findRouteCall(expr);
    }
    
    // Could be property access in a chain
    if (Node.isPropertyAccessExpression(node)) {
      return this.findRouteCall(node.getExpression());
    }
    
    return null;
  }

  /**
   * Check if a method name is an HTTP method
   */
  private isHttpMethod(name: string): name is ExpressMethod {
    return HTTP_METHODS.includes(name.toLowerCase() as ExpressMethod);
  }

  /**
   * Get the router/app name from an expression
   */
  private getRouterName(expr: Node): string | undefined {
    if (Node.isIdentifier(expr)) {
      return expr.getText();
    }
    if (Node.isPropertyAccessExpression(expr)) {
      // Could be something like this.router
      return expr.getText();
    }
    return undefined;
  }

  /**
   * Extract string value from a path argument
   */
  private extractPathString(arg: Node): string | undefined {
    if (Node.isStringLiteral(arg)) {
      return arg.getLiteralValue();
    }
    if (Node.isNoSubstitutionTemplateLiteral(arg)) {
      return arg.getLiteralValue();
    }
    if (Node.isTemplateExpression(arg)) {
      // For now, just return the head text
      // Full template analysis would need variable resolution
      return arg.getHead().getText().slice(1, -2); // Remove ` and ${
    }
    return undefined;
  }

  /**
   * Extract pattern - implement abstract method
   */
  protected matchPattern(pattern: PatternDef, node: Node): MatchResult | null {
    // Delegate to the main match method
    return this.match(node);
  }

  /**
   * Extract schema from match
   */
  async extract(match: MatchResult): Promise<NormalizedSchema> {
    const captures = match.captures as RESTMatchCaptures;
    
    // Build properties from path parameters
    const properties: Record<string, any> = {};
    
    // Add path parameters
    if (captures.pathParameters) {
      for (const param of captures.pathParameters) {
        properties[`params.${param.name}`] = {
          type: { kind: 'primitive', value: param.inferredType === 'number' ? 'number' : 'string' },
          optional: param.optional,
          nullable: false,
          readonly: false,
          deprecated: false,
        };
      }
    }
    
    // Add validation middleware schemas
    if (captures.validationMiddleware) {
      for (const middleware of captures.validationMiddleware) {
        // The actual schema extraction would need to parse the Zod/Joi schema
        // For now, just note that validation exists
        properties[`${middleware.target}._validated`] = {
          type: { kind: 'unknown' },
          optional: false,
          nullable: false,
          readonly: false,
          deprecated: false,
          description: `Validated by ${middleware.library}`,
        };
      }
    }

    return {
      name: match.identifier,
      properties,
      required: Object.keys(properties).filter(k => !properties[k].optional),
      source: {
        source: 'typescript',
        id: `express:${match.identifier}`,
      },
      location: match.location,
    };
  }
}
