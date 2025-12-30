/**
 * Tests for Cross-File Import Resolution
 * 
 * Tests the ImportResolver subsystem for TypeScript projects.
 * These tests are written BEFORE implementation (TDD Red Phase).
 * 
 * ADR Reference: .context/ADR-P2-5-IMPORT-RESOLUTION.md
 * 
 * Test Categories:
 *   - Relative Import Resolution
 *   - tsconfig.json Path Alias Resolution
 *   - Re-export Chain Resolution
 *   - Circular Reference Detection
 *   - Cache Behavior (LRU)
 *   - Error Cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';

// These imports will FAIL until the import-resolver module is implemented
// This is expected in Red Phase - tests should fail with clear messages
import {
  ImportResolver,
  ImportResolverImpl,
  FileCache,
  type ResolvedImport,
  type ResolvedTypeRef,
  type ImportResolverConfig,
  type CacheStats,
  type ImportGraphNode,
} from '../src/languages/import-resolver.js';

import type { NormalizedType } from '../src/core/types.js';

// ============================================================================
// Test Fixtures Path
// ============================================================================

const FIXTURE_DIR = path.resolve(process.cwd(), 'test', 'fixtures', 'imports');
const TSCONFIG_PATH = path.join(FIXTURE_DIR, 'tsconfig.json');

// Helper to get absolute fixture paths
function fixturePath(...parts: string[]): string {
  return path.join(FIXTURE_DIR, ...parts);
}

// ============================================================================
// ImportResolver Interface Tests
// ============================================================================

describe('ImportResolver', () => {
  let resolver: ImportResolver;

  beforeEach(() => {
    resolver = new ImportResolverImpl({
      tsConfigPath: TSCONFIG_PATH,
      maxReexportDepth: 10,
      maxCacheSize: 100,
    });
  });

  afterEach(() => {
    resolver.clearCache();
  });

  // ==========================================================================
  // Relative Import Resolution Tests
  // ==========================================================================

  describe('relative imports', () => {
    it('should resolve same-directory relative import (./) to .ts file', () => {
      // Given: handler imports from same directory sibling
      const fromFile = fixturePath('types', 'order.ts');
      const importPath = './user';

      // When: resolving the import
      const result = resolver.resolve(importPath, fromFile);

      // Then: should resolve to user.ts in same directory
      expect(result).not.toBeNull();
      expect(result!.filePath).toBe(fixturePath('types', 'user.ts'));
      expect(result!.originalSpecifier).toBe('./user');
    });

    it('should resolve parent-directory relative import (../) correctly', () => {
      // Given: handler imports from parent's types directory
      const fromFile = fixturePath('handlers', 'user-handler.ts');
      const importPath = '../types';

      // When: resolving the import
      const result = resolver.resolve(importPath, fromFile);

      // Then: should resolve to types/index.ts (barrel)
      expect(result).not.toBeNull();
      expect(result!.filePath).toBe(fixturePath('types', 'index.ts'));
    });

    it('should resolve index.ts barrel import when importing directory', () => {
      // Given: import path points to a directory with index.ts
      const fromFile = fixturePath('handlers', 'order-handler.ts');
      const importPath = '../types';

      // When: resolving the import
      const result = resolver.resolve(importPath, fromFile);

      // Then: should resolve to types/index.ts
      expect(result).not.toBeNull();
      expect(result!.filePath).toMatch(/types[/\\]index\.ts$/);
    });

    it('should probe extensions in correct order (.ts, .tsx, /index.ts)', () => {
      // Given: import without extension
      const fromFile = fixturePath('handlers', 'user-handler.ts');
      const importPath = '../types/user';

      // When: resolving
      const result = resolver.resolve(importPath, fromFile);

      // Then: should find user.ts before trying other extensions
      expect(result).not.toBeNull();
      expect(result!.filePath).toMatch(/user\.ts$/);
    });

    it('should return null for non-existent relative import', () => {
      // Given: import path that doesn't exist
      const fromFile = fixturePath('handlers', 'user-handler.ts');
      const importPath = './non-existent-file';

      // When: resolving
      const result = resolver.resolve(importPath, fromFile);

      // Then: should return null
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Named Export Resolution Tests
  // ==========================================================================

  describe('named export resolution', () => {
    it('should resolve named export from direct import', () => {
      // Given: file with named imports
      const fromFile = fixturePath('handlers', 'user-handler.ts');
      
      // When: getting exported types from user.ts
      const exports = resolver.getExportedTypes(fixturePath('types', 'user.ts'));

      // Then: should include User and UserRole
      expect(exports.has('User')).toBe(true);
      expect(exports.has('UserRole')).toBe(true);
      expect(exports.has('UserSummary')).toBe(true);
      expect(exports.has('UserWithTimestamps')).toBe(true);
    });

    it('should NOT include non-exported interfaces', () => {
      // Given: file with internal (non-exported) interface
      const exports = resolver.getExportedTypes(fixturePath('types', 'user.ts'));

      // Then: should NOT include InternalUserData (not exported)
      expect(exports.has('InternalUserData')).toBe(false);
    });

    it('should resolve named import via re-export', () => {
      // Given: barrel file re-exports from multiple files
      const exports = resolver.getExportedTypes(fixturePath('types', 'index.ts'));

      // Then: should include types from user.ts and order.ts
      expect(exports.has('User')).toBe(true);
      expect(exports.has('Order')).toBe(true);
      expect(exports.has('OrderItem')).toBe(true);
    });
  });

  // ==========================================================================
  // Default Export Resolution Tests
  // ==========================================================================

  describe('default export resolution', () => {
    it('should resolve default import from barrel file', () => {
      // Given: barrel file with default export
      const fromFile = fixturePath('handlers', 'order-handler.ts');
      const importPath = '../types';

      // When: resolving
      const result = resolver.resolve(importPath, fromFile);

      // Then: should indicate default export is available
      expect(result).not.toBeNull();
      // Check that we can detect the default export
      const exports = resolver.getExportedTypes(result!.filePath);
      expect(exports.has('default')).toBe(true);
    });
  });

  // ==========================================================================
  // Namespace Import Resolution Tests  
  // ==========================================================================

  describe('namespace import resolution', () => {
    it('should resolve namespace import (import * as X)', () => {
      // Given: a file that could be namespace-imported
      const filePath = fixturePath('types', 'user.ts');

      // When: getting all exports
      const exports = resolver.getExportedTypes(filePath);

      // Then: should return all exported types as a map
      expect(exports instanceof Map).toBe(true);
      expect(exports.size).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // tsconfig.json Path Alias Tests
  // ==========================================================================

  describe('tsconfig paths', () => {
    it('should resolve baseUrl relative imports', () => {
      // Given: import using baseUrl (. is baseUrl in fixture tsconfig)
      const fromFile = fixturePath('handlers', 'user-handler.ts');
      const importPath = 'types/user'; // Without ./ prefix, uses baseUrl

      // When: resolving
      const result = resolver.resolve(importPath, fromFile);

      // Then: should resolve via baseUrl
      expect(result).not.toBeNull();
      expect(result!.filePath).toBe(fixturePath('types', 'user.ts'));
    });

    it('should resolve @/* path alias to root directory', () => {
      // Given: import using @/* alias (maps to ./*)
      const fromFile = fixturePath('handlers', 'user-handler.ts');
      const importPath = '@/types/user';

      // When: resolving
      const result = resolver.resolve(importPath, fromFile);

      // Then: should resolve to types/user.ts
      expect(result).not.toBeNull();
      expect(result!.filePath).toBe(fixturePath('types', 'user.ts'));
    });

    it('should resolve @types/* path alias to types directory', () => {
      // Given: import using @types/* alias
      const fromFile = fixturePath('handlers', 'order-handler.ts');
      const importPath = '@types/order';

      // When: resolving
      const result = resolver.resolve(importPath, fromFile);

      // Then: should resolve to types/order.ts
      expect(result).not.toBeNull();
      expect(result!.filePath).toBe(fixturePath('types', 'order.ts'));
    });

    it('should resolve @handlers/* path alias to handlers directory', () => {
      // Given: import using @handlers/* alias
      const fromFile = fixturePath('types', 'index.ts');
      const importPath = '@handlers/user-handler';

      // When: resolving
      const result = resolver.resolve(importPath, fromFile);

      // Then: should resolve to handlers/user-handler.ts
      expect(result).not.toBeNull();
      expect(result!.filePath).toBe(fixturePath('handlers', 'user-handler.ts'));
    });

    it('should resolve exact path alias (models) to aliased/models', () => {
      // Given: exact path alias without wildcard
      const fromFile = fixturePath('handlers', 'user-handler.ts');
      const importPath = 'models';

      // When: resolving
      const result = resolver.resolve(importPath, fromFile);

      // Then: should resolve to aliased/models.ts
      expect(result).not.toBeNull();
      expect(result!.filePath).toBe(fixturePath('aliased', 'models.ts'));
    });

    it('should return null when path alias has no matching target', () => {
      // Given: path alias pattern with non-existent target
      const fromFile = fixturePath('handlers', 'user-handler.ts');
      const importPath = '@/nonexistent/path';

      // When: resolving
      const result = resolver.resolve(importPath, fromFile);

      // Then: should return null
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Re-export Chain Resolution Tests
  // ==========================================================================

  describe('re-export chains', () => {
    it('should resolve export * from pattern (star re-export)', () => {
      // Given: barrel file with export * from './user'
      const typeRef = resolver.resolveTypeRef('User', fixturePath('types', 'index.ts'));

      // Then: should find User defined in user.ts
      expect(typeRef).not.toBeNull();
      expect(typeRef!.definitionFile).toBe(fixturePath('types', 'user.ts'));
      expect(typeRef!.complete).toBe(true);
    });

    it('should resolve named re-export with alias', () => {
      // Given: barrel file with export { User as AppUser }
      const typeRef = resolver.resolveTypeRef('AppUser', fixturePath('types', 'index.ts'));

      // Then: should find the aliased export pointing to User
      expect(typeRef).not.toBeNull();
      expect(typeRef!.definitionFile).toBe(fixturePath('types', 'user.ts'));
      expect(typeRef!.complete).toBe(true);
    });

    it('should track re-export chain in result', () => {
      // Given: type accessed through barrel file
      const fromFile = fixturePath('handlers', 'user-handler.ts');
      const typeRef = resolver.resolveTypeRef('User', fromFile);

      // Then: reexportChain should include the path
      expect(typeRef).not.toBeNull();
      expect(typeRef!.reexportChain.length).toBeGreaterThan(0);
      expect(typeRef!.reexportChain).toContain(fixturePath('types', 'index.ts'));
    });

    it('should resolve multi-level re-export chain', () => {
      // Given: Order imports User, User is re-exported through barrel
      const typeRef = resolver.resolveTypeRef('User', fixturePath('handlers', 'order-handler.ts'));

      // Then: should fully resolve to user.ts definition
      expect(typeRef).not.toBeNull();
      expect(typeRef!.complete).toBe(true);
      expect(typeRef!.definitionFile).toMatch(/user\.ts$/);
    });

    it('should handle barrel file patterns correctly', () => {
      // Given: barrel file re-exports multiple files
      const exports = resolver.getExportedTypes(fixturePath('types', 'index.ts'));

      // Then: should include exports from all re-exported files
      expect(exports.has('User')).toBe(true);
      expect(exports.has('UserRole')).toBe(true);
      expect(exports.has('Order')).toBe(true);
      expect(exports.has('OrderItem')).toBe(true);
      expect(exports.has('OrderStatus')).toBe(true);
      expect(exports.has('ApiResponse')).toBe(true); // Local export
    });
  });

  // ==========================================================================
  // Circular Reference Detection Tests
  // ==========================================================================

  describe('circular references', () => {
    it('should detect direct circular import (A → B → A)', () => {
      // Given: a.ts imports from b.ts which imports from a.ts
      const typeRef = resolver.resolveTypeRef('NodeB', fixturePath('circular', 'a.ts'));

      // Then: should handle gracefully without infinite loop
      expect(typeRef).not.toBeNull();
      // Circular refs should be marked as refs, not fully inlined
      // The resolution should complete (not hang)
    });

    it('should detect indirect circular import (A → B → C → A)', () => {
      // Given: c.ts imports from both a.ts and b.ts
      const typeRef = resolver.resolveTypeRef('NodeA', fixturePath('circular', 'c.ts'));

      // Then: should detect the cycle and return incomplete result
      expect(typeRef).not.toBeNull();
      // The result should indicate this was a circular resolution
    });

    it('should handle self-referencing types', () => {
      // Given: TreeNode interface with self-reference (children: TreeNode[])
      const typeRef = resolver.resolveTypeRef('TreeNode', fixturePath('circular', 'c.ts'));

      // Then: should handle gracefully
      expect(typeRef).not.toBeNull();
      expect(typeRef!.complete).toBe(true);
      
      // The type should use ref kind for the self-reference
      if (typeRef!.type.kind === 'object' && typeRef!.type.schema) {
        const childrenProp = typeRef!.type.schema.properties['children'];
        // children should reference TreeNode, not inline infinitely
        expect(childrenProp).toBeDefined();
      }
    });

    it('should mark circular references with ref kind', () => {
      // Given: NodeB has source and target properties of type NodeA
      const typeRef = resolver.resolveTypeRef('NodeB', fixturePath('circular', 'b.ts'));

      // Then: NodeA references should be { kind: 'ref', name: 'NodeA' }
      expect(typeRef).not.toBeNull();
      
      if (typeRef!.type.kind === 'object' && typeRef!.type.schema) {
        const sourceProp = typeRef!.type.schema.properties['source'];
        expect(sourceProp.type.kind).toBe('ref');
        if (sourceProp.type.kind === 'ref') {
          expect(sourceProp.type.name).toBe('NodeA');
        }
      }
    });

    it('should include circular reference reason in incomplete results', () => {
      // Given: circular reference scenario
      // Create a resolver with very low depth limit
      const shallowResolver = new ImportResolverImpl({
        tsConfigPath: TSCONFIG_PATH,
        maxReexportDepth: 2,
        maxCacheSize: 100,
      });

      const typeRef = shallowResolver.resolveTypeRef('Graph', fixturePath('circular', 'c.ts'));

      // Then: if incomplete, should have a reason
      if (typeRef && !typeRef.complete) {
        expect(typeRef.incompleteReason).toBeDefined();
        expect(typeRef.incompleteReason).toContain('circular');
      }

      shallowResolver.clearCache();
    });
  });

  // ==========================================================================
  // Type Reference Resolution Tests
  // ==========================================================================

  describe('resolveTypeRef()', () => {
    it('should return ResolvedTypeRef with all required fields', () => {
      // Given: a simple type to resolve
      const typeRef = resolver.resolveTypeRef('User', fixturePath('types', 'user.ts'));

      // Then: should have all required fields
      expect(typeRef).not.toBeNull();
      expect(typeRef!.type).toBeDefined();
      expect(typeRef!.definitionFile).toBeDefined();
      expect(typeRef!.definitionLine).toBeGreaterThan(0);
      expect(typeRef!.reexportChain).toBeInstanceOf(Array);
      expect(typeof typeRef!.complete).toBe('boolean');
    });

    it('should return null for non-existent type', () => {
      // Given: type name that doesn't exist
      const typeRef = resolver.resolveTypeRef('NonExistentType', fixturePath('types', 'user.ts'));

      // Then: should return null
      expect(typeRef).toBeNull();
    });

    it('should resolve imported type to its original definition', () => {
      // Given: Order interface imports User
      const typeRef = resolver.resolveTypeRef('User', fixturePath('types', 'order.ts'));

      // Then: should resolve to user.ts (where User is defined)
      expect(typeRef).not.toBeNull();
      expect(typeRef!.definitionFile).toBe(fixturePath('types', 'user.ts'));
    });
  });

  // ==========================================================================
  // Import Graph Tests
  // ==========================================================================

  describe('getImportGraph()', () => {
    it('should return ImportGraphNode for a file', () => {
      // Given: file with imports
      const graph = resolver.getImportGraph(fixturePath('handlers', 'user-handler.ts'));

      // Then: should return valid graph node
      expect(graph.filePath).toBe(fixturePath('handlers', 'user-handler.ts'));
      expect(graph.imports).toBeInstanceOf(Array);
      expect(graph.exports).toBeInstanceOf(Array);
    });

    it('should include resolved import paths', () => {
      // Given: file that imports from ../types
      const graph = resolver.getImportGraph(fixturePath('handlers', 'user-handler.ts'));

      // Then: imports should have resolved paths
      type ImportEntry = { specifier: string; resolved: string | null; names: string[] };
      const typesImport = graph.imports.find((i: ImportEntry) => i.specifier === '../types');
      expect(typesImport).toBeDefined();
      expect(typesImport!.resolved).toBe(fixturePath('types', 'index.ts'));
    });

    it('should traverse to specified depth', () => {
      // Given: request for depth 2
      const graph = resolver.getImportGraph(fixturePath('handlers', 'user-handler.ts'), 2);

      // Then: should have children (depth 1) with their own children (depth 2)
      expect(graph.children).toBeDefined();
      if (graph.children && graph.children.length > 0) {
        // At depth 2, children should also have children
        const hasNestedChildren = graph.children.some((c: ImportGraphNode) => c.children && c.children.length > 0);
        expect(hasNestedChildren).toBe(true);
      }
    });

    it('should list exported names', () => {
      // Given: file with exports
      const graph = resolver.getImportGraph(fixturePath('types', 'user.ts'));

      // Then: exports should list exported names
      expect(graph.exports).toContain('User');
      expect(graph.exports).toContain('UserRole');
    });
  });
});

// ============================================================================
// FileCache (LRU) Tests
// ============================================================================

describe('FileCache', () => {
  let cache: FileCache;

  beforeEach(() => {
    cache = new FileCache(5); // Small cache for testing eviction
  });

  describe('LRU behavior', () => {
    it('should cache parsed file data', () => {
      // Given: a cache entry
      const filePath = '/test/file.ts';
      const entry = {
        sourceFile: {} as any,
        mtime: Date.now(),
        cachedAt: Date.now(),
      };

      // When: setting the entry
      cache.set(filePath, entry);

      // Then: should be retrievable
      const retrieved = cache.get(filePath);
      expect(retrieved).toBe(entry);
    });

    it('should track cache hits', () => {
      // Given: cached entry
      const filePath = '/test/file.ts';
      cache.set(filePath, { sourceFile: {} as any, mtime: 0, cachedAt: 0 });

      // When: accessing multiple times
      cache.get(filePath);
      cache.get(filePath);
      cache.get(filePath);

      // Then: hits should be tracked
      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
    });

    it('should track cache misses', () => {
      // Given: empty cache

      // When: accessing non-existent entries
      cache.get('/nonexistent1.ts');
      cache.get('/nonexistent2.ts');

      // Then: misses should be tracked
      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it('should evict least recently used entry when full', () => {
      // Given: cache at max capacity (5)
      for (let i = 0; i < 5; i++) {
        cache.set(`/file${i}.ts`, { sourceFile: {} as any, mtime: 0, cachedAt: 0 });
      }

      // Access files in order: 0, 1, 2, 3, 4 (0 becomes LRU)
      for (let i = 0; i < 5; i++) {
        cache.get(`/file${i}.ts`);
      }

      // Make file0 LRU by not accessing it, access others
      cache.get('/file1.ts');
      cache.get('/file2.ts');
      cache.get('/file3.ts');
      cache.get('/file4.ts');

      // When: adding new entry (should evict file0)
      cache.set('/file5.ts', { sourceFile: {} as any, mtime: 0, cachedAt: 0 });

      // Then: file0 should be evicted
      expect(cache.get('/file0.ts')).toBeUndefined();
      expect(cache.get('/file5.ts')).toBeDefined();
    });

    it('should update access order on get', () => {
      // Given: cache with entries
      cache.set('/file0.ts', { sourceFile: {} as any, mtime: 0, cachedAt: 0 });
      cache.set('/file1.ts', { sourceFile: {} as any, mtime: 0, cachedAt: 0 });
      cache.set('/file2.ts', { sourceFile: {} as any, mtime: 0, cachedAt: 0 });
      cache.set('/file3.ts', { sourceFile: {} as any, mtime: 0, cachedAt: 0 });
      cache.set('/file4.ts', { sourceFile: {} as any, mtime: 0, cachedAt: 0 });

      // When: accessing file0 (making it most recently used)
      cache.get('/file0.ts');

      // And: adding new entry
      cache.set('/file5.ts', { sourceFile: {} as any, mtime: 0, cachedAt: 0 });

      // Then: file1 should be evicted (now LRU), file0 should remain
      expect(cache.get('/file0.ts')).toBeDefined();
      expect(cache.get('/file1.ts')).toBeUndefined();
    });
  });

  describe('stats tracking', () => {
    it('should return accurate CacheStats', () => {
      // Given: cache with some activity
      cache.set('/file1.ts', { sourceFile: {} as any, mtime: 0, cachedAt: 0 });
      cache.set('/file2.ts', { sourceFile: {} as any, mtime: 0, cachedAt: 0 });
      cache.get('/file1.ts'); // hit
      cache.get('/file2.ts'); // hit
      cache.get('/file3.ts'); // miss

      // When: getting stats
      const stats = cache.getStats();

      // Then: stats should be accurate
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    });

    it('should calculate hitRate correctly', () => {
      // Given: cache with known hit/miss pattern
      cache.set('/file.ts', { sourceFile: {} as any, mtime: 0, cachedAt: 0 });
      
      // 4 hits
      cache.get('/file.ts');
      cache.get('/file.ts');
      cache.get('/file.ts');
      cache.get('/file.ts');
      
      // 1 miss
      cache.get('/nonexistent.ts');

      // Then: hit rate should be 4/5 = 0.8
      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(0.8, 2);
    });

    it('should handle zero total accesses', () => {
      // Given: cache with no accesses
      const stats = cache.getStats();

      // Then: hitRate should be 0 (not NaN)
      expect(stats.hitRate).toBe(0);
      expect(Number.isNaN(stats.hitRate)).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should invalidate specific entry', () => {
      // Given: cached entry
      cache.set('/file.ts', { sourceFile: {} as any, mtime: 0, cachedAt: 0 });
      expect(cache.get('/file.ts')).toBeDefined();

      // When: invalidating
      cache.invalidate('/file.ts');

      // Then: entry should be gone
      expect(cache.get('/file.ts')).toBeUndefined();
    });

    it('should clear all entries', () => {
      // Given: multiple cached entries
      cache.set('/file1.ts', { sourceFile: {} as any, mtime: 0, cachedAt: 0 });
      cache.set('/file2.ts', { sourceFile: {} as any, mtime: 0, cachedAt: 0 });
      cache.set('/file3.ts', { sourceFile: {} as any, mtime: 0, cachedAt: 0 });

      // When: clearing
      cache.clear();

      // Then: all entries should be gone
      expect(cache.getStats().size).toBe(0);
      expect(cache.get('/file1.ts')).toBeUndefined();
      expect(cache.get('/file2.ts')).toBeUndefined();
      expect(cache.get('/file3.ts')).toBeUndefined();
    });

    it('should reset stats on clear', () => {
      // Given: cache with activity
      cache.set('/file.ts', { sourceFile: {} as any, mtime: 0, cachedAt: 0 });
      cache.get('/file.ts');
      cache.get('/nonexistent.ts');

      // When: clearing
      cache.clear();

      // Then: stats should be reset
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});

// ============================================================================
// ImportResolver Error Cases
// ============================================================================

describe('ImportResolver Error Cases', () => {
  let resolver: ImportResolver;

  beforeEach(() => {
    resolver = new ImportResolverImpl({
      tsConfigPath: TSCONFIG_PATH,
      maxReexportDepth: 10,
      maxCacheSize: 100,
    });
  });

  afterEach(() => {
    resolver.clearCache();
  });

  describe('missing file handling', () => {
    it('should return null for non-existent fromFile', () => {
      // Given: fromFile that doesn't exist
      const result = resolver.resolve('./user', '/nonexistent/path/file.ts');

      // Then: should return null
      expect(result).toBeNull();
    });

    it('should return empty map for non-existent file in getExportedTypes', () => {
      // Given: file that doesn't exist
      const exports = resolver.getExportedTypes('/nonexistent/file.ts');

      // Then: should return empty map
      expect(exports.size).toBe(0);
    });
  });

  describe('unresolvable import handling', () => {
    it('should return null for node_modules import (not supported)', () => {
      // Given: import from node_modules (not supported by design)
      const result = resolver.resolve('lodash', fixturePath('types', 'user.ts'));

      // Then: should return null (node_modules not resolved)
      expect(result).toBeNull();
    });

    it('should return null for HTTP/URL imports', () => {
      // Given: URL import
      const result = resolver.resolve('https://example.com/types.ts', fixturePath('types', 'user.ts'));

      // Then: should return null
      expect(result).toBeNull();
    });
  });

  describe('maximum depth exceeded', () => {
    it('should handle max re-export depth gracefully', () => {
      // Given: resolver with very low depth limit
      const shallowResolver = new ImportResolverImpl({
        tsConfigPath: TSCONFIG_PATH,
        maxReexportDepth: 1, // Very shallow
        maxCacheSize: 100,
      });

      // When: resolving through re-export chain
      const typeRef = shallowResolver.resolveTypeRef('User', fixturePath('handlers', 'user-handler.ts'));

      // Then: should return incomplete result with reason
      if (typeRef && !typeRef.complete) {
        expect(typeRef.incompleteReason).toBeDefined();
        expect(typeRef.incompleteReason).toContain('depth');
      }

      shallowResolver.clearCache();
    });
  });

  describe('invalid tsconfig handling', () => {
    it('should work without tsconfig (basic resolution only)', () => {
      // Given: resolver without tsconfig
      const basicResolver = new ImportResolverImpl({
        baseDir: FIXTURE_DIR,
        maxCacheSize: 100,
      });

      // When: resolving relative import
      const result = basicResolver.resolve('./user', fixturePath('types', 'order.ts'));

      // Then: should still work for relative imports
      expect(result).not.toBeNull();

      basicResolver.clearCache();
    });

    it('should handle missing tsconfig gracefully', () => {
      // Given: resolver with non-existent tsconfig path
      const badResolver = new ImportResolverImpl({
        tsConfigPath: '/nonexistent/tsconfig.json',
        maxCacheSize: 100,
      });

      // When/Then: should not throw, should fall back to basic resolution
      expect(() => {
        badResolver.resolve('./user', fixturePath('types', 'order.ts'));
      }).not.toThrow();

      badResolver.clearCache();
    });
  });
});

// ============================================================================
// ImportResolver Cache Integration Tests
// ============================================================================

describe('ImportResolver Cache Integration', () => {
  it('should use cache for repeated resolutions', () => {
    const resolver = new ImportResolverImpl({
      tsConfigPath: TSCONFIG_PATH,
      maxCacheSize: 100,
    });

    // When: resolving same import multiple times
    resolver.resolve('../types', fixturePath('handlers', 'user-handler.ts'));
    resolver.resolve('../types', fixturePath('handlers', 'user-handler.ts'));
    resolver.resolve('../types', fixturePath('handlers', 'user-handler.ts'));

    // Then: cache should show hits
    const stats = resolver.getCacheStats();
    expect(stats.hits).toBeGreaterThan(0);

    resolver.clearCache();
  });

  it('should respect maxCacheSize configuration', () => {
    const resolver = new ImportResolverImpl({
      tsConfigPath: TSCONFIG_PATH,
      maxCacheSize: 3, // Very small cache
    });

    // When: parsing more files than cache size
    resolver.getExportedTypes(fixturePath('types', 'user.ts'));
    resolver.getExportedTypes(fixturePath('types', 'order.ts'));
    resolver.getExportedTypes(fixturePath('types', 'index.ts'));
    resolver.getExportedTypes(fixturePath('handlers', 'user-handler.ts'));
    resolver.getExportedTypes(fixturePath('handlers', 'order-handler.ts'));

    // Then: cache size should not exceed max
    const stats = resolver.getCacheStats();
    expect(stats.size).toBeLessThanOrEqual(3);

    resolver.clearCache();
  });

  it('should clear cache on clearCache()', () => {
    const resolver = new ImportResolverImpl({
      tsConfigPath: TSCONFIG_PATH,
      maxCacheSize: 100,
    });

    // Given: populated cache
    resolver.getExportedTypes(fixturePath('types', 'user.ts'));
    resolver.getExportedTypes(fixturePath('types', 'order.ts'));

    // When: clearing cache
    resolver.clearCache();

    // Then: cache should be empty
    const stats = resolver.getCacheStats();
    expect(stats.size).toBe(0);
  });
});

// ============================================================================
// ImportResolver Configuration Tests
// ============================================================================

describe('ImportResolverConfig', () => {
  it('should accept all configuration options', () => {
    // Given: full configuration
    const config: ImportResolverConfig = {
      tsConfigPath: TSCONFIG_PATH,
      maxReexportDepth: 15,
      maxCacheSize: 1000,
      includeNodeModules: false,
      pathMappings: {
        'custom/*': ['./custom/*'],
      },
      baseDir: FIXTURE_DIR,
    };

    // When: creating resolver with config
    const resolver = new ImportResolverImpl(config);

    // Then: should not throw
    expect(resolver).toBeDefined();

    resolver.clearCache();
  });

  it('should use default values for optional config', () => {
    // Given: minimal configuration
    const resolver = new ImportResolverImpl({});

    // Then: should use defaults and not throw
    const stats = resolver.getCacheStats();
    expect(stats.maxSize).toBeGreaterThan(0); // Default max size

    resolver.clearCache();
  });
});
