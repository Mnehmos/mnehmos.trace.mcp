/**
 * Fastify Pattern Matcher
 * 
 * Detects Fastify route patterns including:
 * - fastify.get(), fastify.post(), etc.
 * - fastify.route({ method, url, schema })
 * - server.get(), app.get() (alternative instance names)
 * - Schema extraction (body, querystring, params, headers, response)
 * 
 * @module patterns/rest/fastify
 * @see .context/ADR-P2-2-REST-DETECTION.md
 */

import { Node, CallExpression, ObjectLiteralExpression, PropertyAssignment } from 'ts-morph';
import type { NormalizedSchema, SourceLocation } from '../../core/types.js';
import { BasePatternMatcher } from '../base.js';
import type { PatternDef, MatchResult, PatternType } from '../types.js';
import type { HTTPMethod, RESTMatchCaptures, FastifySchemas } from './types.js';
import { parsePath } from './path-parser.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 📋 Constants
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * HTTP methods supported by Fastify
 */
const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'all'] as const;
type FastifyMethod = typeof HTTP_METHODS[number];

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔍 FastifyPatternMatcher Class
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Pattern matcher for Fastify routes.
 *
 * Detects patterns:
 * - `fastify.get()`, `fastify.post()`, etc.
 * - `fastify.route({ method, url, schema })`
 * - `server.get()`, `app.get()` (alternative instance names)
 *
 * Also extracts Fastify schema definitions:
 * - `body`, `querystring`, `params`, `headers`, `response`
 *
 * @example
 * ```typescript
 * const matcher = new FastifyPatternMatcher();
 * const result = matcher.match(callExpressionNode);
 * if (result) {
 *   console.log(result.captures.schemas?.body);  // Schema node
 *   console.log(result.captures.schemas?.response); // Map<number, Node>
 * }
 * ```
 */
export class FastifyPatternMatcher extends BasePatternMatcher {
  readonly name = 'fastify';
  readonly framework = 'fastify';
  readonly supportedTypes: PatternType[] = ['call', 'property'];

  readonly patterns: PatternDef[] = [
    // fastify.get(), fastify.post(), etc.
    {
      type: 'call',
      signature: /^(get|post|put|delete|patch|options|head|all)$/i,
      inputSchemaLocation: { type: 'arg-named', name: 'schema' },
    },
    // fastify.route({ method, url, schema })
    {
      type: 'call',
      signature: /^route$/,
      inputSchemaLocation: { type: 'arg', index: 0 },
    },
  ];

  /**
   * Match an AST node against Fastify patterns
   */
  match(node: Node): MatchResult | null {
    if (!node) return null;
    
    // Must be a call expression
    if (!Node.isCallExpression(node)) {
      return null;
    }
    
    // Check for fastify.route() call
    const routeResult = this.matchRouteMethod(node);
    if (routeResult) {
      return routeResult;
    }
    
    // Check for shorthand method call (fastify.get('/path', handler))
    return this.matchShorthandMethod(node);
  }

  /**
   * Match shorthand HTTP method calls: fastify.get(), server.post(), etc.
   */
  private matchShorthandMethod(call: CallExpression): MatchResult | null {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) {
      return null;
    }

    const methodName = expression.getName().toLowerCase();
    if (!this.isHttpMethod(methodName)) {
      return null;
    }

    // Get the receiver (fastify, server, app, etc.)
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

    // Check for options object (second arg could be options or handler)
    let schemas: FastifySchemas | undefined;
    let handlerNode: Node | undefined;

    if (args.length >= 2) {
      const secondArg = args[1];
      
      if (Node.isObjectLiteralExpression(secondArg)) {
        // Options object
        schemas = this.extractSchemasFromOptions(secondArg);
        handlerNode = args.length > 2 ? args[2] : undefined;
      } else if (Node.isFunctionExpression(secondArg) || Node.isArrowFunction(secondArg)) {
        // Handler function
        handlerNode = secondArg;
      }
    }

    const httpMethod = methodName.toUpperCase() as HTTPMethod;
    const sourceFile = call.getSourceFile();

    const captures: RESTMatchCaptures = {
      httpMethod,
      routePath,
      pathParameters: pathParams,
      routerName,
      schemas,
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
   * Match fastify.route() method
   */
  private matchRouteMethod(call: CallExpression): MatchResult | null {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) {
      return null;
    }

    const methodName = expression.getName();
    if (methodName !== 'route') {
      return null;
    }

    // Get options object (first argument)
    const args = call.getArguments();
    if (args.length === 0) {
      return null;
    }

    const optionsArg = args[0];
    if (!Node.isObjectLiteralExpression(optionsArg)) {
      return null;
    }

    // Extract method and url from options
    const methodValue = this.getPropertyValue(optionsArg, 'method');
    const urlValue = this.getPropertyValue(optionsArg, 'url');

    if (!urlValue) {
      return null;
    }

    // Handle method as string or array
    const httpMethods = this.parseMethodValue(methodValue);
    if (httpMethods.length === 0) {
      return null;
    }

    // Get router name
    const receiver = expression.getExpression();
    const routerName = this.getRouterName(receiver);

    // Extract schemas
    const schemas = this.extractSchemasFromOptions(optionsArg);

    // Get handler
    const handlerProp = optionsArg.getProperty('handler');
    const handlerNode = handlerProp && Node.isPropertyAssignment(handlerProp)
      ? handlerProp.getInitializer()
      : undefined;

    // Parse path parameters
    const pathParams = parsePath(urlValue);

    // Use the first method for the identifier
    const httpMethod = httpMethods[0];
    const sourceFile = call.getSourceFile();

    const captures: RESTMatchCaptures = {
      httpMethod,
      routePath: urlValue,
      pathParameters: pathParams,
      routerName,
      schemas,
      handlerNode,
    };

    return {
      pattern: this.patterns[1],
      node: call,
      framework: this.framework,
      identifier: `${httpMethod} ${urlValue}`,
      location: this.getLocation(call, sourceFile.getFilePath()),
      captures,
    };
  }

  /**
   * Extract schemas from Fastify options object
   */
  extractSchemasFromOptions(options: ObjectLiteralExpression): FastifySchemas | undefined {
    const schemaProp = options.getProperty('schema');
    if (!schemaProp || !Node.isPropertyAssignment(schemaProp)) {
      return undefined;
    }

    const schemaValue = schemaProp.getInitializer();
    if (!schemaValue || !Node.isObjectLiteralExpression(schemaValue)) {
      return undefined;
    }

    const schemas: FastifySchemas = {};

    // Extract each schema type
    const bodyProp = schemaValue.getProperty('body');
    if (bodyProp && Node.isPropertyAssignment(bodyProp)) {
      schemas.body = bodyProp.getInitializer();
    }

    const querystringProp = schemaValue.getProperty('querystring');
    if (querystringProp && Node.isPropertyAssignment(querystringProp)) {
      schemas.querystring = querystringProp.getInitializer();
    }

    const paramsProp = schemaValue.getProperty('params');
    if (paramsProp && Node.isPropertyAssignment(paramsProp)) {
      schemas.params = paramsProp.getInitializer();
    }

    const headersProp = schemaValue.getProperty('headers');
    if (headersProp && Node.isPropertyAssignment(headersProp)) {
      schemas.headers = headersProp.getInitializer();
    }

    // Extract response schemas
    const responseProp = schemaValue.getProperty('response');
    if (responseProp && Node.isPropertyAssignment(responseProp)) {
      const responseValue = responseProp.getInitializer();
      if (responseValue && Node.isObjectLiteralExpression(responseValue)) {
        schemas.response = this.extractResponseSchemas(responseValue);
      }
    }

    return Object.keys(schemas).length > 0 ? schemas : undefined;
  }

  /**
   * Extract response schemas by status code
   */
  private extractResponseSchemas(responseObj: ObjectLiteralExpression): Map<number, Node> {
    const responses = new Map<number, Node>();

    for (const prop of responseObj.getProperties()) {
      if (Node.isPropertyAssignment(prop)) {
        const name = prop.getName();
        const statusCode = parseInt(name, 10);
        
        if (!isNaN(statusCode)) {
          const value = prop.getInitializer();
          if (value) {
            responses.set(statusCode, value);
          }
        }
      }
    }

    return responses;
  }

  /**
   * Parse method value which can be string or array
   */
  private parseMethodValue(value: string | undefined): HTTPMethod[] {
    if (!value) {
      return [];
    }

    // Remove quotes and brackets
    const cleaned = value.replace(/['"[\]]/g, '').trim();
    
    // Could be comma-separated
    const methods = cleaned.split(',').map(m => m.trim().toUpperCase());
    
    return methods.filter(m => 
      HTTP_METHODS.includes(m.toLowerCase() as FastifyMethod)
    ) as HTTPMethod[];
  }

  /**
   * Get a property value from an object literal
   */
  private getPropertyValue(obj: ObjectLiteralExpression, name: string): string | undefined {
    const prop = obj.getProperty(name);
    if (!prop || !Node.isPropertyAssignment(prop)) {
      return undefined;
    }

    const initializer = prop.getInitializer();
    if (!initializer) {
      return undefined;
    }

    if (Node.isStringLiteral(initializer)) {
      return initializer.getLiteralValue();
    }

    if (Node.isArrayLiteralExpression(initializer)) {
      // For method arrays like ['GET', 'HEAD']
      return initializer.getText();
    }

    return initializer.getText();
  }

  /**
   * Check if a method name is an HTTP method
   */
  private isHttpMethod(name: string): name is FastifyMethod {
    return HTTP_METHODS.includes(name.toLowerCase() as FastifyMethod);
  }

  /**
   * Get the router/app name from an expression
   */
  private getRouterName(expr: Node): string | undefined {
    if (Node.isIdentifier(expr)) {
      return expr.getText();
    }
    if (Node.isPropertyAccessExpression(expr)) {
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
    return undefined;
  }

  /**
   * Extract pattern - implement abstract method
   */
  protected matchPattern(pattern: PatternDef, node: Node): MatchResult | null {
    return this.match(node);
  }

  /**
   * Extract schema from match
   */
  async extract(match: MatchResult): Promise<NormalizedSchema> {
    const captures = match.captures as RESTMatchCaptures;
    
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
    
    // Note presence of schemas
    if (captures.schemas) {
      if (captures.schemas.body) {
        properties['body._schema'] = {
          type: { kind: 'unknown' },
          optional: false,
          nullable: false,
          readonly: false,
          deprecated: false,
          description: 'Fastify body schema defined',
        };
      }
      if (captures.schemas.querystring) {
        properties['query._schema'] = {
          type: { kind: 'unknown' },
          optional: false,
          nullable: false,
          readonly: false,
          deprecated: false,
          description: 'Fastify querystring schema defined',
        };
      }
      if (captures.schemas.params) {
        properties['params._schema'] = {
          type: { kind: 'unknown' },
          optional: false,
          nullable: false,
          readonly: false,
          deprecated: false,
          description: 'Fastify params schema defined',
        };
      }
      if (captures.schemas.headers) {
        properties['headers._schema'] = {
          type: { kind: 'unknown' },
          optional: false,
          nullable: false,
          readonly: false,
          deprecated: false,
          description: 'Fastify headers schema defined',
        };
      }
      if (captures.schemas.response) {
        properties['response._schema'] = {
          type: { kind: 'unknown' },
          optional: false,
          nullable: false,
          readonly: false,
          deprecated: false,
          description: `Fastify response schemas: ${Array.from(captures.schemas.response.keys()).join(', ')}`,
        };
      }
    }

    return {
      name: match.identifier,
      properties,
      required: Object.keys(properties).filter(k => !properties[k].optional),
      source: {
        source: 'typescript',
        id: `fastify:${match.identifier}`,
      },
      location: match.location,
    };
  }
}
