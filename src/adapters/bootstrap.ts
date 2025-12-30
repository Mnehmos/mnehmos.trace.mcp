/**
 * 🚀 Adapter Bootstrap
 * Initializes the adapter registry with all built-in adapters
 *
 * @module adapters/bootstrap
 */

import { registerAdapter } from './registry.js';
import { MCPAdapter } from './mcp.js';
import { OpenAPIAdapter } from './openapi/index.js';
import { TRPCAdapter } from './trpc/index.js';

/**
 * Bootstrap the adapter registry with all built-in adapters.
 *
 * This function should be called once during application startup
 * to register all available schema adapters. Currently registers:
 *
 * - **MCP Adapter** (`mcp`): For MCP tool schemas
 * - **OpenAPI Adapter** (`openapi`): For OpenAPI/Swagger specifications
 * - **tRPC Adapter** (`trpc`): For tRPC router definitions
 *
 * Multiple calls are safe due to last-wins replacement semantics.
 *
 * @example
 * ```typescript
 * // In your application entry point
 * import { bootstrapAdapters } from './adapters';
 *
 * bootstrapAdapters();
 * // Now you can use getAdapter('mcp') or getAdapter('openapi') or getAdapter('trpc')
 * ```
 */
export function bootstrapAdapters(): void {
  if (process.env.DEBUG_TRACE_MCP) {
    console.log('[AdapterBootstrap] Registering built-in adapters...');
  }

  // Register MCP adapter for MCP tool schemas
  registerAdapter(new MCPAdapter());

  // Register OpenAPI adapter for OpenAPI/Swagger specifications
  registerAdapter(new OpenAPIAdapter());

  // Register tRPC adapter for tRPC router definitions
  registerAdapter(new TRPCAdapter());

  if (process.env.DEBUG_TRACE_MCP) {
    console.log('[AdapterBootstrap] Built-in adapters registered');
  }
}
