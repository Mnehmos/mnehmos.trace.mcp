/**
 * REST Pattern Matcher Types
 * 
 * Types for Express and Fastify REST endpoint detection.
 * 
 * @module patterns/rest/types
 * @see .context/ADR-P2-2-REST-DETECTION.md
 */

import type { Node } from 'ts-morph';
import type { MatchCaptures } from '../types.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 📋 HTTP Method Types
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * HTTP methods supported by REST frameworks
 */
export type HTTPMethod =
  | 'GET' 
  | 'POST' 
  | 'PUT' 
  | 'DELETE' 
  | 'PATCH' 
  | 'OPTIONS' 
  | 'HEAD' 
  | 'ALL';

/* ═══════════════════════════════════════════════════════════════════════════
 * 🛤️ Path Parameter Types
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Path parameter extracted from route paths
 * 
 * @example
 * For path `/users/:id(\\d+)?`:
 * ```typescript
 * {
 *   name: 'id',
 *   position: 1,
 *   optional: true,
 *   pattern: '\\d+',
 *   inferredType: 'number'
 * }
 * ```
 */
export interface PathParameter {
  /** Parameter name (without leading :) */
  name: string;
  
  /** Position in path segments (0-indexed) */
  position: number;
  
  /** Whether parameter is optional (:id?) */
  optional: boolean;
  
  /** Regex constraint if present (:id(\\d+)) */
  pattern?: string;
  
  /** Type inferred from pattern or default to string */
  inferredType: 'string' | 'number' | 'any';
}

/**
 * Validation middleware detected in route
 */
export interface ValidationMiddleware {
  /** Validation library used */
  library: 'zod' | 'joi' | 'celebrate' | 'express-validator' | 'yup' | 'unknown';
  
  /** What is being validated */
  target: 'body' | 'query' | 'params' | 'headers';
  
  /** AST node containing the schema */
  schemaNode: Node;
  
  /** Position in middleware chain */
  middlewareIndex?: number;
}

/**
 * Fastify schema definition extracted from route options
 */
export interface FastifySchemas {
  /** Body schema (for POST, PUT, PATCH) */
  body?: Node;
  
  /** Query string schema */
  querystring?: Node;
  
  /** Path params schema */
  params?: Node;
  
  /** Headers schema */
  headers?: Node;
  
  /** Response schemas by status code */
  response?: Map<number, Node>;
}

/**
 * Extended captures for REST pattern matches
 */
export interface RESTMatchCaptures extends MatchCaptures {
  /** HTTP method for this route */
  httpMethod: HTTPMethod;
  
  /** Route path (e.g., '/users/:id') */
  routePath: string;
  
  /** Parsed path parameters */
  pathParameters: PathParameter[];
  
  /** Router/app instance name (e.g., 'app', 'router', 'userRouter') */
  routerName?: string;
  
  /** Detected validation middleware */
  validationMiddleware?: ValidationMiddleware[];
  
  /** The handler function node */
  handlerNode?: Node;
  
  /** Fastify-specific schemas */
  schemas?: FastifySchemas;
}

/**
 * Schema format detected in Fastify routes
 */
export type SchemaFormat = 'json-schema' | 'typebox' | 'zod' | 'unknown';

/**
 * Response inference result
 */
export interface ResponseInference {
  /** How the schema was inferred */
  method: 'explicit-return' | 'generic-param' | 'body-analysis' | 'unknown';
  
  /** The AST node containing the response type (if found) */
  node?: Node;
}
