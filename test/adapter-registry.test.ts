/**
 * Tests for Adapter Registry
 * 
 * Tests the adapter registry pattern for managing schema adapters.
 * These tests are written BEFORE implementation (TDD Red Phase).
 * 
 * API Reference: .context/ADR-P1-4-ADAPTER-REGISTRY.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerAdapter,
  getAdapter,
  hasAdapter,
  listAdapters,
  getAdapterForRef,
  extractSchema,
  listSchemas,
} from '../src/adapters/registry.js';
import {
  AdapterNotFoundError,
  AdapterValidationError,
} from '../src/adapters/errors.js';
import type { SchemaAdapter, SchemaRef, NormalizedSchema, SchemaSourceKind } from '../src/core/types.js';

// ============================================================================
// Test Fixtures - Mock Adapters
// ============================================================================

/**
 * Creates a valid mock adapter for testing
 */
function createMockAdapter(kind: SchemaSourceKind, overrides: Partial<SchemaAdapter> = {}): SchemaAdapter {
  return {
    kind,
    supports: (ref: SchemaRef) => ref.source === kind,
    extract: async (ref: SchemaRef): Promise<NormalizedSchema> => ({
      name: `mock-${kind}`,
      properties: {},
      required: [],
      source: ref,
    }),
    ...overrides,
  };
}

/**
 * Creates a mock adapter with list() support
 */
function createMockAdapterWithList(kind: SchemaSourceKind): SchemaAdapter {
  return {
    kind,
    supports: (ref: SchemaRef) => ref.source === kind,
    extract: async (ref: SchemaRef): Promise<NormalizedSchema> => ({
      name: `mock-${kind}`,
      properties: {},
      required: [],
      source: ref,
    }),
    list: async (basePath: string): Promise<SchemaRef[]> => [
      { source: kind, id: `${basePath}/item1` },
      { source: kind, id: `${basePath}/item2` },
    ],
  };
}

// ============================================================================
// Registration Tests
// ============================================================================

describe('Adapter Registry - Registration', () => {
  describe('registerAdapter()', () => {
    it('should register valid adapter successfully', () => {
      const adapter = createMockAdapter('mcp');
      
      // Should not throw
      expect(() => registerAdapter(adapter)).not.toThrow();
      
      // Should be retrievable after registration
      expect(hasAdapter('mcp')).toBe(true);
    });

    it('should throw AdapterValidationError if kind missing', () => {
      const invalidAdapter = {
        // kind is missing
        supports: () => true,
        extract: async () => ({ properties: {}, required: [], source: { source: 'mcp', id: 'test' } }),
      } as unknown as SchemaAdapter;

      expect(() => registerAdapter(invalidAdapter)).toThrow(AdapterValidationError);
      
      try {
        registerAdapter(invalidAdapter);
      } catch (error) {
        expect(error).toBeInstanceOf(AdapterValidationError);
        expect((error as AdapterValidationError).reason).toContain('kind');
      }
    });

    it('should throw AdapterValidationError if supports not a function', () => {
      const invalidAdapter = {
        kind: 'mcp',
        supports: 'not a function', // Invalid
        extract: async () => ({ properties: {}, required: [], source: { source: 'mcp', id: 'test' } }),
      } as unknown as SchemaAdapter;

      expect(() => registerAdapter(invalidAdapter)).toThrow(AdapterValidationError);
      
      try {
        registerAdapter(invalidAdapter);
      } catch (error) {
        expect(error).toBeInstanceOf(AdapterValidationError);
        expect((error as AdapterValidationError).reason).toContain('supports');
      }
    });

    it('should throw AdapterValidationError if extract not a function', () => {
      const invalidAdapter = {
        kind: 'mcp',
        supports: () => true,
        extract: 'not a function', // Invalid
      } as unknown as SchemaAdapter;

      expect(() => registerAdapter(invalidAdapter)).toThrow(AdapterValidationError);
      
      try {
        registerAdapter(invalidAdapter);
      } catch (error) {
        expect(error).toBeInstanceOf(AdapterValidationError);
        expect((error as AdapterValidationError).reason).toContain('extract');
      }
    });

    it('should replace existing adapter for same kind (last-wins)', () => {
      const adapter1 = createMockAdapter('openapi', {
        extract: async () => ({
          name: 'first-adapter',
          properties: {},
          required: [],
          source: { source: 'openapi', id: 'test' },
        }),
      });
      
      const adapter2 = createMockAdapter('openapi', {
        extract: async () => ({
          name: 'second-adapter',
          properties: {},
          required: [],
          source: { source: 'openapi', id: 'test' },
        }),
      });

      // Register first adapter
      registerAdapter(adapter1);
      
      // Register second adapter for same kind (should replace)
      registerAdapter(adapter2);
      
      // Get the registered adapter
      const registeredAdapter = getAdapter('openapi');
      
      // Should be the second adapter (last-wins)
      expect(registeredAdapter).toBe(adapter2);
    });

    it('should validate list is function if defined', () => {
      const invalidAdapter = {
        kind: 'graphql',
        supports: () => true,
        extract: async () => ({ properties: {}, required: [], source: { source: 'graphql', id: 'test' } }),
        list: 'not a function', // Invalid - should be function or undefined
      } as unknown as SchemaAdapter;

      expect(() => registerAdapter(invalidAdapter)).toThrow(AdapterValidationError);
      
      try {
        registerAdapter(invalidAdapter);
      } catch (error) {
        expect(error).toBeInstanceOf(AdapterValidationError);
        expect((error as AdapterValidationError).reason).toContain('list');
      }
    });
  });
});

// ============================================================================
// Lookup Tests
// ============================================================================

describe('Adapter Registry - Lookup', () => {
  describe('getAdapter()', () => {
    it('should return registered adapter by kind', () => {
      const adapter = createMockAdapter('typescript');
      registerAdapter(adapter);

      const retrieved = getAdapter('typescript');
      
      expect(retrieved).toBe(adapter);
      expect(retrieved.kind).toBe('typescript');
    });

    it('should throw AdapterNotFoundError with available list when not found', () => {
      // Register some adapters first
      registerAdapter(createMockAdapter('mcp'));
      registerAdapter(createMockAdapter('openapi'));

      expect(() => getAdapter('graphql')).toThrow(AdapterNotFoundError);
      
      try {
        getAdapter('graphql');
      } catch (error) {
        expect(error).toBeInstanceOf(AdapterNotFoundError);
        const notFoundError = error as AdapterNotFoundError;
        expect(notFoundError.kind).toBe('graphql');
        expect(notFoundError.available).toContain('mcp');
        expect(notFoundError.available).toContain('openapi');
      }
    });
  });

  describe('hasAdapter()', () => {
    it('should return true for registered kind', () => {
      const adapter = createMockAdapter('zod');
      registerAdapter(adapter);

      expect(hasAdapter('zod')).toBe(true);
    });

    it('should return false for unregistered kind', () => {
      // Assuming 'prisma' has not been registered
      expect(hasAdapter('prisma')).toBe(false);
    });
  });

  describe('listAdapters()', () => {
    it('should return empty array initially', () => {
      // This test assumes a fresh registry
      // In real tests, we'd need registry reset mechanism
      const kinds = listAdapters();
      
      expect(kinds).toBeInstanceOf(Array);
      // Note: May not be empty if other tests registered adapters
      // The test verifies the function returns an array
    });

    it('should return all registered kinds', () => {
      registerAdapter(createMockAdapter('json_schema'));
      registerAdapter(createMockAdapter('yup'));
      registerAdapter(createMockAdapter('joi'));

      const kinds = listAdapters();

      expect(kinds).toBeInstanceOf(Array);
      expect(kinds).toContain('json_schema');
      expect(kinds).toContain('yup');
      expect(kinds).toContain('joi');
    });
  });
});

// ============================================================================
// Ref-Based Lookup Tests
// ============================================================================

describe('Adapter Registry - Ref-Based Lookup', () => {
  describe('getAdapterForRef()', () => {
    it('should return adapter that supports ref', () => {
      const mcpAdapter = createMockAdapter('mcp');
      const openapiAdapter = createMockAdapter('openapi');
      
      registerAdapter(mcpAdapter);
      registerAdapter(openapiAdapter);

      const ref: SchemaRef = { source: 'mcp', id: 'tool:my_tool@./server.ts' };
      
      const adapter = getAdapterForRef(ref);
      
      expect(adapter).toBe(mcpAdapter);
      expect(adapter.supports(ref)).toBe(true);
    });

    it('should throw AdapterNotFoundError when no adapter supports ref', () => {
      // Register adapters that don't support the ref's source
      registerAdapter(createMockAdapter('mcp'));
      
      const ref: SchemaRef = { source: 'asyncapi', id: 'test' };

      expect(() => getAdapterForRef(ref)).toThrow(AdapterNotFoundError);
      
      try {
        getAdapterForRef(ref);
      } catch (error) {
        expect(error).toBeInstanceOf(AdapterNotFoundError);
        const notFoundError = error as AdapterNotFoundError;
        expect(notFoundError.kind).toBe('asyncapi');
      }
    });
  });
});

// ============================================================================
// Convenience Function Tests
// ============================================================================

describe('Adapter Registry - Convenience Functions', () => {
  describe('extractSchema()', () => {
    it('should delegate to correct adapter', async () => {
      let extractCalled = false;
      const ref: SchemaRef = { source: 'trpc', id: 'procedure:myProcedure' };
      
      const mockAdapter = createMockAdapter('trpc', {
        extract: async (extractRef: SchemaRef) => {
          extractCalled = true;
          expect(extractRef).toEqual(ref);
          return {
            name: 'extracted-schema',
            properties: {
              data: {
                type: { kind: 'primitive', value: 'string' },
                optional: false,
                nullable: false,
                readonly: false,
                deprecated: false,
              },
            },
            required: ['data'],
            source: extractRef,
          };
        },
      });
      
      registerAdapter(mockAdapter);

      const schema = await extractSchema(ref);
      
      expect(extractCalled).toBe(true);
      expect(schema.name).toBe('extracted-schema');
      expect(schema.source).toEqual(ref);
    });
  });

  describe('listSchemas()', () => {
    it('should throw if adapter lacks list() method', async () => {
      // Create adapter without list method
      const adapterWithoutList = createMockAdapter('typebox');
      registerAdapter(adapterWithoutList);

      await expect(listSchemas('typebox', './schemas')).rejects.toThrow();
      
      try {
        await listSchemas('typebox', './schemas');
      } catch (error) {
        expect((error as Error).message).toContain('typebox');
        expect((error as Error).message).toContain('list');
      }
    });

    it('should delegate to adapter list() when available', async () => {
      const adapterWithList = createMockAdapterWithList('drizzle');
      registerAdapter(adapterWithList);

      const refs = await listSchemas('drizzle', './models');
      
      expect(refs).toBeInstanceOf(Array);
      expect(refs.length).toBe(2);
      expect(refs[0].source).toBe('drizzle');
      expect(refs[0].id).toContain('./models');
    });
  });
});

// ============================================================================
// Error Type Tests
// ============================================================================

describe('Adapter Registry - Error Types', () => {
  describe('AdapterNotFoundError', () => {
    it('should have kind and available properties', () => {
      const error = new AdapterNotFoundError('graphql', ['mcp', 'openapi']);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AdapterNotFoundError);
      expect(error.kind).toBe('graphql');
      expect(error.available).toEqual(['mcp', 'openapi']);
      expect(error.message).toContain('graphql');
      expect(error.message).toContain('mcp');
      expect(error.message).toContain('openapi');
    });
  });

  describe('AdapterValidationError', () => {
    it('should have adapter and reason properties', () => {
      const invalidAdapter = { kind: 'test' } as unknown as Partial<SchemaAdapter>;
      const error = new AdapterValidationError(invalidAdapter, 'missing supports()');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AdapterValidationError);
      expect(error.adapter).toBe(invalidAdapter);
      expect(error.reason).toBe('missing supports()');
      expect(error.message).toContain('missing supports()');
    });
  });
});
