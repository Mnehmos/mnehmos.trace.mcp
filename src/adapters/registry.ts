/**
 * 📦 Adapter Registry
 * Central registry for managing schema adapters with validation and lookup
 * 
 * @module adapters/registry
 */

import type { SchemaAdapter, SchemaRef, NormalizedSchema, SchemaSourceKind } from '../core/types.js';
import { AdapterNotFoundError, AdapterValidationError } from './errors.js';

/**
 * Internal registry class that manages schema adapters.
 * 
 * Provides validated registration, lookup by kind, and ref-based
 * adapter resolution. Uses last-wins semantics for replacement.
 */
class AdapterRegistry {
  private adapters = new Map<SchemaSourceKind, SchemaAdapter>();

  /**
   * Register an adapter with validation.
   * 
   * Validates the adapter interface before registration.
   * If an adapter for the same kind exists, it is replaced (last-wins).
   * 
   * @param adapter - The schema adapter to register
   * @throws {AdapterValidationError} If the adapter is missing required properties
   */
  register(adapter: SchemaAdapter): void {
    this.validateAdapter(adapter);

    if (this.adapters.has(adapter.kind) && process.env.DEBUG_TRACE_MCP) {
      console.error(`[AdapterRegistry] Overwriting adapter for kind: ${adapter.kind}`);
    }

    this.adapters.set(adapter.kind, adapter);

    if (process.env.DEBUG_TRACE_MCP) {
      console.error(`[AdapterRegistry] Registered adapter: ${adapter.kind}`);
    }
  }

  /**
   * Get an adapter by its kind.
   * 
   * @param kind - The schema source kind to look up
   * @returns The registered adapter for the kind
   * @throws {AdapterNotFoundError} If no adapter is registered for the kind
   */
  get(kind: SchemaSourceKind): SchemaAdapter {
    const adapter = this.adapters.get(kind);
    if (!adapter) {
      throw new AdapterNotFoundError(kind, this.list());
    }
    return adapter;
  }

  /**
   * Check if an adapter is registered for a kind.
   * 
   * @param kind - The schema source kind to check
   * @returns True if an adapter is registered
   */
  has(kind: SchemaSourceKind): boolean {
    return this.adapters.has(kind);
  }

  /**
   * List all registered adapter kinds.
   * 
   * @returns Array of registered schema source kinds
   */
  list(): SchemaSourceKind[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get an adapter that supports a given schema ref.
   * 
   * Looks up the adapter by the ref's source kind and verifies
   * that the adapter supports the specific ref.
   * 
   * @param ref - The schema reference to find an adapter for
   * @returns The adapter that supports the ref
   * @throws {AdapterNotFoundError} If no adapter supports the ref
   */
  getForRef(ref: SchemaRef): SchemaAdapter {
    const adapter = this.adapters.get(ref.source);
    if (adapter && adapter.supports(ref)) {
      return adapter;
    }

    throw new AdapterNotFoundError(ref.source, this.list());
  }

  /**
   * Validate adapter before registration.
   * 
   * Ensures the adapter has all required properties and methods:
   * - kind: string identifier
   * - supports(): function to check ref compatibility
   * - extract(): function to extract schemas
   * - list() (optional): function to list available refs
   * 
   * @param adapter - The adapter to validate
   * @throws {AdapterValidationError} If validation fails
   */
  private validateAdapter(adapter: SchemaAdapter): void {
    const partial = adapter as Partial<SchemaAdapter>;

    if (!partial.kind || typeof partial.kind !== 'string') {
      throw new AdapterValidationError(partial, 'kind is required and must be a string');
    }

    if (typeof partial.supports !== 'function') {
      throw new AdapterValidationError(partial, 'supports() must be a function');
    }

    if (typeof partial.extract !== 'function') {
      throw new AdapterValidationError(partial, 'extract() must be a function');
    }

    if (partial.list !== undefined && typeof partial.list !== 'function') {
      throw new AdapterValidationError(partial, 'list() must be a function if defined');
    }
  }
}

// Singleton instance
const registry = new AdapterRegistry();

/**
 * Register a schema adapter.
 * 
 * The adapter is validated before registration. If an adapter for
 * the same kind already exists, it is replaced (last-wins semantics).
 * 
 * @param adapter - The schema adapter to register
 * @throws {AdapterValidationError} If the adapter is invalid
 * 
 * @example
 * ```typescript
 * registerAdapter(new MCPAdapter());
 * ```
 */
export function registerAdapter(adapter: SchemaAdapter): void {
  registry.register(adapter);
}

/**
 * Get a registered adapter by kind.
 * 
 * @param kind - The schema source kind to look up
 * @returns The registered adapter
 * @throws {AdapterNotFoundError} If no adapter is registered for the kind
 * 
 * @example
 * ```typescript
 * const adapter = getAdapter('mcp');
 * ```
 */
export function getAdapter(kind: SchemaSourceKind): SchemaAdapter {
  return registry.get(kind);
}

/**
 * Check if an adapter is registered for a kind.
 * 
 * @param kind - The schema source kind to check
 * @returns True if an adapter is registered
 * 
 * @example
 * ```typescript
 * if (hasAdapter('mcp')) {
 *   console.log('MCP adapter available');
 * }
 * ```
 */
export function hasAdapter(kind: SchemaSourceKind): boolean {
  return registry.has(kind);
}

/**
 * List all registered adapter kinds.
 * 
 * @returns Array of registered schema source kinds
 * 
 * @example
 * ```typescript
 * const kinds = listAdapters();
 * console.log('Available:', kinds.join(', '));
 * ```
 */
export function listAdapters(): SchemaSourceKind[] {
  return registry.list();
}

/**
 * Get an adapter that supports a given schema ref.
 * 
 * @param ref - The schema reference to find an adapter for
 * @returns The adapter that supports the ref
 * @throws {AdapterNotFoundError} If no adapter supports the ref
 * 
 * @example
 * ```typescript
 * const ref: SchemaRef = { source: 'mcp', id: 'tool:get_weather' };
 * const adapter = getAdapterForRef(ref);
 * ```
 */
export function getAdapterForRef(ref: SchemaRef): SchemaAdapter {
  return registry.getForRef(ref);
}

/**
 * Extract a schema using the appropriate adapter.
 * 
 * Automatically selects the adapter based on the ref's source kind
 * and delegates extraction to that adapter.
 * 
 * @param ref - The schema reference to extract
 * @returns Promise resolving to the normalized schema
 * @throws {AdapterNotFoundError} If no adapter supports the ref
 * 
 * @example
 * ```typescript
 * const schema = await extractSchema({
 *   source: 'mcp',
 *   id: 'tool:get_weather'
 * });
 * ```
 */
export async function extractSchema(ref: SchemaRef): Promise<NormalizedSchema> {
  const adapter = getAdapterForRef(ref);
  
  if (process.env.DEBUG_TRACE_MCP) {
    console.error(`[AdapterRegistry] Extracting schema: ${ref.id} via ${adapter.kind}`);
  }
  
  return adapter.extract(ref);
}

/**
 * List available schemas using the appropriate adapter.
 * 
 * Not all adapters support listing. This function throws if
 * the adapter doesn't implement the list() method.
 * 
 * @param kind - The schema source kind
 * @param basePath - Base path to search for schemas
 * @returns Promise resolving to array of schema refs
 * @throws {AdapterNotFoundError} If no adapter is registered for the kind
 * @throws {Error} If the adapter doesn't support listing
 * 
 * @example
 * ```typescript
 * const refs = await listSchemas('mcp', './src');
 * for (const ref of refs) {
 *   console.log(`Found: ${ref.id}`);
 * }
 * ```
 */
export async function listSchemas(kind: SchemaSourceKind, basePath: string): Promise<SchemaRef[]> {
  const adapter = getAdapter(kind);
  
  if (!adapter.list) {
    throw new Error(`Adapter for kind "${kind}" does not support list() method`);
  }
  
  if (process.env.DEBUG_TRACE_MCP) {
    console.error(`[AdapterRegistry] Listing schemas via ${kind} in ${basePath}`);
  }
  
  return adapter.list(basePath);
}
