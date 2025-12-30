/**
 * 🔧 tRPC Router/Procedure Extractor
 * 
 * AST-based extraction of tRPC router definitions and Zod schemas.
 * This module provides utilities to:
 * - Parse TypeScript files containing tRPC routers
 * - Extract procedure definitions (query, mutation, subscription)
 * - Convert Zod schemas to NormalizedSchema format
 * 
 * Uses ts-morph for AST analysis, supporting patterns like:
 * - `t.router({ ... })` - Standard tRPC v10+ pattern
 * - `createTRPCRouter({ ... })` - Next.js/T3 pattern
 * - Nested routers via object composition
 * 
 * @module adapters/trpc/extractor
 */

import {
  Project,
  Node,
  CallExpression,
  SourceFile,
  ObjectLiteralExpression,
  PropertyAssignment,
} from 'ts-morph';
import type {
  NormalizedSchema,
  NormalizedType,
  PropertyDef,
  SchemaRef,
  SourceLocation,
  Constraints,
} from '../../core/types.js';

// ============================================================================
// Public Types
// ============================================================================

/**
 * Information about an extracted tRPC procedure.
 * 
 * Represents a single procedure within a router, including its
 * path (e.g., `["users", "getById"]`), type, and schema AST nodes.
 * 
 * @example
 * ```typescript
 * const info: ProcedureInfo = {
 *   path: ['users', 'getById'],
 *   type: 'query',
 *   inputSchema: inputNode,
 *   outputSchema: undefined,
 *   location: { file: './router.ts', line: 42 }
 * };
 * ```
 */
export interface ProcedureInfo {
  /** Full path as array (e.g., ["users", "getById"]) */
  path: string[];
  /** Procedure type: query for reads, mutation for writes, subscription for realtime */
  type: 'query' | 'mutation' | 'subscription';
  /** Input schema AST node (from `.input(...)` call), if defined */
  inputSchema?: Node;
  /** Output schema AST node (from `.output(...)` call), if defined */
  outputSchema?: Node;
  /** Source location where the procedure is defined */
  location: SourceLocation;
}

// ============================================================================
// Project Creation
// ============================================================================

/**
 * Create a new ts-morph Project instance for AST analysis.
 * 
 * Configures the project without tsconfig to allow standalone
 * file analysis without project-wide compilation context.
 * 
 * @returns A new ts-morph Project instance
 * 
 * @example
 * ```typescript
 * const project = createProject();
 * const sourceFile = project.addSourceFileAtPath('./router.ts');
 * const procedures = extractProcedures(sourceFile);
 * ```
 */
export function createProject(): Project {
  return new Project({
    tsConfigFilePath: undefined,
    skipAddingFilesFromTsConfig: true,
  });
}

// ============================================================================
// Procedure Extraction
// ============================================================================

/**
 * Extract all procedures from a tRPC router source file.
 * 
 * Scans the file for router definitions and extracts all procedure
 * definitions, including those in nested routers. Each procedure
 * is returned with its full path, type, and schema nodes.
 * 
 * Supported patterns:
 * - `t.router({ user: t.procedure.query(...) })`
 * - `createTRPCRouter({ users: userRouter })`
 * - `createRouter({ nested: { deep: procedure } })`
 * 
 * @param sourceFile - The ts-morph SourceFile to analyze
 * @returns Array of ProcedureInfo objects for all found procedures
 * 
 * @example
 * ```typescript
 * const project = createProject();
 * const file = project.addSourceFileAtPath('./server/routers/index.ts');
 * const procedures = extractProcedures(file);
 * 
 * for (const proc of procedures) {
 *   console.log(`${proc.path.join('.')} - ${proc.type}`);
 *   // Output: "users.getById - query"
 * }
 * ```
 */
export function extractProcedures(sourceFile: SourceFile): ProcedureInfo[] {
  const procedures: ProcedureInfo[] = [];
  const filePath = sourceFile.getFilePath();

  // Find all router calls and extract procedures
  sourceFile.forEachDescendant((node) => {
    if (Node.isCallExpression(node) && isRouterCall(node)) {
      const procs = parseRouterObject(node, [], filePath);
      procedures.push(...procs);
    }
  });

  return procedures;
}

/**
 * Check if a call expression is a tRPC router call.
 * 
 * Matches patterns like:
 * - `t.router(...)` - Method call on object
 * - `trpc.router(...)` - Namespaced call
 * - `createRouter(...)` - Function call
 * - `createTRPCRouter(...)` - T3/Next.js pattern
 * 
 * @param node - The AST node to check
 * @returns True if the node is a router call expression
 * 
 * @example
 * ```typescript
 * sourceFile.forEachDescendant((node) => {
 *   if (Node.isCallExpression(node) && isRouterCall(node)) {
 *     // Process router definition
 *   }
 * });
 * ```
 */
export function isRouterCall(node: Node): node is CallExpression {
  if (!Node.isCallExpression(node)) return false;

  const expr = node.getExpression();
  
  // Match patterns like: t.router(), trpc.router(), createRouter(), createTRPCRouter()
  if (Node.isPropertyAccessExpression(expr)) {
    return expr.getName() === 'router';
  }
  
  // Match direct function calls
  if (Node.isIdentifier(expr)) {
    const name = expr.getText();
    return name === 'createRouter' || name === 'createTRPCRouter';
  }

  return false;
}

/**
 * Check if a node is a tRPC procedure chain.
 * 
 * Procedure chains are method chains that terminate in `.query()`,
 * `.mutation()`, or `.subscription()`. This function walks up the
 * chain to find these terminal methods.
 * 
 * @param node - The AST node to check
 * @returns True if the node is a procedure chain
 * 
 * @example
 * ```typescript
 * // These would return true:
 * // t.procedure.input(z.string()).query(...)
 * // t.procedure.mutation(...)
 * // publicProcedure.subscription(...)
 * ```
 */
export function isProcedureChain(node: Node | undefined): boolean {
  if (!node) return false;

  // Walk up the call chain to find terminal methods
  let current = node;
  while (Node.isCallExpression(current)) {
    const expr = current.getExpression();
    if (Node.isPropertyAccessExpression(expr)) {
      const methodName = expr.getName();
      if (methodName === 'query' || methodName === 'mutation' || methodName === 'subscription') {
        return true;
      }
    }
    // Move to inner expression to keep checking
    if (Node.isPropertyAccessExpression(expr)) {
      const inner = expr.getExpression();
      if (Node.isCallExpression(inner)) {
        current = inner;
        continue;
      }
    }
    break;
  }

  return false;
}

/**
 * Parse a router object literal and extract all procedures.
 * 
 * Recursively processes router definitions, handling:
 * - Direct procedure definitions
 * - Nested router references
 * - Inline nested routers
 * 
 * @param routerCall - The router call expression node
 * @param currentPath - Current path prefix for nested routers
 * @param filePath - Path to the source file
 * @returns Array of ProcedureInfo for all found procedures
 */
export function parseRouterObject(
  routerCall: CallExpression,
  currentPath: string[],
  filePath: string
): ProcedureInfo[] {
  const procedures: ProcedureInfo[] = [];
  const args = routerCall.getArguments();

  if (args.length === 0) return procedures;

  const routerObj = args[0];
  if (!Node.isObjectLiteralExpression(routerObj)) return procedures;

  for (const prop of routerObj.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;

    const propName = prop.getName();
    const init = prop.getInitializer();
    if (!init) continue;

    // Check if it's a nested router
    if (isNestedRouter(init)) {
      // Recursively parse nested router
      const nestedCall = extractRouterCall(init);
      if (nestedCall) {
        const nested = parseRouterObject(
          nestedCall,
          [...currentPath, propName],
          filePath
        );
        procedures.push(...nested);
      }
    } else if (isProcedureChain(init)) {
      // Parse procedure definition
      const procInfo = parseProcedureChain(init, [...currentPath, propName], filePath);
      if (procInfo) {
        procedures.push(procInfo);
      }
    }
  }

  return procedures;
}

/**
 * Check if a node represents a nested router.
 * 
 * @param node - The AST node to check
 * @returns True if the node is a nested router definition or reference
 */
function isNestedRouter(node: Node): boolean {
  // Direct router call
  if (Node.isCallExpression(node) && isRouterCall(node)) {
    return true;
  }

  // Identifier referencing a router (e.g., userRouter)
  if (Node.isIdentifier(node)) {
    const name = node.getText();
    return name.endsWith('Router') || name.endsWith('router');
  }

  return false;
}

/**
 * Extract the router call from a node.
 * 
 * Handles both direct router calls and identifier references
 * to router variables.
 * 
 * @param node - The AST node to extract from
 * @returns The router CallExpression, or null if not found
 */
function extractRouterCall(node: Node): CallExpression | null {
  if (Node.isCallExpression(node) && isRouterCall(node)) {
    return node;
  }

  // For identifier references, we need to follow the variable declaration
  if (Node.isIdentifier(node)) {
    const symbol = node.getSymbol();
    if (symbol) {
      const declarations = symbol.getDeclarations();
      for (const decl of declarations) {
        if (Node.isVariableDeclaration(decl)) {
          const init = decl.getInitializer();
          if (init && Node.isCallExpression(init) && isRouterCall(init)) {
            return init;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Parse a procedure method chain to extract input/output schemas.
 * 
 * Walks the method chain (`.input().output().query()`) and extracts:
 * - Input schema from `.input(zodSchema)`
 * - Output schema from `.output(zodSchema)`
 * - Procedure type from terminal method (`.query()`, `.mutation()`, `.subscription()`)
 * 
 * @param node - The procedure chain call expression
 * @param path - Full path to this procedure
 * @param filePath - Path to the source file
 * @returns ProcedureInfo or null if parsing fails
 * 
 * @example
 * ```typescript
 * // For: t.procedure.input(z.object({ id: z.string() })).query(...)
 * // Returns: { path: ['getById'], type: 'query', inputSchema: <Node>, ... }
 * ```
 */
export function parseProcedureChain(
  node: Node,
  path: string[],
  filePath: string
): ProcedureInfo | null {
  if (!Node.isCallExpression(node)) return null;

  const location: SourceLocation = {
    file: filePath,
    line: node.getStartLineNumber(),
  };

  let inputSchema: Node | undefined;
  let outputSchema: Node | undefined;
  let procedureType: 'query' | 'mutation' | 'subscription' = 'query';

  // Walk up the method chain to collect .input(), .output(), etc.
  let current: Node | undefined = node;

  while (current && Node.isCallExpression(current)) {
    const expr = current.getExpression();

    if (Node.isPropertyAccessExpression(expr)) {
      const methodName = expr.getName();
      const args = current.getArguments();

      switch (methodName) {
        case 'input':
          if (args.length > 0) inputSchema = args[0];
          break;
        case 'output':
          if (args.length > 0) outputSchema = args[0];
          break;
        case 'query':
          procedureType = 'query';
          break;
        case 'mutation':
          procedureType = 'mutation';
          break;
        case 'subscription':
          procedureType = 'subscription';
          break;
      }

      // Move up the chain
      const inner = expr.getExpression();
      if (Node.isCallExpression(inner)) {
        current = inner;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return {
    path,
    type: procedureType,
    inputSchema,
    outputSchema,
    location,
  };
}

// ============================================================================
// Zod Schema Conversion
// ============================================================================

/**
 * Convert a Zod schema AST node to NormalizedSchema.
 * 
 * Parses Zod schema definitions and converts them to the framework's
 * NormalizedSchema format. Supports common Zod types:
 * - Primitives: `z.string()`, `z.number()`, `z.boolean()`
 * - Objects: `z.object({ ... })`
 * - Arrays: `z.array(...)`
 * - Unions: `z.union([...])`, `z.enum([...])`
 * - Modifiers: `.optional()`, `.nullable()`, `.default()`
 * - Constraints: `.min()`, `.max()`, `.email()`, etc.
 * 
 * @param node - The AST node containing the Zod schema
 * @param ref - The SchemaRef for source tracking
 * @param location - Source location for error reporting
 * @param name - Optional schema name
 * @returns The converted NormalizedSchema
 * 
 * @example
 * ```typescript
 * const schema = zodToNormalizedSchema(
 *   inputSchemaNode,
 *   { source: 'trpc', id: 'trpc:users.create@./router.ts' },
 *   { file: './router.ts', line: 42 },
 *   'users.create.input'
 * );
 * ```
 */
export function zodToNormalizedSchema(
  node: Node,
  ref: SchemaRef,
  location: SourceLocation,
  name?: string
): NormalizedSchema {
  const properties: Record<string, PropertyDef> = {};
  const required: string[] = [];

  // Parse z.object({...})
  if (Node.isCallExpression(node)) {
    const expr = node.getExpression();
    const exprText = expr.getText();

    if (exprText === 'z.object' || exprText.endsWith('.object')) {
      const args = node.getArguments();
      if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
        parseZodObjectProperties(args[0], properties, required);
      }
    }
  }

  // Handle identifier references to named schemas
  if (Node.isIdentifier(node)) {
    const schema = resolveZodSchemaReference(node);
    if (schema) {
      return zodToNormalizedSchema(schema, ref, location, name);
    }
  }

  return {
    name: name || ref.id.split('@')[0].split(':')[1],
    properties,
    required,
    source: ref,
    location,
  };
}

/**
 * Resolve a Zod schema reference (identifier) to its definition.
 * 
 * Follows variable declarations to find the actual schema definition.
 * Used for patterns like `const UserSchema = z.object({ ... })`.
 * 
 * @param node - The identifier node to resolve
 * @returns The resolved schema AST node, or null if not found
 */
function resolveZodSchemaReference(node: Node): Node | null {
  if (!Node.isIdentifier(node)) return null;

  const symbol = node.getSymbol();
  if (!symbol) return null;

  const declarations = symbol.getDeclarations();
  for (const decl of declarations) {
    if (Node.isVariableDeclaration(decl)) {
      const init = decl.getInitializer();
      if (init) return init;
    }
  }

  return null;
}

/**
 * Parse properties from a `z.object({ ... })` call.
 * 
 * Extracts each property definition and determines which are required.
 * Properties with `.optional()`, `.nullish()`, or `.default()` are
 * considered optional.
 * 
 * @param obj - The object literal expression node
 * @param properties - Map to populate with property definitions
 * @param required - Array to populate with required property names
 */
function parseZodObjectProperties(
  obj: ObjectLiteralExpression,
  properties: Record<string, PropertyDef>,
  required: string[]
): void {
  for (const prop of obj.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;

    const propName = prop.getName();
    const init = prop.getInitializer();
    if (!init) continue;

    const propDef = parseZodTypeToPropDef(init);
    properties[propName] = propDef;

    const initText = init.getText();
    // Check if not optional and not with default
    if (!initText.includes('.optional()') && 
        !initText.includes('.nullish()') &&
        !initText.includes('.default(')) {
      required.push(propName);
    }
  }
}

/**
 * Parse a Zod type expression to PropertyDef.
 * 
 * Converts a single property's Zod schema to PropertyDef format,
 * extracting type, optionality, nullability, and constraints.
 * 
 * @param node - The Zod type expression node
 * @returns The converted PropertyDef
 */
function parseZodTypeToPropDef(node: Node): PropertyDef {
  const text = node.getText();
  const type = parseZodTypeToNormalized(node);
  const constraints = extractZodConstraints(text);

  const isOptional = text.includes('.optional()') || text.includes('.nullish()') || text.includes('.default(');
  const isNullable = text.includes('.nullable()') || text.includes('.nullish()');

  return {
    type,
    optional: isOptional,
    nullable: isNullable,
    readonly: false,
    deprecated: false,
    constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
  };
}

/**
 * Parse a Zod type to NormalizedType.
 * 
 * Recursively converts Zod types to the framework's NormalizedType format.
 * Handles nested types (arrays, objects, unions) and method chains.
 * 
 * Supported Zod types:
 * - `z.string()` → `{ kind: 'primitive', value: 'string' }`
 * - `z.number()` → `{ kind: 'primitive', value: 'number' }`
 * - `z.boolean()` → `{ kind: 'primitive', value: 'boolean' }`
 * - `z.array(T)` → `{ kind: 'array', element: T }`
 * - `z.object({})` → `{ kind: 'object', schema: {...} }`
 * - `z.enum([])` → `{ kind: 'union', variants: [...] }`
 * - `z.literal(v)` → `{ kind: 'literal', value: v }`
 * 
 * @param node - The Zod type AST node
 * @returns The converted NormalizedType
 */
function parseZodTypeToNormalized(node: Node): NormalizedType {
  const text = node.getText();
  const trimmedText = text.trim();

  // First, resolve identifier references
  if (Node.isIdentifier(node)) {
    const resolved = resolveZodSchemaReference(node);
    if (resolved) {
      return parseZodTypeToNormalized(resolved);
    }
    return { kind: 'ref', name: node.getText() };
  }

  // Handle chained methods (e.g., z.string().optional())
  // Must check BEFORE primitive types to unwrap the chain
  if (Node.isCallExpression(node)) {
    const expr = node.getExpression();
    if (Node.isPropertyAccessExpression(expr)) {
      const methodName = expr.getName();
      // Skip over .optional(), .nullable(), .default(), etc. and parse inner
      if (['optional', 'nullable', 'nullish', 'default', 'describe',
           'min', 'max', 'int', 'positive', 'email', 'uuid', 'url'].includes(methodName)) {
        const inner = expr.getExpression();
        return parseZodTypeToNormalized(inner);
      }
    }
  }

  // z.string()
  if (trimmedText.startsWith('z.string()') || trimmedText.startsWith('z.string(')) {
    return { kind: 'primitive', value: 'string' };
  }

  // z.number()
  if (trimmedText.startsWith('z.number()') || trimmedText.startsWith('z.number(')) {
    return { kind: 'primitive', value: 'number' };
  }

  // z.boolean()
  if (trimmedText.startsWith('z.boolean()') || trimmedText.startsWith('z.boolean(')) {
    return { kind: 'primitive', value: 'boolean' };
  }

  // z.date()
  if (trimmedText.startsWith('z.date()') || trimmedText.startsWith('z.date(')) {
    return { kind: 'primitive', value: 'string' }; // Date serialized as string
  }

  // z.enum([...])
  if (trimmedText.startsWith('z.enum(')) {
    const enumMatch = text.match(/z\.enum\(\[(.*?)\]\)/s);
    if (enumMatch) {
      const values = enumMatch[1]
        .split(',')
        .map(v => v.trim().replace(/['"]/g, ''))
        .filter(v => v.length > 0);
      
      const variants: NormalizedType[] = values.map(v => ({
        kind: 'literal' as const,
        value: v,
      }));
      
      return { kind: 'union', variants };
    }
  }

  // z.array(...)
  if (trimmedText.startsWith('z.array(')) {
    if (Node.isCallExpression(node)) {
      const args = node.getArguments();
      if (args.length > 0) {
        const elementType = parseZodTypeToNormalized(args[0]);
        return { kind: 'array', element: elementType };
      }
    }
    return { kind: 'array', element: { kind: 'unknown' } };
  }

  // z.object(...) - check multiple patterns
  if (trimmedText.startsWith('z.object(') || trimmedText.startsWith('z.object({')) {
    if (Node.isCallExpression(node)) {
      const args = node.getArguments();
      if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
        const properties: Record<string, PropertyDef> = {};
        const required: string[] = [];
        parseZodObjectProperties(args[0], properties, required);
        
        return {
          kind: 'object',
          schema: {
            properties,
            required,
            source: { source: 'trpc', id: 'inline' },
          },
        };
      }
    }
    return { kind: 'object', schema: { properties: {}, required: [], source: { source: 'trpc', id: 'inline' } } };
  }

  // z.literal(...)
  if (trimmedText.startsWith('z.literal(')) {
    const match = text.match(/z\.literal\(['"](.+?)['"]\)/);
    if (match) {
      return { kind: 'literal', value: match[1] };
    }
    const numMatch = text.match(/z\.literal\((\d+)\)/);
    if (numMatch) {
      return { kind: 'literal', value: parseInt(numMatch[1]) };
    }
    const boolMatch = text.match(/z\.literal\((true|false)\)/);
    if (boolMatch) {
      return { kind: 'literal', value: boolMatch[1] === 'true' };
    }
  }

  // z.union([...])
  if (trimmedText.startsWith('z.union(')) {
    if (Node.isCallExpression(node)) {
      const args = node.getArguments();
      if (args.length > 0 && Node.isArrayLiteralExpression(args[0])) {
        const variants = args[0].getElements().map(el => parseZodTypeToNormalized(el));
        return { kind: 'union', variants };
      }
    }
  }

  // Fallback: Check if this is a CallExpression that looks like z.X pattern
  if (Node.isCallExpression(node)) {
    const expr = node.getExpression();
    if (Node.isPropertyAccessExpression(expr)) {
      const objExpr = expr.getExpression();
      if (Node.isIdentifier(objExpr) && objExpr.getText() === 'z') {
        const methodName = expr.getName();
        if (methodName === 'object') {
          const args = node.getArguments();
          if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
            const properties: Record<string, PropertyDef> = {};
            const required: string[] = [];
            parseZodObjectProperties(args[0], properties, required);
            
            return {
              kind: 'object',
              schema: {
                properties,
                required,
                source: { source: 'trpc', id: 'inline' },
              },
            };
          }
        }
      }
    }
  }

  return { kind: 'unknown' };
}

/**
 * Extract validation constraints from a Zod type chain.
 * 
 * Parses the Zod method chain text to extract constraints like:
 * - String: `.min(n)`, `.max(n)`, `.email()`, `.uuid()`, `.url()`
 * - Number: `.min(n)`, `.max(n)`, `.int()`, `.positive()`
 * 
 * @param text - The Zod type chain as text
 * @returns Extracted constraints object
 * 
 * @example
 * ```typescript
 * extractZodConstraints('z.string().min(1).max(100).email()')
 * // { minLength: 1, maxLength: 100, format: 'email' }
 * ```
 */
function extractZodConstraints(text: string): Constraints {
  const constraints: Constraints = {};

  // String constraints
  const minLengthMatch = text.match(/\.min\((\d+)\)/);
  const maxLengthMatch = text.match(/\.max\((\d+)\)/);
  
  // For strings
  if (text.includes('z.string()')) {
    if (minLengthMatch) constraints.minLength = parseInt(minLengthMatch[1]);
    if (maxLengthMatch) constraints.maxLength = parseInt(maxLengthMatch[1]);
    
    // Format constraints
    if (text.includes('.email()')) constraints.format = 'email';
    if (text.includes('.uuid()')) constraints.format = 'uuid';
    if (text.includes('.url()')) constraints.format = 'url';
  }

  // Number constraints
  if (text.includes('z.number()')) {
    if (minLengthMatch) constraints.minimum = parseInt(minLengthMatch[1]);
    if (maxLengthMatch) constraints.maximum = parseInt(maxLengthMatch[1]);
  }

  return constraints;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create an empty NormalizedSchema.
 * 
 * Used for procedures without explicit input or output schemas.
 * Returns a valid schema with empty properties.
 * 
 * @param ref - The SchemaRef for source tracking
 * @param location - Source location for error reporting
 * @param name - Optional schema name
 * @returns An empty NormalizedSchema
 * 
 * @example
 * ```typescript
 * // For a procedure with no .input() call
 * const emptyInput = createEmptySchema(
 *   ref,
 *   { file: './router.ts', line: 10 },
 *   'users.list.input'
 * );
 * ```
 */
export function createEmptySchema(
  ref: SchemaRef,
  location: SourceLocation,
  name?: string
): NormalizedSchema {
  return {
    name: name || ref.id.split('@')[0].split(':')[1],
    properties: {},
    required: [],
    source: ref,
    location,
  };
}
