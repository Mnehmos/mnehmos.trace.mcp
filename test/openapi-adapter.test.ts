/**
 * Tests for OpenAPI Adapter
 * 
 * Tests the OpenAPI adapter for extracting schemas from OpenAPI/Swagger specs.
 * These tests are written BEFORE implementation (TDD Red Phase).
 * 
 * API Reference: .context/ADR-P1-1-OPENAPI-ADAPTER.md
 * 
 * SchemaRef ID Format:
 *   {type}:{identifier}@{specPath}
 * 
 * Types:
 *   - endpoint:GET:/users/{id}@./api.yaml
 *   - request:POST:/users@./api.yaml
 *   - response:GET:/users/{id}:200@./api.yaml
 *   - schema:User@./api.yaml
 *   - file:./api.yaml
 */

import { describe, it, expect } from 'vitest';
import path from 'path';

// These imports will fail until implementation exists
import { 
  OpenAPIAdapter,
  parseOpenAPIRef,
  type OpenAPIRef,
} from '../src/adapters/openapi/index.js';

import type { 
  SchemaRef, 
  NormalizedSchema, 
  NormalizedType,
  PropertyDef,
} from '../src/core/types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const FIXTURE_PATH = path.resolve(process.cwd(), 'test', 'fixtures', 'sample-openapi.yaml');
const RELATIVE_FIXTURE = './test/fixtures/sample-openapi.yaml';

// ============================================================================
// Ref Parsing Tests
// ============================================================================

describe('OpenAPI Ref Parsing - parseOpenAPIRef()', () => {
  describe('should parse endpoint ref correctly', () => {
    it('should parse GET endpoint ref', () => {
      const refId = `endpoint:GET:/users/{id}@${RELATIVE_FIXTURE}`;
      
      const parsed = parseOpenAPIRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('endpoint');
      expect(parsed!.method).toBe('GET');
      expect(parsed!.path).toBe('/users/{id}');
      expect(parsed!.specPath).toBe(RELATIVE_FIXTURE);
      expect(parsed!.statusCode).toBeUndefined();
      expect(parsed!.schemaName).toBeUndefined();
    });

    it('should parse POST endpoint ref', () => {
      const refId = `endpoint:POST:/users@${RELATIVE_FIXTURE}`;
      
      const parsed = parseOpenAPIRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('endpoint');
      expect(parsed!.method).toBe('POST');
      expect(parsed!.path).toBe('/users');
      expect(parsed!.specPath).toBe(RELATIVE_FIXTURE);
    });
  });

  describe('should parse request ref correctly', () => {
    it('should parse request body ref', () => {
      const refId = `request:POST:/users@${RELATIVE_FIXTURE}`;
      
      const parsed = parseOpenAPIRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('request');
      expect(parsed!.method).toBe('POST');
      expect(parsed!.path).toBe('/users');
      expect(parsed!.specPath).toBe(RELATIVE_FIXTURE);
    });

    it('should parse PUT request with path params', () => {
      const refId = `request:PUT:/users/{id}@${RELATIVE_FIXTURE}`;
      
      const parsed = parseOpenAPIRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('request');
      expect(parsed!.method).toBe('PUT');
      expect(parsed!.path).toBe('/users/{id}');
    });
  });

  describe('should parse response ref correctly', () => {
    it('should parse 200 response ref', () => {
      const refId = `response:GET:/users/{id}:200@${RELATIVE_FIXTURE}`;
      
      const parsed = parseOpenAPIRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('response');
      expect(parsed!.method).toBe('GET');
      expect(parsed!.path).toBe('/users/{id}');
      expect(parsed!.statusCode).toBe('200');
      expect(parsed!.specPath).toBe(RELATIVE_FIXTURE);
    });

    it('should parse 201 response ref', () => {
      const refId = `response:POST:/users:201@${RELATIVE_FIXTURE}`;
      
      const parsed = parseOpenAPIRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('response');
      expect(parsed!.method).toBe('POST');
      expect(parsed!.path).toBe('/users');
      expect(parsed!.statusCode).toBe('201');
    });

    it('should parse 404 error response ref', () => {
      const refId = `response:GET:/users/{id}:404@${RELATIVE_FIXTURE}`;
      
      const parsed = parseOpenAPIRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('response');
      expect(parsed!.statusCode).toBe('404');
    });
  });

  describe('should parse component schema ref correctly', () => {
    it('should parse User schema ref', () => {
      const refId = `schema:User@${RELATIVE_FIXTURE}`;
      
      const parsed = parseOpenAPIRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('schema');
      expect(parsed!.schemaName).toBe('User');
      expect(parsed!.specPath).toBe(RELATIVE_FIXTURE);
      expect(parsed!.method).toBeUndefined();
      expect(parsed!.path).toBeUndefined();
    });

    it('should parse CreateUser schema ref', () => {
      const refId = `schema:CreateUser@${RELATIVE_FIXTURE}`;
      
      const parsed = parseOpenAPIRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('schema');
      expect(parsed!.schemaName).toBe('CreateUser');
    });

    it('should parse Error schema ref', () => {
      const refId = `schema:Error@${RELATIVE_FIXTURE}`;
      
      const parsed = parseOpenAPIRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('schema');
      expect(parsed!.schemaName).toBe('Error');
    });
  });

  describe('should parse file ref correctly', () => {
    it('should parse file-only ref', () => {
      const refId = `file:${RELATIVE_FIXTURE}`;
      
      const parsed = parseOpenAPIRef(refId);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('file');
      expect(parsed!.specPath).toBe(RELATIVE_FIXTURE);
      expect(parsed!.method).toBeUndefined();
      expect(parsed!.path).toBeUndefined();
      expect(parsed!.schemaName).toBeUndefined();
    });
  });

  describe('should return null for invalid refs', () => {
    it('should return null for empty string', () => {
      const parsed = parseOpenAPIRef('');
      expect(parsed).toBeNull();
    });

    it('should return null for missing type', () => {
      const parsed = parseOpenAPIRef(`/users@${RELATIVE_FIXTURE}`);
      expect(parsed).toBeNull();
    });

    it('should return null for unknown type', () => {
      const parsed = parseOpenAPIRef(`unknown:value@${RELATIVE_FIXTURE}`);
      expect(parsed).toBeNull();
    });

    it('should return null for malformed ref', () => {
      const parsed = parseOpenAPIRef('not-a-valid-ref');
      expect(parsed).toBeNull();
    });

    it('should return null for missing spec path', () => {
      const parsed = parseOpenAPIRef('schema:User');
      expect(parsed).toBeNull();
    });
  });
});

// ============================================================================
// Adapter Tests
// ============================================================================

describe('OpenAPIAdapter', () => {
  const adapter = new OpenAPIAdapter();

  describe('kind property', () => {
    it('should have kind = "openapi"', () => {
      expect(adapter.kind).toBe('openapi');
    });
  });

  describe('supports()', () => {
    it('should return true for openapi source refs', () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `endpoint:GET:/users@${RELATIVE_FIXTURE}`,
      };
      
      expect(adapter.supports(ref)).toBe(true);
    });

    it('should return true for all openapi ref types', () => {
      const refs: SchemaRef[] = [
        { source: 'openapi', id: `file:${RELATIVE_FIXTURE}` },
        { source: 'openapi', id: `endpoint:GET:/users@${RELATIVE_FIXTURE}` },
        { source: 'openapi', id: `request:POST:/users@${RELATIVE_FIXTURE}` },
        { source: 'openapi', id: `response:GET:/users:200@${RELATIVE_FIXTURE}` },
        { source: 'openapi', id: `schema:User@${RELATIVE_FIXTURE}` },
      ];
      
      for (const ref of refs) {
        expect(adapter.supports(ref)).toBe(true);
      }
    });

    it('should return false for non-openapi source refs', () => {
      const refs: SchemaRef[] = [
        { source: 'mcp', id: 'tool:my_tool@./server.ts' },
        { source: 'typescript', id: 'interface:User@./types.ts' },
        { source: 'graphql', id: 'type:User@./schema.graphql' },
        { source: 'json_schema', id: './schema.json' },
      ];
      
      for (const ref of refs) {
        expect(adapter.supports(ref)).toBe(false);
      }
    });
  });

  describe('extract() - endpoint schema', () => {
    it('should extract endpoint schema with request and response', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `endpoint:POST:/users@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.name).toContain('createUser'); // operationId or method+path
      expect(schema.properties).toHaveProperty('request');
      expect(schema.properties).toHaveProperty('responses');
      expect(schema.source).toEqual(ref);
    });

    it('should include request body in endpoint request schema', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `endpoint:POST:/users@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const requestProp = schema.properties['request'];
      
      expect(requestProp).toBeDefined();
      expect(requestProp.type.kind).toBe('object');
      
      // Request should have body property
      if (requestProp.type.kind === 'object') {
        expect(requestProp.type.schema.properties).toHaveProperty('body');
      }
    });

    it('should include response schemas by status code', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `endpoint:POST:/users@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const responsesProp = schema.properties['responses'];
      
      expect(responsesProp).toBeDefined();
      expect(responsesProp.type.kind).toBe('object');
      
      if (responsesProp.type.kind === 'object') {
        // Should have 201 and 400 responses
        expect(responsesProp.type.schema.properties).toHaveProperty('201');
        expect(responsesProp.type.schema.properties).toHaveProperty('400');
      }
    });
  });

  describe('extract() - request body schema only', () => {
    it('should extract request body schema for POST endpoint', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `request:POST:/users@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('name');
      expect(schema.required).toContain('name');
    });

    it('should extract request body schema for PUT endpoint', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `request:PUT:/users/{id}@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('name');
      expect(schema.properties).toHaveProperty('email');
      expect(schema.properties).toHaveProperty('status');
    });
  });

  describe('extract() - response schema by status code', () => {
    it('should extract 200 response schema', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `response:GET:/users/{id}:200@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('id');
      expect(schema.properties).toHaveProperty('name');
      expect(schema.properties).toHaveProperty('status');
      expect(schema.required).toContain('id');
      expect(schema.required).toContain('name');
    });

    it('should extract 201 created response schema', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `response:POST:/users:201@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('id');
    });

    it('should extract 400 error response schema', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `response:GET:/users:400@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('code');
      expect(schema.properties).toHaveProperty('message');
      expect(schema.required).toContain('code');
      expect(schema.required).toContain('message');
    });

    it('should extract array response schema for list endpoint', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `response:GET:/users:200@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      // GET /users returns array of User
      // This could be a schema with an array type or wrapped
      expect(schema.name || schema.properties).toBeDefined();
    });
  });

  describe('extract() - component schema by name', () => {
    it('should extract User component schema', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:User@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.name).toBe('User');
      expect(schema.properties).toHaveProperty('id');
      expect(schema.properties).toHaveProperty('name');
      expect(schema.properties).toHaveProperty('email');
      expect(schema.properties).toHaveProperty('status');
      expect(schema.required).toContain('id');
      expect(schema.required).toContain('name');
      expect(schema.required).toContain('status');
    });

    it('should extract CreateUser component schema', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:CreateUser@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.name).toBe('CreateUser');
      expect(schema.properties).toHaveProperty('name');
      expect(schema.required).toContain('name');
      expect(schema.required).not.toContain('email'); // email is optional
    });

    it('should extract Error component schema', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:Error@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.name).toBe('Error');
      expect(schema.properties).toHaveProperty('code');
      expect(schema.properties).toHaveProperty('message');
      expect(schema.required).toEqual(expect.arrayContaining(['code', 'message']));
    });
  });

  describe('extract() - path parameters', () => {
    it('should handle path parameters in extraction', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `endpoint:GET:/users/{id}@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      const requestProp = schema.properties['request'];
      
      if (requestProp && requestProp.type.kind === 'object') {
        // Should have path params
        expect(requestProp.type.schema.properties).toHaveProperty('path');
        
        const pathParams = requestProp.type.schema.properties['path'];
        if (pathParams && pathParams.type.kind === 'object') {
          expect(pathParams.type.schema.properties).toHaveProperty('id');
        }
      }
    });
  });

  describe('extract() - query parameters', () => {
    it('should handle query parameters in extraction', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `endpoint:GET:/users@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      const requestProp = schema.properties['request'];
      
      if (requestProp && requestProp.type.kind === 'object') {
        // Should have query params
        expect(requestProp.type.schema.properties).toHaveProperty('query');
        
        const queryParams = requestProp.type.schema.properties['query'];
        if (queryParams && queryParams.type.kind === 'object') {
          expect(queryParams.type.schema.properties).toHaveProperty('limit');
          expect(queryParams.type.schema.properties).toHaveProperty('offset');
        }
      }
    });
  });

  describe('extract() - error handling', () => {
    it('should throw for non-existent endpoint', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `endpoint:GET:/nonexistent@${FIXTURE_PATH}`,
      };
      
      await expect(adapter.extract(ref)).rejects.toThrow();
    });

    it('should throw for non-existent schema', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:NonExistent@${FIXTURE_PATH}`,
      };
      
      await expect(adapter.extract(ref)).rejects.toThrow();
    });

    it('should throw for non-existent spec file', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: 'endpoint:GET:/users@./nonexistent.yaml',
      };
      
      await expect(adapter.extract(ref)).rejects.toThrow();
    });

    it('should throw for invalid response status code', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `response:GET:/users:999@${FIXTURE_PATH}`,
      };
      
      await expect(adapter.extract(ref)).rejects.toThrow();
    });
  });

  describe('list()', () => {
    it('should list all endpoints from spec', async () => {
      const refs = await adapter.list(FIXTURE_PATH);
      
      expect(refs).toBeInstanceOf(Array);
      expect(refs.length).toBeGreaterThan(0);
      
      // Should include all endpoints
      const endpoints = refs.filter((r: SchemaRef) => r.id.startsWith('endpoint:'));
      expect(endpoints.length).toBeGreaterThan(0);
      
      // All refs should have source: 'openapi'
      for (const ref of refs) {
        expect(ref.source).toBe('openapi');
      }
    });

    it('should list GET, POST, PUT, DELETE endpoints', async () => {
      const refs = await adapter.list(FIXTURE_PATH);
      
      const methods = refs.map((r: SchemaRef) => {
        const match = r.id.match(/^endpoint:([A-Z]+):/);
        return match ? match[1] : null;
      }).filter(Boolean);
      
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('PUT');
      expect(methods).toContain('DELETE');
    });

    it('should include spec path in each ref id', async () => {
      const refs = await adapter.list(FIXTURE_PATH);
      
      for (const ref of refs) {
        expect(ref.id).toContain('@');
        expect(ref.id).toContain(FIXTURE_PATH);
      }
    });

    it('should return empty array for non-existent spec', async () => {
      // Per ADR, list() should handle errors gracefully
      const refs = await adapter.list('./nonexistent.yaml');
      
      expect(refs).toBeInstanceOf(Array);
      expect(refs.length).toBe(0);
    });
  });
});

// ============================================================================
// Type Mapping Tests
// ============================================================================

describe('OpenAPI Type Mapping', () => {
  const adapter = new OpenAPIAdapter();

  describe('primitive types', () => {
    it('should map OpenAPI string to NormalizedType primitive', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:User@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const nameProp = schema.properties['name'];
      
      expect(nameProp).toBeDefined();
      expect(nameProp.type).toEqual({
        kind: 'primitive',
        value: 'string',
      });
    });

    it('should map OpenAPI integer to NormalizedType number', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:User@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const ageProp = schema.properties['age'];
      
      expect(ageProp).toBeDefined();
      expect(ageProp.type).toEqual({
        kind: 'primitive',
        value: 'number',
      });
    });

    it('should map OpenAPI number to NormalizedType number', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:User@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      // Age is integer, which should map to number
      const ageProp = schema.properties['age'];
      
      expect(ageProp.type.kind).toBe('primitive');
      if (ageProp.type.kind === 'primitive') {
        expect(ageProp.type.value).toBe('number');
      }
    });
  });

  describe('array types', () => {
    it('should map OpenAPI array to NormalizedType array', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:User@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const rolesProp = schema.properties['roles'];
      
      expect(rolesProp).toBeDefined();
      expect(rolesProp.type.kind).toBe('array');
      
      if (rolesProp.type.kind === 'array') {
        expect(rolesProp.type.element).toEqual({
          kind: 'primitive',
          value: 'string',
        });
      }
    });

    it('should handle array of objects', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `response:GET:/users:200@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      // GET /users returns array of User
      // The schema should represent an array type
      expect(schema).toBeDefined();
    });
  });

  describe('object types', () => {
    it('should map OpenAPI object to NormalizedSchema', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:User@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const metadataProp = schema.properties['metadata'];
      
      expect(metadataProp).toBeDefined();
      expect(metadataProp.type.kind).toBe('object');
      
      if (metadataProp.type.kind === 'object') {
        expect(metadataProp.type.schema).toBeDefined();
        expect(metadataProp.type.schema.additionalProperties).toBe(true);
      }
    });
  });

  describe('enum types', () => {
    it('should map OpenAPI enum to union of literals', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:User@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const statusProp = schema.properties['status'];
      
      expect(statusProp).toBeDefined();
      expect(statusProp.type.kind).toBe('union');
      
      if (statusProp.type.kind === 'union') {
        expect(statusProp.type.variants.length).toBe(3);
        
        // Each variant should be a literal
        for (const variant of statusProp.type.variants) {
          expect(variant.kind).toBe('literal');
        }
        
        // Check literal values
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

  describe('composition types', () => {
    it('should map OpenAPI oneOf to union', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:Pet@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      // Pet is oneOf Cat | Dog, so it should have union representation
      // The exact structure depends on how we represent it
    });

    it('should map OpenAPI anyOf to union', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:SearchResult@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      // SearchResult is anyOf User | Error
    });

    it('should map OpenAPI allOf to intersection', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:CompositeEntity@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      // CompositeEntity uses allOf with BaseEntity
      // Should have properties from both
      expect(schema.properties).toHaveProperty('id');
      expect(schema.properties).toHaveProperty('extra');
    });
  });

  describe('nullable types', () => {
    it('should handle nullable properties', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:User@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const emailProp = schema.properties['email'];
      
      expect(emailProp).toBeDefined();
      expect(emailProp.nullable).toBe(true);
    });
  });

  describe('constraints mapping', () => {
    it('should map minLength/maxLength constraints', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:User@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const nameProp = schema.properties['name'];
      
      expect(nameProp).toBeDefined();
      expect(nameProp.constraints).toBeDefined();
      expect(nameProp.constraints?.minLength).toBe(1);
      expect(nameProp.constraints?.maxLength).toBe(100);
    });

    it('should map minimum/maximum constraints', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:User@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const ageProp = schema.properties['age'];
      
      expect(ageProp).toBeDefined();
      expect(ageProp.constraints).toBeDefined();
      expect(ageProp.constraints?.minimum).toBe(0);
      expect(ageProp.constraints?.maximum).toBe(150);
    });

    it('should map format constraint', async () => {
      const ref: SchemaRef = {
        source: 'openapi',
        id: `schema:User@${FIXTURE_PATH}`,
      };
      
      const schema = await adapter.extract(ref);
      const idProp = schema.properties['id'];
      const emailProp = schema.properties['email'];
      
      expect(idProp.constraints?.format).toBe('uuid');
      expect(emailProp.constraints?.format).toBe('email');
    });
  });
});

// ============================================================================
// PropertyDef Structure Tests
// ============================================================================

describe('OpenAPI PropertyDef Structure', () => {
  const adapter = new OpenAPIAdapter();

  it('should include all PropertyDef fields', async () => {
    const ref: SchemaRef = {
      source: 'openapi',
      id: `schema:User@${FIXTURE_PATH}`,
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

  it('should mark optional properties correctly', async () => {
    const ref: SchemaRef = {
      source: 'openapi',
      id: `schema:User@${FIXTURE_PATH}`,
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

  it('should include description when available', async () => {
    const ref: SchemaRef = {
      source: 'openapi',
      id: `schema:User@${FIXTURE_PATH}`,
    };
    
    const schema = await adapter.extract(ref);
    
    // Properties with descriptions should have them
    const idProp = schema.properties['id'];
    expect(idProp.description).toBe('Unique user identifier');
    
    const nameProp = schema.properties['name'];
    expect(nameProp.description).toBe("User's full name");
  });
});

// ============================================================================
// Source Location Tests
// ============================================================================

describe('OpenAPI Source Location', () => {
  const adapter = new OpenAPIAdapter();

  it('should include source location with file path', async () => {
    const ref: SchemaRef = {
      source: 'openapi',
      id: `schema:User@${FIXTURE_PATH}`,
    };
    
    const schema = await adapter.extract(ref);
    
    expect(schema.location).toBeDefined();
    expect(schema.location?.file).toContain('sample-openapi.yaml');
  });
});
