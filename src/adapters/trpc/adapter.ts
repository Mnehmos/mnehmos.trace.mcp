/**
 * 📋 tRPC Schema Adapter
 * 
 * Extracts and converts tRPC router definitions to NormalizedSchema.
 * 
 * This adapter implements the SchemaAdapter interface for tRPC
 * router files. It supports extraction of:
 * - Procedure input schemas (from `.input()` calls)
 * - Procedure output schemas (from `.output()` calls)
 * - Nested router structures
 * - Zod schema validation rules
 * 
 * Uses ts-morph for AST analysis, parsing the actual TypeScript
 * source code to extract schema definitions without requiring
 * runtime evaluation.
 * 
 * @module adapters/trpc/adapter
 */

import { existsSync } from 'fs';
import type {
  SchemaAdapter,
  SchemaRef,
  NormalizedSchema,
} from '../../core/types.js';
import { parseTRPCRef, buildTRPCRefId } from './parser.js';
import {
  createProject,
  extractProcedures,
  zodToNormalizedSchema,
  createEmptySchema,
  type ProcedureInfo,
} from './extractor.js';

// ============================================================================
// Adapter Implementation
// ============================================================================

/**
 * Schema adapter for tRPC router definitions.
 * 
 * Implements the SchemaAdapter interface to extract schemas from
 * tRPC router files. Uses ts-morph for AST analysis to parse
 * Zod schemas without runtime evaluation.
 * 
 * Supported tRPC patterns:
 * - `t.router({ ... })` - Standard tRPC v10+ pattern
 * - `createTRPCRouter({ ... })` - Next.js/T3 pattern
 * - `createRouter({ ... })` - Legacy pattern
 * - Nested routers via object composition
 * 
 * Supported Zod schemas:
 * - Primitives: `z.string()`, `z.number()`, `z.boolean()`
 * - Objects: `z.object({ ... })`
 * - Arrays: `z.array(...)`
 * - Unions: `z.union([...])`, `z.enum([...])`
 * - Modifiers: `.optional()`, `.nullable()`, `.default()`
 * - Constraints: `.min()`, `.max()`, `.email()`, etc.
 * 
 * @implements {SchemaAdapter}
 * 
 * @example
 * ```typescript
 * import { TRPCAdapter } from './adapter.js';
 * import { registerAdapter } from '../registry.js';
 * 
 * // Register the adapter
 * registerAdapter(new TRPCAdapter());
 * 
 * // Extract procedure input schema
 * const adapter = new TRPCAdapter();
 * const schema = await adapter.extract({
 *   source: 'trpc',
 *   id: 'trpc:users.getById@./router.ts'
 * });
 * 
 * // Extract procedure output schema
 * const outputSchema = await adapter.extract({
 *   source: 'trpc',
 *   id: 'trpc:users.getById.output@./router.ts'
 * });
 * 
 * // List all procedures in a file
 * const refs = await adapter.list('./router.ts');
 * ```
 */
export class TRPCAdapter implements SchemaAdapter {
  /** Adapter kind identifier */
  readonly kind = 'trpc' as const;

  /**
   * Check if this adapter supports the given schema reference.
   * 
   * @param ref - The schema reference to check
   * @returns True if the ref source is 'trpc'
   */
  supports(ref: SchemaRef): boolean {
    return ref.source === 'trpc';
  }

  /**
   * Extract a schema from a tRPC procedure.
   * 
   * Parses the ref ID to determine the procedure and schema type:
   * - `trpc:{path}@{file}` - Extract input schema (default)
   * - `trpc:{path}.input@{file}` - Extract input schema (explicit)
   * - `trpc:{path}.output@{file}` - Extract output schema
   * 
   * The extraction process:
   * 1. Parse the reference ID to get procedure path and schema type
   * 2. Load and parse the TypeScript file with ts-morph
   * 3. Find all router definitions and extract procedures
   * 4. Locate the target procedure by path
   * 5. Convert the Zod schema to NormalizedSchema
   * 
   * @param ref - The schema reference specifying what to extract
   * @returns Promise resolving to the normalized schema
   * @throws {Error} If the ref ID is invalid
   * @throws {Error} If the file is not found
   * @throws {Error} If the procedure is not found
   * 
   * @example
   * ```typescript
   * // Extract input schema (default)
   * const schema = await adapter.extract({
   *   source: 'trpc',
   *   id: 'trpc:users.getById@./router.ts'
   * });
   * 
   * // Extract output schema
   * const outputSchema = await adapter.extract({
   *   source: 'trpc',
   *   id: 'trpc:users.create.output@./router.ts'
   * });
   * 
   * // Access the extracted schema
   * console.log(schema.name);        // 'users.getById.input'
   * console.log(schema.properties);  // { id: { type: {...}, optional: false, ... } }
   * console.log(schema.required);    // ['id']
   * ```
   */
  async extract(ref: SchemaRef): Promise<NormalizedSchema> {
    const parsed = parseTRPCRef(ref.id);
    if (!parsed) {
      throw new Error(`Invalid tRPC ref ID: ${ref.id}`);
    }

    const { path: procedurePath, schemaType, filePath } = parsed;

    // Check if file exists
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Create project and load file
    const project = createProject();
    const sourceFile = project.addSourceFileAtPath(filePath);

    // Extract all procedures
    const procedures = extractProcedures(sourceFile);

    // Find the target procedure
    const procedure = procedures.find(p => p.path.join('.') === procedurePath);

    if (!procedure) {
      throw new Error(`Procedure "${procedurePath}" not found in ${filePath}`);
    }

    // Get the appropriate schema
    const schemaNode = schemaType === 'output'
      ? procedure.outputSchema
      : procedure.inputSchema;

    // Build the schema name
    const schemaName = `${procedurePath}.${schemaType}`;

    if (!schemaNode) {
      // Return empty schema for procedures without explicit input/output
      return createEmptySchema(ref, procedure.location, schemaName);
    }

    return zodToNormalizedSchema(schemaNode, ref, procedure.location, schemaName);
  }

  /**
   * List all tRPC procedures in a file.
   * 
   * Scans the file for router definitions and returns a SchemaRef
   * for each procedure found. Only returns input schema refs by default,
   * as these are the most commonly needed for validation.
   * 
   * The listing process:
   * 1. Load and parse the TypeScript file with ts-morph
   * 2. Find all router definitions (including nested routers)
   * 3. Extract procedure definitions
   * 4. Build SchemaRef IDs for each procedure
   * 
   * Handles errors gracefully - returns empty array if file not found
   * or parsing fails, per ADR guidelines.
   * 
   * @param basePath - Path to the tRPC router file
   * @returns Promise resolving to array of procedure SchemaRefs
   * 
   * @example
   * ```typescript
   * const refs = await adapter.list('./server/routers/index.ts');
   * // [
   * //   { source: 'trpc', id: 'trpc:users.list@./server/routers/index.ts' },
   * //   { source: 'trpc', id: 'trpc:users.getById@./server/routers/index.ts' },
   * //   { source: 'trpc', id: 'trpc:users.create@./server/routers/index.ts' },
   * //   { source: 'trpc', id: 'trpc:posts.list@./server/routers/index.ts' },
   * //   ...
   * // ]
   * 
   * // Then extract each schema
   * for (const ref of refs) {
   *   const schema = await adapter.extract(ref);
   *   console.log(`${schema.name}: ${Object.keys(schema.properties).length} props`);
   * }
   * ```
   */
  async list(basePath: string): Promise<SchemaRef[]> {
    try {
      // Check if file exists
      if (!existsSync(basePath)) {
        return [];
      }

      // Create project and load file
      const project = createProject();
      const sourceFile = project.addSourceFileAtPath(basePath);

      // Extract all procedures
      const procedures = extractProcedures(sourceFile);

      // Convert to SchemaRefs
      const refs: SchemaRef[] = [];

      for (const proc of procedures) {
        const procPath = proc.path.join('.');
        refs.push({
          source: 'trpc',
          id: buildTRPCRefId(procPath, 'input', basePath),
        });
      }

      return refs;
    } catch {
      // Per ADR, list() should handle errors gracefully
      return [];
    }
  }
}
