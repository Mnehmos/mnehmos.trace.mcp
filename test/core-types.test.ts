/**
 * Tests for Core Types
 * Tests NormalizedSchema, DataFlowDirection, and type conversions
 */

import { describe, it, expect } from 'vitest';
import type {
  NormalizedSchema,
  NormalizedType,
  PropertyDef,
  DataFlowDirection,
  SchemaRef,
  Constraints,
} from '../src/core/types.js';

describe('Core Types', () => {
  describe('DataFlowDirection', () => {
    it('should have three valid values', () => {
      const validDirections: DataFlowDirection[] = [
        'producer_to_consumer',
        'consumer_to_producer',
        'bidirectional',
      ];

      // TypeScript will ensure these are the only valid values
      expect(validDirections).toHaveLength(3);
    });

    it('should be assignable to variables', () => {
      const d1: DataFlowDirection = 'producer_to_consumer';
      const d2: DataFlowDirection = 'consumer_to_producer';
      const d3: DataFlowDirection = 'bidirectional';

      expect(d1).toBe('producer_to_consumer');
      expect(d2).toBe('consumer_to_producer');
      expect(d3).toBe('bidirectional');
    });
  });

  describe('NormalizedType', () => {
    it('should support primitive types', () => {
      const stringType: NormalizedType = { kind: 'primitive', value: 'string' };
      const numberType: NormalizedType = { kind: 'primitive', value: 'number' };
      const booleanType: NormalizedType = { kind: 'primitive', value: 'boolean' };
      const nullType: NormalizedType = { kind: 'primitive', value: 'null' };

      expect(stringType.kind).toBe('primitive');
      expect(numberType.kind).toBe('primitive');
      expect(booleanType.kind).toBe('primitive');
      expect(nullType.kind).toBe('primitive');
    });

    it('should support literal types', () => {
      const stringLiteral: NormalizedType = { kind: 'literal', value: 'active' };
      const numberLiteral: NormalizedType = { kind: 'literal', value: 42 };
      const booleanLiteral: NormalizedType = { kind: 'literal', value: true };

      expect(stringLiteral.kind).toBe('literal');
      expect(numberLiteral.kind).toBe('literal');
      expect(booleanLiteral.kind).toBe('literal');
    });

    it('should support array types', () => {
      const stringArray: NormalizedType = {
        kind: 'array',
        element: { kind: 'primitive', value: 'string' },
      };

      expect(stringArray.kind).toBe('array');
      if (stringArray.kind === 'array') {
        expect(stringArray.element.kind).toBe('primitive');
      }
    });

    it('should support object types', () => {
      const objectType: NormalizedType = {
        kind: 'object',
        schema: {
          properties: {
            name: {
              type: { kind: 'primitive', value: 'string' },
              optional: false,
              nullable: false,
              readonly: false,
              deprecated: false,
            },
          },
          required: ['name'],
          source: { source: 'mcp', id: 'test' },
        },
      };

      expect(objectType.kind).toBe('object');
      if (objectType.kind === 'object') {
        expect(objectType.schema.properties.name).toBeDefined();
      }
    });

    it('should support union types', () => {
      const unionType: NormalizedType = {
        kind: 'union',
        variants: [
          { kind: 'primitive', value: 'string' },
          { kind: 'primitive', value: 'number' },
        ],
      };

      expect(unionType.kind).toBe('union');
      if (unionType.kind === 'union') {
        expect(unionType.variants).toHaveLength(2);
      }
    });

    it('should support intersection types', () => {
      const intersectionType: NormalizedType = {
        kind: 'intersection',
        members: [
          { kind: 'primitive', value: 'string' },
          { kind: 'primitive', value: 'number' },
        ],
      };

      expect(intersectionType.kind).toBe('intersection');
      if (intersectionType.kind === 'intersection') {
        expect(intersectionType.members).toHaveLength(2);
      }
    });

    it('should support ref types', () => {
      const refType: NormalizedType = { kind: 'ref', name: 'User' };

      expect(refType.kind).toBe('ref');
      if (refType.kind === 'ref') {
        expect(refType.name).toBe('User');
      }
    });

    it('should support any and unknown types', () => {
      const anyType: NormalizedType = { kind: 'any' };
      const unknownType: NormalizedType = { kind: 'unknown' };

      expect(anyType.kind).toBe('any');
      expect(unknownType.kind).toBe('unknown');
    });
  });

  describe('PropertyDef', () => {
    it('should include all required fields', () => {
      const prop: PropertyDef = {
        type: { kind: 'primitive', value: 'string' },
        optional: false,
        nullable: false,
        readonly: false,
        deprecated: false,
      };

      expect(prop.type).toBeDefined();
      expect(typeof prop.optional).toBe('boolean');
      expect(typeof prop.nullable).toBe('boolean');
      expect(typeof prop.readonly).toBe('boolean');
      expect(typeof prop.deprecated).toBe('boolean');
    });

    it('should support optional fields', () => {
      const prop: PropertyDef = {
        type: { kind: 'primitive', value: 'string' },
        optional: true,
        nullable: false,
        readonly: false,
        deprecated: false,
        description: 'A test property',
        constraints: {
          minLength: 1,
          maxLength: 100,
        },
      };

      expect(prop.description).toBe('A test property');
      expect(prop.constraints).toBeDefined();
      expect(prop.constraints?.minLength).toBe(1);
    });
  });

  describe('Constraints', () => {
    it('should support string constraints', () => {
      const constraints: Constraints = {
        minLength: 1,
        maxLength: 100,
        pattern: '^[a-z]+$',
        format: 'email',
      };

      expect(constraints.minLength).toBe(1);
      expect(constraints.maxLength).toBe(100);
      expect(constraints.pattern).toBe('^[a-z]+$');
      expect(constraints.format).toBe('email');
    });

    it('should support number constraints', () => {
      const constraints: Constraints = {
        minimum: 0,
        maximum: 100,
      };

      expect(constraints.minimum).toBe(0);
      expect(constraints.maximum).toBe(100);
    });

    it('should support enum constraints', () => {
      const constraints: Constraints = {
        enum: ['active', 'inactive', 'pending'],
      };

      expect(constraints.enum).toHaveLength(3);
      expect(constraints.enum).toContain('active');
    });
  });

  describe('NormalizedSchema', () => {
    it('should have required fields', () => {
      const schema: NormalizedSchema = {
        properties: {
          id: {
            type: { kind: 'primitive', value: 'number' },
            optional: false,
            nullable: false,
            readonly: false,
            deprecated: false,
          },
          name: {
            type: { kind: 'primitive', value: 'string' },
            optional: false,
            nullable: false,
            readonly: false,
            deprecated: false,
          },
        },
        required: ['id', 'name'],
        source: { source: 'mcp', id: 'test' },
      };

      expect(schema.properties).toBeDefined();
      expect(schema.required).toHaveLength(2);
      expect(schema.source.source).toBe('mcp');
    });

    it('should support optional fields', () => {
      const schema: NormalizedSchema = {
        name: 'User',
        properties: {},
        required: [],
        additionalProperties: false,
        source: { source: 'typescript', id: 'User' },
        location: { file: 'test.ts', line: 1, column: 0 },
      };

      expect(schema.name).toBe('User');
      expect(schema.additionalProperties).toBe(false);
      expect(schema.location).toBeDefined();
      expect(schema.location?.file).toBe('test.ts');
    });

    it('should support nested schemas', () => {
      const schema: NormalizedSchema = {
        properties: {
          user: {
            type: {
              kind: 'object',
              schema: {
                properties: {
                  name: {
                    type: { kind: 'primitive', value: 'string' },
                    optional: false,
                    nullable: false,
                    readonly: false,
                    deprecated: false,
                  },
                },
                required: ['name'],
                source: { source: 'mcp', id: 'nested' },
              },
            },
            optional: false,
            nullable: false,
            readonly: false,
            deprecated: false,
          },
        },
        required: ['user'],
        source: { source: 'mcp', id: 'parent' },
      };

      expect(schema.properties.user.type.kind).toBe('object');
      if (schema.properties.user.type.kind === 'object') {
        expect(schema.properties.user.type.schema.properties.name).toBeDefined();
      }
    });
  });

  describe('SchemaRef', () => {
    it('should support various source kinds', () => {
      const mcpRef: SchemaRef = { source: 'mcp', id: 'tool:test@file.ts' };
      const tsRef: SchemaRef = { source: 'typescript', id: 'interface:User' };
      const openApiRef: SchemaRef = { source: 'openapi', id: '/users' };
      const graphqlRef: SchemaRef = { source: 'graphql', id: 'type:User' };

      expect(mcpRef.source).toBe('mcp');
      expect(tsRef.source).toBe('typescript');
      expect(openApiRef.source).toBe('openapi');
      expect(graphqlRef.source).toBe('graphql');
    });

    it('should support options', () => {
      const ref: SchemaRef = {
        source: 'mcp',
        id: 'test',
        options: {
          include: ['**/*.ts'],
          exclude: ['**/node_modules/**'],
        },
      };

      expect(ref.options).toBeDefined();
      expect(ref.options?.include).toBeInstanceOf(Array);
    });
  });

  describe('Type narrowing', () => {
    it('should allow type narrowing with kind discriminator', () => {
      const type: NormalizedType = { kind: 'primitive', value: 'string' };

      if (type.kind === 'primitive') {
        expect(type.value).toBe('string');
      }

      if (type.kind === 'array') {
        expect(type.element).toBeDefined();
      }

      if (type.kind === 'union') {
        expect(type.variants).toBeDefined();
      }
    });

    it('should handle complex nested type checking', () => {
      const type: NormalizedType = {
        kind: 'union',
        variants: [
          { kind: 'primitive', value: 'string' },
          {
            kind: 'array',
            element: { kind: 'primitive', value: 'number' },
          },
        ],
      };

      expect(type.kind).toBe('union');
      if (type.kind === 'union') {
        expect(type.variants[0].kind).toBe('primitive');
        expect(type.variants[1].kind).toBe('array');

        const arrayVariant = type.variants[1];
        if (arrayVariant.kind === 'array') {
          expect(arrayVariant.element.kind).toBe('primitive');
        }
      }
    });
  });
});
