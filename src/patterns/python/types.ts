/**
 * Python HTTP Client Pattern Types
 * 
 * Types for detecting Python HTTP client calls (requests, httpx, aiohttp)
 * and tracking response property access.
 * 
 * @see .context/TASK_MAP_P3.md - Task P3-4
 */

/**
 * Supported Python HTTP client libraries
 */
export type PythonHttpLibrary = 'requests' | 'httpx' | 'aiohttp';

/**
 * HTTP method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Represents a detected Python HTTP client call
 */
export interface PythonHttpCall {
  /** HTTP method used (GET, POST, etc.) */
  method: HttpMethod;
  
  /** Library that was detected (requests, httpx, aiohttp) */
  library: PythonHttpLibrary;
  
  /** Extracted URL (may be partial or contain placeholders) */
  url?: string;
  
  /** Whether the URL contains dynamic parts (f-strings) */
  isDynamicUrl?: boolean;
  
  /** Path parameters extracted from f-string URLs */
  pathParams?: string[];
  
  /** Whether request has query parameters */
  hasQueryParams?: boolean;
  
  /** Whether request has custom headers */
  hasHeaders?: boolean;
  
  /** Whether request has a body (json, data) */
  hasBody?: boolean;
  
  /** Whether this is a session-based call */
  isSession?: boolean;
  
  /** Whether this uses a Client instance (httpx) */
  isClient?: boolean;
  
  /** Whether this uses an AsyncClient (httpx) */
  isAsyncClient?: boolean;
  
  /** Whether this is an async call (httpx AsyncClient, aiohttp) */
  isAsync?: boolean;
  
  /** Variable name storing the response */
  responseVariable?: string;
  
  /** Line number in source */
  line: number;
  
  /** Column number in source */
  column?: number;
}

/**
 * Represents response property access on an HTTP response variable
 */
export interface PythonPropertyAccess {
  /** Variable name being accessed */
  variable: string;
  
  /** Property or method being accessed (json, text, status_code, etc.) */
  property: string;
  
  /** Whether this is a method call (json()) vs property access (text) */
  isMethodCall: boolean;
  
  /** Line number in source */
  line: number;
}

/**
 * Combined result of HTTP call detection
 */
export interface PythonHttpCallResult extends PythonHttpCall {
  /** Properties accessed on the response */
  responseProperties: string[];
}

/**
 * Pattern for detecting library-specific HTTP calls
 */
export interface HttpClientPattern {
  /** Library name */
  library: PythonHttpLibrary;
  
  /** Module names to detect imports from */
  modules: string[];
  
  /** Function/method names that make HTTP calls */
  httpMethods: string[];
  
  /** Session/Client class names */
  sessionClasses: string[];
  
  /** Response property/method names */
  responseAccess: string[];
}

/**
 * Pattern definitions for each supported library
 */
export const HTTP_CLIENT_PATTERNS: Record<PythonHttpLibrary, HttpClientPattern> = {
  requests: {
    library: 'requests',
    modules: ['requests'],
    httpMethods: ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'request'],
    sessionClasses: ['Session'],
    responseAccess: ['json', 'text', 'content', 'status_code', 'headers', 'ok', 'reason', 'url', 'encoding', 'cookies']
  },
  httpx: {
    library: 'httpx',
    modules: ['httpx'],
    httpMethods: ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'request'],
    sessionClasses: ['Client', 'AsyncClient'],
    responseAccess: ['json', 'text', 'content', 'status_code', 'headers', 'is_success', 'is_error', 'is_redirect', 'url', 'encoding', 'cookies']
  },
  aiohttp: {
    library: 'aiohttp',
    modules: ['aiohttp'],
    httpMethods: ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'request'],
    sessionClasses: ['ClientSession'],
    responseAccess: ['json', 'text', 'read', 'status', 'headers', 'ok', 'reason', 'url', 'content_type', 'cookies']
  }
};

/**
 * Map HTTP method string to type
 */
export function normalizeHttpMethod(method: string): HttpMethod | null {
  const upper = method.toUpperCase();
  const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  return methods.includes(upper as HttpMethod) ? upper as HttpMethod : null;
}
