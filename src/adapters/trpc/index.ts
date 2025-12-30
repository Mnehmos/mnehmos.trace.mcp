/**
 * 📋 tRPC Schema Adapter Module
 * 
 * Exports for tRPC router schema extraction and normalization.
 * 
 * This module provides tools to extract Zod schemas from tRPC
 * router definitions and convert them to the framework's
 * NormalizedSchema format for contract validation.
 * 
 * @module adapters/trpc
 * 
 * @example
 * ```typescript
 * import { TRPCAdapter, parseTRPCRef, buildTRPCRefId } from './adapters/trpc/index.js';
 * 
 * // Use the adapter directly
 * const adapter = new TRPCAdapter();
 * const schema = await adapter.extract({
 *   source: 'trpc',
 *   id: 'trpc:users.getById@./router.ts'
 * });
 * 
 * // Or parse/build ref IDs manually
 * const ref = parseTRPCRef('trpc:users.create.output@./router.ts');
 * const id = buildTRPCRefId('users.create', 'output', './router.ts');
 * ```
 */

// ============================================================================
// Adapter
// ============================================================================

export { TRPCAdapter } from './adapter.js';

// ============================================================================
// Parser Utilities
// ============================================================================

export { parseTRPCRef, buildTRPCRefId, type TRPCRef } from './parser.js';

// ============================================================================
// Extractor Utilities
// ============================================================================

export {
  extractProcedures,
  createProject,
  type ProcedureInfo,
} from './extractor.js';
