/**
 * 📋 OpenAPI Schema Adapter
 * Extracts schemas from OpenAPI 3.x / Swagger specifications
 * 
 * This module provides a complete adapter for working with OpenAPI
 * specifications in the trace-mcp schema extraction framework.
 * 
 * ## Features
 * - 📄 Parse OpenAPI 3.x specifications
 * - 🔗 Reference ID parsing and building
 * - 🔄 Type conversion to normalized format
 * - 📊 Constraint extraction (validation rules)
 * - 🗂️ Endpoint and component schema extraction
 * 
 * ## Usage
 * ```typescript
 * import { OpenAPIAdapter, parseOpenAPIRef } from '@trace-mcp/adapters/openapi';
 * import { registerAdapter } from '@trace-mcp/adapters/registry';
 * 
 * // Register the adapter
 * registerAdapter(new OpenAPIAdapter());
 * 
 * // Parse a ref ID
 * const ref = parseOpenAPIRef('endpoint:GET:/users@./api.yaml');
 * 
 * // Extract a schema
 * const adapter = new OpenAPIAdapter();
 * const schema = await adapter.extract({
 *   source: 'openapi',
 *   id: 'schema:User@./api.yaml'
 * });
 * ```
 * 
 * @module adapters/openapi
 */

// ============================================================================
// Main Adapter
// ============================================================================

export { OpenAPIAdapter } from './adapter.js';

// ============================================================================
// Parser Utilities
// ============================================================================

export { parseOpenAPIRef, buildOpenAPIRefId, type OpenAPIRef } from './parser.js';

// ============================================================================
// Conversion Utilities
// ============================================================================

export {
  convertToNormalizedSchema,
  convertToNormalizedType,
  convertParametersToSchema,
  extractConstraints,
} from './convert.js';
