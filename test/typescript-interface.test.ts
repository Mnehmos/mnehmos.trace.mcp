/**
 * Tests for TypeScript Interface/Type Extraction
 * 
 * Tests the new extractInterfaces() and extractAll() methods on TypeScriptParser.
 * These tests are written BEFORE implementation (TDD Red Phase).
 * 
 * ADR Reference: .context/ADR-P1-2-TYPESCRIPT-INTERFACE.md
 * 
 * SchemaRef ID Format:
 *   {type}:{name}@{filePath}
 * 
 * Types:
 *   - interface:User@./types.ts
 *   - type:Status@./types.ts
 *   - enum:Priority@./types.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';

// Import the parser - these methods will fail until implementation exists
import { TypeScriptParser } from '../src/languages/typescript.js';

import type { 
  NormalizedSchema, 
  NormalizedType,
  PropertyDef,
} from '../src/core/types.js';

import type { ExtractOptions } from '../src/languages/base.js';

// ============================================================================
// Type Extensions for Testing (methods that don't exist yet)
// ============================================================================

/**
 * Extended parser interface for testing new methods.
 * These methods are expected to be implemented on TypeScriptParser.
 */
interface TypeScriptParserExtended {
  extractInterfaces(options: ExtractOptions): Promise<NormalizedSchema[]>;
  extractAll(options: ExtractOptions): Promise<NormalizedSchema[]>;
}

// Cast parser to extended type - will fail at runtime until implemented
function getExtendedParser(): TypeScriptParserExtended & TypeScriptParser {
  return new TypeScriptParser() as TypeScriptParserExtended & TypeScriptParser;
}

// ============================================================================
// Test Fixtures
// ============================================================================

const FIXTURE_DIR = path.resolve(process.cwd(), 'test', 'fixtures');

// ============================================================================
// Interface Extraction Tests
// ============================================================================

describe('TypeScript Interface Extraction', () => {
  let parser: TypeScriptParserExtended & TypeScriptParser;

  beforeAll(() => {
    parser = getExtendedParser();
  });

  describe('extractInterfaces() method', () => {
    it('should have extractInterfaces method on TypeScriptParser', () => {
      // This test will fail until extractInterfaces is implemented
      expect(typeof parser.extractInterfaces).toBe('function');
    });

    it('should return Promise<NormalizedSchema[]>', async () => {
      // This test will fail until extractInterfaces is implemented
      const result = await parser.extractInterfaces({ rootDir: FIXTURE_DIR });
      
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('simple interface extraction', () => {
    it('should extract simple interface with primitive types', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      // Find the User interface
      const userSchema = result.find((s: NormalizedSchema) => s.name === 'User');
      
      expect(userSchema).toBeDefined();
      expect(userSchema!.name).toBe('User');
      expect(userSchema!.properties).toHaveProperty('id');
      expect(userSchema!.properties).toHaveProperty('name');
      expect(userSchema!.properties).toHaveProperty('email');
      expect(userSchema!.required).toContain('id');
      expect(userSchema!.required).toContain('name');
      expect(userSchema!.required).not.toContain('email'); // email is optional
    });

    it('should extract interface with optional properties', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const userSchema = result.find((s: NormalizedSchema) => s.name === 'User');
      
      expect(userSchema).toBeDefined();
      
      // email property should be marked optional
      const emailProp = userSchema!.properties['email'];
      expect(emailProp).toBeDefined();
      expect(emailProp.optional).toBe(true);
      
      // id property should not be optional
      const idProp = userSchema!.properties['id'];
      expect(idProp.optional).toBe(false);
    });

    it('should extract interface with readonly properties', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const immutableSchema = result.find((s: NormalizedSchema) => s.name === 'ImmutableRecord');
      
      expect(immutableSchema).toBeDefined();
      
      // readonly properties should have readonly: true
      const idProp = immutableSchema!.properties['id'];
      expect(idProp).toBeDefined();
      expect(idProp.readonly).toBe(true);
      
      const createdAtProp = immutableSchema!.properties['createdAt'];
      expect(createdAtProp.readonly).toBe(true);
      
      // mutableField should have readonly: false
      const mutableProp = immutableSchema!.properties['mutableField'];
      expect(mutableProp.readonly).toBe(false);
    });

    it('should extract interface with nested object property', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const profileSchema = result.find((s: NormalizedSchema) => s.name === 'Profile');
      
      expect(profileSchema).toBeDefined();
      expect(profileSchema!.properties).toHaveProperty('user');
      expect(profileSchema!.properties).toHaveProperty('settings');
      
      // user property should reference User interface
      const userProp = profileSchema!.properties['user'];
      expect(userProp.type.kind).toBe('object');
      
      // settings should be an inline object type
      const settingsProp = profileSchema!.properties['settings'];
      expect(settingsProp.type.kind).toBe('object');
      
      if (settingsProp.type.kind === 'object') {
        expect(settingsProp.type.schema.properties).toHaveProperty('theme');
        expect(settingsProp.type.schema.properties).toHaveProperty('notifications');
      }
    });

    it('should extract interface with array properties', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const teamSchema = result.find((s: NormalizedSchema) => s.name === 'Team');
      
      expect(teamSchema).toBeDefined();
      
      // members should be array of User
      const membersProp = teamSchema!.properties['members'];
      expect(membersProp.type.kind).toBe('array');
      
      // tags should be array of string
      const tagsProp = teamSchema!.properties['tags'];
      expect(tagsProp.type.kind).toBe('array');
      
      if (tagsProp.type.kind === 'array') {
        expect(tagsProp.type.element).toEqual({
          kind: 'primitive',
          value: 'string',
        });
      }
    });

    it('should only extract exported interfaces', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      // InternalConfig is NOT exported, should not be in results
      const internalConfig = result.find((s: NormalizedSchema) => s.name === 'InternalConfig');
      expect(internalConfig).toBeUndefined();
      
      // User is exported, should be in results
      const user = result.find((s: NormalizedSchema) => s.name === 'User');
      expect(user).toBeDefined();
    });
  });

  describe('interface with inheritance (extends)', () => {
    it('should extract interface extending another', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const extendedUser = result.find((s: NormalizedSchema) => s.name === 'ExtendedUser');
      
      expect(extendedUser).toBeDefined();
      
      // Should have properties from User (id, name, email)
      expect(extendedUser!.properties).toHaveProperty('id');
      expect(extendedUser!.properties).toHaveProperty('name');
      expect(extendedUser!.properties).toHaveProperty('email');
      
      // Should have its own properties
      expect(extendedUser!.properties).toHaveProperty('role');
      expect(extendedUser!.properties).toHaveProperty('permissions');
    });
  });

  describe('source field and SchemaRef ID format', () => {
    it('should set source field to typescript', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const userSchema = result.find((s: NormalizedSchema) => s.name === 'User');
      
      expect(userSchema).toBeDefined();
      expect(userSchema!.source).toBeDefined();
      expect(userSchema!.source.source).toBe('typescript');
    });

    it('should format SchemaRef ID correctly for interfaces', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const userSchema = result.find((s: NormalizedSchema) => s.name === 'User');
      
      expect(userSchema).toBeDefined();
      expect(userSchema!.source.id).toMatch(/^interface:User@/);
      expect(userSchema!.source.id).toContain('sample-interfaces.ts');
    });

    it('should include source location', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const userSchema = result.find((s: NormalizedSchema) => s.name === 'User');
      
      expect(userSchema).toBeDefined();
      expect(userSchema!.location).toBeDefined();
      expect(userSchema!.location!.file).toContain('sample-interfaces.ts');
      expect(typeof userSchema!.location!.line).toBe('number');
      expect(userSchema!.location!.line).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Type Alias Extraction Tests
// ============================================================================

describe('TypeScript Type Alias Extraction', () => {
  let parser: TypeScriptParserExtended & TypeScriptParser;

  beforeAll(() => {
    parser = getExtendedParser();
  });

  describe('simple object type alias', () => {
    it('should extract simple object type alias', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      // Find the Point type alias
      const pointSchema = result.find((s: NormalizedSchema) => s.name === 'Point');
      
      expect(pointSchema).toBeDefined();
      expect(pointSchema!.properties).toHaveProperty('x');
      expect(pointSchema!.properties).toHaveProperty('y');
      expect(pointSchema!.properties).toHaveProperty('z');
      
      // x and y are required, z is optional
      expect(pointSchema!.required).toContain('x');
      expect(pointSchema!.required).toContain('y');
      expect(pointSchema!.required).not.toContain('z');
    });

    it('should format SchemaRef ID correctly for type aliases', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const pointSchema = result.find((s: NormalizedSchema) => s.name === 'Point');
      
      expect(pointSchema).toBeDefined();
      expect(pointSchema!.source.id).toMatch(/^type:Point@/);
    });
  });

  describe('string literal union type', () => {
    it('should extract string literal union type', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const statusSchema = result.find((s: NormalizedSchema) => s.name === 'Status');
      
      expect(statusSchema).toBeDefined();
      // Status is a union of literals, not an object with properties
      // It should be represented appropriately
    });
  });

  describe('intersection types', () => {
    it('should extract intersection type', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const entitySchema = result.find((s: NormalizedSchema) => s.name === 'Entity');
      
      expect(entitySchema).toBeDefined();
      
      // Entity = Base & Timestamps, should have properties from both
      expect(entitySchema!.properties).toHaveProperty('id'); // from Base
      expect(entitySchema!.properties).toHaveProperty('createdAt'); // from Timestamps
      expect(entitySchema!.properties).toHaveProperty('updatedAt'); // from Timestamps
    });
  });

  describe('union of objects', () => {
    it('should extract union of object types', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const resultSchema = result.find((s: NormalizedSchema) => s.name === 'Result');
      
      expect(resultSchema).toBeDefined();
      // Result = SuccessResult | ErrorResult
      // This should be represented as a union type
    });
  });

  describe('only exported type aliases', () => {
    it('should only extract exported type aliases', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      // InternalHelper is NOT exported
      const internalHelper = result.find((s: NormalizedSchema) => s.name === 'InternalHelper');
      expect(internalHelper).toBeUndefined();
      
      // Point is exported
      const point = result.find((s: NormalizedSchema) => s.name === 'Point');
      expect(point).toBeDefined();
    });
  });
});

// ============================================================================
// Utility Types Tests (Optional - may be deferred)
// ============================================================================

describe('TypeScript Utility Types Extraction', () => {
  let parser: TypeScriptParserExtended & TypeScriptParser;

  beforeAll(() => {
    parser = getExtendedParser();
  });

  describe('Pick utility type', () => {
    it('should resolve Pick<User, "id" | "name"> correctly', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const userSummary = result.find((s: NormalizedSchema) => s.name === 'UserSummary');
      
      expect(userSummary).toBeDefined();
      
      // Should only have id and name from FullUser
      expect(userSummary!.properties).toHaveProperty('id');
      expect(userSummary!.properties).toHaveProperty('name');
      expect(userSummary!.properties).not.toHaveProperty('email');
      expect(userSummary!.properties).not.toHaveProperty('password');
      expect(userSummary!.properties).not.toHaveProperty('age');
    });
  });

  describe('Omit utility type', () => {
    it('should resolve Omit<User, "password"> correctly', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const safeUser = result.find((s: NormalizedSchema) => s.name === 'SafeUser');
      
      expect(safeUser).toBeDefined();
      
      // Should have all properties except password
      expect(safeUser!.properties).toHaveProperty('id');
      expect(safeUser!.properties).toHaveProperty('name');
      expect(safeUser!.properties).toHaveProperty('email');
      expect(safeUser!.properties).not.toHaveProperty('password');
      expect(safeUser!.properties).toHaveProperty('age');
    });
  });

  describe('Partial utility type', () => {
    it('should resolve Partial<User> - all properties optional', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const userUpdate = result.find((s: NormalizedSchema) => s.name === 'UserUpdate');
      
      expect(userUpdate).toBeDefined();
      
      // All properties should be optional
      for (const propDef of Object.values(userUpdate!.properties) as PropertyDef[]) {
        expect(propDef.optional).toBe(true);
      }
      
      // required array should be empty
      expect(userUpdate!.required.length).toBe(0);
    });
  });

  describe('Required utility type', () => {
    it('should resolve Required<T> - all properties required', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const requiredUser = result.find((s: NormalizedSchema) => s.name === 'RequiredUser');
      
      expect(requiredUser).toBeDefined();
      
      // All properties should be required
      for (const propDef of Object.values(requiredUser!.properties) as PropertyDef[]) {
        expect(propDef.optional).toBe(false);
      }
    });
  });

  describe('Record utility type', () => {
    it('should resolve Record<string, number>', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const stringMap = result.find((s: NormalizedSchema) => s.name === 'StringMap');
      
      expect(stringMap).toBeDefined();
      
      // Record<string, number> should have additionalProperties
      expect(stringMap!.additionalProperties).toBeDefined();
    });
  });
});

// ============================================================================
// Enum Extraction Tests
// ============================================================================

describe('TypeScript Enum Extraction', () => {
  let parser: TypeScriptParserExtended & TypeScriptParser;

  beforeAll(() => {
    parser = getExtendedParser();
  });

  describe('numeric enum', () => {
    it('should extract numeric enum', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const priorityEnum = result.find((s: NormalizedSchema) => s.name === 'Priority');
      
      expect(priorityEnum).toBeDefined();
      expect(priorityEnum!.source.id).toMatch(/^enum:Priority@/);
    });
  });

  describe('string enum', () => {
    it('should extract string enum', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const statusEnum = result.find((s: NormalizedSchema) => s.name === 'StatusEnum');
      
      expect(statusEnum).toBeDefined();
      expect(statusEnum!.source.id).toMatch(/^enum:StatusEnum@/);
    });
  });
});

// ============================================================================
// Type Mapping Tests
// ============================================================================

describe('TypeScript Type Mapping', () => {
  let parser: TypeScriptParserExtended & TypeScriptParser;

  beforeAll(() => {
    parser = getExtendedParser();
  });

  describe('primitive type mapping', () => {
    it('should map string to NormalizedType primitive', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const userSchema = result.find((s: NormalizedSchema) => s.name === 'User');
      const idProp = userSchema!.properties['id'];
      
      expect(idProp.type).toEqual({
        kind: 'primitive',
        value: 'string',
      });
    });

    it('should map number to NormalizedType primitive', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const pointSchema = result.find((s: NormalizedSchema) => s.name === 'Point');
      const xProp = pointSchema!.properties['x'];
      
      expect(xProp.type).toEqual({
        kind: 'primitive',
        value: 'number',
      });
    });

    it('should map boolean to NormalizedType primitive', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const profileSchema = result.find((s: NormalizedSchema) => s.name === 'Profile');
      
      // Access nested settings.notifications
      if (profileSchema!.properties['settings'].type.kind === 'object') {
        const notificationsProp = profileSchema!.properties['settings'].type.schema.properties['notifications'];
        
        expect(notificationsProp.type).toEqual({
          kind: 'primitive',
          value: 'boolean',
        });
      }
    });
  });

  describe('array type mapping', () => {
    it('should map string[] to array of primitive string', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const teamSchema = result.find((s: NormalizedSchema) => s.name === 'Team');
      const tagsProp = teamSchema!.properties['tags'];
      
      expect(tagsProp.type.kind).toBe('array');
      
      if (tagsProp.type.kind === 'array') {
        expect(tagsProp.type.element).toEqual({
          kind: 'primitive',
          value: 'string',
        });
      }
    });

    it('should map Array<number> to array of primitive number', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const arrayTypesSchema = result.find((s: NormalizedSchema) => s.name === 'ArrayTypes');
      const numbersProp = arrayTypesSchema!.properties['numbers'];
      
      expect(numbersProp.type.kind).toBe('array');
      
      if (numbersProp.type.kind === 'array') {
        expect(numbersProp.type.element).toEqual({
          kind: 'primitive',
          value: 'number',
        });
      }
    });
  });

  describe('union type mapping', () => {
    it('should map union types correctly', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const nullableSchema = result.find((s: NormalizedSchema) => s.name === 'NullableFields');
      const maybeNullProp = nullableSchema!.properties['maybeNull'];
      
      // string | null should either be:
      // 1. Type with nullable: true
      // 2. Or union of string and null
      expect(maybeNullProp.nullable).toBe(true);
    });
  });

  describe('intersection type mapping', () => {
    it('should map intersection types correctly', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const entitySchema = result.find((s: NormalizedSchema) => s.name === 'Entity');
      
      // Entity = Base & Timestamps - properties merged
      expect(entitySchema).toBeDefined();
      expect(entitySchema!.properties).toHaveProperty('id');
      expect(entitySchema!.properties).toHaveProperty('createdAt');
      expect(entitySchema!.properties).toHaveProperty('updatedAt');
    });
  });

  describe('nullable property mapping', () => {
    it('should mark nullable properties with nullable: true', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const nullableSchema = result.find((s: NormalizedSchema) => s.name === 'NullableFields');
      
      // maybeNull: string | null
      const maybeNullProp = nullableSchema!.properties['maybeNull'];
      expect(maybeNullProp.nullable).toBe(true);
      expect(maybeNullProp.optional).toBe(false);
      
      // maybeUndefined: string | undefined
      const maybeUndefinedProp = nullableSchema!.properties['maybeUndefined'];
      expect(maybeUndefinedProp.optional).toBe(true);
      
      // both: string | null | undefined
      const bothProp = nullableSchema!.properties['both'];
      expect(bothProp.nullable).toBe(true);
      expect(bothProp.optional).toBe(true);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('TypeScript extractAll() Integration', () => {
  let parser: TypeScriptParserExtended & TypeScriptParser;

  beforeAll(() => {
    parser = getExtendedParser();
  });

  describe('extractAll() method', () => {
    it('should have extractAll method on TypeScriptParser', () => {
      expect(typeof parser.extractAll).toBe('function');
    });

    it('should return both Zod and interface schemas', async () => {
      // This test will fail until extractAll is implemented
      const result = await parser.extractAll({ rootDir: FIXTURE_DIR });
      
      expect(result).toBeInstanceOf(Array);
    });

    it('should include source: "typescript" for interface schemas', async () => {
      const result = await parser.extractAll({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      // Filter to only interface/type schemas
      const tsSchemas = result.filter((s: NormalizedSchema) => s.source?.source === 'typescript');
      
      expect(tsSchemas.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// PropertyDef Structure Tests
// ============================================================================

describe('TypeScript PropertyDef Structure', () => {
  let parser: TypeScriptParserExtended & TypeScriptParser;

  beforeAll(() => {
    parser = getExtendedParser();
  });

  it('should include all PropertyDef required fields', async () => {
    const result = await parser.extractInterfaces({ 
      rootDir: FIXTURE_DIR,
      include: ['sample-interfaces.ts'],
    });
    
    const userSchema = result.find((s: NormalizedSchema) => s.name === 'User');
    
    for (const propDef of Object.values(userSchema!.properties) as PropertyDef[]) {
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

  it('should include description from JSDoc when available', async () => {
    const result = await parser.extractInterfaces({ 
      rootDir: FIXTURE_DIR,
      include: ['sample-interfaces.ts'],
    });
    
    const userSchema = result.find((s: NormalizedSchema) => s.name === 'User');
    
    // id property has JSDoc comment
    const idProp = userSchema!.properties['id'];
    expect(idProp.description).toBe('Unique user identifier');
    
    // name property has JSDoc comment
    const nameProp = userSchema!.properties['name'];
    expect(nameProp.description).toBe("User's display name");
  });

  it('should detect @deprecated JSDoc tag', async () => {
    const result = await parser.extractInterfaces({ 
      rootDir: FIXTURE_DIR,
      include: ['sample-interfaces.ts'],
    });
    
    const deprecatedSchema = result.find((s: NormalizedSchema) => s.name === 'WithDeprecated');
    
    expect(deprecatedSchema).toBeDefined();
    
    // legacy property has @deprecated JSDoc tag
    const legacyProp = deprecatedSchema!.properties['legacy'];
    expect(legacyProp.deprecated).toBe(true);
    
    // current property is not deprecated
    const currentProp = deprecatedSchema!.properties['current'];
    expect(currentProp.deprecated).toBe(false);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('TypeScript Interface Edge Cases', () => {
  let parser: TypeScriptParserExtended & TypeScriptParser;

  beforeAll(() => {
    parser = getExtendedParser();
  });

  describe('generic interfaces', () => {
    it('should handle generic interface', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const containerSchema = result.find((s: NormalizedSchema) => s.name === 'Container');
      
      // Container<T> is a generic interface
      // It should still be extractable (T becomes unknown or any)
      expect(containerSchema).toBeDefined();
      expect(containerSchema!.properties).toHaveProperty('value');
      expect(containerSchema!.properties).toHaveProperty('isEmpty');
    });
  });

  describe('tuple types', () => {
    it('should handle tuple type in property', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const arrayTypesSchema = result.find((s: NormalizedSchema) => s.name === 'ArrayTypes');
      const tupleProp = arrayTypesSchema!.properties['tupleType'];
      
      // [string, number] should be mapped to array (lossy per ADR)
      expect(tupleProp.type.kind).toBe('array');
    });
  });

  describe('nested arrays', () => {
    it('should handle nested arrays', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const arrayTypesSchema = result.find((s: NormalizedSchema) => s.name === 'ArrayTypes');
      const nestedArrayProp = arrayTypesSchema!.properties['nestedArray'];
      
      // number[][] should be array of array of number
      expect(nestedArrayProp.type.kind).toBe('array');
      
      if (nestedArrayProp.type.kind === 'array') {
        expect(nestedArrayProp.type.element.kind).toBe('array');
      }
    });
  });

  describe('readonly arrays', () => {
    it('should handle readonly arrays', async () => {
      const result = await parser.extractInterfaces({ 
        rootDir: FIXTURE_DIR,
        include: ['sample-interfaces.ts'],
      });
      
      const arrayTypesSchema = result.find((s: NormalizedSchema) => s.name === 'ArrayTypes');
      const readonlyArrayProp = arrayTypesSchema!.properties['readonlyStrings'];
      
      // readonly string[] should be mapped to array
      expect(readonlyArrayProp.type.kind).toBe('array');
      // The readonly-ness should be captured
      expect(readonlyArrayProp.readonly).toBe(true);
    });
  });
});
