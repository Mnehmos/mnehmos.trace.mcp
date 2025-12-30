/**
 * 🔗 OpenAPI Ref Parser
 * Parses and builds SchemaRef ID strings for the OpenAPI adapter
 * 
 * The OpenAPI adapter uses structured reference IDs to identify
 * specific parts of an OpenAPI specification. This module provides
 * utilities to parse these IDs and reconstruct them from components.
 * 
 * @module adapters/openapi/parser
 */

/**
 * Parsed components of an OpenAPI reference ID.
 * 
 * Reference IDs encode the type, location, and spec path:
 * - `file` - Entire spec file
 * - `endpoint` - Full endpoint (request + responses)
 * - `request` - Request body schema only
 * - `response` - Specific response by status code
 * - `schema` - Named component schema
 */
export interface OpenAPIRef {
  /** The type of reference being accessed */
  type: 'file' | 'endpoint' | 'request' | 'response' | 'schema';
  
  /** HTTP method (GET, POST, etc.) - for endpoint/request/response types */
  method?: string;
  
  /** API path (e.g., /users/{id}) - for endpoint/request/response types */
  path?: string;
  
  /** Response status code (e.g., 200, 404) - for response type only */
  statusCode?: string;
  
  /** Component schema name - for schema type only */
  schemaName?: string;
  
  /** Path to the OpenAPI specification file */
  specPath: string;
}

/** Valid reference type identifiers */
const VALID_TYPES = ['file', 'endpoint', 'request', 'response', 'schema'] as const;

/**
 * Parse an OpenAPI SchemaRef ID string into its components.
 * 
 * ID formats by type:
 * - `endpoint:METHOD:/path@specPath` - Full endpoint
 * - `request:METHOD:/path@specPath` - Request body only
 * - `response:METHOD:/path:statusCode@specPath` - Specific response
 * - `schema:SchemaName@specPath` - Component schema
 * - `file:specPath` - Entire spec file
 * 
 * @param refId - The reference ID string to parse
 * @returns Parsed reference object, or null if the ID is invalid
 * 
 * @example
 * ```typescript
 * // Parse an endpoint reference
 * const ref = parseOpenAPIRef('endpoint:GET:/users/{id}@./api.yaml');
 * // { type: 'endpoint', method: 'GET', path: '/users/{id}', specPath: './api.yaml' }
 * 
 * // Parse a response reference
 * const ref = parseOpenAPIRef('response:POST:/users:201@./api.yaml');
 * // { type: 'response', method: 'POST', path: '/users', statusCode: '201', specPath: './api.yaml' }
 * 
 * // Parse a component schema reference
 * const ref = parseOpenAPIRef('schema:User@./api.yaml');
 * // { type: 'schema', schemaName: 'User', specPath: './api.yaml' }
 * ```
 */
export function parseOpenAPIRef(refId: string): OpenAPIRef | null {
  if (!refId || refId.length === 0) {
    return null;
  }

  // Find the @ separator (last occurrence for spec path)
  const atIndex = refId.lastIndexOf('@');
  
  // Find the first colon (type separator)
  const colonIndex = refId.indexOf(':');
  
  if (colonIndex === -1) {
    return null;
  }

  const type = refId.slice(0, colonIndex) as OpenAPIRef['type'];
  
  if (!VALID_TYPES.includes(type)) {
    return null;
  }

  // Handle file type specially (format: file:path)
  if (type === 'file') {
    const specPath = refId.slice(colonIndex + 1);
    if (!specPath) {
      return null;
    }
    return { type: 'file', specPath };
  }

  // All other types require @ separator for spec path
  if (atIndex === -1) {
    return null;
  }

  const specPath = refId.slice(atIndex + 1);
  const identifier = refId.slice(colonIndex + 1, atIndex);

  if (!specPath) {
    return null;
  }

  switch (type) {
    case 'schema': {
      // Format: schema:SchemaName@specPath
      return {
        type: 'schema',
        schemaName: identifier,
        specPath,
      };
    }

    case 'endpoint':
    case 'request': {
      // Format: type:METHOD:/path@specPath
      const methodEnd = identifier.indexOf(':');
      if (methodEnd === -1) {
        return null;
      }
      const method = identifier.slice(0, methodEnd);
      const path = decodeURIComponent(identifier.slice(methodEnd + 1));
      return {
        type,
        method,
        path,
        specPath,
      };
    }

    case 'response': {
      // Format: response:METHOD:/path:statusCode@specPath
      const methodEnd = identifier.indexOf(':');
      if (methodEnd === -1) {
        return null;
      }
      const method = identifier.slice(0, methodEnd);
      const restPart = identifier.slice(methodEnd + 1);
      
      // Find the last colon for status code
      const lastColon = restPart.lastIndexOf(':');
      if (lastColon === -1) {
        return null;
      }
      
      const path = decodeURIComponent(restPart.slice(0, lastColon));
      const statusCode = restPart.slice(lastColon + 1);
      
      return {
        type: 'response',
        method,
        path,
        statusCode,
        specPath,
      };
    }

    default:
      return null;
  }
}

/**
 * Build an OpenAPI SchemaRef ID string from its components.
 * 
 * This is the inverse of `parseOpenAPIRef` - it takes parsed
 * components and constructs a valid reference ID string.
 * 
 * @param ref - The OpenAPIRef components to encode
 * @returns The formatted ID string
 * @throws {Error} If the ref type is unknown
 * 
 * @example
 * ```typescript
 * // Build an endpoint reference
 * const id = buildOpenAPIRefId({
 *   type: 'endpoint',
 *   method: 'GET',
 *   path: '/users/{id}',
 *   specPath: './api.yaml'
 * });
 * // 'endpoint:GET:/users/{id}@./api.yaml'
 * 
 * // Build a schema reference
 * const id = buildOpenAPIRefId({
 *   type: 'schema',
 *   schemaName: 'User',
 *   specPath: './api.yaml'
 * });
 * // 'schema:User@./api.yaml'
 * ```
 */
export function buildOpenAPIRefId(ref: OpenAPIRef): string {
  const { type, method, path, statusCode, schemaName, specPath } = ref;

  switch (type) {
    case 'file':
      return `file:${specPath}`;
    
    case 'schema':
      return `schema:${schemaName}@${specPath}`;
    
    case 'endpoint':
    case 'request':
      return `${type}:${method}:${path}@${specPath}`;
    
    case 'response':
      return `response:${method}:${path}:${statusCode}@${specPath}`;
    
    default:
      throw new Error(`Unknown OpenAPI ref type: ${type}`);
  }
}
