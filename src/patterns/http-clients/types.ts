/**
 * HTTP Client Tracing Types
 * 
 * Type definitions for HTTP client pattern matching (fetch, axios).
 * 
 * @module patterns/http-clients/types
 * @see .context/ADR-P2-3-HTTP-CLIENT-TRACING.md
 */

import type { Node } from 'ts-morph';
import type { SourceLocation } from '../../core/types.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 🌐 HTTP Primitives
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * HTTP methods supported for tracing
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔗 URL Extraction
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * URL extraction result structure.
 * 
 * @example
 * ```typescript
 * // Static URL
 * { raw: '/api/users', static: '/api/users', isDynamic: false }
 * 
 * // Dynamic URL with template literal
 * { raw: '/api/users/${id}', pattern: '/api/users/:id', isDynamic: true, pathParams: ['id'] }
 * ```
 */
export interface URLExtractionResult {
  /** Raw URL string or pattern as written in code */
  raw: string;
  /** Static URL if not dynamic (no template substitutions) */
  static?: string;
  /** Whether the URL contains dynamic parts */
  isDynamic: boolean;
  /** URL pattern with :param placeholders for OpenAPI compatibility */
  pattern?: string;
  /** Extracted path parameters (e.g., ['userId', 'postId']) */
  pathParams?: string[];
  /** Extracted query parameters (e.g., ['page', 'limit']) */
  queryParams?: string[];
  /** Base URL if present (from axios instance or config) */
  baseURL?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔍 Type Inference
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Type inference source information.
 * 
 * Tracks how a response type was inferred, enabling confidence-based
 * selection when multiple inference sources are available.
 * 
 * @example
 * ```typescript
 * // High confidence: generic parameter
 * { method: 'generic-param', typeText: 'User', confidence: 'high' }
 * 
 * // Medium confidence: variable annotation
 * { method: 'variable-annotation', typeText: 'User[]', confidence: 'high' }
 * ```
 */
export interface TypeInferenceSource {
  /** How the type was inferred */
  method: 
    | 'generic-param'      // axios.get<User>()
    | 'variable-annotation' // const user: User = await fetch()
    | 'cast-expression'    // fetch() as User
    | 'return-type'        // function getUser(): User { return fetch() }
    | 'property-access'    // inferring from response.user.name
    | 'unknown';           // fallback
  /** Text representation of the type */
  typeText?: string;
  /** Confidence level for prioritization */
  confidence: 'high' | 'medium' | 'low';
  /** AST node where type was found (for location reporting) */
  node?: Node;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 📊 Property Access Tracking
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Property access information.
 * 
 * Tracks properties accessed on HTTP response data for schema inference.
 * 
 * @example
 * ```typescript
 * // response.data.user.name → { path: 'data.user.name', segments: ['data', 'user', 'name'] }
 * ```
 */
export interface PropertyAccess {
  /** Full property path (e.g., "user.profile.name") */
  path: string;
  /** Individual segments of the path */
  segments: string[];
  /** Source location for debugging */
  location?: {
    file: string;
    line: number;
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 📨 Request Configuration
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Request headers information.
 * 
 * Separates static (known at analysis time) from dynamic headers.
 */
export interface HeadersInfo {
  /** Static headers with known values (e.g., Content-Type) */
  static?: Record<string, string>;
  /** Headers with dynamic values (resolved at runtime) */
  dynamic?: string[];
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 🎯 Match Captures
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * HTTP client usage captures - extends MatchCaptures.
 * 
 * Comprehensive capture of all information extracted from an HTTP client call.
 */
export interface HTTPClientCaptures {
  /** HTTP method (GET, POST, etc.) */
  httpMethod?: HTTPMethod;
  /** URL information */
  url?: URLExtractionResult;
  /** Request body type/value */
  requestBody?: unknown;
  /** Request headers */
  requestHeaders?: HeadersInfo;
  /** Type inference sources for response */
  typeInference?: TypeInferenceSource[];
  /** Property accesses on response (for schema inference) */
  propertyAccesses?: PropertyAccess[];
  /** Client library identifier */
  clientLibrary?: 'fetch' | 'axios';
  /** Axios instance name (if using axios.create()) */
  axiosInstance?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 📋 Consumer Usage Schema
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Consumer usage schema for HTTP clients.
 * 
 * Normalized representation of an HTTP client call for schema comparison.
 */
export interface ConsumerUsage {
  /** Full URL pattern */
  url: string;
  /** HTTP method */
  method: HTTPMethod;
  /** Expected response type (if inferred) */
  expectedResponse?: unknown;
  /** Request body type (if present) */
  requestBody?: unknown;
  /** Request headers */
  requestHeaders?: Record<string, string>;
  /** Property accesses observed on response */
  accessedProperties: PropertyAccess[];
  /** Source location */
  location: SourceLocation;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ⚙️ Axios Instance Configuration
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Axios instance configuration.
 * 
 * Captured from axios.create() calls for baseURL composition.
 * 
 * @example
 * ```typescript
 * const api = axios.create({
 *   baseURL: 'https://api.example.com',
 *   timeout: 5000,
 * });
 * // Captures: { name: 'api', baseURL: 'https://api.example.com', timeout: 5000 }
 * ```
 */
export interface AxiosInstanceConfig {
  /** Instance variable name */
  name: string;
  /** Base URL configured */
  baseURL?: string;
  /** Default headers */
  headers?: Record<string, string>;
  /** Default timeout */
  timeout?: number;
}
