/**
 * 🔌 Schema Adapters
 * 
 * This module provides the adapter system for extracting and normalizing
 * schemas from different sources (MCP, OpenAPI, GraphQL, etc.).
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import { bootstrapAdapters, getAdapter, extractSchema } from './adapters';
 * 
 * // Initialize built-in adapters
 * bootstrapAdapters();
 * 
 * // Extract a schema
 * const schema = await extractSchema({
 *   source: 'mcp',
 *   id: 'tool:get_weather'
 * });
 * ```
 * 
 * ## Available Exports
 * 
 * - **Adapters**: MCPAdapter
 * - **Registry Functions**: registerAdapter, getAdapter, hasAdapter, listAdapters
 * - **High-Level Functions**: extractSchema, listSchemas, getAdapterForRef
 * - **Bootstrap**: bootstrapAdapters
 * - **Error Types**: AdapterRegistryError, AdapterNotFoundError, AdapterValidationError
 * 
 * @module adapters
 */

// ============================================================================
// Adapters
// ============================================================================

export { MCPAdapter } from './mcp.js';
export { OpenAPIAdapter, parseOpenAPIRef, type OpenAPIRef } from './openapi/index.js';
export { TRPCAdapter, parseTRPCRef, type TRPCRef } from './trpc/index.js';

// ============================================================================
// Registry Functions
// ============================================================================

export {
  registerAdapter,
  getAdapter,
  hasAdapter,
  listAdapters,
  getAdapterForRef,
  extractSchema,
  listSchemas,
} from './registry.js';

// ============================================================================
// Error Types
// ============================================================================

export {
  AdapterRegistryError,
  AdapterNotFoundError,
  AdapterValidationError,
} from './errors.js';

// ============================================================================
// Bootstrap
// ============================================================================

export { bootstrapAdapters } from './bootstrap.js';

// ============================================================================
// Type Re-exports
// ============================================================================

export type { SchemaAdapter, SchemaRef, NormalizedSchema, SchemaSourceKind } from '../core/types.js';
