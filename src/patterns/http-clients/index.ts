/**
 * HTTP Client Pattern Matchers
 * 
 * This module provides pattern matchers for HTTP client libraries (fetch, axios).
 * It enables tracing of HTTP requests made from consumer code, extracting:
 * - URL patterns and path parameters
 * - HTTP methods
 * - Request/response type inference
 * - Property access tracking for consumer schema inference
 * 
 * @module patterns/http-clients
 * @see .context/ADR-P2-3-HTTP-CLIENT-TRACING.md
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 📋 Type Exports
 * ═══════════════════════════════════════════════════════════════════════════ */

export type {
  HTTPMethod,
  URLExtractionResult,
  TypeInferenceSource,
  PropertyAccess,
  HeadersInfo,
  HTTPClientCaptures,
  ConsumerUsage,
  AxiosInstanceConfig,
} from './types.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔧 Utility Exports
 * ═══════════════════════════════════════════════════════════════════════════ */

export { extractURL, composeURL } from './url-extractor.js';
export { findTypeInferenceSources, getBestInferredType } from './type-inference.js';
export { trackPropertyAccesses, buildTypeFromAccesses } from './property-access.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔍 Matcher Exports
 * ═══════════════════════════════════════════════════════════════════════════ */

export { FetchPatternMatcher } from './fetch.js';
export { AxiosPatternMatcher } from './axios.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 🚀 Bootstrap
 * ═══════════════════════════════════════════════════════════════════════════ */

import { registerPattern } from '../registry.js';
import { FetchPatternMatcher } from './fetch.js';
import { AxiosPatternMatcher } from './axios.js';

/**
 * Register all HTTP client pattern matchers with the global registry.
 * 
 * Call this during application initialization to enable HTTP client tracing.
 * 
 * @example
 * ```typescript
 * import { bootstrapHTTPClientPatterns } from './patterns/http-clients/index.js';
 * 
 * // During app initialization
 * bootstrapHTTPClientPatterns();
 * 
 * // Now HTTP client patterns are available for matching
 * ```
 */
export function bootstrapHTTPClientPatterns(): void {
  registerPattern(new FetchPatternMatcher());
  registerPattern(new AxiosPatternMatcher());
}
