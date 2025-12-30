/**
 * REST Pattern Detection Module
 * 
 * Provides pattern matchers for Express.js and Fastify routes.
 * 
 * @module patterns/rest
 * @see .context/ADR-P2-2-REST-DETECTION.md
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 📋 Type Exports
 * ═══════════════════════════════════════════════════════════════════════════ */

export type {
  HTTPMethod,
  PathParameter,
  ValidationMiddleware,
  FastifySchemas,
  RESTMatchCaptures,
  ResponseInference,
} from './types.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔧 Utility Exports
 * ═══════════════════════════════════════════════════════════════════════════ */

export { parsePath, pathParametersToSchema } from './path-parser.js';
export { detectExpressMiddleware } from './middleware.js';
export { inferResponseSchema, detectMultipleResponses } from './response-inference.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔍 Matcher Exports
 * ═══════════════════════════════════════════════════════════════════════════ */

export { ExpressPatternMatcher } from './express.js';
export { FastifyPatternMatcher } from './fastify.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 🚀 Bootstrap
 * ═══════════════════════════════════════════════════════════════════════════ */

import { registerPattern } from '../registry.js';
import { ExpressPatternMatcher } from './express.js';
import { FastifyPatternMatcher } from './fastify.js';

/**
 * Register all REST pattern matchers with the global registry.
 * 
 * Call this during application initialization to enable REST detection.
 * 
 * @example
 * ```typescript
 * import { bootstrapRESTPatterns } from './patterns/rest/index.js';
 * 
 * // During app initialization
 * bootstrapRESTPatterns();
 * 
 * // Now REST patterns are available for matching
 * ```
 */
export function bootstrapRESTPatterns(): void {
  registerPattern(new ExpressPatternMatcher());
  registerPattern(new FastifyPatternMatcher());
}
