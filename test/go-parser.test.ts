/**
 * Go Parser Test Suite
 *
 * TDD Red Phase: Comprehensive failing tests for Go language support
 *
 * Test categories:
 * 1. Parser initialization
 * 2. Struct extraction
 * 3. JSON tag parsing
 * 4. Embedded struct handling
 * 5. Interface extraction
 * 6. Type conversion to NormalizedSchema
 * 7. stdlib HTTP handler detection
 * 8. Chi router pattern detection
 * 9. Gin framework pattern detection
 * 10. Route parameter extraction
 * 11. Error handling
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Import the Go parser module (does not exist yet - tests WILL fail)
// This is intentional for Red Phase TDD
import { GoParser } from '../src/languages/go';
import type { SourceLocation } from '../src/types';

// =============================================================================
// Extended Types for Go Parser
// =============================================================================

/**
 * Extended schema for Go structs, interfaces, and routes.
 * The Go parser should return these extended schemas.
 */
interface GoSchema {
  /** Schema name (struct/interface name) */
  name: string;
  /** Schema type: 'object', 'interface', 'route' */
  type?: string;
  /** Description from comments */
  description?: string;
  /** Properties for struct fields */
  properties?: Record<string, GoProperty>;
  /** Required fields (no omitempty) */
  required?: string[];
  /** For composition (embedded structs) */
  allOf?: GoSchema[];
  /** Interface methods */
  methods?: GoMethod[];
  /** Source location */
  sourceLocation?: SourceLocation;
}

/**
 * Property definition for Go struct fields
 */
interface GoProperty {
  type?: string;
  format?: string;
  description?: string;
  items?: GoProperty;
  additionalProperties?: GoProperty | boolean;
  nullable?: boolean;
  default?: unknown;
  enum?: unknown[];
  [key: string]: unknown;
}

/**
 * Interface method definition
 */
interface GoMethod {
  name: string;
  parameters?: string[];
  returnType?: string[];
}

/**
 * Route definition extracted from router patterns
 */
interface GoRoute {
  path: string;
  method?: string;
  methods?: string[];
  pathParams?: string[];
  handler?: string;
}

/**
 * Options for parsing Go source code
 */
interface GoParseOptions {
  content: string;
  filePath?: string;
}

// Fixture paths
const fixturesDir = join(__dirname, 'fixtures', 'go-samples');
const loadFixture = (name: string): string =>
  readFileSync(join(fixturesDir, name), 'utf-8');

describe('Go Parser', () => {
  let parser: GoParser;

  beforeAll(() => {
    parser = new GoParser();
  });

  // ============================================
  // 1. PARSER INITIALIZATION
  // ============================================
  describe('Parser Initialization', () => {
    it('should create parser instance with tree-sitter-go', () => {
      const p = new GoParser();
      expect(p).toBeDefined();
      expect(p).toBeInstanceOf(GoParser);
    });

    it('should have name property set to "go"', () => {
      expect(parser.name).toBe('go');
    });

    it('should identify .go files correctly', () => {
      expect(parser.canParse('main.go')).toBe(true);
      expect(parser.canParse('handler.go')).toBe(true);
      expect(parser.canParse('types.go')).toBe(true);
    });

    it('should reject non-Go files', () => {
      expect(parser.canParse('main.ts')).toBe(false);
      expect(parser.canParse('handler.py')).toBe(false);
      expect(parser.canParse('types.java')).toBe(false);
      expect(parser.canParse('main.go.bak')).toBe(false);
    });

    it('should expose supported file extensions', () => {
      expect(parser.extensions).toContain('.go');
    });
  });

  // ============================================
  // 2. STRUCT EXTRACTION
  // ============================================
  describe('Struct Extraction', () => {
    let structsFixture: string;

    beforeAll(() => {
      structsFixture = loadFixture('structs.go');
    });

    it('should extract User struct with all fields', async () => {
      const schemas = await parser.extractSchemas({ content: structsFixture } as GoParseOptions) as GoSchema[];

      const userSchema = schemas.find((s: GoSchema) => s.name === 'User');
      expect(userSchema).toBeDefined();
      expect(userSchema?.type).toBe('object');
      expect(userSchema?.properties).toHaveProperty('id');
      expect(userSchema?.properties).toHaveProperty('name');
      expect(userSchema?.properties).toHaveProperty('email');
      expect(userSchema?.properties).toHaveProperty('created_at');
    });

    it('should extract struct with correct property types', async () => {
      const schemas = await parser.extractSchemas({ content: structsFixture } as GoParseOptions) as GoSchema[];

      const userSchema = schemas.find((s: GoSchema) => s.name === 'User');
      expect(userSchema?.properties?.id?.type).toBe('integer');
      expect(userSchema?.properties?.name?.type).toBe('string');
      expect(userSchema?.properties?.email?.type).toBe('string');
      expect(userSchema?.properties?.is_active?.type).toBe('boolean');
    });

    it('should extract CreateUserRequest struct', async () => {
      const schemas = await parser.extractSchemas({ content: structsFixture } as GoParseOptions) as GoSchema[];

      const schema = schemas.find((s: GoSchema) => s.name === 'CreateUserRequest');
      expect(schema).toBeDefined();
      expect(schema?.properties).toHaveProperty('name');
      expect(schema?.properties).toHaveProperty('email');
      expect(schema?.properties).toHaveProperty('password');
    });

    it('should extract UpdateUserRequest struct', async () => {
      const schemas = await parser.extractSchemas({ content: structsFixture } as GoParseOptions) as GoSchema[];

      const schema = schemas.find((s: GoSchema) => s.name === 'UpdateUserRequest');
      expect(schema).toBeDefined();
    });

    it('should extract UserResponse struct', async () => {
      const schemas = await parser.extractSchemas({ content: structsFixture } as GoParseOptions) as GoSchema[];

      const schema = schemas.find((s: GoSchema) => s.name === 'UserResponse');
      expect(schema).toBeDefined();
    });

    it('should extract nested struct types', async () => {
      const schemas = await parser.extractSchemas({ content: structsFixture } as GoParseOptions) as GoSchema[];

      const metadataSchema = schemas.find((s: GoSchema) => s.name === 'Metadata');
      expect(metadataSchema).toBeDefined();
      expect(metadataSchema?.properties).toHaveProperty('key');
      expect(metadataSchema?.properties).toHaveProperty('value');
    });

    it('should capture struct documentation comments', async () => {
      const schemas = await parser.extractSchemas({ content: structsFixture } as GoParseOptions) as GoSchema[];

      const userSchema = schemas.find((s: GoSchema) => s.name === 'User');
      expect(userSchema?.description).toContain('User');
    });

    it('should extract all structs from file', async () => {
      const schemas = await parser.extractSchemas({ content: structsFixture } as GoParseOptions) as GoSchema[];

      // Expecting multiple structs
      expect(schemas.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ============================================
  // 3. JSON TAG PARSING
  // ============================================
  describe('JSON Tag Parsing', () => {
    let structsFixture: string;

    beforeAll(() => {
      structsFixture = loadFixture('structs.go');
    });

    it('should parse basic json tag for field name', async () => {
      const schemas = await parser.extractSchemas({ content: structsFixture } as GoParseOptions) as GoSchema[];

      const userSchema = schemas.find((s: GoSchema) => s.name === 'User');
      // Field is `ID int64 `json:"id"`` - property key should be "id" not "ID"
      expect(userSchema?.properties).toHaveProperty('id');
      expect(userSchema?.properties).not.toHaveProperty('ID');
    });

    it('should parse json tag with omitempty', async () => {
      const schemas = await parser.extractSchemas({ content: structsFixture } as GoParseOptions) as GoSchema[];

      const userSchema = schemas.find((s: GoSchema) => s.name === 'User');
      // email field has omitempty - should not be required
      const emailProp = userSchema?.properties?.email;
      expect(emailProp).toBeDefined();
      // omitempty means field is optional
      expect(userSchema?.required).not.toContain('email');
    });

    it('should mark fields without omitempty as required', async () => {
      const schemas = await parser.extractSchemas({ content: structsFixture } as GoParseOptions) as GoSchema[];

      const schema = schemas.find((s: GoSchema) => s.name === 'CreateUserRequest');
      // Fields without omitempty should be required
      expect(schema?.required).toContain('name');
      expect(schema?.required).toContain('email');
    });

    it('should skip fields with json:"-"', async () => {
      const schemas = await parser.extractSchemas({ content: structsFixture } as GoParseOptions) as GoSchema[];

      const userSchema = schemas.find((s: GoSchema) => s.name === 'User');
      // password_hash has json:"-" so should not appear in schema
      expect(userSchema?.properties).not.toHaveProperty('password_hash');
    });

    it('should handle snake_case json tag names', async () => {
      const schemas = await parser.extractSchemas({ content: structsFixture } as GoParseOptions) as GoSchema[];

      const userSchema = schemas.find((s: GoSchema) => s.name === 'User');
      // CreatedAt time.Time `json:"created_at"` -> property key should be created_at
      expect(userSchema?.properties).toHaveProperty('created_at');
      expect(userSchema?.properties).not.toHaveProperty('CreatedAt');
    });

    it('should handle multiple struct tags', async () => {
      const typesFixture = loadFixture('types.go');
      const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];

      const schema = schemas.find((s: GoSchema) => s.name === 'TagVariations');
      // Field with json, db, xml tags should use json tag for property name
      expect(schema?.properties).toHaveProperty('multi_tag');
    });

    it('should handle validation tags for required fields', async () => {
      const typesFixture = loadFixture('types.go');
      const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];

      const schema = schemas.find((s: GoSchema) => s.name === 'TagVariations');
      // Fields with validate:"required" should be in required array
      expect(schema?.required).toContain('validated');
    });

    it('should use field name when json tag is empty', async () => {
      const typesFixture = loadFixture('types.go');
      const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];

      const schema = schemas.find((s: GoSchema) => s.name === 'TagVariations');
      // Field with `json:",omitempty"` should use Go field name
      expect(schema?.properties).toHaveProperty('UseFieldName');
    });
  });

  // ============================================
  // 4. EMBEDDED STRUCT HANDLING
  // ============================================
  describe('Embedded Struct Handling', () => {
    let embeddedFixture: string;

    beforeAll(() => {
      embeddedFixture = loadFixture('embedded.go');
    });

    it('should handle anonymous struct embedding', async () => {
      const schemas = await parser.extractSchemas({ content: embeddedFixture } as GoParseOptions) as GoSchema[];

      const schema = schemas.find((s: GoSchema) => s.name === 'UserResponse');
      expect(schema).toBeDefined();
      // UserResponse embeds User - should inherit User fields or reference it
      // Option 1: Inline fields
      expect(schema?.properties).toHaveProperty('id');
      expect(schema?.properties).toHaveProperty('name');
      // Plus own field
      expect(schema?.properties).toHaveProperty('token');
    });

    it('should handle pointer embedding', async () => {
      const schemas = await parser.extractSchemas({ content: embeddedFixture } as GoParseOptions) as GoSchema[];

      const schema = schemas.find((s: GoSchema) => s.name === 'ExtendedUser');
      expect(schema).toBeDefined();
      // *Address embedding - should make embedded fields nullable or use allOf
    });

    it('should handle multiple embeddings', async () => {
      const schemas = await parser.extractSchemas({ content: embeddedFixture } as GoParseOptions) as GoSchema[];

      const schema = schemas.find((s: GoSchema) => s.name === 'CompleteProfile');
      expect(schema).toBeDefined();
      // Should have fields from all embedded types
    });

    it('should handle embedding with field override', async () => {
      const schemas = await parser.extractSchemas({ content: embeddedFixture } as GoParseOptions) as GoSchema[];

      const schema = schemas.find((s: GoSchema) => s.name === 'OverriddenUser');
      expect(schema).toBeDefined();
      // When same field name exists, the explicit field should win
    });

    it('should detect allOf pattern for composition', async () => {
      const schemas = await parser.extractSchemas({ content: embeddedFixture } as GoParseOptions) as GoSchema[];

      const schema = schemas.find((s: GoSchema) => s.name === 'ComposedType');
      // Could use allOf for type composition
      expect(schema?.allOf || schema?.properties).toBeDefined();
    });
  });

  // ============================================
  // 5. INTERFACE EXTRACTION
  // ============================================
  describe('Interface Extraction', () => {
    let interfacesFixture: string;

    beforeAll(() => {
      interfacesFixture = loadFixture('interfaces.go');
    });

    it('should extract interface definition', async () => {
      const schemas = await parser.extractSchemas({ content: interfacesFixture } as GoParseOptions) as GoSchema[];

      const repoInterface = schemas.find((s: GoSchema) => s.name === 'UserRepository');
      expect(repoInterface).toBeDefined();
    });

    it('should extract interface methods', async () => {
      const schemas = await parser.extractSchemas({ content: interfacesFixture } as GoParseOptions) as GoSchema[];

      const repoInterface = schemas.find((s: GoSchema) => s.name === 'UserRepository');
      expect(repoInterface?.methods).toBeDefined();
      expect(repoInterface?.methods?.length).toBeGreaterThan(0);
    });

    it('should extract method signatures with parameters', async () => {
      const schemas = await parser.extractSchemas({ content: interfacesFixture } as GoParseOptions) as GoSchema[];

      const repoInterface = schemas.find((s: GoSchema) => s.name === 'UserRepository');
      const getByIdMethod = repoInterface?.methods?.find(
        (m: GoMethod) => m.name === 'GetByID'
      );
      expect(getByIdMethod).toBeDefined();
      expect(getByIdMethod?.parameters).toContain('ctx');
      expect(getByIdMethod?.parameters).toContain('id');
    });

    it('should extract method return types', async () => {
      const schemas = await parser.extractSchemas({ content: interfacesFixture } as GoParseOptions) as GoSchema[];

      const repoInterface = schemas.find((s: GoSchema) => s.name === 'UserRepository');
      const getByIdMethod = repoInterface?.methods?.find(
        (m: GoMethod) => m.name === 'GetByID'
      );
      expect(getByIdMethod?.returnType).toContain('UserEntity');
      expect(getByIdMethod?.returnType).toContain('error');
    });

    it('should extract empty interface', async () => {
      const schemas = await parser.extractSchemas({ content: interfacesFixture } as GoParseOptions) as GoSchema[];

      const emptyInterface = schemas.find((s: GoSchema) => s.name === 'Serializable');
      expect(emptyInterface).toBeDefined();
      // Empty interface should have no methods
      expect(emptyInterface?.methods?.length).toBe(0);
    });

    it('should extract interface with embedded interfaces', async () => {
      const schemas = await parser.extractSchemas({ content: interfacesFixture } as GoParseOptions) as GoSchema[];

      const composedInterface = schemas.find((s: GoSchema) => s.name === 'ReadWriter');
      expect(composedInterface).toBeDefined();
      // Should contain methods from both Reader and Writer
    });
  });

  // ============================================
  // 6. TYPE CONVERSION TO NORMALIZED SCHEMA
  // ============================================
  describe('Type Conversion', () => {
    let typesFixture: string;

    beforeAll(() => {
      typesFixture = loadFixture('types.go');
    });

    describe('Primitive Types', () => {
      it('should convert string to type: string', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'PrimitiveTypes');

        expect(schema?.properties?.string_val?.type).toBe('string');
      });

      it('should convert int/int64 to type: integer', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'PrimitiveTypes');

        expect(schema?.properties?.int_val?.type).toBe('integer');
        expect(schema?.properties?.int64_val?.type).toBe('integer');
      });

      it('should convert bool to type: boolean', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'PrimitiveTypes');

        expect(schema?.properties?.bool_val?.type).toBe('boolean');
      });

      it('should convert float32/float64 to type: number', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'PrimitiveTypes');

        expect(schema?.properties?.float32_val?.type).toBe('number');
        expect(schema?.properties?.float64_val?.type).toBe('number');
      });

      it('should convert byte/rune to appropriate types', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'PrimitiveTypes');

        // byte is uint8, rune is int32
        expect(schema?.properties?.byte_val?.type).toBe('integer');
        expect(schema?.properties?.rune_val?.type).toBe('integer');
      });
    });

    describe('Pointer Types', () => {
      it('should convert *string to union with null', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'PointerTypes');

        // *string should be { type: ['string', 'null'] } or oneOf
        const stringPtr = schema?.properties?.string_ptr;
        expect(stringPtr).toBeDefined();
        expect(
          Array.isArray(stringPtr?.type)
            ? (stringPtr.type as string[]).includes('null')
            : stringPtr?.nullable === true
        ).toBe(true);
      });

      it('should convert *int64 to nullable integer', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'PointerTypes');

        const int64Ptr = schema?.properties?.int64_ptr;
        expect(int64Ptr).toBeDefined();
      });

      it('should convert *struct to nullable object reference', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'PointerTypes');

        const userPtr = schema?.properties?.user_ptr;
        expect(userPtr).toBeDefined();
      });
    });

    describe('Slice Types', () => {
      it('should convert []string to type: array with string items', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'SliceTypes');

        expect(schema?.properties?.string_slice?.type).toBe('array');
        expect(schema?.properties?.string_slice?.items?.type).toBe('string');
      });

      it('should convert []int to type: array with integer items', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'SliceTypes');

        expect(schema?.properties?.int_slice?.type).toBe('array');
        expect(schema?.properties?.int_slice?.items?.type).toBe('integer');
      });

      it('should convert []byte to string (base64)', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'SliceTypes');

        // []byte typically serializes as base64 string
        const byteSlice = schema?.properties?.byte_slice;
        expect(byteSlice?.type).toBe('string');
        expect(byteSlice?.format).toBe('byte');
      });

      it('should convert []struct to array with object items', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'SliceTypes');

        const userSlice = schema?.properties?.user_slice;
        expect(userSlice?.type).toBe('array');
        expect(userSlice?.items).toBeDefined();
      });

      it('should handle nested slices [][]string', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'SliceTypes');

        const matrix = schema?.properties?.string_matrix;
        expect(matrix?.type).toBe('array');
        expect(matrix?.items?.type).toBe('array');
        expect(matrix?.items?.items?.type).toBe('string');
      });
    });

    describe('Map Types', () => {
      it('should convert map[string]string to object with additionalProperties', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'MapTypes');

        const strMap = schema?.properties?.string_string_map;
        expect(strMap?.type).toBe('object');
        expect((strMap?.additionalProperties as GoProperty)?.type).toBe('string');
      });

      it('should convert map[string]int to object with integer additionalProperties', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'MapTypes');

        const intMap = schema?.properties?.string_int_map;
        expect(intMap?.type).toBe('object');
        expect((intMap?.additionalProperties as GoProperty)?.type).toBe('integer');
      });

      it('should convert map[string]interface{} to object with any additionalProperties', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'MapTypes');

        const anyMap = schema?.properties?.string_any_map;
        expect(anyMap?.type).toBe('object');
      });

      it('should handle nested maps', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'MapTypes');

        const nestedMap = schema?.properties?.nested_map;
        expect(nestedMap?.type).toBe('object');
        expect((nestedMap?.additionalProperties as GoProperty)?.type).toBe('object');
      });
    });

    describe('Interface Types', () => {
      it('should convert interface{} to any', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'InterfaceTypes');

        const anyVal = schema?.properties?.any_value;
        // interface{} should be {} or not have a type constraint
        expect(anyVal).toBeDefined();
      });

      it('should convert any (Go 1.18) to any', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'InterfaceTypes');

        const anyAlias = schema?.properties?.any_alias;
        expect(anyAlias).toBeDefined();
      });
    });

    describe('Time Types', () => {
      it('should convert time.Time to string with date-time format', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'TimeTypes');

        const createdAt = schema?.properties?.created_at;
        expect(createdAt?.type).toBe('string');
        expect(createdAt?.format).toBe('date-time');
      });

      it('should convert *time.Time to nullable date-time string', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'TimeTypes');

        const expiresAt = schema?.properties?.expires_at;
        expect(expiresAt).toBeDefined();
        // Should be nullable
      });

      it('should convert time.Duration to integer', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'TimeTypes');

        const timeout = schema?.properties?.timeout;
        expect(timeout?.type).toBe('integer');
      });
    });

    describe('JSON Types', () => {
      it('should convert json.RawMessage to any', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'JSONTypes');

        const rawData = schema?.properties?.raw_data;
        // json.RawMessage is passthrough - should be any/object
        expect(rawData).toBeDefined();
      });
    });

    describe('Type Aliases', () => {
      it('should resolve type aliases to underlying type', async () => {
        const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];
        const schema = schemas.find((s: GoSchema) => s.name === 'AliasedTypes');

        // UserID is int64 -> should be integer
        expect(schema?.properties?.id?.type).toBe('integer');
        // EmailAddr is string -> should be string
        expect(schema?.properties?.email?.type).toBe('string');
      });
    });
  });

  // ============================================
  // 7. STDLIB HTTP HANDLER DETECTION
  // ============================================
  describe('stdlib HTTP Handler Detection', () => {
    let stdlibFixture: string;

    beforeAll(() => {
      stdlibFixture = loadFixture('stdlib-handlers.go');
    });

    it('should detect http.HandleFunc routes', async () => {
      const routes = await parser.extractRoutes({ content: stdlibFixture } as GoParseOptions) as GoRoute[];

      expect(routes).toBeDefined();
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should extract path from http.HandleFunc', async () => {
      const routes = await parser.extractRoutes({ content: stdlibFixture } as GoParseOptions) as GoRoute[];

      const rootRoute = routes.find((r: GoRoute) => r.path === '/');
      expect(rootRoute).toBeDefined();

      const healthRoute = routes.find((r: GoRoute) => r.path === '/health');
      expect(healthRoute).toBeDefined();

      const usersRoute = routes.find((r: GoRoute) => r.path === '/users');
      expect(usersRoute).toBeDefined();
    });

    it('should detect mux.HandleFunc routes', async () => {
      const routes = await parser.extractRoutes({ content: stdlibFixture } as GoParseOptions) as GoRoute[];

      const aboutRoute = routes.find((r: GoRoute) => r.path === '/about');
      expect(aboutRoute).toBeDefined();

      const contactRoute = routes.find((r: GoRoute) => r.path === '/contact');
      expect(contactRoute).toBeDefined();
    });

    it('should detect http.Handle with custom handler types', async () => {
      const routes = await parser.extractRoutes({ content: stdlibFixture } as GoParseOptions) as GoRoute[];

      const healthzRoute = routes.find((r: GoRoute) => r.path === '/healthz');
      expect(healthzRoute).toBeDefined();

      const metricsRoute = routes.find((r: GoRoute) => r.path === '/metrics');
      expect(metricsRoute).toBeDefined();
    });

    it('should detect method from handler implementation', async () => {
      const routes = await parser.extractRoutes({ content: stdlibFixture } as GoParseOptions) as GoRoute[];

      // stdlib routes don't specify method in HandleFunc
      // Parser should either list as ANY or detect from handler body
      const usersRoute = routes.find((r: GoRoute) => r.path === '/users');
      expect(usersRoute?.methods).toBeDefined();
    });

    it('should handle nested API paths', async () => {
      const routes = await parser.extractRoutes({ content: stdlibFixture } as GoParseOptions) as GoRoute[];

      const apiStatusRoute = routes.find((r: GoRoute) => r.path === '/api/v1/status');
      expect(apiStatusRoute).toBeDefined();
    });
  });

  // ============================================
  // 8. CHI ROUTER DETECTION
  // ============================================
  describe('Chi Router Detection', () => {
    let chiFixture: string;

    beforeAll(() => {
      chiFixture = loadFixture('chi-router.go');
    });

    it('should detect chi.NewRouter initialization', async () => {
      const result = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should extract r.Get routes', async () => {
      const routes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];

      const healthRoute = routes.find(
        (r: GoRoute) => r.path === '/health' && r.method === 'GET'
      );
      expect(healthRoute).toBeDefined();
    });

    it('should extract r.Post routes', async () => {
      const routes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];

      const createUserRoute = routes.find(
        (r: GoRoute) => r.path === '/users' && r.method === 'POST'
      );
      expect(createUserRoute).toBeDefined();
    });

    it('should extract r.Put routes', async () => {
      const routes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];

      const updateUserRoute = routes.find(
        (r: GoRoute) => r.path.includes('/users/') && r.method === 'PUT'
      );
      expect(updateUserRoute).toBeDefined();
    });

    it('should extract r.Delete routes', async () => {
      const routes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];

      const deleteUserRoute = routes.find(
        (r: GoRoute) => r.path.includes('/users/') && r.method === 'DELETE'
      );
      expect(deleteUserRoute).toBeDefined();
    });

    it('should extract r.Patch routes', async () => {
      const routes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];

      const patchUserRoute = routes.find(
        (r: GoRoute) => r.path.includes('/users/') && r.method === 'PATCH'
      );
      expect(patchUserRoute).toBeDefined();
    });

    it('should extract Chi path parameters {param}', async () => {
      const routes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];

      const userRoute = routes.find((r: GoRoute) => r.path === '/users/{id}');
      expect(userRoute).toBeDefined();
      expect(userRoute?.pathParams).toContain('id');
    });

    it('should extract Chi path parameters with regex constraints', async () => {
      const routes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];

      // Path: /users/{id:[0-9]+}
      const numericRoute = routes.find((r: GoRoute) =>
        r.path.includes('id') && r.path.includes('[0-9]')
      );
      expect(numericRoute).toBeDefined();
    });

    it('should handle nested path parameters', async () => {
      const routes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];

      const route = routes.find(
        (r: GoRoute) => r.path === '/users/{userId}/posts/{postId}'
      );
      expect(route).toBeDefined();
      expect(route?.pathParams).toContain('userId');
      expect(route?.pathParams).toContain('postId');
    });

    it('should handle r.Route group prefixes', async () => {
      const routes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];

      // Routes inside r.Route("/api", ...) should have /api prefix
      const apiStatusRoute = routes.find((r: GoRoute) => r.path === '/api/status');
      expect(apiStatusRoute).toBeDefined();
    });

    it('should handle nested r.Route groups', async () => {
      const routes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];

      // Nested: r.Route("/api", func() { r.Route("/v1", func() { r.Get("/users", ...) }) })
      const v1UsersRoute = routes.find((r: GoRoute) => r.path === '/api/v1/users');
      expect(v1UsersRoute).toBeDefined();

      const v2UsersRoute = routes.find((r: GoRoute) => r.path === '/api/v2/users');
      expect(v2UsersRoute).toBeDefined();
    });

    it('should handle r.Mount subrouters', async () => {
      const routes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];

      // r.Mount("/api/users", userRouter())
      const mountedRoute = routes.find((r: GoRoute) =>
        r.path.startsWith('/api/users')
      );
      expect(mountedRoute).toBeDefined();
    });

    it('should handle r.MethodFunc', async () => {
      const routes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];

      // r.MethodFunc("GET", "/items", listItems)
      const itemsRoute = routes.find(
        (r: GoRoute) => r.path === '/items' && r.method === 'GET'
      );
      expect(itemsRoute).toBeDefined();
    });
  });

  // ============================================
  // 9. GIN FRAMEWORK DETECTION
  // ============================================
  describe('Gin Framework Detection', () => {
    let ginFixture: string;

    beforeAll(() => {
      ginFixture = loadFixture('gin-router.go');
    });

    it('should detect gin.Default() initialization', async () => {
      const result = await parser.extractRoutes({ content: ginFixture } as GoParseOptions) as GoRoute[];
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should extract router.GET routes', async () => {
      const routes = await parser.extractRoutes({ content: ginFixture } as GoParseOptions) as GoRoute[];

      const healthRoute = routes.find(
        (r: GoRoute) => r.path === '/health' && r.method === 'GET'
      );
      expect(healthRoute).toBeDefined();
    });

    it('should extract router.POST routes', async () => {
      const routes = await parser.extractRoutes({ content: ginFixture } as GoParseOptions) as GoRoute[];

      const createUserRoute = routes.find(
        (r: GoRoute) => r.path === '/users' && r.method === 'POST'
      );
      expect(createUserRoute).toBeDefined();
    });

    it('should extract router.PUT routes', async () => {
      const routes = await parser.extractRoutes({ content: ginFixture } as GoParseOptions) as GoRoute[];

      const updateUserRoute = routes.find(
        (r: GoRoute) => r.path.includes('/users/') && r.method === 'PUT'
      );
      expect(updateUserRoute).toBeDefined();
    });

    it('should extract router.DELETE routes', async () => {
      const routes = await parser.extractRoutes({ content: ginFixture } as GoParseOptions) as GoRoute[];

      const deleteUserRoute = routes.find(
        (r: GoRoute) => r.path.includes('/users/') && r.method === 'DELETE'
      );
      expect(deleteUserRoute).toBeDefined();
    });

    it('should extract router.PATCH routes', async () => {
      const routes = await parser.extractRoutes({ content: ginFixture } as GoParseOptions) as GoRoute[];

      const patchUserRoute = routes.find(
        (r: GoRoute) => r.path.includes('/users/') && r.method === 'PATCH'
      );
      expect(patchUserRoute).toBeDefined();
    });

    it('should extract Gin path parameters :param', async () => {
      const routes = await parser.extractRoutes({ content: ginFixture } as GoParseOptions) as GoRoute[];

      const userRoute = routes.find((r: GoRoute) => r.path === '/users/:id');
      expect(userRoute).toBeDefined();
      expect(userRoute?.pathParams).toContain('id');
    });

    it('should extract Gin wildcard parameters *param', async () => {
      const routes = await parser.extractRoutes({ content: ginFixture } as GoParseOptions) as GoRoute[];

      // Path: /files/*filepath
      const filesRoute = routes.find((r: GoRoute) => r.path.includes('*filepath'));
      expect(filesRoute).toBeDefined();
      expect(filesRoute?.pathParams).toContain('filepath');
    });

    it('should handle multiple path parameters', async () => {
      const routes = await parser.extractRoutes({ content: ginFixture } as GoParseOptions) as GoRoute[];

      const route = routes.find(
        (r: GoRoute) => r.path === '/users/:userId/posts/:postId'
      );
      expect(route).toBeDefined();
      expect(route?.pathParams).toContain('userId');
      expect(route?.pathParams).toContain('postId');
    });

    it('should handle router.Group prefixes', async () => {
      const routes = await parser.extractRoutes({ content: ginFixture } as GoParseOptions) as GoRoute[];

      // Routes inside router.Group("/api") should have /api prefix
      const apiStatusRoute = routes.find((r: GoRoute) => r.path === '/api/status');
      expect(apiStatusRoute).toBeDefined();
    });

    it('should handle nested groups', async () => {
      const routes = await parser.extractRoutes({ content: ginFixture } as GoParseOptions) as GoRoute[];

      // api.Group("/v1") inside router.Group("/api")
      const v1UsersRoute = routes.find((r: GoRoute) => r.path === '/api/v1/users');
      expect(v1UsersRoute).toBeDefined();

      const v2UsersRoute = routes.find((r: GoRoute) => r.path === '/api/v2/users');
      expect(v2UsersRoute).toBeDefined();
    });

    it('should handle router.Any', async () => {
      const routes = await parser.extractRoutes({ content: ginFixture } as GoParseOptions) as GoRoute[];

      // router.Any("/universal", ...) should register all methods
      const universalRoutes = routes.filter((r: GoRoute) => r.path === '/universal');
      expect(universalRoutes.length).toBeGreaterThan(0);
      // Should have multiple methods or special ANY indicator
    });

    it('should handle router.Handle with explicit method', async () => {
      const routes = await parser.extractRoutes({ content: ginFixture } as GoParseOptions) as GoRoute[];

      // router.Handle("GET", "/items", ...)
      const getItemsRoute = routes.find(
        (r: GoRoute) => r.path === '/items' && r.method === 'GET'
      );
      expect(getItemsRoute).toBeDefined();
    });
  });

  // ============================================
  // 10. ROUTE PARAMETER EXTRACTION
  // ============================================
  describe('Route Parameter Extraction', () => {
    it('should extract Chi-style {param} parameters', async () => {
      const chiFixture = loadFixture('chi-router.go');
      const routes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];

      const route = routes.find((r: GoRoute) => r.path.includes('{id}'));
      expect(route?.pathParams).toContain('id');
    });

    it('should extract Chi-style {param:regex} parameters', async () => {
      const chiFixture = loadFixture('chi-router.go');
      const routes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];

      // {id:[0-9]+} should extract 'id' as param name
      const route = routes.find((r: GoRoute) => r.path.includes('{id:'));
      expect(route?.pathParams).toContain('id');
    });

    it('should extract Gin-style :param parameters', async () => {
      const ginFixture = loadFixture('gin-router.go');
      const routes = await parser.extractRoutes({ content: ginFixture } as GoParseOptions) as GoRoute[];

      const route = routes.find((r: GoRoute) => r.path.includes(':id'));
      expect(route?.pathParams).toContain('id');
    });

    it('should extract Gin-style *param wildcard parameters', async () => {
      const ginFixture = loadFixture('gin-router.go');
      const routes = await parser.extractRoutes({ content: ginFixture } as GoParseOptions) as GoRoute[];

      const route = routes.find((r: GoRoute) => r.path.includes('*filepath'));
      expect(route?.pathParams).toContain('filepath');
    });

    it('should extract multiple parameters from path', async () => {
      const chiFixture = loadFixture('chi-router.go');
      const routes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];

      const route = routes.find(
        (r: GoRoute) =>
          r.path.includes('userId') &&
          r.path.includes('postId') &&
          r.path.includes('commentId')
      );
      expect(route?.pathParams).toContain('userId');
      expect(route?.pathParams).toContain('postId');
      expect(route?.pathParams).toContain('commentId');
    });

    it('should normalize different parameter styles to consistent format', async () => {
      const chiFixture = loadFixture('chi-router.go');
      const ginFixture = loadFixture('gin-router.go');

      const chiRoutes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];
      const ginRoutes = await parser.extractRoutes({ content: ginFixture } as GoParseOptions) as GoRoute[];

      // Both should extract 'id' parameter regardless of syntax style
      const chiUserRoute = chiRoutes.find((r: GoRoute) =>
        r.pathParams?.includes('id')
      );
      const ginUserRoute = ginRoutes.find((r: GoRoute) =>
        r.pathParams?.includes('id')
      );

      expect(chiUserRoute?.pathParams).toContain('id');
      expect(ginUserRoute?.pathParams).toContain('id');
    });
  });

  // ============================================
  // 11. ERROR HANDLING
  // ============================================
  describe('Error Handling', () => {
    it('should handle invalid Go syntax gracefully', async () => {
      const invalidFixture = loadFixture('invalid.go');

      // Should not throw, should return partial results or empty
      await expect(
        parser.extractSchemas({ content: invalidFixture } as GoParseOptions)
      ).resolves.toBeDefined();
    });

    it('should return empty array for completely invalid input', async () => {
      const garbage = 'this is not go code at all }{][';

      const schemas = await parser.extractSchemas({ content: garbage } as GoParseOptions) as GoSchema[];
      expect(Array.isArray(schemas)).toBe(true);
    });

    it('should handle empty file', async () => {
      const schemas = await parser.extractSchemas({ content: '' } as GoParseOptions) as GoSchema[];
      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas.length).toBe(0);
    });

    it('should handle file with only comments', async () => {
      const commentsOnly = `
        // This is a comment
        /* This is a block comment */
        // package models
      `;

      const schemas = await parser.extractSchemas({ content: commentsOnly } as GoParseOptions) as GoSchema[];
      expect(Array.isArray(schemas)).toBe(true);
    });

    it('should handle file with only package declaration', async () => {
      const packageOnly = 'package main';

      const schemas = await parser.extractSchemas({ content: packageOnly } as GoParseOptions) as GoSchema[];
      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas.length).toBe(0);
    });

    it('should handle malformed struct tags', async () => {
      const malformedTags = `
        package models
        
        type BadTags struct {
          Field1 string \`json:"unclosed
          Field2 string \`json:\`
        }
      `;

      // Should not throw
      const schemas = await parser.extractSchemas({ content: malformedTags } as GoParseOptions) as GoSchema[];
      expect(Array.isArray(schemas)).toBe(true);
    });

    it('should handle unknown types gracefully', async () => {
      const unknownTypes = `
        package models
        
        type WithUnknown struct {
          Field1 UnknownType \`json:"field1"\`
          Field2 pkg.Type    \`json:"field2"\`
        }
      `;

      const schemas = await parser.extractSchemas({ content: unknownTypes } as GoParseOptions) as GoSchema[];
      expect(Array.isArray(schemas)).toBe(true);
      // Unknown types should be treated as any or object
    });

    it('should handle circular type references', async () => {
      const typesFixture = loadFixture('types.go');
      const schemas = await parser.extractSchemas({ content: typesFixture } as GoParseOptions) as GoSchema[];

      // CircularType has Children []CircularType - should not infinite loop
      const circularSchema = schemas.find((s: GoSchema) => s.name === 'CircularType');
      expect(circularSchema).toBeDefined();
    });

    it('should provide meaningful error context', async () => {
      const invalidFixture = loadFixture('invalid.go');

      const result = await parser.extractSchemas({
        content: invalidFixture,
        filePath: 'test/invalid.go',
      } as GoParseOptions) as GoSchema[];

      // If errors are reported, they should include file path
      // This tests error reporting, not necessarily throwing
      expect(result).toBeDefined();
    });
  });

  // ============================================
  // INTEGRATION: PRODUCER SCHEMA EXTRACTION
  // ============================================
  describe('Producer Schema Extraction', () => {
    it('should return ProducerSchema format', async () => {
      const structsFixture = loadFixture('structs.go');

      const schemas = await parser.extractSchemas({ content: structsFixture } as GoParseOptions) as GoSchema[];

      // Should conform to ProducerSchema structure
      const schema = schemas[0];
      expect(schema).toHaveProperty('name');
      expect(schema).toHaveProperty('type');
    });

    it('should include source location information', async () => {
      const structsFixture = loadFixture('structs.go');

      const schemas = await parser.extractSchemas({
        content: structsFixture,
        filePath: 'structs.go',
      } as GoParseOptions) as GoSchema[];

      const schema = schemas.find((s: GoSchema) => s.name === 'User');
      expect(schema?.sourceLocation).toBeDefined();
      expect(schema?.sourceLocation?.file).toBe('structs.go');
      expect(schema?.sourceLocation?.line).toBeGreaterThan(0);
    });

    it('should handle both struct and route extraction', async () => {
      const chiFixture = loadFixture('chi-router.go');

      const schemas = await parser.extractSchemas({ content: chiFixture } as GoParseOptions) as GoSchema[];
      const routes = await parser.extractRoutes({ content: chiFixture } as GoParseOptions) as GoRoute[];

      // Should extract ChiUser struct
      const userSchema = schemas.find((s: GoSchema) => s.name === 'ChiUser');
      expect(userSchema).toBeDefined();

      // Should extract routes
      expect(routes.length).toBeGreaterThan(0);
    });
  });
});
