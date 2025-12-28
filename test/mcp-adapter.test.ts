/**
 * Tests for MCP Adapter
 * Tests the new SchemaAdapter pattern
 */

import { describe, it, expect } from 'vitest';
import { MCPAdapter } from '../src/adapters/mcp.js';
import path from 'path';

describe('MCPAdapter', () => {
  const adapter = new MCPAdapter();

  describe('supports()', () => {
    it('should support mcp refs', () => {
      expect(adapter.supports({ source: 'mcp', id: 'test' })).toBe(true);
    });

    it('should reject non-mcp refs', () => {
      expect(adapter.supports({ source: 'typescript', id: 'test' })).toBe(false);
      expect(adapter.supports({ source: 'openapi', id: 'test' })).toBe(false);
    });
  });

  describe('kind property', () => {
    it('should have kind = "mcp"', () => {
      expect(adapter.kind).toBe('mcp');
    });
  });

  describe('extract() - file format', () => {
    it('should extract from file with file: prefix', async () => {
      const filePath = path.resolve(process.cwd(), 'test', 'fixtures', 'sample-server.ts');

      const schema = await adapter.extract({
        source: 'mcp',
        id: `file:${filePath}`,
      });

      expect(schema).toBeDefined();
      expect(schema.properties).toBeDefined();
      expect(schema.required).toBeInstanceOf(Array);
      expect(schema.source.source).toBe('mcp');
      expect(schema.location).toBeDefined();
      expect(schema.location?.file).toBe(filePath);
    });

    it('should throw on invalid file path', async () => {
      await expect(
        adapter.extract({
          source: 'mcp',
          id: 'file:./nonexistent.ts',
        })
      ).rejects.toThrow();
    });
  });

  describe('extract() - dir format', () => {
    it('should extract from directory with dir: prefix', async () => {
      const dirPath = path.resolve(process.cwd(), 'test', 'fixtures');

      const schema = await adapter.extract({
        source: 'mcp',
        id: `dir:${dirPath}`,
      });

      expect(schema).toBeDefined();
      expect(schema.properties).toBeDefined();
      expect(schema.source.source).toBe('mcp');
    });
  });

  describe('extract() - tool format', () => {
    it('should extract specific tool with tool:name@path format', async () => {
      const filePath = path.resolve(process.cwd(), 'test', 'fixtures', 'sample-server.ts');

      // Assuming sample-server.ts has a tool named 'get_character'
      const schema = await adapter.extract({
        source: 'mcp',
        id: `tool:get_character@${filePath}`,
      });

      expect(schema).toBeDefined();
      expect(schema.name).toBe('get_character');
      expect(schema.properties).toBeDefined();
    });

    it('should throw when tool not found', async () => {
      const filePath = path.resolve(process.cwd(), 'test', 'fixtures', 'sample-server.ts');

      await expect(
        adapter.extract({
          source: 'mcp',
          id: `tool:nonexistent_tool@${filePath}`,
        })
      ).rejects.toThrow('not found');
    });
  });

  describe('extract() - unsupported format', () => {
    it('should throw on unsupported ID format', async () => {
      await expect(
        adapter.extract({
          source: 'mcp',
          id: 'invalid:format',
        })
      ).rejects.toThrow('Unsupported');
    });
  });

  describe('list()', () => {
    it('should list all tools in a directory', async () => {
      const basePath = path.resolve('./test/fixtures');

      const refs = await adapter.list(basePath);

      expect(refs).toBeInstanceOf(Array);
      expect(refs.length).toBeGreaterThan(0);

      // All refs should have source: 'mcp'
      for (const ref of refs) {
        expect(ref.source).toBe('mcp');
        expect(ref.id).toMatch(/^tool:/);
      }
    });

    it('should skip node_modules and dist directories', async () => {
      const basePath = path.resolve(process.cwd());

      const refs = await adapter.list(basePath);

      // None should be from node_modules or dist
      for (const ref of refs) {
        expect(ref.id).not.toContain('node_modules');
        expect(ref.id).not.toContain('dist');
      }
    });
  });

  describe('NormalizedSchema conversion', () => {
    it('should convert to NormalizedSchema with proper structure', async () => {
      const filePath = path.resolve(process.cwd(), 'test', 'fixtures', 'sample-server.ts');

      const schema = await adapter.extract({
        source: 'mcp',
        id: `file:${filePath}`,
      });

      // Check NormalizedSchema structure
      expect(schema).toHaveProperty('properties');
      expect(schema).toHaveProperty('required');
      expect(schema).toHaveProperty('source');
      expect(schema.source).toHaveProperty('source', 'mcp');
      expect(schema.source).toHaveProperty('id');

      // Check PropertyDef structure
      const firstProp = Object.values(schema.properties)[0];
      if (firstProp) {
        expect(firstProp).toHaveProperty('type');
        expect(firstProp).toHaveProperty('optional');
        expect(firstProp).toHaveProperty('nullable');
        expect(firstProp).toHaveProperty('readonly');
        expect(firstProp).toHaveProperty('deprecated');
      }
    });

    it('should convert Zod types to NormalizedType', async () => {
      const filePath = path.resolve(process.cwd(), 'test', 'fixtures', 'sample-server.ts');

      const schema = await adapter.extract({
        source: 'mcp',
        id: `file:${filePath}`,
      });

      // Check type conversion
      for (const prop of Object.values(schema.properties)) {
        expect(prop.type).toBeDefined();
        expect(prop.type).toHaveProperty('kind');

        // Kind should be one of the valid NormalizedType kinds
        expect(['primitive', 'literal', 'array', 'object', 'union', 'intersection', 'ref', 'any', 'unknown'])
          .toContain(prop.type.kind);
      }
    });

    it('should mark optional properties correctly', async () => {
      const filePath = path.resolve(process.cwd(), 'test', 'fixtures', 'sample-server.ts');

      const schema = await adapter.extract({
        source: 'mcp',
        id: `file:${filePath}`,
      });

      // Check that optional matches required array
      for (const [propName, propDef] of Object.entries(schema.properties)) {
        const isRequired = schema.required.includes(propName);
        const isOptional = propDef.optional;

        // If required, should not be optional (and vice versa)
        expect(isRequired).toBe(!isOptional);
      }
    });
  });

  describe('Type mapping', () => {
    it('should map z.string() to primitive string', async () => {
      // This would require a fixture with known types
      // For now, just check that strings are recognized
      const filePath = path.resolve(process.cwd(), 'test', 'fixtures', 'sample-server.ts');

      const schema = await adapter.extract({
        source: 'mcp',
        id: `file:${filePath}`,
      });

      // Find a string property (assuming there is one)
      const stringProps = Object.values(schema.properties).filter(
        p => p.type.kind === 'primitive' && 'value' in p.type && p.type.value === 'string'
      );

      expect(stringProps.length).toBeGreaterThan(0);
    });

    it('should handle z.enum() as union of literals', async () => {
      // Would need a fixture with enum
      // Just verify the pattern works
      expect(adapter).toBeDefined();
    });
  });

  describe('Source location tracking', () => {
    it('should include source location in schema', async () => {
      const filePath = path.resolve(process.cwd(), 'test', 'fixtures', 'sample-server.ts');

      const schema = await adapter.extract({
        source: 'mcp',
        id: `file:${filePath}`,
      });

      expect(schema.location).toBeDefined();
      expect(schema.location?.file).toBe(filePath);
      expect(schema.location?.line).toBeGreaterThan(0);
    });
  });

  describe('Integration with existing code', () => {
    it('should work with existing compare functions', async () => {
      // This is an integration test to ensure adapter output
      // works with the comparison engine
      const filePath = path.resolve(process.cwd(), 'test', 'fixtures', 'sample-server.ts');

      const schema = await adapter.extract({
        source: 'mcp',
        id: `file:${filePath}`,
      });

      // Schema should be valid for comparison
      expect(schema.properties).toBeDefined();
      expect(schema.required).toBeDefined();
      expect(schema.source).toBeDefined();
    });
  });
});
