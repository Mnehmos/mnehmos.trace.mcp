/**
 * 🔗 Cross-File Import Resolution for TypeScript Projects
 *
 * This module provides comprehensive import resolution capabilities for TypeScript
 * projects, including:
 * - Relative import resolution (./foo, ../bar)
 * - tsconfig.json path alias resolution (@/utils, models)
 * - Re-export chain following (export * from, export { X } from)
 * - Circular reference detection
 * - Import graph building for visualization
 *
 * @module import-resolver
 * @see ADR Reference: .context/ADR-P2-5-IMPORT-RESOLUTION.md
 *
 * @example Basic Usage
 * ```typescript
 * import { ImportResolverImpl } from './import-resolver.js';
 *
 * const resolver = new ImportResolverImpl({
 *   tsConfigPath: './tsconfig.json',
 *   maxReexportDepth: 10,
 * });
 *
 * // Resolve an import
 * const result = resolver.resolve('./types', '/project/src/index.ts');
 *
 * // Get all exported types from a file
 * const types = resolver.getExportedTypes('/project/src/types/index.ts');
 *
 * // Resolve a specific type reference
 * const typeRef = resolver.resolveTypeRef('User', '/project/src/handlers/user.ts');
 * ```
 */

import { Project, SourceFile, Node, SyntaxKind, Type, Symbol as TsSymbol, ts } from 'ts-morph';
import type { NormalizedType, NormalizedSchema, PropertyDef, SchemaRef } from '../core/types.js';
import * as path from 'path';
import * as fs from 'fs';

// ═══════════════════════════════════════════════════════════════════════════
// 📁 Path Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Checks if a file path is a Windows-style path.
 *
 * Detects Windows paths by looking for drive letter patterns like `C:\` or `C:/`.
 *
 * @param filePath - The file path to check
 * @returns `true` if the path contains a Windows drive letter pattern
 *
 * @example
 * ```typescript
 * isWindowsPath('C:\\Users\\project\\src'); // true
 * isWindowsPath('/home/user/project'); // false
 * ```
 */
function isWindowsPath(filePath: string): boolean {
  // Check for Windows drive letter pattern anywhere in the path (e.g., C:, f:, F:\, f:/)
  // This handles both "C:\..." and "C:/..." formats
  return /[a-zA-Z]:[\\/]/.test(filePath) || /^[a-zA-Z]:/.test(filePath);
}

/**
 * Normalizes path separators to use OS-native separators.
 *
 * On Windows, converts forward slashes to backslashes to ensure consistent
 * path handling across the codebase.
 *
 * @param filePath - The file path to normalize
 * @returns The path with OS-native separators
 *
 * @example
 * ```typescript
 * // On Windows:
 * normalizePath('C:/Users/project/src'); // 'C:\\Users\\project\\src'
 * ```
 */
function normalizePath(filePath: string): string {
  // On Windows, always convert forward slashes to backslashes
  if (process.platform === 'win32' || isWindowsPath(filePath)) {
    // Use regex to replace ALL forward slashes in one operation
    return filePath.replace(/\//g, '\\');
  }
  return filePath;
}

/**
 * Forces path normalization for output - the final step before returning to caller.
 *
 * This is the last line of defense against mixed slashes in returned paths.
 *
 * @param filePath - The file path to normalize
 * @returns The path with OS-native separators
 */
function normalizeOutputPath(filePath: string): string {
  if (process.platform === 'win32') {
    return filePath.replace(/\//g, '\\');
  }
  return filePath;
}

/**
 * Joins path segments with proper separator based on the first segment.
 *
 * On Windows, ensures the result uses backslashes regardless of input format.
 *
 * @param segments - Path segments to join
 * @returns The joined path with OS-native separators
 *
 * @example
 * ```typescript
 * // On Windows:
 * joinPath('C:\\project', 'src', 'index.ts'); // 'C:\\project\\src\\index.ts'
 * ```
 */
function joinPath(...segments: string[]): string {
  // Use the first non-empty segment to determine if this is a Windows path
  const firstSegment = segments.find(s => s.length > 0) || '';

  // On Windows (or if path looks like Windows), use backslash
  if (isWindowsPath(firstSegment) || process.platform === 'win32') {
    // Join manually with backslash to avoid path.join using wrong separator
    const normalizedSegments = segments.map(s => s.replace(/\//g, '\\').replace(/\\+$/, ''));
    const result = normalizedSegments.join('\\').replace(/\\+/g, '\\');
    return result;
  }

  // Use path.join for non-Windows
  return path.join(...segments);
}

// ═══════════════════════════════════════════════════════════════════════════
// 📋 Public Interfaces
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of resolving an import specifier to a file path.
 *
 * This interface represents the complete result of import resolution,
 * including the resolved file path, export information, and the parsed
 * source file for further analysis.
 *
 * @example
 * ```typescript
 * const result: ResolvedImport = {
 *   filePath: '/project/src/types/user.ts',
 *   exportName: 'User',
 *   isDefault: false,
 *   isNamespace: false,
 *   isTypeOnly: true,
 *   originalSpecifier: './types/user',
 * };
 * ```
 */
export interface ResolvedImport {
  /** Absolute path to the resolved file */
  filePath: string;

  /** The export name (or 'default' for default exports, '*' for namespace) */
  exportName: string;

  /** Whether this is a default import (`import X from '...'`) */
  isDefault: boolean;

  /** Whether this is a namespace import (`import * as X from '...'`) */
  isNamespace: boolean;

  /** Whether this is a type-only import (`import type { X } from '...'`) */
  isTypeOnly: boolean;

  /** The source file containing the export (if successfully parsed) */
  sourceFile?: SourceFile;

  /** Original import specifier for debugging and error messages */
  originalSpecifier: string;
}

/**
 * Result of resolving a type reference across files.
 *
 * When resolving a type like `User` from a handler file, this interface
 * provides the fully resolved type definition, the file where it's defined,
 * and the chain of re-exports that were followed to find it.
 *
 * @example
 * ```typescript
 * const result: ResolvedTypeRef = {
 *   type: { kind: 'object', schema: { name: 'User', properties: {...} } },
 *   definitionFile: '/project/src/types/user.ts',
 *   definitionLine: 5,
 *   reexportChain: ['/project/src/types/index.ts'],
 *   complete: true,
 * };
 * ```
 */
export interface ResolvedTypeRef {
  /** The fully resolved type in NormalizedType format */
  type: NormalizedType;

  /** Absolute path to the file where the type is defined */
  definitionFile: string;

  /** Line number of the type definition (1-indexed) */
  definitionLine: number;

  /** Chain of re-export files traversed to reach the definition */
  reexportChain: string[];

  /** Whether resolution was complete or partial */
  complete: boolean;

  /** Reason if resolution was incomplete (e.g., circular reference, max depth) */
  incompleteReason?: string;
}

/**
 * Configuration options for the import resolver.
 *
 * @example
 * ```typescript
 * const config: ImportResolverConfig = {
 *   tsConfigPath: './tsconfig.json',
 *   maxReexportDepth: 15,
 *   maxCacheSize: 1000,
 *   includeNodeModules: false,
 * };
 * ```
 */
export interface ImportResolverConfig {
  /**
   * Path to tsconfig.json file.
   * Enables path alias resolution using `compilerOptions.paths` and `baseUrl`.
   */
  tsConfigPath?: string;

  /**
   * Maximum depth for re-export chain resolution.
   * Prevents infinite loops in complex re-export scenarios.
   * @default 10
   */
  maxReexportDepth?: number;

  /**
   * Maximum number of entries in the file cache (LRU eviction).
   * Higher values use more memory but improve performance.
   * @default 500
   */
  maxCacheSize?: number;

  /**
   * Whether to resolve imports from node_modules.
   * When false, third-party package imports return null.
   * @default false
   */
  includeNodeModules?: boolean;

  /**
   * Custom module resolution path mappings.
   * Alternative to tsconfig.json paths for dynamic configuration.
   */
  pathMappings?: Record<string, string[]>;

  /**
   * Base directory for relative path resolution.
   * Defaults to the directory containing the source file.
   */
  baseDir?: string;
}

/**
 * Node in an import dependency graph.
 *
 * Represents a file and its import/export relationships for visualization
 * and dependency analysis.
 *
 * @example
 * ```typescript
 * const node: ImportGraphNode = {
 *   filePath: '/project/src/handlers/user.ts',
 *   imports: [
 *     { specifier: '../types', resolved: '/project/src/types/index.ts', names: ['User'] },
 *   ],
 *   exports: ['getUserHandler', 'createUserHandler'],
 *   children: [...], // Recursive nodes for imported files
 * };
 * ```
 */
export interface ImportGraphNode {
  /** Absolute path to this file */
  filePath: string;

  /** List of imports in this file */
  imports: Array<{
    /** Original import specifier (e.g., '../types', '@/utils') */
    specifier: string;
    /** Resolved absolute path, or null if unresolvable */
    resolved: string | null;
    /** Names imported from this specifier */
    names: string[];
  }>;

  /** List of exported type/value names from this file */
  exports: string[];

  /** Child nodes for imported files (when depth > 0) */
  children?: ImportGraphNode[];
}

/**
 * Statistics about the file cache performance.
 *
 * Use this to monitor cache effectiveness and tune `maxCacheSize`.
 */
export interface CacheStats {
  /** Current number of cached entries */
  size: number;

  /** Maximum cache capacity */
  maxSize: number;

  /** Number of cache hits (successful lookups) */
  hits: number;

  /** Number of cache misses (new file parses required) */
  misses: number;

  /** Cache hit rate as a decimal (0.0 to 1.0) */
  hitRate: number;
}

/**
 * Import resolution engine interface.
 *
 * Provides methods for resolving TypeScript imports, extracting exported types,
 * and building import dependency graphs.
 *
 * @example
 * ```typescript
 * const resolver: ImportResolver = new ImportResolverImpl({
 *   tsConfigPath: './tsconfig.json',
 * });
 *
 * // Resolve a relative import
 * const resolved = resolver.resolve('./types', '/project/src/index.ts');
 *
 * // Get exported types
 * const types = resolver.getExportedTypes('/project/src/types/index.ts');
 * ```
 */
export interface ImportResolver {
  /**
   * Resolves an import specifier from a source file.
   *
   * @param importPath - The import specifier (e.g., './types', '@/utils', 'lodash')
   * @param fromFile - Absolute path to the file containing the import
   * @returns Resolved import info, or null if unresolvable
   *
   * @example
   * ```typescript
   * const result = resolver.resolve('./types/user', '/project/src/handlers/index.ts');
   * // result.filePath === '/project/src/types/user.ts'
   * ```
   */
  resolve(importPath: string, fromFile: string): ResolvedImport | null;

  /**
   * Gets all exported types from a file.
   *
   * Includes both direct exports and re-exports from other modules.
   *
   * @param filePath - Absolute path to the file
   * @returns Map of export name to NormalizedType
   *
   * @example
   * ```typescript
   * const types = resolver.getExportedTypes('/project/src/types/index.ts');
   * // types.get('User') => { kind: 'object', schema: {...} }
   * ```
   */
  getExportedTypes(filePath: string): Map<string, NormalizedType>;

  /**
   * Resolves a type reference following imports and re-exports.
   *
   * Starting from a source file, follows the import chain to find
   * where a type is actually defined.
   *
   * @param typeName - Name of the type to resolve
   * @param fromFile - Absolute path to the file using the type
   * @returns Resolved type reference, or null if not found
   *
   * @example
   * ```typescript
   * const ref = resolver.resolveTypeRef('User', '/project/src/handlers/user.ts');
   * // ref.definitionFile === '/project/src/types/user.ts'
   * // ref.reexportChain === ['/project/src/types/index.ts']
   * ```
   */
  resolveTypeRef(typeName: string, fromFile: string): ResolvedTypeRef | null;

  /**
   * Gets the import graph for a file.
   *
   * Builds a tree of import dependencies for visualization or analysis.
   *
   * @param filePath - Absolute path to the root file
   * @param depth - How deep to traverse (default: 1)
   * @returns Import graph node with children
   *
   * @example
   * ```typescript
   * const graph = resolver.getImportGraph('/project/src/index.ts', 2);
   * // graph.imports => [{ specifier: './handlers', resolved: '...', names: [...] }]
   * // graph.children => [{ filePath: '...', imports: [...], ... }]
   * ```
   */
  getImportGraph(filePath: string, depth?: number): ImportGraphNode;

  /**
   * Clears all cached data.
   *
   * Use after making changes to source files to ensure fresh parsing.
   */
  clearCache(): void;

  /**
   * Gets cache performance statistics.
   *
   * @returns Current cache statistics
   *
   * @example
   * ```typescript
   * const stats = resolver.getCacheStats();
   * console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
   * ```
   */
  getCacheStats(): CacheStats;

  /**
   * Warms the cache by pre-loading files matching patterns.
   *
   * Use before batch operations to improve performance.
   *
   * @param patterns - Glob patterns for files to pre-load
   *
   * @example
   * ```typescript
   * await resolver.warmCache(['src/**\/*.ts', 'lib/**\/*.ts']);
   * ```
   */
  warmCache(patterns: string[]): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🗄️ Cache Implementation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cached data for a parsed TypeScript file.
 * @internal
 */
interface CacheEntry {
  /** Parsed ts-morph source file */
  sourceFile: SourceFile;

  /** Exported types (lazily computed on first access) */
  exportedTypes?: Map<string, NormalizedType>;

  /** File modification time for cache invalidation */
  mtime: number;

  /** Timestamp when this entry was created */
  cachedAt: number;
}

/**
 * LRU (Least Recently Used) Cache for parsed TypeScript files.
 *
 * Provides efficient caching with automatic eviction of least-recently-used
 * entries when the cache reaches capacity.
 *
 * @example
 * ```typescript
 * const cache = new FileCache(100);
 * cache.set('/path/to/file.ts', { sourceFile, mtime: Date.now(), cachedAt: Date.now() });
 * const entry = cache.get('/path/to/file.ts');
 * ```
 */
export class FileCache {
  private cache: Map<string, CacheEntry>;
  private accessOrder: string[];
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;

  /**
   * Creates a new FileCache instance.
   *
   * @param maxSize - Maximum number of entries before LRU eviction (default: 500)
   */
  constructor(maxSize = 500) {
    this.cache = new Map();
    this.accessOrder = [];
    this.maxSize = maxSize;
  }

  /**
   * Gets a cached entry, updating its access order.
   *
   * @param filePath - Absolute path to the file
   * @returns Cached entry, or undefined if not cached
   */
  get(filePath: string): CacheEntry | undefined {
    const entry = this.cache.get(filePath);
    if (entry) {
      this.hits++;
      // Move to end of access order (most recently used)
      const idx = this.accessOrder.indexOf(filePath);
      if (idx !== -1) {
        this.accessOrder.splice(idx, 1);
      }
      this.accessOrder.push(filePath);
      return entry;
    }
    this.misses++;
    return undefined;
  }

  /**
   * Sets a cache entry, evicting LRU entries if at capacity.
   *
   * @param filePath - Absolute path to the file
   * @param entry - Cache entry to store
   */
  set(filePath: string, entry: CacheEntry): void {
    // If already exists, update and move to end
    if (this.cache.has(filePath)) {
      this.cache.set(filePath, entry);
      const idx = this.accessOrder.indexOf(filePath);
      if (idx !== -1) {
        this.accessOrder.splice(idx, 1);
      }
      this.accessOrder.push(filePath);
      return;
    }

    // Evict LRU if at capacity
    while (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
      const lruKey = this.accessOrder.shift()!;
      this.cache.delete(lruKey);
    }

    // Add new entry
    this.cache.set(filePath, entry);
    this.accessOrder.push(filePath);
  }

  /**
   * Invalidates a cache entry for a modified file.
   *
   * @param filePath - Absolute path to the file to invalidate
   */
  invalidate(filePath: string): void {
    this.cache.delete(filePath);
    const idx = this.accessOrder.indexOf(filePath);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
  }

  /**
   * Clears all cached data and resets statistics.
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Gets cache performance statistics.
   *
   * @returns Cache statistics including hit rate
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚙️ tsconfig.json Path Alias Resolution
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parsed tsconfig.json path configuration.
 * @internal
 */
interface TsConfigPaths {
  /** Base URL for non-relative module names */
  baseUrl: string;
  /** Path mappings from compilerOptions.paths */
  paths: Record<string, string[]>;
}

/**
 * Parses tsconfig.json to extract path mapping configuration.
 *
 * @param tsConfigPath - Absolute path to tsconfig.json
 * @returns Parsed path configuration, or null if parsing fails
 * @internal
 */
function parseTsConfig(tsConfigPath: string): TsConfigPaths | null {
  try {
    if (!fs.existsSync(tsConfigPath)) {
      return null;
    }
    const content = fs.readFileSync(tsConfigPath, 'utf-8');
    const config = JSON.parse(content);
    const compilerOptions = config.compilerOptions || {};

    return {
      baseUrl: compilerOptions.baseUrl || '.',
      paths: compilerOptions.paths || {},
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 Import Resolution Engine Implementation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Implementation of the ImportResolver interface.
 *
 * Provides comprehensive import resolution for TypeScript projects including:
 * - Relative import resolution with extension probing
 * - tsconfig.json path alias resolution
 * - Re-export chain following
 * - Circular reference detection
 * - LRU caching for performance
 *
 * @example
 * ```typescript
 * const resolver = new ImportResolverImpl({
 *   tsConfigPath: './tsconfig.json',
 *   maxReexportDepth: 15,
 *   maxCacheSize: 1000,
 * });
 *
 * // Resolve an import
 * const result = resolver.resolve('./types', '/project/src/index.ts');
 * if (result) {
 *   console.log(`Resolved to: ${result.filePath}`);
 * }
 *
 * // Get all exported types
 * const types = resolver.getExportedTypes('/project/src/types/index.ts');
 * for (const [name, type] of types) {
 *   console.log(`Export: ${name} (${type.kind})`);
 * }
 * ```
 */
export class ImportResolverImpl implements ImportResolver {
  private config: Required<Omit<ImportResolverConfig, 'tsConfigPath' | 'pathMappings' | 'baseDir'>> &
    Pick<ImportResolverConfig, 'tsConfigPath' | 'pathMappings' | 'baseDir'>;
  private cache: FileCache;
  private project: Project;
  private tsConfigPaths: TsConfigPaths | null = null;
  private tsConfigDir: string = '';

  /**
   * Creates a new ImportResolverImpl instance.
   *
   * @param config - Configuration options for the resolver
   *
   * @example
   * ```typescript
   * const resolver = new ImportResolverImpl({
   *   tsConfigPath: './tsconfig.json',
   *   maxCacheSize: 1000,
   * });
   * ```
   */
  constructor(config: ImportResolverConfig = {}) {
    this.config = {
      maxReexportDepth: config.maxReexportDepth ?? 10,
      maxCacheSize: config.maxCacheSize ?? 500,
      includeNodeModules: config.includeNodeModules ?? false,
      tsConfigPath: config.tsConfigPath,
      pathMappings: config.pathMappings,
      baseDir: config.baseDir,
    };
    this.cache = new FileCache(this.config.maxCacheSize);

    // Initialize ts-morph project
    this.project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        strict: true,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
      },
    });

    // Parse tsconfig if provided
    if (this.config.tsConfigPath) {
      this.tsConfigPaths = parseTsConfig(this.config.tsConfigPath);
      this.tsConfigDir = path.dirname(this.config.tsConfigPath);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resolves an import specifier from a source file.
   *
   * Handles relative imports, path aliases, and baseUrl resolution.
   * Returns null for node_modules imports unless `includeNodeModules` is true.
   *
   * @param importPath - The import specifier (e.g., './types', '@/utils')
   * @param fromFile - Absolute path to the file containing the import
   * @returns Resolved import info, or null if unresolvable
   */
  resolve(importPath: string, fromFile: string): ResolvedImport | null {
    // Validate fromFile exists
    if (!fs.existsSync(fromFile)) {
      return null;
    }

    // Skip node_modules imports
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      // Check if it's a path alias
      const aliasResolved = this.resolvePathAlias(importPath, fromFile);
      if (aliasResolved) {
        return this.createResolvedImport(aliasResolved, importPath);
      }

      // Check baseUrl resolution
      const baseUrlResolved = this.resolveFromBaseUrl(importPath, fromFile);
      if (baseUrlResolved) {
        return this.createResolvedImport(baseUrlResolved, importPath);
      }

      // Skip HTTP/URL imports
      if (importPath.startsWith('http://') || importPath.startsWith('https://')) {
        return null;
      }

      // Skip node_modules (third-party packages)
      return null;
    }

    // Resolve relative import
    const resolvedPath = this.resolveRelativeImport(importPath, fromFile);
    if (!resolvedPath) {
      return null;
    }

    return this.createResolvedImport(resolvedPath, importPath);
  }

  /**
   * Gets all exported types from a file.
   *
   * Collects direct exports (interfaces, type aliases, enums) and follows
   * re-export chains to gather all publicly available types.
   *
   * @param filePath - Absolute path to the file
   * @returns Map of export name to NormalizedType
   */
  getExportedTypes(filePath: string): Map<string, NormalizedType> {
    const result = new Map<string, NormalizedType>();

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return result;
    }

    const sourceFile = this.getOrParseFile(filePath);
    if (!sourceFile) {
      return result;
    }

    // Collect direct exports
    this.collectDirectExports(sourceFile, result);

    // Collect re-exports
    this.collectReExports(sourceFile, result, new Set([filePath]), 0);

    return result;
  }

  /**
   * Resolves a type reference following imports and re-exports.
   *
   * Starting from a source file, traces the import chain to find where
   * a type is actually defined, handling re-exports and aliases.
   *
   * @param typeName - Name of the type to resolve
   * @param fromFile - Absolute path to the file using the type
   * @returns Resolved type reference, or null if not found
   */
  resolveTypeRef(typeName: string, fromFile: string): ResolvedTypeRef | null {
    // Check if file exists
    if (!fs.existsSync(fromFile)) {
      return null;
    }

    const sourceFile = this.getOrParseFile(fromFile);
    if (!sourceFile) {
      return null;
    }

    // Track visited files for circular detection
    const visited = new Set<string>();
    const reexportChain: string[] = [];

    return this.resolveTypeRefInternal(
      typeName,
      sourceFile,
      visited,
      reexportChain,
      0
    );
  }

  /**
   * Gets the import graph for a file.
   *
   * Builds a tree structure showing all import dependencies, useful for
   * visualization and dependency analysis.
   *
   * @param filePath - Absolute path to the root file
   * @param depth - How deep to traverse (default: 1)
   * @returns Import graph node with children
   */
  getImportGraph(filePath: string, depth: number = 1): ImportGraphNode {
    // Force backslash normalization on input
    let normalizedFilePath = filePath;
    if (process.platform === 'win32' || isWindowsPath(filePath)) {
      normalizedFilePath = filePath.replace(/\//g, '\\');
    }
    const sourceFile = this.getOrParseFile(normalizedFilePath);

    if (!sourceFile) {
      return {
        filePath: normalizedFilePath,
        imports: [],
        exports: [],
      };
    }

    return this.buildImportGraph(sourceFile, depth, new Set());
  }

  /**
   * Clears all cached data.
   *
   * Use after making changes to source files to ensure fresh parsing.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Gets cache performance statistics.
   *
   * @returns Current cache statistics
   */
  getCacheStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * Warms the cache by pre-loading files matching patterns.
   *
   * @param patterns - Glob patterns for files to pre-load
   */
  async warmCache(patterns: string[]): Promise<void> {
    // For each pattern, add files to the project
    for (const pattern of patterns) {
      this.project.addSourceFilesAtPaths(pattern);
    }

    // Parse and cache each file
    for (const sourceFile of this.project.getSourceFiles()) {
      const filePath = normalizePath(sourceFile.getFilePath());
      try {
        const stats = fs.statSync(filePath);
        this.cache.set(filePath, {
          sourceFile,
          mtime: stats.mtimeMs,
          cachedAt: Date.now(),
        });
      } catch {
        // Ignore files that can't be accessed
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Import Resolution Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resolves a relative import path (./foo or ../bar).
   *
   * @param importPath - The relative import specifier
   * @param fromFile - Absolute path to the file containing the import
   * @returns Resolved absolute path, or null if not found
   * @internal
   */
  private resolveRelativeImport(importPath: string, fromFile: string): string | null {
    // Helper to force Windows path separators
    const forceBackslash = (p: string): string => {
      if (process.platform === 'win32' || isWindowsPath(p)) {
        return p.split('/').join('\\');
      }
      return p;
    };

    // Normalize fromFile first (might have forward slashes from ts-morph)
    const normalizedFromFile = forceBackslash(fromFile);
    const fromDir = forceBackslash(path.dirname(normalizedFromFile));
    // Normalize importPath too - convert forward slashes to backslashes on Windows
    const normalizedImportPath = forceBackslash(importPath);
    const targetBase = forceBackslash(path.resolve(fromDir, normalizedImportPath));

    // Probe extensions in order
    const extensions = ['.ts', '.tsx'];

    // First check if the target already has an extension
    if (fs.existsSync(targetBase) && fs.statSync(targetBase).isFile()) {
      return forceBackslash(targetBase);
    }

    // Probe extensions
    for (const ext of extensions) {
      const candidate = forceBackslash(targetBase + ext);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return forceBackslash(candidate);
      }
    }

    // Check if it's a directory with index file
    if (fs.existsSync(targetBase) && fs.statSync(targetBase).isDirectory()) {
      for (const indexName of ['index.ts', 'index.tsx']) {
        // Build index path with backslash on Windows
        const indexPath = targetBase + '\\' + indexName;
        if (fs.existsSync(indexPath)) {
          return indexPath;
        }
        // Try forward slash too (for cross-platform compatibility)
        const indexPathFwd = targetBase + '/' + indexName;
        if (fs.existsSync(indexPathFwd)) {
          return forceBackslash(indexPathFwd);
        }
      }
    }

    // Also check for index files when the target doesn't exist as a directory
    for (const indexName of ['index.ts', 'index.tsx']) {
      // Build index path with backslash on Windows
      const indexPath = targetBase + '\\' + indexName;
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
      // Try forward slash too (for cross-platform compatibility)
      const indexPathFwd = targetBase + '/' + indexName;
      if (fs.existsSync(indexPathFwd)) {
        return forceBackslash(indexPathFwd);
      }
    }

    return null;
  }

  /**
   * Resolves a path alias from tsconfig.json paths configuration.
   *
   * @param importPath - The import specifier (e.g., '@/utils', 'models')
   * @param fromFile - Absolute path to the file containing the import
   * @returns Resolved absolute path, or null if not a matching alias
   * @internal
   */
  private resolvePathAlias(importPath: string, fromFile: string): string | null {
    if (!this.tsConfigPaths) {
      return null;
    }

    const { paths } = this.tsConfigPaths;

    for (const [pattern, targets] of Object.entries(paths)) {
      // Handle exact match (e.g., "models" -> ["aliased/models"])
      if (pattern === importPath) {
        for (const target of targets) {
          const resolvedTarget = path.resolve(this.tsConfigDir, this.tsConfigPaths.baseUrl, target);
          const resolved = this.probeFile(resolvedTarget);
          if (resolved) {
            return resolved;
          }
        }
      }

      // Handle wildcard patterns (e.g., "@/*" -> ["./*"])
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1); // Remove trailing *
        if (importPath.startsWith(prefix)) {
          const suffix = importPath.slice(prefix.length);
          for (const target of targets) {
            const targetBase = target.slice(0, -1); // Remove trailing * from target
            const resolvedTarget = path.resolve(
              this.tsConfigDir,
              this.tsConfigPaths.baseUrl,
              targetBase + suffix
            );
            const resolved = this.probeFile(resolvedTarget);
            if (resolved) {
              return resolved;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Resolves an import using baseUrl from tsconfig.json.
   *
   * @param importPath - The import specifier
   * @param fromFile - Absolute path to the file containing the import
   * @returns Resolved absolute path, or null if not found
   * @internal
   */
  private resolveFromBaseUrl(importPath: string, fromFile: string): string | null {
    if (!this.tsConfigPaths) {
      return null;
    }

    const targetBase = path.resolve(
      this.tsConfigDir,
      this.tsConfigPaths.baseUrl,
      importPath
    );

    return this.probeFile(targetBase);
  }

  /**
   * Probes for a file with various extensions and index files.
   *
   * @param targetBase - Base path to probe
   * @returns Resolved path if found, or null
   * @internal
   */
  private probeFile(targetBase: string): string | null {
    // Check direct file and with extensions
    const extensions = ['', '.ts', '.tsx'];

    for (const ext of extensions) {
      const candidate = normalizePath(targetBase + ext);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }

    // Check for index files in directory
    for (const indexName of ['index.ts', 'index.tsx']) {
      const indexPath = joinPath(targetBase, indexName);
      if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
        return indexPath;
      }
    }

    return null;
  }

  /**
   * Creates a ResolvedImport object from a resolved file path.
   *
   * @param filePath - Resolved absolute file path
   * @param originalSpecifier - Original import specifier
   * @returns ResolvedImport object
   * @internal
   */
  private createResolvedImport(filePath: string, originalSpecifier: string): ResolvedImport {
    // Force normalization - use split/join as ultimate fallback
    let normalizedPath = filePath;
    if (process.platform === 'win32' || isWindowsPath(filePath)) {
      normalizedPath = filePath.split('/').join('\\');
    }
    const sourceFile = this.getOrParseFile(normalizedPath);

    return {
      filePath: normalizedPath,
      exportName: '*', // Will be refined when resolving specific exports
      isDefault: false,
      isNamespace: false,
      isTypeOnly: false,
      sourceFile: sourceFile || undefined,
      originalSpecifier,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // File Parsing and Caching
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Gets or parses a source file, using cache when available.
   *
   * @param filePath - Absolute path to the file
   * @returns Parsed SourceFile, or null if parsing fails
   * @internal
   */
  private getOrParseFile(filePath: string): SourceFile | null {
    // Check cache
    const cached = this.cache.get(filePath);
    if (cached) {
      return cached.sourceFile;
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      // Get mtime for cache invalidation
      const stats = fs.statSync(filePath);
      const mtime = stats.mtimeMs;

      // Try to get from project first
      let sourceFile = this.project.getSourceFile(filePath);
      if (!sourceFile) {
        sourceFile = this.project.addSourceFileAtPath(filePath);
      }

      // Cache the parsed file
      this.cache.set(filePath, {
        sourceFile,
        mtime,
        cachedAt: Date.now(),
      });

      return sourceFile;
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Export Collection
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Collects directly exported types from a source file.
   *
   * @param sourceFile - The source file to analyze
   * @param result - Map to populate with exported types
   * @internal
   */
  private collectDirectExports(sourceFile: SourceFile, result: Map<string, NormalizedType>): void {
    // Get interfaces
    for (const iface of sourceFile.getInterfaces()) {
      if (iface.isExported()) {
        const name = iface.getName();
        const type = this.convertInterfaceToNormalizedType(iface);
        result.set(name, type);
      }
    }

    // Get type aliases
    for (const typeAlias of sourceFile.getTypeAliases()) {
      if (typeAlias.isExported()) {
        const name = typeAlias.getName();
        const type = this.convertTypeAliasToNormalizedType(typeAlias);
        result.set(name, type);
      }
    }

    // Get enums
    for (const enumDecl of sourceFile.getEnums()) {
      if (enumDecl.isExported()) {
        const name = enumDecl.getName();
        result.set(name, { kind: 'ref', name });
      }
    }

    // Check for default export
    const defaultExport = sourceFile.getDefaultExportSymbol();
    if (defaultExport) {
      result.set('default', { kind: 'ref', name: 'default' });
    }
  }

  /**
   * Collects re-exported types from a source file.
   *
   * Follows `export * from '...'` and `export { X } from '...'` declarations.
   *
   * @param sourceFile - The source file to analyze
   * @param result - Map to populate with re-exported types
   * @param visited - Set of visited file paths for cycle detection
   * @param depth - Current recursion depth
   * @internal
   */
  private collectReExports(
    sourceFile: SourceFile,
    result: Map<string, NormalizedType>,
    visited: Set<string>,
    depth: number
  ): void {
    if (depth >= this.config.maxReexportDepth) {
      return;
    }

    const filePath = normalizePath(sourceFile.getFilePath());

    // Find export declarations
    for (const exportDecl of sourceFile.getExportDeclarations()) {
      const moduleSpecifier = exportDecl.getModuleSpecifierValue();
      if (!moduleSpecifier) continue;

      // Resolve the module
      const resolvedPath = this.resolveRelativeImport(moduleSpecifier, filePath) ||
                          this.resolvePathAlias(moduleSpecifier, filePath);
      if (!resolvedPath || visited.has(resolvedPath)) continue;

      visited.add(resolvedPath);
      const targetFile = this.getOrParseFile(resolvedPath);
      if (!targetFile) continue;

      const namedExports = exportDecl.getNamedExports();

      if (namedExports.length === 0) {
        // export * from '...'
        this.collectDirectExports(targetFile, result);
        this.collectReExports(targetFile, result, visited, depth + 1);
      } else {
        // export { X, Y as Z } from '...'
        const targetTypes = new Map<string, NormalizedType>();
        this.collectDirectExports(targetFile, targetTypes);

        for (const namedExport of namedExports) {
          const importName = namedExport.getName();
          const exportName = namedExport.getAliasNode()?.getText() || importName;

          const type = targetTypes.get(importName);
          if (type) {
            result.set(exportName, type);
          }
        }
      }
    }

    // Check for default re-export: export { X as default } from '...'
    for (const exportDecl of sourceFile.getExportDeclarations()) {
      const moduleSpecifier = exportDecl.getModuleSpecifierValue();
      if (!moduleSpecifier) continue;

      for (const namedExport of exportDecl.getNamedExports()) {
        const alias = namedExport.getAliasNode();
        if (alias && alias.getText() === 'default') {
          const resolvedPath = this.resolveRelativeImport(moduleSpecifier, filePath) ||
                              this.resolvePathAlias(moduleSpecifier, filePath);
          if (resolvedPath) {
            result.set('default', { kind: 'ref', name: namedExport.getName() });
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Type Conversion
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Converts a TypeScript interface to NormalizedType format.
   *
   * @param iface - The interface node to convert
   * @returns NormalizedType representation
   * @internal
   */
  private convertInterfaceToNormalizedType(iface: Node): NormalizedType {
    if (!Node.isInterfaceDeclaration(iface)) {
      return { kind: 'unknown' };
    }

    const interfaceName = iface.getName();
    const properties: Record<string, PropertyDef> = {};
    const required: string[] = [];
    const type = iface.getType();

    // Start with the current interface in visitingTypes to prevent infinite recursion
    const visitingTypes = new Set<string>([interfaceName]);

    for (const prop of type.getProperties()) {
      const propName = prop.getName();
      const propType = prop.getValueDeclaration()
        ? prop.getValueDeclarationOrThrow().getType()
        : prop.getDeclaredType();

      const isOptional = prop.isOptional();
      const normalizedType = this.convertTsTypeToNormalized(propType, visitingTypes);

      properties[propName] = {
        type: normalizedType,
        optional: isOptional,
        nullable: false,
        readonly: false,
        deprecated: false,
      };

      if (!isOptional) {
        required.push(propName);
      }
    }

    const schema: NormalizedSchema = {
      name: interfaceName,
      properties,
      required,
      source: { source: 'typescript', id: `interface:${interfaceName}` },
    };

    return { kind: 'object', schema };
  }

  /**
   * Converts a TypeScript type alias to NormalizedType format.
   *
   * @param typeAlias - The type alias node to convert
   * @returns NormalizedType representation
   * @internal
   */
  private convertTypeAliasToNormalizedType(typeAlias: Node): NormalizedType {
    if (!Node.isTypeAliasDeclaration(typeAlias)) {
      return { kind: 'unknown' };
    }

    const aliasType = typeAlias.getType();
    return this.convertTsTypeToNormalized(aliasType, new Set());
  }

  /**
   * Converts a ts-morph Type to NormalizedType format.
   *
   * Handles primitives, literals, arrays, unions, intersections, and objects.
   *
   * @param type - The ts-morph Type to convert
   * @param visitingTypes - Set of type names being visited (for cycle detection)
   * @returns NormalizedType representation
   * @internal
   */
  private convertTsTypeToNormalized(type: Type, visitingTypes: Set<string>): NormalizedType {
    // Check for primitives
    if (type.isString()) {
      return { kind: 'primitive', value: 'string' };
    }
    if (type.isNumber()) {
      return { kind: 'primitive', value: 'number' };
    }
    if (type.isBoolean()) {
      return { kind: 'primitive', value: 'boolean' };
    }
    if (type.isNull()) {
      return { kind: 'primitive', value: 'null' };
    }

    // Check for literal types
    if (type.isStringLiteral()) {
      return { kind: 'literal', value: type.getLiteralValue() as string };
    }
    if (type.isNumberLiteral()) {
      return { kind: 'literal', value: type.getLiteralValue() as number };
    }
    if (type.isBooleanLiteral()) {
      const text = type.getText();
      return { kind: 'literal', value: text === 'true' };
    }

    // Check for array types
    if (type.isArray()) {
      const elementType = type.getArrayElementType();
      if (elementType) {
        return {
          kind: 'array',
          element: this.convertTsTypeToNormalized(elementType, visitingTypes),
        };
      }
      return { kind: 'array', element: { kind: 'unknown' } };
    }

    // Check for union types
    if (type.isUnion()) {
      const variants = type.getUnionTypes()
        .filter(t => !t.isNull() && !t.isUndefined())
        .map(t => this.convertTsTypeToNormalized(t, visitingTypes));

      if (variants.length === 0) {
        return { kind: 'unknown' };
      }
      if (variants.length === 1) {
        return variants[0];
      }
      return { kind: 'union', variants };
    }

    // Check for intersection types
    if (type.isIntersection()) {
      const members = type.getIntersectionTypes()
        .map(t => this.convertTsTypeToNormalized(t, visitingTypes));
      return { kind: 'intersection', members };
    }

    // Check for object types (interfaces, type literals, etc.)
    if (type.isObject()) {
      const symbol = type.getSymbol();
      if (symbol) {
        const name = symbol.getName();

        // Check for circular reference - already visiting this type
        if (name !== '__type' && visitingTypes.has(name)) {
          return { kind: 'ref', name };
        }

        // Skip built-in types
        if (name === 'Date' || name === 'Array' || name === 'Promise') {
          return { kind: 'ref', name };
        }

        // For named interfaces/type aliases, use ref for nested types
        if (name !== '__type') {
          const declarations = symbol.getDeclarations();
          const isNamedType = declarations && declarations.length > 0 &&
            (Node.isInterfaceDeclaration(declarations[0]) || Node.isTypeAliasDeclaration(declarations[0]));

          if (isNamedType) {
            // Only inline at the top level (visitingTypes empty)
            if (visitingTypes.size > 0) {
              return { kind: 'ref', name };
            }
            // At top level, mark as visiting and proceed to inline
            visitingTypes.add(name);
          }
        }
      }

      const properties: Record<string, PropertyDef> = {};
      const required: string[] = [];

      for (const prop of type.getProperties()) {
        const propName = prop.getName();
        const propType = prop.getValueDeclaration()
          ? prop.getValueDeclarationOrThrow().getType()
          : prop.getDeclaredType();

        const isOptional = prop.isOptional();

        // Check for circular reference in property type
        const propSymbol = propType.getSymbol();
        if (propSymbol && visitingTypes.has(propSymbol.getName())) {
          properties[propName] = {
            type: { kind: 'ref', name: propSymbol.getName() },
            optional: isOptional,
            nullable: false,
            readonly: false,
            deprecated: false,
          };
        } else {
          properties[propName] = {
            type: this.convertTsTypeToNormalized(propType, visitingTypes),
            optional: isOptional,
            nullable: false,
            readonly: false,
            deprecated: false,
          };
        }

        if (!isOptional) {
          required.push(propName);
        }
      }

      const schema: NormalizedSchema = {
        properties,
        required,
        source: { source: 'typescript', id: 'inline' },
      };

      return { kind: 'object', schema };
    }

    // Check for any/unknown
    if (type.getText() === 'any') {
      return { kind: 'any' };
    }

    return { kind: 'unknown' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Type Reference Resolution
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Internal type reference resolution with cycle detection.
   *
   * @param typeName - Name of the type to resolve
   * @param sourceFile - Current source file being analyzed
   * @param visited - Set of visited file:type combinations
   * @param reexportChain - Chain of re-export files traversed
   * @param depth - Current recursion depth
   * @returns Resolved type reference, or null if not found
   * @internal
   */
  private resolveTypeRefInternal(
    typeName: string,
    sourceFile: SourceFile,
    visited: Set<string>,
    reexportChain: string[],
    depth: number
  ): ResolvedTypeRef | null {
    const filePath = normalizePath(String(sourceFile.getFilePath()));

    // Check for max depth
    if (depth >= this.config.maxReexportDepth) {
      return {
        type: { kind: 'ref', name: typeName },
        definitionFile: filePath,
        definitionLine: 1,
        reexportChain,
        complete: false,
        incompleteReason: `Maximum re-export depth (${this.config.maxReexportDepth}) exceeded while resolving '${typeName}' in '${filePath}'`,
      };
    }

    // Check for circular reference
    if (visited.has(filePath + ':' + typeName)) {
      return {
        type: { kind: 'ref', name: typeName },
        definitionFile: filePath,
        definitionLine: 1,
        reexportChain,
        complete: false,
        incompleteReason: `Circular reference detected: '${typeName}' in '${filePath}' (chain: ${reexportChain.join(' -> ')})`,
      };
    }
    visited.add(filePath + ':' + typeName);

    // Check for direct definition in this file
    const directDef = this.findDirectDefinition(typeName, sourceFile);
    if (directDef) {
      return {
        type: directDef.type,
        definitionFile: filePath,
        definitionLine: directDef.line,
        reexportChain,
        complete: true,
      };
    }

    // Check imports in this file
    const importResult = this.findInImports(typeName, sourceFile, visited, reexportChain, depth);
    if (importResult) {
      return importResult;
    }

    // Check re-exports
    for (const exportDecl of sourceFile.getExportDeclarations()) {
      const moduleSpecifier = exportDecl.getModuleSpecifierValue();
      if (!moduleSpecifier) continue;

      const namedExports = exportDecl.getNamedExports();

      // Check if this exports the type we're looking for
      let targetTypeName = typeName;
      let found = false;

      if (namedExports.length === 0) {
        // export * from '...' - might include our type
        found = true;
      } else {
        // Check named exports
        for (const namedExport of namedExports) {
          const exportName = namedExport.getAliasNode()?.getText() || namedExport.getName();
          if (exportName === typeName) {
            targetTypeName = namedExport.getName();
            found = true;
            break;
          }
        }
      }

      if (found) {
        const resolvedPath = this.resolveRelativeImport(moduleSpecifier, filePath) ||
                            this.resolvePathAlias(moduleSpecifier, filePath);
        if (resolvedPath) {
          const targetFile = this.getOrParseFile(resolvedPath);
          if (targetFile) {
            reexportChain.push(filePath);
            const result = this.resolveTypeRefInternal(
              targetTypeName,
              targetFile,
              visited,
              reexportChain,
              depth + 1
            );
            if (result) {
              return result;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Finds a direct type definition in a source file.
   *
   * @param typeName - Name of the type to find
   * @param sourceFile - Source file to search
   * @returns Type and line number if found, or null
   * @internal
   */
  private findDirectDefinition(
    typeName: string,
    sourceFile: SourceFile
  ): { type: NormalizedType; line: number } | null {
    // Check interfaces
    for (const iface of sourceFile.getInterfaces()) {
      if (iface.getName() === typeName && iface.isExported()) {
        return {
          type: this.convertInterfaceToNormalizedType(iface),
          line: iface.getStartLineNumber(),
        };
      }
    }

    // Check type aliases
    for (const typeAlias of sourceFile.getTypeAliases()) {
      if (typeAlias.getName() === typeName && typeAlias.isExported()) {
        return {
          type: this.convertTypeAliasToNormalizedType(typeAlias),
          line: typeAlias.getStartLineNumber(),
        };
      }
    }

    // Check enums
    for (const enumDecl of sourceFile.getEnums()) {
      if (enumDecl.getName() === typeName && enumDecl.isExported()) {
        return {
          type: { kind: 'ref', name: typeName },
          line: enumDecl.getStartLineNumber(),
        };
      }
    }

    return null;
  }

  /**
   * Finds a type in the imports of a source file.
   *
   * @param typeName - Name of the type to find
   * @param sourceFile - Source file containing imports
   * @param visited - Set of visited file:type combinations
   * @param reexportChain - Chain of re-export files traversed
   * @param depth - Current recursion depth
   * @returns Resolved type reference, or null if not found in imports
   * @internal
   */
  private findInImports(
    typeName: string,
    sourceFile: SourceFile,
    visited: Set<string>,
    reexportChain: string[],
    depth: number
  ): ResolvedTypeRef | null {
    const filePath = normalizePath(sourceFile.getFilePath());

    for (const importDecl of sourceFile.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      const namedImports = importDecl.getNamedImports();

      for (const namedImport of namedImports) {
        const importName = namedImport.getName();
        const alias = namedImport.getAliasNode()?.getText();
        const usedName = alias || importName;

        if (usedName === typeName) {
          const resolvedPath = this.resolveRelativeImport(moduleSpecifier, filePath) ||
                              this.resolvePathAlias(moduleSpecifier, filePath);
          if (resolvedPath) {
            const targetFile = this.getOrParseFile(normalizePath(resolvedPath));
            if (targetFile) {
              reexportChain.push(filePath);
              return this.resolveTypeRefInternal(
                importName,
                targetFile,
                visited,
                reexportChain,
                depth + 1
              );
            }
          }
        }
      }
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Import Graph Building
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Builds an import graph recursively from a source file.
   *
   * @param sourceFile - Root source file
   * @param depth - Remaining depth to traverse
   * @param visited - Set of visited file paths
   * @returns Import graph node
   * @internal
   */
  private buildImportGraph(
    sourceFile: SourceFile,
    depth: number,
    visited: Set<string>
  ): ImportGraphNode {
    // ts-morph returns paths with forward slashes, convert to backslashes on Windows
    const rawPath = String(sourceFile.getFilePath());
    const filePath = process.platform === 'win32' || isWindowsPath(rawPath)
      ? rawPath.replace(/\//g, '\\')
      : rawPath;
    visited.add(filePath);

    const imports: ImportGraphNode['imports'] = [];
    const exports: string[] = [];

    // Collect imports
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const specifier = importDecl.getModuleSpecifierValue();
      const names = importDecl.getNamedImports().map(n => n.getName());

      const resolvedPath = this.resolveRelativeImport(specifier, filePath) ||
                          this.resolvePathAlias(specifier, filePath);

      imports.push({
        specifier,
        resolved: resolvedPath ? normalizePath(resolvedPath) : null,
        names,
      });
    }

    // Also collect export declarations with module specifiers
    for (const exportDecl of sourceFile.getExportDeclarations()) {
      const moduleSpecifier = exportDecl.getModuleSpecifierValue();
      if (!moduleSpecifier) continue;

      const namedExports = exportDecl.getNamedExports();
      const names = namedExports.length > 0
        ? namedExports.map(n => n.getName())
        : ['*']; // Star export

      const resolvedPath = this.resolveRelativeImport(moduleSpecifier, filePath) ||
                          this.resolvePathAlias(moduleSpecifier, filePath);

      imports.push({
        specifier: moduleSpecifier,
        resolved: resolvedPath ? normalizePath(resolvedPath) : null,
        names,
      });
    }

    // Collect exports
    for (const iface of sourceFile.getInterfaces()) {
      if (iface.isExported()) {
        exports.push(iface.getName());
      }
    }
    for (const typeAlias of sourceFile.getTypeAliases()) {
      if (typeAlias.isExported()) {
        exports.push(typeAlias.getName());
      }
    }
    for (const enumDecl of sourceFile.getEnums()) {
      if (enumDecl.isExported()) {
        exports.push(enumDecl.getName());
      }
    }

    const node: ImportGraphNode = {
      filePath,
      imports,
      exports,
    };

    // Recurse to children if depth > 0
    if (depth > 0) {
      const children: ImportGraphNode[] = [];
      for (const imp of imports) {
        if (imp.resolved && !visited.has(imp.resolved)) {
          const childFile = this.getOrParseFile(imp.resolved);
          if (childFile) {
            children.push(this.buildImportGraph(childFile, depth - 1, visited));
          }
        }
      }
      if (children.length > 0) {
        node.children = children;
      }
    }

    return node;
  }
}
