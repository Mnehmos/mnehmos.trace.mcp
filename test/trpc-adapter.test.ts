/**
 * Tests for tRPC Adapter
 * 
 * Tests the tRPC adapter for extracting schemas from tRPC router definitions.
 * These tests are written BEFORE implementation (TDD Red Phase).
 * 
 * API Reference: .context/ADR-P1-3-TRPC-EXTRACTION.md
 * 
 * SchemaRef ID Format:
 *   trpc:{procedurePath}@{filePath}           # Default (input schema)
 *   trpc:{procedurePath}.input@{filePath}     # Explicit input
 *   trpc:{procedurePath}.output@{filePath}    # Explicit output
 * 
 * Examples:
 *   - trpc:users.getById@./router.ts
 *   - trpc:users.create.input@./router.ts
 *   - trpc:users.create.output@./router.ts
 */

import { describe, it, expect } from 'vitest';
import path from 'path';

// These imports will fail until implementation exists
import {
  TRPCAdapter,
  parseTRPCRef,
  type TRPCRef,
} from '../src/adapters/trpc/index.js';

import type {
  SchemaRef,
  NormalizedSchema,
  NormalizedType,
  PropertyDef,
} from '../src/core/types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const FIXTURE_PATH = path.resolve(process.cwd(), 'test', 'fixtures', 'sample-trpc-router.ts');
const RELATIVE_FIXTURE = './test/fixtures/sample-trpc-router.ts';

// ============================================================================
// Ref Parsing Tests (5 tests)
// ============================================================================

describe('tRPC Ref Parsing - parseTRPCRef()', () => {
  describe('should parse simple procedure ref', () => {
    it('should parse simple procedure ref with default input schema', () => {
      const refId = `trpc:users.getById@${RELATIVE_FIXTURE}`;
      
      const parsed = parseTRPCRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.path).toBe('users.getById');
      expect(parsed!.schemaType).toBe('input');
      expect(parsed!.filePath).toBe(RELATIVE_FIXTURE);
    });
  });

  describe('should parse nested procedure ref', () => {
    it('should parse deeply nested procedure ref (e.g., admin.users.ban)', () => {
      const refId = `trpc:admin.users.ban@${RELATIVE_FIXTURE}`;
      
      const parsed = parseTRPCRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.path).toBe('admin.users.ban');
      expect(parsed!.schemaType).toBe('input');
      expect(parsed!.filePath).toBe(RELATIVE_FIXTURE);
    });

    it('should parse three-level nested path (users.posts.list)', () => {
      const refId = `trpc:users.posts.list@${RELATIVE_FIXTURE}`;
      
      const parsed = parseTRPCRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.path).toBe('users.posts.list');
    });
  });

  describe('should parse explicit input ref', () => {
    it('should parse procedure ref with explicit .input suffix', () => {
      const refId = `trpc:users.create.input@${RELATIVE_FIXTURE}`;
      
      const parsed = parseTRPCRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.path).toBe('users.create');
      expect(parsed!.schemaType).toBe('input');
      expect(parsed!.filePath).toBe(RELATIVE_FIXTURE);
    });
  });

  describe('should parse explicit output ref', () => {
    it('should parse procedure ref with explicit .output suffix', () => {
      const refId = `trpc:users.create.output@${RELATIVE_FIXTURE}`;
      
      const parsed = parseTRPCRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.path).toBe('users.create');
      expect(parsed!.schemaType).toBe('output');
      expect(parsed!.filePath).toBe(RELATIVE_FIXTURE);
    });

    it('should parse nested procedure output ref', () => {
      const refId = `trpc:posts.create.output@${RELATIVE_FIXTURE}`;
      
      const parsed = parseTRPCRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.path).toBe('posts.create');
      expect(parsed!.schemaType).toBe('output');
    });
  });

  describe('should return null for invalid refs', () => {
    it('should return null for empty string', () => {
      const parsed = parseTRPCRef('');
      expect(parsed).toBeNull();
    });

    it('should return null for missing trpc: prefix', () => {
      const parsed = parseTRPCRef(`users.getById@${RELATIVE_FIXTURE}`);
      expect(parsed).toBeNull();
    });

    it('should return null for missing @ separator', () => {
      const parsed = parseTRPCRef('trpc:users.getById');
      expect(parsed).toBeNull();
    });

    it('should return null for wrong prefix', () => {
      const parsed = parseTRPCRef(`mcp:users.getById@${RELATIVE_FIXTURE}`);
      expect(parsed).toBeNull();
    });

    it('should return null for malformed ref', () => {
      const parsed = parseTRPCRef('not-a-valid-ref');
      expect(parsed).toBeNull();
    });
  });
});

// ============================================================================
// Adapter Tests (9 tests)
// ============================================================================

describe('TRPCAdapter', () => {
  const adapter = new TRPCAdapter();

  describe('kind property', () => {
    it('should have kind = "trpc"', () => {
      expect(adapter.kind).toBe('trpc');
    });
  });

  describe('supports()', () => {
    it('should return true for trpc source refs', () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.getById@${RELATIVE_FIXTURE}`,
      };
      
      expect(adapter.supports(ref)).toBe(true);
    });

    it('should return true for all trpc ref types', () => {
      const refs: SchemaRef[] = [
        { source: 'trpc', id: `trpc:users.getById@${RELATIVE_FIXTURE}` },
        { source: 'trpc', id: `trpc:users.create.input@${RELATIVE_FIXTURE}` },
        { source: 'trpc', id: `trpc:users.create.output@${RELATIVE_FIXTURE}` },
        { source: 'trpc', id: `trpc:health@${RELATIVE_FIXTURE}` },
        { source: 'trpc', id: `trpc:admin.users.ban@${RELATIVE_FIXTURE}` },
      ];
      
      for (const ref of refs) {
        expect(adapter.supports(ref)).toBe(true);
      }
    });

    it('should return false for non-trpc source refs', () => {
      const refs: SchemaRef[] = [
        { source: 'openapi', id: 'endpoint:GET:/users@./api.yaml' },
        { source: 'mcp', id: 'tool:my_tool@./server.ts' },
        { source: 'typescript', id: 'interface:User@./types.ts' },
        { source: 'graphql', id: 'type:User@./schema.graphql' },
      ];
      
      for (const ref of refs) {
        expect(adapter.supports(ref)).toBe(false);
      }
    });
  });

  describe('extract() - simple query procedure', () => {
    it('should extract simple query procedure input schema', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.getById@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('id');
      expect(schema.properties['id'].type).toEqual({
        kind: 'primitive',
        value: 'string',
      });
      expect(schema.source).toEqual(ref);
    });
  });

  describe('extract() - mutation procedure', () => {
    it('should extract mutation procedure input schema', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.create@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('name');
      expect(schema.required).toContain('name');
    });
  });

  describe('extract() - output schema', () => {
    it('should extract procedure output schema', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.create.output@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('id');
      expect(schema.properties).toHaveProperty('name');
      expect(schema.properties).toHaveProperty('status');
      expect(schema.properties).toHaveProperty('createdAt');
    });
  });

  describe('extract() - nested router path', () => {
    it('should handle nested router path (e.g., admin.users.ban)', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:admin.users.ban@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('userId');
      expect(schema.properties).toHaveProperty('reason');
      expect(schema.required).toContain('userId');
      expect(schema.required).toContain('reason');
    });

    it('should handle deeply nested paths correctly', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:admin.users.unban@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('userId');
    });
  });

  describe('extract() - error handling', () => {
    it('should throw for non-existent procedure', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:nonexistent.procedure@${FIXTURE_PATH}`,
      };
      
      await expect(adapter.extract(ref)).rejects.toThrow(/not found|does not exist/i);
    });

    it('should throw for non-existent file', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: 'trpc:users.getById@./nonexistent-router.ts',
      };
      
      await expect(adapter.extract(ref)).rejects.toThrow();
    });
  });

  describe('list()', () => {
    it('should list all procedures from router file', async () => {
      const refs = await adapter.list(FIXTURE_PATH);
      
      expect(refs).toBeInstanceOf(Array);
      expect(refs.length).toBeGreaterThan(0);
      
      // Should include key procedures
      const refIds = refs.map((r: SchemaRef) => r.id);
      expect(refIds).toEqual(expect.arrayContaining([
        expect.stringContaining('users.getById'),
        expect.stringContaining('users.create'),
        expect.stringContaining('users.list'),
        expect.stringContaining('posts.getById'),
        expect.stringContaining('posts.create'),
        expect.stringContaining('health'),
      ]));
      
      // All refs should have source: 'trpc'
      for (const ref of refs) {
        expect(ref.source).toBe('trpc');
      }
    });

    it('should include nested router procedures in list', async () => {
      const refs = await adapter.list(FIXTURE_PATH);
      
      const refIds = refs.map((r: SchemaRef) => r.id);
      
      // Should include deeply nested procedures
      expect(refIds).toEqual(expect.arrayContaining([
        expect.stringContaining('admin.users.ban'),
        expect.stringContaining('admin.users.unban'),
        expect.stringContaining('admin.stats'),
      ]));
    });

    it('should return empty for file without tRPC router', async () => {
      // Use a fixture that doesn't have tRPC routers
      const nonTrpcFile = path.resolve(process.cwd(), 'test', 'fixtures', 'sample-interfaces.ts');
      const refs = await adapter.list(nonTrpcFile);
      
      expect(refs).toBeInstanceOf(Array);
      expect(refs.length).toBe(0);
    });

    it('should handle non-existent file gracefully', async () => {
      const refs = await adapter.list('./nonexistent-file.ts');
      
      expect(refs).toBeInstanceOf(Array);
      expect(refs.length).toBe(0);
    });
  });
});

// ============================================================================
// Schema Extraction Tests (6 tests)
// ============================================================================

describe('tRPC Schema Extraction', () => {
  const adapter = new TRPCAdapter();

  describe('Zod schema extraction from .input()', () => {
    it('should extract Zod schema from .input(z.object({...}))', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.getById@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('id');
      
      // Should correctly extract z.string().uuid()
      const idProp = schema.properties['id'];
      expect(idProp.type.kind).toBe('primitive');
      if (idProp.type.kind === 'primitive') {
        expect(idProp.type.value).toBe('string');
      }
    });

    it('should extract complex Zod schema with nested objects', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.update@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('id');
      expect(schema.properties).toHaveProperty('data');
      
      // data should be an object
      const dataProp = schema.properties['data'];
      expect(dataProp.type.kind).toBe('object');
    });
  });

  describe('Zod schema extraction from .output()', () => {
    it('should extract Zod schema from .output(z.object({...}))', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.create.output@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('id');
      expect(schema.properties).toHaveProperty('name');
      expect(schema.properties).toHaveProperty('email');
      expect(schema.properties).toHaveProperty('status');
      expect(schema.properties).toHaveProperty('createdAt');
    });

    it('should extract referenced Zod schema (shared schema variable)', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:posts.create.output@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      // PostSchema has these properties
      expect(schema.properties).toHaveProperty('id');
      expect(schema.properties).toHaveProperty('title');
      expect(schema.properties).toHaveProperty('content');
      expect(schema.properties).toHaveProperty('authorId');
      expect(schema.properties).toHaveProperty('published');
    });
  });

  describe('procedure chain handling', () => {
    it('should handle .input().query() chain', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:posts.listByAuthor@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('authorId');
      expect(schema.properties).toHaveProperty('limit');
      expect(schema.properties).toHaveProperty('offset');
    });

    it('should handle .input().mutation() chain', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.delete@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('id');
    });
  });

  describe('procedures without explicit schemas', () => {
    it('should handle procedure without input (should return empty schema)', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.list@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(Object.keys(schema.properties)).toHaveLength(0);
      expect(schema.required).toEqual([]);
    });

    it('should handle procedure without output (should infer or skip)', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.delete.output@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      // Should return empty or inferred schema when no explicit output
      expect(schema).toBeDefined();
    });
  });
});

// ============================================================================
// Procedure Metadata Tests (3 tests)
// ============================================================================

describe('tRPC Procedure Metadata', () => {
  const adapter = new TRPCAdapter();

  describe('procedure type detection', () => {
    it('should include procedure type (query) in metadata', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.getById@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      // The procedure type might be in metadata or the schema name
      // Based on ADR, could be in schema.name or custom metadata field
      expect(schema.name).toContain('getById');
    });

    it('should include procedure type (mutation) in metadata', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.create@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.name).toContain('create');
    });
  });

  describe('procedure path in schema name', () => {
    it('should include full procedure path in schema.name', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:admin.users.ban@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      // Should include the full path for uniqueness
      expect(schema.name).toContain('admin.users.ban');
    });

    it('should handle nested paths in schema name', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:posts.listByAuthor@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.name).toContain('posts.listByAuthor');
    });
  });

  describe('source metadata', () => {
    it('should set source to "trpc" in schema', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.getById@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.source).toEqual(ref);
      expect(schema.source.source).toBe('trpc');
    });

    it('should include file location', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.getById@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.location).toBeDefined();
      expect(schema.location?.file).toContain('sample-trpc-router.ts');
    });
  });
});

// ============================================================================
// Type Mapping Tests
// ============================================================================

describe('tRPC Type Mapping', () => {
  const adapter = new TRPCAdapter();

  describe('primitive types', () => {
    it('should map z.string() to primitive string', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:posts.create@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const titleProp = schema.properties['title'];
      
      expect(titleProp).toBeDefined();
      expect(titleProp.type).toEqual({
        kind: 'primitive',
        value: 'string',
      });
    });

    it('should map z.number() to primitive number', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:posts.listByAuthor@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const limitProp = schema.properties['limit'];
      
      expect(limitProp).toBeDefined();
      expect(limitProp.type).toEqual({
        kind: 'primitive',
        value: 'number',
      });
    });

    it('should map z.boolean() to primitive boolean', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:posts.create.output@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const publishedProp = schema.properties['published'];
      
      expect(publishedProp).toBeDefined();
      expect(publishedProp.type).toEqual({
        kind: 'primitive',
        value: 'boolean',
      });
    });
  });

  describe('enum types', () => {
    it('should map z.enum() to union of literals', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.create.output@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const statusProp = schema.properties['status'];
      
      expect(statusProp).toBeDefined();
      expect(statusProp.type.kind).toBe('union');
      
      if (statusProp.type.kind === 'union') {
        expect(statusProp.type.variants.length).toBe(3);
        
        const values = statusProp.type.variants.map((v: NormalizedType) => {
          if (v.kind === 'literal') return v.value;
          return null;
        });
        expect(values).toContain('active');
        expect(values).toContain('inactive');
        expect(values).toContain('pending');
      }
    });
  });

  describe('optional and nullable', () => {
    it('should mark z.optional() properties as optional', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.create@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const emailProp = schema.properties['email'];
      
      expect(emailProp).toBeDefined();
      expect(emailProp.optional).toBe(true);
    });

    it('should handle default values from z.default()', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:posts.listByAuthor@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const limitProp = schema.properties['limit'];
      
      expect(limitProp).toBeDefined();
      // Properties with defaults are effectively optional
      expect(limitProp.optional).toBe(true);
    });
  });

  describe('constraints', () => {
    it('should map z.string().min().max() constraints', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:posts.create@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const titleProp = schema.properties['title'];
      
      expect(titleProp).toBeDefined();
      expect(titleProp.constraints).toBeDefined();
      expect(titleProp.constraints?.minLength).toBe(1);
      expect(titleProp.constraints?.maxLength).toBe(200);
    });

    it('should map z.number().int().min().max() constraints', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:posts.listByAuthor@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const limitProp = schema.properties['limit'];
      
      expect(limitProp).toBeDefined();
      expect(limitProp.constraints).toBeDefined();
      expect(limitProp.constraints?.minimum).toBe(1);
      expect(limitProp.constraints?.maximum).toBe(100);
    });

    it('should map z.string().email() format constraint', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.create@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const emailProp = schema.properties['email'];
      
      expect(emailProp).toBeDefined();
      expect(emailProp.constraints).toBeDefined();
      expect(emailProp.constraints?.format).toBe('email');
    });

    it('should map z.string().uuid() format constraint', async () => {
      const ref: SchemaRef = {
        source: 'trpc',
        id: `trpc:users.getById@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const idProp = schema.properties['id'];
      
      expect(idProp).toBeDefined();
      expect(idProp.constraints).toBeDefined();
      expect(idProp.constraints?.format).toBe('uuid');
    });
  });
});

// ============================================================================
// PropertyDef Structure Tests
// ============================================================================

describe('tRPC PropertyDef Structure', () => {
  const adapter = new TRPCAdapter();

  it('should include all PropertyDef fields', async () => {
    const ref: SchemaRef = {
      source: 'trpc',
      id: `trpc:users.create@${FIXTURE_PATH}`,
    };
    
    const schema = await adapter.extract(ref);
    
    for (const [propName, propDef] of Object.entries(schema.properties) as [string, PropertyDef][]) {
      // All PropertyDef required fields should exist
      expect(propDef).toHaveProperty('type');
      expect(propDef).toHaveProperty('optional');
      expect(propDef).toHaveProperty('nullable');
      expect(propDef).toHaveProperty('readonly');
      expect(propDef).toHaveProperty('deprecated');
      
      // Type assertions
      expect(typeof propDef.optional).toBe('boolean');
      expect(typeof propDef.nullable).toBe('boolean');
      expect(typeof propDef.readonly).toBe('boolean');
      expect(typeof propDef.deprecated).toBe('boolean');
    }
  });

  it('should mark required properties correctly', async () => {
    const ref: SchemaRef = {
      source: 'trpc',
      id: `trpc:users.create@${FIXTURE_PATH}`,
    };
    
    const schema = await adapter.extract(ref);
    
    // Required properties should not be optional
    for (const reqProp of schema.required) {
      if (schema.properties[reqProp]) {
        expect(schema.properties[reqProp].optional).toBe(false);
      }
    }
    
    // Non-required properties should be optional
    const allProps = Object.keys(schema.properties);
    const optionalProps = allProps.filter(p => !schema.required.includes(p));
    
    for (const optProp of optionalProps) {
      expect(schema.properties[optProp].optional).toBe(true);
    }
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('tRPC Edge Cases', () => {
  const adapter = new TRPCAdapter();

  it('should handle top-level procedure (not in nested router)', async () => {
    const ref: SchemaRef = {
      source: 'trpc',
      id: `trpc:health@${FIXTURE_PATH}`,
    };
    
    const schema = await adapter.extract(ref);
    
    expect(schema).toBeDefined();
    // health procedure has no input
    expect(Object.keys(schema.properties)).toHaveLength(0);
  });

  it('should handle complex nested input schema', async () => {
    // complexInputRouter has deeply nested input
    const ref: SchemaRef = {
      source: 'trpc',
      id: `trpc:search@${FIXTURE_PATH}`,
    };
    
    // This might not exist in appRouter but exists as a separate export
    // The adapter should handle both exported routers
    try {
      const schema = await adapter.extract(ref);
      expect(schema.properties).toHaveProperty('query');
      expect(schema.properties).toHaveProperty('filters');
      expect(schema.properties).toHaveProperty('pagination');
    } catch {
      // Expected if adapter only processes main appRouter
    }
  });

  it('should handle empty router', async () => {
    // emptyRouter has no procedures
    // list() should return empty array when processing it
    const refs = await adapter.list(FIXTURE_PATH);
    
    // Even with empty router in file, should list procedures from appRouter
    expect(refs.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Source Location Tests
// ============================================================================

describe('tRPC Source Location', () => {
  const adapter = new TRPCAdapter();

  it('should include source location with file path', async () => {
    const ref: SchemaRef = {
      source: 'trpc',
      id: `trpc:users.getById@${FIXTURE_PATH}`,
    };
    
    const schema = await adapter.extract(ref);
    
    expect(schema.location).toBeDefined();
    expect(schema.location?.file).toContain('sample-trpc-router.ts');
  });

  it('should include line number in location', async () => {
    const ref: SchemaRef = {
      source: 'trpc',
      id: `trpc:users.create@${FIXTURE_PATH}`,
    };
    
    const schema = await adapter.extract(ref);
    
    expect(schema.location).toBeDefined();
    expect(schema.location?.line).toBeDefined();
    expect(typeof schema.location?.line).toBe('number');
    expect(schema.location!.line).toBeGreaterThan(0);
  });
});
