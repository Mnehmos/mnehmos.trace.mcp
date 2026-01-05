/**
 * Python HTTP Client Pattern Detection
 * 
 * Re-exports for Python HTTP client detection modules.
 * Supports: requests, httpx, aiohttp
 * 
 * @see .context/TASK_MAP_P3.md - Task P3-4
 */

// Types
export type {
  PythonHttpLibrary,
  HttpMethod,
  PythonHttpCall,
  PythonPropertyAccess,
  PythonHttpCallResult,
  HttpClientPattern
} from './types.js';

export {
  HTTP_CLIENT_PATTERNS,
  normalizeHttpMethod
} from './types.js';

// Library-specific detectors
export { detectRequestsCalls, getRequestsResponseProperties } from './requests.js';
export { detectHttpxCalls, getHttpxResponseProperties } from './httpx.js';
export { detectAiohttpCalls, getAiohttpResponseProperties } from './aiohttp.js';

// Property access tracking
export {
  detectPropertyAccess,
  correlatePropertyAccess,
  getLibraryResponseProperties,
  isValidResponseProperty
} from './property-access.js';

// =============================================================================
// Combined detection function
// =============================================================================

import type { PythonHttpCall, PythonHttpCallResult } from './types.js';
import { detectRequestsCalls } from './requests.js';
import { detectHttpxCalls } from './httpx.js';
import { detectAiohttpCalls } from './aiohttp.js';
import { correlatePropertyAccess } from './property-access.js';

/**
 * Detect all HTTP client calls from Python source code
 * 
 * Supports:
 * - requests library
 * - httpx library  
 * - aiohttp library
 * 
 * @param content Python source code content
 * @returns Array of HTTP calls with correlated response property access
 */
export function detectAllHttpCalls(content: string): PythonHttpCallResult[] {
  const results: PythonHttpCallResult[] = [];
  
  // Detect from each library
  const requestsCalls = detectRequestsCalls(content);
  const httpxCalls = detectHttpxCalls(content);
  const aiohttpCalls = detectAiohttpCalls(content);
  
  // Combine all calls
  const allCalls: PythonHttpCall[] = [
    ...requestsCalls,
    ...httpxCalls,
    ...aiohttpCalls
  ];
  
  // Correlate property access
  const propertyMap = correlatePropertyAccess(allCalls, content);
  
  // Build results
  for (const call of allCalls) {
    const properties = propertyMap.get(call) || [];
    results.push({
      ...call,
      responseProperties: properties
    });
  }
  
  // Sort by line number
  results.sort((a, b) => a.line - b.line);
  
  return results;
}

/**
 * Get supported libraries
 */
export function getSupportedLibraries(): string[] {
  return ['requests', 'httpx', 'aiohttp'];
}
