/**
 * 🔗 tRPC Ref ID Parser
 * 
 * Parses and builds SchemaRef ID strings for the tRPC adapter.
 * 
 * The tRPC adapter uses structured reference IDs to identify
 * specific schemas within tRPC router files. Each ID encodes:
 * - The procedure path (e.g., `users.getById`)
 * - The schema type (`input` or `output`)
 * - The source file path
 * 
 * This module provides utilities to parse these IDs and
 * reconstruct them from components.
 * 
 * @module adapters/trpc/parser
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Parsed components of a tRPC reference ID.
 * 
 * Reference IDs encode the procedure path, schema type, and file path:
 * - `trpc:users.getById@./router.ts` - Input schema (default)
 * - `trpc:users.getById.input@./router.ts` - Explicit input
 * - `trpc:users.getById.output@./router.ts` - Output schema
 * 
 * @example
 * ```typescript
 * const ref: TRPCRef = {
 *   path: 'users.getById',
 *   schemaType: 'input',
 *   filePath: './server/routers/user.ts'
 * };
 * ```
 */
export interface TRPCRef {
  /** 
   * Procedure path using dot notation.
   * For nested routers, this includes the full path (e.g., `users.posts.list`).
   */
  path: string;
  
  /** 
   * Schema type to extract.
   * - `input`: The procedure's input validation schema (from `.input()`)
   * - `output`: The procedure's output validation schema (from `.output()`)
   */
  schemaType: 'input' | 'output';
  
  /** Path to the TypeScript source file containing the router */
  filePath: string;
}

// ============================================================================
// Parsing
// ============================================================================

/**
 * Parse a tRPC reference ID string into its components.
 * 
 * Supported formats:
 * - `trpc:{path}@{file}` - Default (input schema)
 * - `trpc:{path}.input@{file}` - Explicit input schema
 * - `trpc:{path}.output@{file}` - Explicit output schema
 * 
 * The parser handles these edge cases:
 * - Empty or null input → returns null
 * - Missing `trpc:` prefix → returns null
 * - Missing `@` separator → returns null
 * - Empty path or file → returns null
 * 
 * @param refId - The tRPC reference ID string to parse
 * @returns Parsed TRPCRef object, or null if the ID is invalid
 * 
 * @example
 * ```typescript
 * // Parse a default (input) reference
 * parseTRPCRef('trpc:users.getById@./router.ts')
 * // → { path: 'users.getById', schemaType: 'input', filePath: './router.ts' }
 * 
 * // Parse an explicit output reference
 * parseTRPCRef('trpc:users.create.output@./router.ts')
 * // → { path: 'users.create', schemaType: 'output', filePath: './router.ts' }
 * 
 * // Handle nested router paths
 * parseTRPCRef('trpc:admin.users.permissions.grant@./router.ts')
 * // → { path: 'admin.users.permissions.grant', schemaType: 'input', filePath: './router.ts' }
 * 
 * // Invalid inputs return null
 * parseTRPCRef('invalid')  // → null
 * parseTRPCRef('')         // → null
 * ```
 */
export function parseTRPCRef(refId: string): TRPCRef | null {
  // Must have trpc: prefix
  if (!refId || !refId.startsWith('trpc:')) {
    return null;
  }

  // Remove prefix
  const rest = refId.slice(5); // 'trpc:'.length

  // Must have @ separator
  const atIndex = rest.lastIndexOf('@');
  if (atIndex === -1 || atIndex === 0) {
    return null;
  }

  const pathPart = rest.slice(0, atIndex);
  const filePath = rest.slice(atIndex + 1);

  if (!pathPart || !filePath) {
    return null;
  }

  // Determine schema type and actual path
  let schemaType: 'input' | 'output' = 'input';
  let path = pathPart;

  if (pathPart.endsWith('.input')) {
    schemaType = 'input';
    path = pathPart.slice(0, -6); // '.input'.length
  } else if (pathPart.endsWith('.output')) {
    schemaType = 'output';
    path = pathPart.slice(0, -7); // '.output'.length
  }

  return { path, schemaType, filePath };
}

// ============================================================================
// Building
// ============================================================================

/**
 * Build a tRPC reference ID string from its components.
 * 
 * This is the inverse of `parseTRPCRef` - it takes parsed
 * components and constructs a valid reference ID string.
 * 
 * Format conventions:
 * - Input schemas use the default format without `.input` suffix
 * - Output schemas explicitly include the `.output` suffix
 * - This keeps the common case (input) shorter
 * 
 * @param path - Procedure path using dot notation (e.g., `users.getById`)
 * @param schemaType - Schema type: `'input'` or `'output'`
 * @param filePath - Path to the source file containing the router
 * @returns The formatted tRPC reference ID string
 * 
 * @example
 * ```typescript
 * // Build an input reference (default, no suffix)
 * buildTRPCRefId('users.getById', 'input', './router.ts')
 * // → 'trpc:users.getById@./router.ts'
 * 
 * // Build an output reference (explicit suffix)
 * buildTRPCRefId('users.create', 'output', './router.ts')
 * // → 'trpc:users.create.output@./router.ts'
 * 
 * // Round-trip example
 * const ref = parseTRPCRef('trpc:users.list@./router.ts');
 * const id = buildTRPCRefId(ref.path, ref.schemaType, ref.filePath);
 * // id === 'trpc:users.list@./router.ts'
 * ```
 */
export function buildTRPCRefId(
  path: string,
  schemaType: 'input' | 'output',
  filePath: string
): string {
  // Default (input) doesn't need suffix for brevity
  if (schemaType === 'input') {
    return `trpc:${path}@${filePath}`;
  }
  return `trpc:${path}.${schemaType}@${filePath}`;
}
