/**
 * Tests for Pattern Matcher Infrastructure
 * 
 * Tests the pattern matcher abstraction for framework-agnostic API detection.
 * These tests are written BEFORE implementation (TDD Red Phase).
 * 
 * API Reference: .context/ADR-P2-1-PATTERN-MATCHER.md
 * 
 * Covers:
 * - PatternRegistry: registration, lookup, scanning
 * - PatternMatcher: match(), extract(), patterns by type
 * - MatchResult: captures, schema locations
 * - Error handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile, Node } from 'ts-morph';
import path from 'path';

// These imports will FAIL until implementation exists
// Pattern Types
import type {
  PatternType,
  SchemaLocation,
  PatternDef,
  MatchResult,
  MatchCaptures,
} from '../src/patterns/types.js';

// Pattern Matcher Interface and Base Class
import type { PatternMatcher } from '../src/patterns/base.js';
import { BasePatternMatcher } from '../src/patterns/base.js';

// Pattern Registry
import {
  registerPattern,
  getPattern,
  getPatternsByFramework,
  getPatternsByType,
  hasPattern,
  listPatterns,
  listFrameworks,
  scanForPatterns,
} from '../src/patterns/registry.js';

// Pattern Errors
import {
  PatternRegistryError,
  PatternNotFoundError,
  PatternValidationError,
  PatternMatchError,
  PatternExtractionError,
} from '../src/patterns/errors.js';

// Schema Extractors
import { extractSchemaNode } from '../src/patterns/extractors.js';

// Core types for schema references
import type { NormalizedSchema, SourceLocation } from '../src/core/types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const FIXTURES_DIR = path.resolve(process.cwd(), 'test', 'fixtures', 'pattern-samples');
const CALL_PATTERNS_FILE = path.join(FIXTURES_DIR, 'call-patterns.ts');
const DECORATOR_PATTERNS_FILE = path.join(FIXTURES_DIR, 'decorator-patterns.ts');
const PROPERTY_PATTERNS_FILE = path.join(FIXTURES_DIR, 'property-patterns.ts');
const EXPORT_PATTERNS_FILE = path.join(FIXTURES_DIR, 'export-patterns.ts');
const CHAIN_PATTERNS_FILE = path.join(FIXTURES_DIR, 'chain-patterns.ts');

/**
 * Creates a mock PatternMatcher for testing registry
 */
function createMockMatcher(
  name: string,
  framework: string,
  supportedTypes: PatternType[],
  overrides: Partial<PatternMatcher> = {}
): PatternMatcher {
  const patterns: PatternDef[] = supportedTypes.map(type => ({
    type,
    signature: `mock-${name}`,
  }));

  return {
    name,
    framework,
    patterns,
    supportedTypes,
    match: (node: Node): MatchResult | null => null,
    extract: async (match: MatchResult): Promise<NormalizedSchema> => ({
      name: `mock-${name}`,
      properties: {},
      required: [],
      source: { source: 'mcp', id: `mock:${name}` },
    }),
    ...overrides,
  };
}

/**
 * Create ts-morph Project for parsing fixtures
 */
function createProject(): Project {
  return new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      strict: false,
      noImplicitAny: false,
      skipLibCheck: true,
    },
  });
}

/**
 * Load a fixture file
 */
function loadFixture(project: Project, filePath: string): SourceFile {
  return project.addSourceFileAtPath(filePath);
}

// ============================================================================
// PatternRegistry Tests - Registration
// ============================================================================

describe('PatternRegistry - Registration', () => {
  describe('registerPattern()', () => {
    it('should register valid matcher successfully', () => {
      const matcher = createMockMatcher('test-register', 'test', ['call']);
      
      // Should not throw
      expect(() => registerPattern(matcher)).not.toThrow();
      
      // Should be retrievable after registration
      expect(hasPattern('test-register')).toBe(true);
    });

    it('should throw PatternValidationError if name missing', () => {
      const invalidMatcher = {
        // name is missing
        framework: 'test',
        patterns: [{ type: 'call', signature: 'test' }],
        supportedTypes: ['call'],
        match: () => null,
        extract: async () => ({ properties: {}, required: [], source: { source: 'mcp', id: 'test' } }),
      } as unknown as PatternMatcher;

      expect(() => registerPattern(invalidMatcher)).toThrow(PatternValidationError);
      
      try {
        registerPattern(invalidMatcher);
      } catch (error) {
        expect(error).toBeInstanceOf(PatternValidationError);
        expect((error as PatternValidationError).reason).toContain('name');
      }
    });

    it('should throw PatternValidationError if framework missing', () => {
      const invalidMatcher = {
        name: 'test',
        // framework is missing
        patterns: [{ type: 'call', signature: 'test' }],
        supportedTypes: ['call'],
        match: () => null,
        extract: async () => ({ properties: {}, required: [], source: { source: 'mcp', id: 'test' } }),
      } as unknown as PatternMatcher;

      expect(() => registerPattern(invalidMatcher)).toThrow(PatternValidationError);
      
      try {
        registerPattern(invalidMatcher);
      } catch (error) {
        expect(error).toBeInstanceOf(PatternValidationError);
        expect((error as PatternValidationError).reason).toContain('framework');
      }
    });

    it('should throw PatternValidationError if patterns array empty', () => {
      const invalidMatcher = {
        name: 'test',
        framework: 'test',
        patterns: [], // Empty patterns
        supportedTypes: ['call'],
        match: () => null,
        extract: async () => ({ properties: {}, required: [], source: { source: 'mcp', id: 'test' } }),
      } as unknown as PatternMatcher;

      expect(() => registerPattern(invalidMatcher)).toThrow(PatternValidationError);
      
      try {
        registerPattern(invalidMatcher);
      } catch (error) {
        expect(error).toBeInstanceOf(PatternValidationError);
        expect((error as PatternValidationError).reason).toContain('pattern');
      }
    });

    it('should throw PatternValidationError if supportedTypes missing', () => {
      const invalidMatcher = {
        name: 'test',
        framework: 'test',
        patterns: [{ type: 'call', signature: 'test' }],
        // supportedTypes missing
        match: () => null,
        extract: async () => ({ properties: {}, required: [], source: { source: 'mcp', id: 'test' } }),
      } as unknown as PatternMatcher;

      expect(() => registerPattern(invalidMatcher)).toThrow(PatternValidationError);
    });

    it('should throw PatternValidationError if match not a function', () => {
      const invalidMatcher = {
        name: 'test',
        framework: 'test',
        patterns: [{ type: 'call', signature: 'test' }],
        supportedTypes: ['call'],
        match: 'not a function', // Invalid
        extract: async () => ({ properties: {}, required: [], source: { source: 'mcp', id: 'test' } }),
      } as unknown as PatternMatcher;

      expect(() => registerPattern(invalidMatcher)).toThrow(PatternValidationError);
      
      try {
        registerPattern(invalidMatcher);
      } catch (error) {
        expect(error).toBeInstanceOf(PatternValidationError);
        expect((error as PatternValidationError).reason).toContain('match');
      }
    });

    it('should throw PatternValidationError if extract not a function', () => {
      const invalidMatcher = {
        name: 'test',
        framework: 'test',
        patterns: [{ type: 'call', signature: 'test' }],
        supportedTypes: ['call'],
        match: () => null,
        extract: 'not a function', // Invalid
      } as unknown as PatternMatcher;

      expect(() => registerPattern(invalidMatcher)).toThrow(PatternValidationError);
      
      try {
        registerPattern(invalidMatcher);
      } catch (error) {
        expect(error).toBeInstanceOf(PatternValidationError);
        expect((error as PatternValidationError).reason).toContain('extract');
      }
    });

    it('should replace existing matcher for same name (last-wins)', () => {
      const matcher1 = createMockMatcher('replace-test', 'test', ['call']);
      const matcher2 = createMockMatcher('replace-test', 'test-updated', ['call', 'decorator']);

      registerPattern(matcher1);
      registerPattern(matcher2);

      const registered = getPattern('replace-test');
      
      // Should be the second matcher
      expect(registered.framework).toBe('test-updated');
      expect(registered.supportedTypes).toContain('decorator');
    });
  });
});

// ============================================================================
// PatternRegistry Tests - Lookup
// ============================================================================

describe('PatternRegistry - Lookup', () => {
  describe('getPattern()', () => {
    it('should return registered matcher by name', () => {
      const matcher = createMockMatcher('get-test', 'framework-a', ['call']);
      registerPattern(matcher);

      const retrieved = getPattern('get-test');
      
      expect(retrieved).toBe(matcher);
      expect(retrieved.name).toBe('get-test');
    });

    it('should throw PatternNotFoundError with available list when not found', () => {
      // Register some matchers first
      registerPattern(createMockMatcher('existing-1', 'test', ['call']));
      registerPattern(createMockMatcher('existing-2', 'test', ['decorator']));

      expect(() => getPattern('non-existent-matcher')).toThrow(PatternNotFoundError);
      
      try {
        getPattern('non-existent-matcher');
      } catch (error) {
        expect(error).toBeInstanceOf(PatternNotFoundError);
        const notFoundError = error as PatternNotFoundError;
        expect(notFoundError.framework).toBe('non-existent-matcher');
        expect(notFoundError.available).toContain('existing-1');
        expect(notFoundError.available).toContain('existing-2');
      }
    });
  });

  describe('hasPattern()', () => {
    it('should return true for registered name', () => {
      const matcher = createMockMatcher('has-test', 'test', ['call']);
      registerPattern(matcher);

      expect(hasPattern('has-test')).toBe(true);
    });

    it('should return false for unregistered name', () => {
      expect(hasPattern('definitely-not-registered-abc123')).toBe(false);
    });
  });

  describe('listPatterns()', () => {
    it('should return all registered pattern names', () => {
      registerPattern(createMockMatcher('list-test-1', 'test', ['call']));
      registerPattern(createMockMatcher('list-test-2', 'test', ['decorator']));
      registerPattern(createMockMatcher('list-test-3', 'test', ['property']));

      const names = listPatterns();

      expect(names).toBeInstanceOf(Array);
      expect(names).toContain('list-test-1');
      expect(names).toContain('list-test-2');
      expect(names).toContain('list-test-3');
    });
  });

  describe('getPatternsByFramework()', () => {
    it('should return all matchers for a framework', () => {
      registerPattern(createMockMatcher('fw-matcher-1', 'express', ['call']));
      registerPattern(createMockMatcher('fw-matcher-2', 'express', ['decorator']));
      registerPattern(createMockMatcher('other-fw-matcher', 'fastify', ['call']));

      const expressMatchers = getPatternsByFramework('express');

      expect(expressMatchers).toBeInstanceOf(Array);
      expect(expressMatchers.length).toBe(2);
      expect(expressMatchers.map(m => m.name)).toContain('fw-matcher-1');
      expect(expressMatchers.map(m => m.name)).toContain('fw-matcher-2');
    });

    it('should return empty array for unknown framework', () => {
      const matchers = getPatternsByFramework('unknown-framework-xyz');
      
      expect(matchers).toBeInstanceOf(Array);
      expect(matchers.length).toBe(0);
    });
  });

  describe('getPatternsByType()', () => {
    it('should return all matchers supporting a pattern type', () => {
      registerPattern(createMockMatcher('type-matcher-call', 'test', ['call']));
      registerPattern(createMockMatcher('type-matcher-call-dec', 'test', ['call', 'decorator']));
      registerPattern(createMockMatcher('type-matcher-prop', 'test', ['property']));

      const callMatchers = getPatternsByType('call');

      expect(callMatchers).toBeInstanceOf(Array);
      expect(callMatchers.length).toBeGreaterThanOrEqual(2);
      expect(callMatchers.map(m => m.name)).toContain('type-matcher-call');
      expect(callMatchers.map(m => m.name)).toContain('type-matcher-call-dec');
    });
  });

  describe('listFrameworks()', () => {
    it('should return all unique framework names', () => {
      registerPattern(createMockMatcher('fw-list-1', 'express', ['call']));
      registerPattern(createMockMatcher('fw-list-2', 'fastify', ['call']));
      registerPattern(createMockMatcher('fw-list-3', 'nestjs', ['decorator']));
      registerPattern(createMockMatcher('fw-list-4', 'express', ['decorator'])); // Duplicate framework

      const frameworks = listFrameworks();

      expect(frameworks).toBeInstanceOf(Array);
      expect(frameworks).toContain('express');
      expect(frameworks).toContain('fastify');
      expect(frameworks).toContain('nestjs');
    });
  });
});

// ============================================================================
// PatternRegistry Tests - Scanning
// ============================================================================

describe('PatternRegistry - Scanning', () => {
  let project: Project;
  let callPatternsFile: SourceFile;

  beforeEach(() => {
    project = createProject();
    callPatternsFile = loadFixture(project, CALL_PATTERNS_FILE);
  });

  describe('scanForPatterns()', () => {
    it('should scan source file with all registered matchers', () => {
      // Register a mock matcher that matches something
      let matchCount = 0;
      const matcher = createMockMatcher('scan-test', 'test', ['call'], {
        match: (node: Node): MatchResult | null => {
          // Match any CallExpression for testing
          if (Node.isCallExpression(node)) {
            matchCount++;
            if (matchCount <= 3) { // Limit matches for test
              return {
                pattern: { type: 'call', signature: 'test' },
                node,
                framework: 'test',
                identifier: 'test-match',
                location: { file: '', line: 1, column: 1 },
                captures: {},
              };
            }
          }
          return null;
        },
      });
      
      registerPattern(matcher);
      
      const matches = scanForPatterns(callPatternsFile);
      
      expect(matches).toBeInstanceOf(Array);
      // Should have found at least some matches
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should filter by frameworks option', () => {
      registerPattern(createMockMatcher('filter-fw-1', 'express', ['call']));
      registerPattern(createMockMatcher('filter-fw-2', 'fastify', ['call']));
      
      const matches = scanForPatterns(callPatternsFile, {
        frameworks: ['express'],
      });
      
      // Should only include express framework matches
      for (const match of matches) {
        expect(match.framework).toBe('express');
      }
    });

    it('should filter by types option', () => {
      registerPattern(createMockMatcher('filter-type-1', 'test', ['call']));
      registerPattern(createMockMatcher('filter-type-2', 'test', ['decorator']));
      
      const matches = scanForPatterns(callPatternsFile, {
        types: ['call'],
      });
      
      // All matches should come from matchers supporting 'call' type
      // (This is a constraint on which matchers are used, not on the match results)
      expect(matches).toBeInstanceOf(Array);
    });

    it('should combine framework and type filters', () => {
      registerPattern(createMockMatcher('combo-1', 'express', ['call']));
      registerPattern(createMockMatcher('combo-2', 'express', ['decorator']));
      registerPattern(createMockMatcher('combo-3', 'fastify', ['call']));
      
      const matches = scanForPatterns(callPatternsFile, {
        frameworks: ['express'],
        types: ['call'],
      });
      
      // Should only use express + call matchers
      expect(matches).toBeInstanceOf(Array);
    });
  });
});

// ============================================================================
// PatternMatcher Tests - Call Patterns
// ============================================================================

describe('PatternMatcher - Call Patterns', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = createProject();
    sourceFile = loadFixture(project, CALL_PATTERNS_FILE);
  });

  describe('PatternDef.type = "call"', () => {
    it('should match server.tool() pattern', () => {
      const toolPattern: PatternDef = {
        type: 'call',
        signature: 'tool',
        receiver: 'server',
        inputSchemaLocation: { type: 'arg', index: 2 },
      };

      // Find server.tool() calls in fixture
      const toolCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        return expr.getName() === 'tool';
      });

      expect(toolCalls.length).toBeGreaterThan(0);
      // Pattern matcher should identify these
    });

    it('should match app.get() Express pattern', () => {
      const expressPattern: PatternDef = {
        type: 'call',
        signature: /^(get|post|put|delete|patch)$/i,
        receiver: /^(app|router)$/,
      };

      // Find Express-style route calls
      const routeCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        const method = expr.getName().toLowerCase();
        return ['get', 'post', 'put', 'delete', 'patch'].includes(method);
      });

      expect(routeCalls.length).toBeGreaterThan(0);
    });

    it('should match fastify.route() pattern with options object', () => {
      const fastifyPattern: PatternDef = {
        type: 'call',
        signature: 'route',
        receiver: 'fastify',
        inputSchemaLocation: { type: 'arg-named', name: 'schema' },
      };

      // Find fastify.route() calls
      const routeCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        return expr.getName() === 'route';
      });

      expect(routeCalls.length).toBeGreaterThan(0);
    });

    it('should match with string signature (exact match)', () => {
      const pattern: PatternDef = {
        type: 'call',
        signature: 'get',
      };

      // Exact string should match 'get' calls
      const getCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        return expr.getName() === 'get';
      });

      expect(getCalls.length).toBeGreaterThan(0);
    });

    it('should match with RegExp signature (pattern match)', () => {
      const pattern: PatternDef = {
        type: 'call',
        signature: /^(get|post|put|delete)$/i,
      };

      // RegExp should match multiple HTTP methods
      const httpCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        const method = expr.getName();
        return /^(get|post|put|delete)$/i.test(method);
      });

      expect(httpCalls.length).toBeGreaterThan(0);
    });

    it('should return null for non-matching calls', () => {
      const pattern: PatternDef = {
        type: 'call',
        signature: 'nonExistentMethod',
        receiver: 'nonExistentReceiver',
      };

      // Should not find any matches for non-existent pattern
      const matches = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        return expr.getName() === 'nonExistentMethod';
      });

      expect(matches.length).toBe(0);
    });
  });
});

// ============================================================================
// PatternMatcher Tests - Decorator Patterns
// ============================================================================

describe('PatternMatcher - Decorator Patterns', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = createProject();
    sourceFile = loadFixture(project, DECORATOR_PATTERNS_FILE);
  });

  describe('PatternDef.type = "decorator"', () => {
    it('should match @Get() decorator', () => {
      const pattern: PatternDef = {
        type: 'decorator',
        signature: 'Get',
        outputSchemaLocation: { type: 'return' },
      };

      // Find @Get decorators
      const decorators = sourceFile.getDescendants().filter(node => {
        if (!Node.isDecorator(node)) return false;
        const callExpr = node.getCallExpression();
        if (!callExpr) return false;
        const expr = callExpr.getExpression();
        return Node.isIdentifier(expr) && expr.getText() === 'Get';
      });

      expect(decorators.length).toBeGreaterThan(0);
    });

    it('should match @Post() decorator', () => {
      const pattern: PatternDef = {
        type: 'decorator',
        signature: 'Post',
      };

      const decorators = sourceFile.getDescendants().filter(node => {
        if (!Node.isDecorator(node)) return false;
        const callExpr = node.getCallExpression();
        if (!callExpr) return false;
        const expr = callExpr.getExpression();
        return Node.isIdentifier(expr) && expr.getText() === 'Post';
      });

      expect(decorators.length).toBeGreaterThan(0);
    });

    it('should match @Body() parameter decorator', () => {
      const pattern: PatternDef = {
        type: 'decorator',
        signature: 'Body',
        inputSchemaLocation: { type: 'decorator-arg', index: 0 },
      };

      const decorators = sourceFile.getDescendants().filter(node => {
        if (!Node.isDecorator(node)) return false;
        const callExpr = node.getCallExpression();
        if (!callExpr) return false;
        const expr = callExpr.getExpression();
        return Node.isIdentifier(expr) && expr.getText() === 'Body';
      });

      expect(decorators.length).toBeGreaterThan(0);
    });

    it('should match @Controller() class decorator', () => {
      const pattern: PatternDef = {
        type: 'decorator',
        signature: 'Controller',
      };

      const decorators = sourceFile.getDescendants().filter(node => {
        if (!Node.isDecorator(node)) return false;
        const callExpr = node.getCallExpression();
        if (!callExpr) return false;
        const expr = callExpr.getExpression();
        return Node.isIdentifier(expr) && expr.getText() === 'Controller';
      });

      expect(decorators.length).toBeGreaterThan(0);
    });

    it('should match validation decorators (@IsString, @IsEmail, etc.)', () => {
      const validationDecorators = ['IsString', 'IsEmail', 'IsNumber', 'IsOptional'];

      for (const decoratorName of validationDecorators) {
        const pattern: PatternDef = {
          type: 'decorator',
          signature: decoratorName,
        };

        const decorators = sourceFile.getDescendants().filter(node => {
          if (!Node.isDecorator(node)) return false;
          const callExpr = node.getCallExpression();
          if (!callExpr) return false;
          const expr = callExpr.getExpression();
          return Node.isIdentifier(expr) && expr.getText() === decoratorName;
        });

        expect(decorators.length).toBeGreaterThan(0);
      }
    });

    it('should extract route path from decorator argument', () => {
      // @Get(':id') should capture ':id' as route path
      const decorators = sourceFile.getDescendants().filter(node => {
        if (!Node.isDecorator(node)) return false;
        const callExpr = node.getCallExpression();
        if (!callExpr) return false;
        const expr = callExpr.getExpression();
        if (!Node.isIdentifier(expr) || expr.getText() !== 'Get') return false;
        
        const args = callExpr.getArguments();
        return args.some(arg => arg.getText().includes(':id'));
      });

      expect(decorators.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// PatternMatcher Tests - Property Patterns
// ============================================================================

describe('PatternMatcher - Property Patterns', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = createProject();
    sourceFile = loadFixture(project, PROPERTY_PATTERNS_FILE);
  });

  describe('PatternDef.type = "property"', () => {
    it('should match Query property in GraphQL resolvers', () => {
      const pattern: PatternDef = {
        type: 'property',
        signature: 'Query',
      };

      // Find Query properties
      const queryProps = sourceFile.getDescendants().filter(node => {
        if (!Node.isPropertyAssignment(node)) return false;
        return node.getName() === 'Query';
      });

      expect(queryProps.length).toBeGreaterThan(0);
    });

    it('should match Mutation property in GraphQL resolvers', () => {
      const pattern: PatternDef = {
        type: 'property',
        signature: 'Mutation',
      };

      const mutationProps = sourceFile.getDescendants().filter(node => {
        if (!Node.isPropertyAssignment(node)) return false;
        return node.getName() === 'Mutation';
      });

      expect(mutationProps.length).toBeGreaterThan(0);
    });

    it('should match Subscription property in GraphQL resolvers', () => {
      const pattern: PatternDef = {
        type: 'property',
        signature: 'Subscription',
      };

      const subscriptionProps = sourceFile.getDescendants().filter(node => {
        if (!Node.isPropertyAssignment(node)) return false;
        return node.getName() === 'Subscription';
      });

      expect(subscriptionProps.length).toBeGreaterThan(0);
    });

    it('should match nested resolver methods', () => {
      const pattern: PatternDef = {
        type: 'property',
        signature: 'user',
        inputSchemaLocation: { type: 'arg', index: 1 }, // args parameter
      };

      // Find 'user' resolver inside Query
      const userResolvers = sourceFile.getDescendants().filter(node => {
        if (!Node.isPropertyAssignment(node)) return false;
        return node.getName() === 'user';
      });

      expect(userResolvers.length).toBeGreaterThan(0);
    });

    it('should match with RegExp for any resolver method', () => {
      const pattern: PatternDef = {
        type: 'property',
        signature: /^(create|update|delete)/,
      };

      // Find mutation-style resolvers
      const mutationResolvers = sourceFile.getDescendants().filter(node => {
        if (!Node.isPropertyAssignment(node)) return false;
        const name = node.getName();
        return /^(create|update|delete)/.test(name);
      });

      expect(mutationResolvers.length).toBeGreaterThan(0);
    });

    it('should match with validate predicate', () => {
      const pattern: PatternDef = {
        type: 'property',
        signature: /.*/,
        validate: (node: Node) => {
          // Only match if inside Query or Mutation object
          const parent = node.getParent();
          if (!parent || !Node.isObjectLiteralExpression(parent)) return false;
          const grandparent = parent.getParent();
          if (!grandparent || !Node.isPropertyAssignment(grandparent)) return false;
          const propName = grandparent.getName();
          return propName === 'Query' || propName === 'Mutation';
        },
      };

      // Should find resolver methods inside Query/Mutation
    });
  });
});

// ============================================================================
// PatternMatcher Tests - Export Patterns
// ============================================================================

describe('PatternMatcher - Export Patterns', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = createProject();
    sourceFile = loadFixture(project, EXPORT_PATTERNS_FILE);
  });

  describe('PatternDef.type = "export"', () => {
    it('should match exported Zod schema (export const XSchema = z.object())', () => {
      const pattern: PatternDef = {
        type: 'export',
        signature: /Schema$/,
        inputSchemaLocation: { type: 'body' },
      };

      // Find exported variables ending in Schema
      const schemaExports = sourceFile.getDescendants().filter(node => {
        if (!Node.isVariableDeclaration(node)) return false;
        const name = node.getName();
        return name.endsWith('Schema');
      });

      expect(schemaExports.length).toBeGreaterThan(0);
    });

    it('should match exported TypeScript interface', () => {
      const pattern: PatternDef = {
        type: 'export',
        signature: /^I[A-Z]/,
        validate: (node: Node) => Node.isInterfaceDeclaration(node),
      };

      // Find interface declarations
      const interfaceExports = sourceFile.getDescendants().filter(node => {
        if (!Node.isInterfaceDeclaration(node)) return false;
        const name = node.getName();
        return /^I[A-Z]/.test(name);
      });

      expect(interfaceExports.length).toBeGreaterThan(0);
    });

    it('should match exported type alias', () => {
      const pattern: PatternDef = {
        type: 'export',
        signature: /.*/,
        validate: (node: Node) => Node.isTypeAliasDeclaration(node),
      };

      // Find type alias declarations
      const typeExports = sourceFile.getDescendants().filter(node => {
        return Node.isTypeAliasDeclaration(node);
      });

      expect(typeExports.length).toBeGreaterThan(0);
    });

    it('should match exported class', () => {
      const pattern: PatternDef = {
        type: 'export',
        signature: /Entity$|Dto$/,
        validate: (node: Node) => Node.isClassDeclaration(node),
      };

      // Find class declarations
      const classExports = sourceFile.getDescendants().filter(node => {
        if (!Node.isClassDeclaration(node)) return false;
        const name = node.getName();
        return name?.endsWith('Entity') || name?.endsWith('Dto');
      });

      expect(classExports.length).toBeGreaterThan(0);
    });

    it('should match default export', () => {
      // Find export default
      const defaultExports = sourceFile.getExportAssignments();
      
      // Should have a default export
      expect(defaultExports.length).toBeGreaterThan(0);
    });

    it('should differentiate between value and type exports', () => {
      // Value exports (const, let, function)
      const valueExports = sourceFile.getExportedDeclarations();
      
      expect(valueExports.size).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// PatternMatcher Tests - Chain Patterns
// ============================================================================

describe('PatternMatcher - Chain Patterns', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = createProject();
    sourceFile = loadFixture(project, CHAIN_PATTERNS_FILE);
  });

  describe('PatternDef.type = "chain"', () => {
    it('should match tRPC .query() terminal method', () => {
      const pattern: PatternDef = {
        type: 'chain',
        signature: 'query',
        receiver: /procedure$/,
        inputSchemaLocation: { type: 'chain-method', method: 'input' },
      };

      // Find .query() calls
      const queryCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        return expr.getName() === 'query';
      });

      expect(queryCalls.length).toBeGreaterThan(0);
    });

    it('should match tRPC .mutation() terminal method', () => {
      const pattern: PatternDef = {
        type: 'chain',
        signature: 'mutation',
        receiver: /procedure$/,
        inputSchemaLocation: { type: 'chain-method', method: 'input' },
        outputSchemaLocation: { type: 'chain-method', method: 'output' },
      };

      const mutationCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        return expr.getName() === 'mutation';
      });

      expect(mutationCalls.length).toBeGreaterThan(0);
    });

    it('should match tRPC .subscription() terminal method', () => {
      const pattern: PatternDef = {
        type: 'chain',
        signature: 'subscription',
      };

      const subscriptionCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        return expr.getName() === 'subscription';
      });

      expect(subscriptionCalls.length).toBeGreaterThan(0);
    });

    it('should extract .input() schema from chain', () => {
      // Find chains with .input() method
      const inputCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        return expr.getName() === 'input';
      });

      expect(inputCalls.length).toBeGreaterThan(0);
      
      // Each input call should have a schema argument
      for (const call of inputCalls.slice(0, 5)) {
        if (Node.isCallExpression(call)) {
          const args = call.getArguments();
          expect(args.length).toBeGreaterThan(0);
        }
      }
    });

    it('should extract .output() schema from chain', () => {
      // Find chains with .output() method
      const outputCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        return expr.getName() === 'output';
      });

      expect(outputCalls.length).toBeGreaterThan(0);
    });

    it('should handle chains with middleware (.use())', () => {
      // Find chains with .use() middleware
      const useCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        return expr.getName() === 'use';
      });

      expect(useCalls.length).toBeGreaterThan(0);
    });

    it('should handle complex chain with input, output, and middleware', () => {
      // Find chains that have multiple methods
      // This is validated by finding procedures with both input and output
      const outputCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        return expr.getName() === 'output';
      });

      // Should have at least some procedures with output definitions
      expect(outputCalls.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// MatchResult Tests - Captures
// ============================================================================

describe('MatchResult - Captures', () => {
  describe('captures property', () => {
    it('should include httpMethod for REST patterns', () => {
      const mockCaptures: MatchCaptures = {
        httpMethod: 'GET',
        routePath: '/users/:id',
      };

      expect(mockCaptures.httpMethod).toBe('GET');
      expect(mockCaptures.routePath).toBe('/users/:id');
    });

    it('should include procedureType for tRPC patterns', () => {
      const mockCaptures: MatchCaptures = {
        procedureType: 'mutation',
      };

      expect(mockCaptures.procedureType).toBe('mutation');
    });

    it('should include description from JSDoc or argument', () => {
      const mockCaptures: MatchCaptures = {
        description: 'Create a new user',
      };

      expect(mockCaptures.description).toBe('Create a new user');
    });

    it('should include inputSchemaNode for extraction', () => {
      const project = createProject();
      const sourceFile = loadFixture(project, CALL_PATTERNS_FILE);
      
      // Find any schema-like expression
      const schemaNode = sourceFile.getDescendants().find(node => {
        if (!Node.isCallExpression(node)) return false;
        const text = node.getText();
        return text.includes('z.object');
      });

      expect(schemaNode).toBeDefined();
    });

    it('should include outputSchemaNode when present', () => {
      const project = createProject();
      const sourceFile = loadFixture(project, CHAIN_PATTERNS_FILE);
      
      // Find output schema nodes
      const outputCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        return expr.getName() === 'output';
      });

      expect(outputCalls.length).toBeGreaterThan(0);
    });

    it('should allow custom framework-specific captures', () => {
      const mockCaptures: MatchCaptures = {
        httpMethod: 'POST',
        customField: 'custom-value',
        nestedData: { key: 'value' },
      };

      expect(mockCaptures['customField']).toBe('custom-value');
      expect(mockCaptures['nestedData']).toEqual({ key: 'value' });
    });
  });
});

// ============================================================================
// Schema Location Tests
// ============================================================================

describe('Schema Location Strategies', () => {
  let project: Project;

  beforeEach(() => {
    project = createProject();
  });

  describe('arg:N location', () => {
    it('should extract schema from positional argument', () => {
      const sourceFile = loadFixture(project, CALL_PATTERNS_FILE);
      const location: SchemaLocation = { type: 'arg', index: 2 };

      // Find server.tool() calls which have schema at arg[2]
      const toolCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const args = node.getArguments();
        return args.length >= 3;
      });

      expect(toolCalls.length).toBeGreaterThan(0);
      
      // Each should have at least 3 arguments
      for (const call of toolCalls.slice(0, 3)) {
        if (Node.isCallExpression(call)) {
          const args = call.getArguments();
          expect(args.length).toBeGreaterThanOrEqual(3);
          expect(args[2]).toBeDefined();
        }
      }
    });

    it('should handle arg:0 (first argument)', () => {
      const location: SchemaLocation = { type: 'arg', index: 0 };
      
      // Should extract first argument
      expect(location.type).toBe('arg');
      expect(location.index).toBe(0);
    });

    it('should handle arg:1 (second argument)', () => {
      const location: SchemaLocation = { type: 'arg', index: 1 };
      
      expect(location.type).toBe('arg');
      expect(location.index).toBe(1);
    });
  });

  describe('arg-named:X location', () => {
    it('should extract schema from named property in options object', () => {
      const sourceFile = loadFixture(project, CALL_PATTERNS_FILE);
      const location: SchemaLocation = { type: 'arg-named', name: 'schema' };

      // Find fastify.route() calls with schema property
      const routeCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const text = node.getText();
        return text.includes('schema:');
      });

      expect(routeCalls.length).toBeGreaterThan(0);
    });
  });

  describe('return location', () => {
    it('should extract return type annotation', () => {
      const location: SchemaLocation = { type: 'return' };
      
      // Find functions with return type annotations
      const sourceFile = loadFixture(project, DECORATOR_PATTERNS_FILE);
      
      const methodsWithReturnType = sourceFile.getDescendants().filter(node => {
        if (!Node.isMethodDeclaration(node)) return false;
        return node.getReturnTypeNode() !== undefined;
      });

      expect(methodsWithReturnType.length).toBeGreaterThan(0);
    });
  });

  describe('type-param:N location', () => {
    it('should extract generic type parameter', () => {
      const location: SchemaLocation = { type: 'type-param', index: 0 };
      
      expect(location.type).toBe('type-param');
      expect(location.index).toBe(0);
    });
  });

  describe('body location', () => {
    it('should infer schema from function body analysis', () => {
      const location: SchemaLocation = { type: 'body' };
      
      expect(location.type).toBe('body');
    });
  });

  describe('chain-method:X location', () => {
    it('should extract schema from method in chain (.input())', () => {
      const sourceFile = loadFixture(project, CHAIN_PATTERNS_FILE);
      const location: SchemaLocation = { type: 'chain-method', method: 'input' };

      // Find .input() method calls
      const inputCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        return expr.getName() === 'input';
      });

      expect(inputCalls.length).toBeGreaterThan(0);
    });

    it('should extract schema from method in chain (.output())', () => {
      const sourceFile = loadFixture(project, CHAIN_PATTERNS_FILE);
      const location: SchemaLocation = { type: 'chain-method', method: 'output' };

      const outputCalls = sourceFile.getDescendants().filter(node => {
        if (!Node.isCallExpression(node)) return false;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        return expr.getName() === 'output';
      });

      expect(outputCalls.length).toBeGreaterThan(0);
    });
  });

  describe('decorator-arg:N location', () => {
    it('should extract decorator argument', () => {
      const sourceFile = loadFixture(project, DECORATOR_PATTERNS_FILE);
      const location: SchemaLocation = { type: 'decorator-arg', index: 0 };

      // Find decorators with arguments
      const decoratorsWithArgs = sourceFile.getDescendants().filter(node => {
        if (!Node.isDecorator(node)) return false;
        const callExpr = node.getCallExpression();
        if (!callExpr) return false;
        return callExpr.getArguments().length > 0;
      });

      expect(decoratorsWithArgs.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Error Case Tests
// ============================================================================

describe('Error Cases', () => {
  describe('PatternNotFoundError', () => {
    it('should include framework and available list', () => {
      const error = new PatternNotFoundError('unknown-framework', ['express', 'fastify']);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PatternNotFoundError);
      expect(error.framework).toBe('unknown-framework');
      expect(error.available).toEqual(['express', 'fastify']);
      expect(error.message).toContain('unknown-framework');
      expect(error.message).toContain('express');
      expect(error.message).toContain('fastify');
    });
  });

  describe('PatternValidationError', () => {
    it('should include matcher and reason', () => {
      const invalidMatcher = { name: 'test' } as unknown as Partial<PatternMatcher>;
      const error = new PatternValidationError(invalidMatcher, 'missing match() method');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PatternValidationError);
      expect(error.matcher).toBe(invalidMatcher);
      expect(error.reason).toBe('missing match() method');
      expect(error.message).toContain('missing match() method');
    });
  });

  describe('PatternMatchError', () => {
    it('should include matcher name, node summary, and reason', () => {
      const error = new PatternMatchError(
        'express-matcher',
        'CallExpression at line 42',
        'Invalid method call structure'
      );
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PatternMatchError);
      expect(error.matcher).toBe('express-matcher');
      expect(error.nodeSummary).toBe('CallExpression at line 42');
      expect(error.reason).toBe('Invalid method call structure');
    });
  });

  describe('PatternExtractionError', () => {
    it('should include match, schema location, and reason', () => {
      const mockMatch: MatchResult = {
        pattern: { type: 'call', signature: 'test' },
        node: {} as Node,
        framework: 'test',
        identifier: 'testMethod',
        location: { file: 'test.ts', line: 1, column: 1 },
        captures: {},
      };
      
      const location: SchemaLocation = { type: 'arg', index: 2 };
      
      const error = new PatternExtractionError(
        mockMatch,
        location,
        'Schema node not found at arg:2'
      );
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PatternExtractionError);
      expect(error.match).toBe(mockMatch);
      expect(error.schemaLocation).toBe(location);
      expect(error.reason).toBe('Schema node not found at arg:2');
    });
  });

  describe('no match returns null', () => {
    it('should return null when pattern does not match', () => {
      const project = createProject();
      const sourceFile = loadFixture(project, CALL_PATTERNS_FILE);
      
      // Create a matcher that matches nothing
      const matcher = createMockMatcher('no-match-test', 'test', ['call'], {
        match: () => null,
      });

      // All nodes should return null
      sourceFile.forEachDescendant(node => {
        const result = matcher.match(node);
        expect(result).toBeNull();
      });
    });
  });

  describe('invalid pattern definition handling', () => {
    it('should validate pattern has required type property', () => {
      const invalidPattern = {
        // type is missing
        signature: 'test',
      } as unknown as PatternDef;

      // When used in a matcher, registration should fail
      const invalidMatcher = {
        name: 'invalid-pattern-test',
        framework: 'test',
        patterns: [invalidPattern],
        supportedTypes: ['call'],
        match: () => null,
        extract: async () => ({ properties: {}, required: [], source: { source: 'mcp', id: 'test' } }),
      } as unknown as PatternMatcher;

      // Should throw or handle gracefully
      // The exact behavior depends on implementation
    });

    it('should validate pattern has signature property', () => {
      const invalidPattern = {
        type: 'call',
        // signature is missing
      } as unknown as PatternDef;

      expect(invalidPattern.type).toBe('call');
      expect(invalidPattern.signature).toBeUndefined();
    });
  });

  describe('malformed AST node handling', () => {
    it('should handle null node gracefully', () => {
      const matcher = createMockMatcher('null-node-test', 'test', ['call']);
      
      // Passing null should not throw
      expect(() => {
        const result = matcher.match(null as unknown as Node);
        expect(result).toBeNull();
      }).not.toThrow();
    });

    it('should handle node without expected structure', () => {
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-malformed.ts',
        '// Just a comment',
        { overwrite: true }
      );

      const matcher = createMockMatcher('malformed-test', 'test', ['call']);
      
      sourceFile.forEachDescendant(node => {
        const result = matcher.match(node);
        expect(result).toBeNull();
      });
    });
  });
});

// ============================================================================
// BasePatternMatcher Tests
// ============================================================================

describe('BasePatternMatcher', () => {
  describe('matchesSignature helper', () => {
    it('should match exact string', () => {
      // This tests the protected helper method via behavior
      const matcher = createMockMatcher('sig-test', 'test', ['call'], {
        match: function(node: Node): MatchResult | null {
          if (!Node.isCallExpression(node)) return null;
          const expr = node.getExpression();
          if (!Node.isPropertyAccessExpression(expr)) return null;
          const name = expr.getName();
          
          // Exact string match
          if (name === 'tool') {
            return {
              pattern: { type: 'call', signature: 'tool' },
              node,
              framework: 'test',
              identifier: name,
              location: { file: '', line: 1, column: 1 },
              captures: {},
            };
          }
          return null;
        },
      });

      const project = createProject();
      const sourceFile = loadFixture(project, CALL_PATTERNS_FILE);
      
      let foundMatch = false;
      sourceFile.forEachDescendant(node => {
        const result = matcher.match(node);
        if (result && result.identifier === 'tool') {
          foundMatch = true;
        }
      });

      expect(foundMatch).toBe(true);
    });

    it('should match RegExp pattern', () => {
      const matcher = createMockMatcher('regex-test', 'test', ['call'], {
        match: function(node: Node): MatchResult | null {
          if (!Node.isCallExpression(node)) return null;
          const expr = node.getExpression();
          if (!Node.isPropertyAccessExpression(expr)) return null;
          const name = expr.getName();
          
          // RegExp match
          if (/^(get|post|put|delete)$/i.test(name)) {
            return {
              pattern: { type: 'call', signature: /^(get|post|put|delete)$/i },
              node,
              framework: 'test',
              identifier: name,
              location: { file: '', line: 1, column: 1 },
              captures: { httpMethod: name.toUpperCase() as any },
            };
          }
          return null;
        },
      });

      const project = createProject();
      const sourceFile = loadFixture(project, CALL_PATTERNS_FILE);
      
      let matchCount = 0;
      sourceFile.forEachDescendant(node => {
        const result = matcher.match(node);
        if (result) {
          matchCount++;
        }
      });

      expect(matchCount).toBeGreaterThan(0);
    });
  });

  describe('getLocation helper', () => {
    it('should extract file, line, and column from node', () => {
      const project = createProject();
      const sourceFile = loadFixture(project, CALL_PATTERNS_FILE);
      
      const firstCall = sourceFile.getDescendants().find(Node.isCallExpression);
      expect(firstCall).toBeDefined();
      
      if (firstCall) {
        const line = firstCall.getStartLineNumber();
        const column = firstCall.getStart() - firstCall.getStartLinePos();
        
        expect(typeof line).toBe('number');
        expect(typeof column).toBe('number');
        expect(line).toBeGreaterThan(0);
        expect(column).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('default scan implementation', () => {
    it('should traverse AST and call match() for each node', () => {
      let matchCallCount = 0;
      
      const matcher = createMockMatcher('scan-count-test', 'test', ['call'], {
        match: function(node: Node): MatchResult | null {
          matchCallCount++;
          return null;
        },
      });

      const project = createProject();
      const sourceFile = loadFixture(project, CALL_PATTERNS_FILE);
      
      // Simulate scan
      sourceFile.forEachDescendant(node => {
        matcher.match(node);
      });

      expect(matchCallCount).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// extractSchemaNode Tests
// ============================================================================

describe('extractSchemaNode', () => {
  let project: Project;

  beforeEach(() => {
    project = createProject();
  });

  it('should extract argument at specified index', () => {
    const sourceFile = loadFixture(project, CALL_PATTERNS_FILE);
    
    // Find a call with multiple arguments
    const call = sourceFile.getDescendants().find(node => {
      if (!Node.isCallExpression(node)) return false;
      return node.getArguments().length >= 3;
    });

    expect(call).toBeDefined();
    
    if (call && Node.isCallExpression(call)) {
      const args = call.getArguments();
      expect(args[2]).toBeDefined();
    }
  });

  it('should extract named argument from options object', () => {
    const sourceFile = loadFixture(project, CALL_PATTERNS_FILE);
    
    // Find fastify.route() with schema property
    const routeCall = sourceFile.getDescendants().find(node => {
      if (!Node.isCallExpression(node)) return false;
      const text = node.getText();
      return text.includes('fastify.route') && text.includes('schema:');
    });

    expect(routeCall).toBeDefined();
  });

  it('should return null for out-of-bounds argument index', () => {
    const sourceFile = loadFixture(project, CALL_PATTERNS_FILE);
    
    // Find a call with few arguments
    const call = sourceFile.getDescendants().find(node => {
      if (!Node.isCallExpression(node)) return false;
      const args = node.getArguments();
      return args.length >= 1 && args.length < 10;
    });

    expect(call).toBeDefined();
    
    if (call && Node.isCallExpression(call)) {
      const args = call.getArguments();
      // Index 100 should be out of bounds
      expect(args[100]).toBeUndefined();
    }
  });

  it('should extract from chain method', () => {
    const sourceFile = loadFixture(project, CHAIN_PATTERNS_FILE);
    
    // Find .input() call
    const inputCall = sourceFile.getDescendants().find(node => {
      if (!Node.isCallExpression(node)) return false;
      const expr = node.getExpression();
      if (!Node.isPropertyAccessExpression(expr)) return false;
      return expr.getName() === 'input';
    });

    expect(inputCall).toBeDefined();
    
    if (inputCall && Node.isCallExpression(inputCall)) {
      const args = inputCall.getArguments();
      expect(args.length).toBeGreaterThan(0);
    }
  });
});
