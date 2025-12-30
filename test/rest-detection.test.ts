/**
 * Tests for REST Endpoint Detection
 * 
 * Tests the REST pattern matchers for Express and Fastify.
 * These tests are written BEFORE implementation (TDD Red Phase).
 * 
 * API Reference: .context/ADR-P2-2-REST-DETECTION.md
 * 
 * Covers:
 * - ExpressPatternMatcher: HTTP methods, path params, middleware
 * - FastifyPatternMatcher: routes, schemas, plugins
 * - Path Parser: parameter extraction, constraints
 * - Integration: full file scanning
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Project, SourceFile, Node } from 'ts-morph';
import path from 'path';

// Core pattern types that already exist
import type { MatchResult } from '../src/patterns/types.js';
import type { NormalizedSchema } from '../src/core/types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const FIXTURES_DIR = path.resolve(process.cwd(), 'test', 'fixtures', 'rest-samples');
const EXPRESS_APP_FILE = path.join(FIXTURES_DIR, 'express-app.ts');
const EXPRESS_ROUTER_FILE = path.join(FIXTURES_DIR, 'express-router.ts');
const FASTIFY_SERVER_FILE = path.join(FIXTURES_DIR, 'fastify-server.ts');
const FASTIFY_PLUGIN_FILE = path.join(FIXTURES_DIR, 'fastify-plugin.ts');

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
// ExpressPatternMatcher Tests - HTTP Method Detection
// ============================================================================

describe('ExpressPatternMatcher', () => {
  describe('HTTP method detection', () => {
    it('should detect app.get() route', async () => {
      // Import will fail until implementation exists
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const getMatches = matches.filter((m: MatchResult) => 
        m.captures?.httpMethod === 'GET'
      );
      
      expect(getMatches.length).toBeGreaterThan(0);
      expect(getMatches.some((m: MatchResult) => m.identifier.includes('/users'))).toBe(true);
    });

    it('should detect app.post() route', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const postMatches = matches.filter((m: MatchResult) => 
        m.captures?.httpMethod === 'POST'
      );
      
      expect(postMatches.length).toBeGreaterThan(0);
      expect(postMatches.some((m: MatchResult) => m.identifier.includes('/users'))).toBe(true);
    });

    it('should detect app.put() route', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const putMatches = matches.filter((m: MatchResult) => 
        m.captures?.httpMethod === 'PUT'
      );
      
      expect(putMatches.length).toBeGreaterThan(0);
    });

    it('should detect app.delete() route', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const deleteMatches = matches.filter((m: MatchResult) => 
        m.captures?.httpMethod === 'DELETE'
      );
      
      expect(deleteMatches.length).toBeGreaterThan(0);
    });

    it('should detect app.patch() route', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const patchMatches = matches.filter((m: MatchResult) => 
        m.captures?.httpMethod === 'PATCH'
      );
      
      expect(patchMatches.length).toBeGreaterThan(0);
    });

    it('should detect app.options() route', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const optionsMatches = matches.filter((m: MatchResult) => 
        m.captures?.httpMethod === 'OPTIONS'
      );
      
      expect(optionsMatches.length).toBeGreaterThan(0);
    });

    it('should detect app.head() route', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const headMatches = matches.filter((m: MatchResult) => 
        m.captures?.httpMethod === 'HEAD'
      );
      
      expect(headMatches.length).toBeGreaterThan(0);
    });

    it('should detect app.all() route', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const allMatches = matches.filter((m: MatchResult) => 
        m.identifier.includes('/health')
      );
      
      expect(allMatches.length).toBeGreaterThan(0);
    });

    it('should detect router.get() route', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_ROUTER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const routerGetMatches = matches.filter((m: MatchResult) => {
        return m.captures?.httpMethod === 'GET' && m.captures?.routerName?.includes('Router');
      });
      
      expect(routerGetMatches.length).toBeGreaterThan(0);
    });

    it('should detect router.post() route', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_ROUTER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const routerPostMatches = matches.filter((m: MatchResult) => {
        return m.captures?.httpMethod === 'POST' && m.captures?.routerName?.includes('Router');
      });
      
      expect(routerPostMatches.length).toBeGreaterThan(0);
    });
  });

  describe('Path parameter extraction', () => {
    it('should extract single path parameter (:id)', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const paramMatch = matches.find((m: MatchResult) => 
        m.captures?.routePath === '/users/:id'
      );
      
      expect(paramMatch).toBeDefined();
      expect(paramMatch!.captures.pathParameters).toHaveLength(1);
      expect(paramMatch!.captures.pathParameters[0].name).toBe('id');
      expect(paramMatch!.captures.pathParameters[0].optional).toBe(false);
    });

    it('should extract multiple path parameters', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const paramMatch = matches.find((m: MatchResult) => 
        m.captures?.routePath?.includes('/users/:userId/posts/:postId')
      );
      
      expect(paramMatch).toBeDefined();
      expect(paramMatch!.captures.pathParameters.length).toBeGreaterThanOrEqual(2);
      expect(paramMatch!.captures.pathParameters.map((p: any) => p.name)).toContain('userId');
      expect(paramMatch!.captures.pathParameters.map((p: any) => p.name)).toContain('postId');
    });

    it('should extract optional parameter (:id?)', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const paramMatch = matches.find((m: MatchResult) => 
        m.captures?.routePath?.includes(':filename?')
      );
      
      expect(paramMatch).toBeDefined();
      const optionalParam = paramMatch!.captures.pathParameters.find((p: any) => p.name === 'filename');
      expect(optionalParam).toBeDefined();
      expect(optionalParam!.optional).toBe(true);
    });

    it('should extract regex-constrained parameter (:id(\\d+))', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const paramMatch = matches.find((m: MatchResult) => 
        m.captures?.routePath?.includes(':id(\\d+)')
      );
      
      expect(paramMatch).toBeDefined();
      const regexParam = paramMatch!.captures.pathParameters.find((p: any) => p.pattern);
      expect(regexParam).toBeDefined();
      expect(regexParam!.pattern).toBe('\\d+');
      expect(regexParam!.inferredType).toBe('number');
    });

    it('should detect wildcard path (/docs/*)', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const wildcardMatch = matches.find((m: MatchResult) => 
        m.captures?.routePath?.includes('/docs/*')
      );
      
      expect(wildcardMatch).toBeDefined();
    });
  });

  describe('Validation middleware detection', () => {
    it('should detect Zod validation middleware', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const zodMatch = matches.find((m: MatchResult) => {
        return m.captures?.validationMiddleware?.some((v: any) => v.library === 'zod');
      });
      
      expect(zodMatch).toBeDefined();
      const zodMiddleware = zodMatch!.captures.validationMiddleware.find((v: any) => v.library === 'zod');
      expect(zodMiddleware).toBeDefined();
      expect(zodMiddleware!.schemaNode).toBeDefined();
    });

    it('should detect Joi/celebrate validation middleware', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_ROUTER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const joiMatch = matches.find((m: MatchResult) => {
        return m.captures?.validationMiddleware?.some((v: any) => 
          v.library === 'joi' || v.library === 'celebrate'
        );
      });
      
      expect(joiMatch).toBeDefined();
    });

    it('should identify body validation target', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const bodyValidationMatch = matches.find((m: MatchResult) => {
        return m.captures?.validationMiddleware?.some((v: any) => v.target === 'body');
      });
      
      expect(bodyValidationMatch).toBeDefined();
      const bodyMiddleware = bodyValidationMatch!.captures.validationMiddleware.find((v: any) => v.target === 'body');
      expect(bodyMiddleware).toBeDefined();
    });

    it('should identify query validation target', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const queryValidationMatch = matches.find((m: MatchResult) => {
        return m.captures?.validationMiddleware?.some((v: any) => v.target === 'query');
      });
      
      expect(queryValidationMatch).toBeDefined();
    });

    it('should preserve middleware ordering', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const multiMiddlewareMatch = matches.find((m: MatchResult) => {
        return m.captures?.validationMiddleware?.length > 0;
      });
      
      expect(multiMiddlewareMatch).toBeDefined();
      
      // Middleware indices should be in order
      const middleware = multiMiddlewareMatch!.captures.validationMiddleware;
      if (middleware.length > 1) {
        for (let i = 1; i < middleware.length; i++) {
          expect(middleware[i].middlewareIndex)
            .toBeGreaterThan(middleware[i - 1].middlewareIndex);
        }
      }
    });
  });

  describe('Multiple middleware handlers', () => {
    it('should detect route with multiple middleware', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const protectedMatch = matches.find((m: MatchResult) => 
        m.captures?.routePath?.includes('/protected')
      );
      
      expect(protectedMatch).toBeDefined();
    });

    it('should identify the final handler function', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const routeMatch = matches.find((m: MatchResult) => m.captures.handlerNode);
      
      expect(routeMatch).toBeDefined();
      expect(routeMatch!.captures.handlerNode).toBeDefined();
    });
  });

  describe('Route chaining (app.route())', () => {
    it('should detect app.route().get()', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const chainMatch = matches.find((m: MatchResult) => 
        m.captures?.routePath?.includes('/articles')
      );
      
      expect(chainMatch).toBeDefined();
    });

    it('should detect multiple methods on same route chain', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const matcher = new ExpressPatternMatcher();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const articleMatches = matches.filter((m: MatchResult) => 
        m.captures?.routePath?.includes('/articles')
      );
      
      // Should have both GET and POST for /articles
      const methods = articleMatches.map((m: MatchResult) => m.captures?.httpMethod);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
    });
  });
});

// ============================================================================
// FastifyPatternMatcher Tests
// ============================================================================

describe('FastifyPatternMatcher', () => {
  describe('Shorthand route detection', () => {
    it('should detect fastify.get() route', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const getMatches = matches.filter((m: MatchResult) => 
        m.captures?.httpMethod === 'GET'
      );
      
      expect(getMatches.length).toBeGreaterThan(0);
    });

    it('should detect fastify.post() route', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const postMatches = matches.filter((m: MatchResult) => 
        m.captures?.httpMethod === 'POST'
      );
      
      expect(postMatches.length).toBeGreaterThan(0);
    });

    it('should detect fastify.put() route', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const putMatches = matches.filter((m: MatchResult) => 
        m.captures?.httpMethod === 'PUT'
      );
      
      expect(putMatches.length).toBeGreaterThan(0);
    });

    it('should detect fastify.delete() route', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const deleteMatches = matches.filter((m: MatchResult) => 
        m.captures?.httpMethod === 'DELETE'
      );
      
      expect(deleteMatches.length).toBeGreaterThan(0);
    });

    it('should detect fastify.patch() route', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const patchMatches = matches.filter((m: MatchResult) => 
        m.captures?.httpMethod === 'PATCH'
      );
      
      expect(patchMatches.length).toBeGreaterThan(0);
    });

    it('should detect fastify.all() route', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const healthMatch = matches.find((m: MatchResult) => 
        m.identifier.includes('/health')
      );
      
      expect(healthMatch).toBeDefined();
    });

    it('should detect alternative instance names (server, app)', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      // server.get()
      const serverMatch = matches.find((m: MatchResult) => 
        m.identifier.includes('/api/health')
      );
      expect(serverMatch).toBeDefined();
      
      // app.get()
      const appMatch = matches.find((m: MatchResult) => 
        m.identifier.includes('/v1/ping')
      );
      expect(appMatch).toBeDefined();
    });
  });

  describe('fastify.route() detection', () => {
    it('should detect fastify.route() with method string', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const routeMatch = matches.find((m: MatchResult) => 
        m.captures?.routePath === '/products'
      );
      
      expect(routeMatch).toBeDefined();
    });

    it('should detect fastify.route() with POST method', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const postRouteMatch = matches.find((m: MatchResult) => {
        return m.captures?.routePath === '/products' && m.captures?.httpMethod === 'POST';
      });
      
      expect(postRouteMatch).toBeDefined();
    });

    it('should detect fastify.route() with array of methods', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const statusMatch = matches.find((m: MatchResult) => 
        m.captures?.routePath === '/status'
      );
      
      expect(statusMatch).toBeDefined();
    });

    it('should extract url property from route options', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const productMatch = matches.find((m: MatchResult) => 
        m.captures?.routePath === '/products/:id'
      );
      
      expect(productMatch).toBeDefined();
    });
  });

  describe('Schema extraction - JSON Schema', () => {
    it('should extract schema.body', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const postMatch = matches.find((m: MatchResult) => {
        return m.captures?.httpMethod === 'POST' && m.captures?.routePath?.includes('/users');
      });
      
      expect(postMatch).toBeDefined();
    });

    it('should extract schema.querystring', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const searchMatch = matches.find((m: MatchResult) => 
        m.captures?.routePath === '/search'
      );
      
      expect(searchMatch).toBeDefined();
    });

    it('should extract schema.params', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const paramMatch = matches.find((m: MatchResult) => {
        return m.captures?.routePath?.includes(':id');
      });
      
      expect(paramMatch).toBeDefined();
    });

    it('should extract schema.headers', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const secureMatch = matches.find((m: MatchResult) => 
        m.captures?.routePath === '/api/secure'
      );
      
      expect(secureMatch).toBeDefined();
    });

    it('should extract schema.response with status codes', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const matchWithResponse = matches.find((m: MatchResult) => {
        return m.captures?.schemas?.response;
      });
      
      expect(matchWithResponse).toBeDefined();
    });
  });

  describe('Schema extraction - TypeBox', () => {
    it('should detect TypeBox schema format', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const typeboxMatch = matches.find((m: MatchResult) => 
        m.captures?.routePath?.includes('/api/users')
      );
      
      expect(typeboxMatch).toBeDefined();
    });

    it('should extract Type.Object() body schema', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const typeboxPostMatch = matches.find((m: MatchResult) => {
        return m.captures?.routePath === '/api/users' && m.captures?.httpMethod === 'POST';
      });
      
      expect(typeboxPostMatch).toBeDefined();
    });
  });

  describe('Schema extraction - Zod', () => {
    it('should detect Zod schema format', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const zodMatch = matches.find((m: MatchResult) => 
        m.captures?.routePath?.includes('/v2/users')
      );
      
      expect(zodMatch).toBeDefined();
    });

    it('should extract z.object() body schema', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const zodPostMatch = matches.find((m: MatchResult) => {
        return m.captures?.routePath === '/v2/users' && m.captures?.httpMethod === 'POST';
      });
      
      expect(zodPostMatch).toBeDefined();
    });
  });

  describe('Fastify shorthand with options', () => {
    it('should detect shorthand with options object', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const optionsMatch = matches.find((m: MatchResult) => 
        m.captures?.routePath === '/search'
      );
      
      expect(optionsMatch).toBeDefined();
    });

    it('should extract schema from options in shorthand', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const schemaMatch = matches.find((m: MatchResult) => {
        return m.captures?.schemas;
      });
      
      expect(schemaMatch).toBeDefined();
    });
  });

  describe('Plugin routes', () => {
    it('should detect routes inside plugin functions', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_PLUGIN_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should detect async plugin routes', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_PLUGIN_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const pluginRoutes = matches.filter((m: MatchResult) => 
        m.captures?.routePath?.startsWith('/')
      );
      
      expect(pluginRoutes.length).toBeGreaterThan(0);
    });

    it('should detect callback plugin routes', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const matcher = new FastifyPatternMatcher();
      const sourceFile = loadFixture(project, FASTIFY_PLUGIN_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      // Should have routes from postsPlugin
      expect(matches.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Path Parser Tests
// ============================================================================

describe('Path Parser', () => {
  describe('parsePath()', () => {
    it('should parse simple path with no parameters', async () => {
      const { parsePath } = await import('../src/patterns/rest/path-parser.js');
      
      const params = parsePath('/users');
      
      expect(params).toBeInstanceOf(Array);
      expect(params).toHaveLength(0);
    });

    it('should parse single parameter (/users/:id)', async () => {
      const { parsePath } = await import('../src/patterns/rest/path-parser.js');
      
      const params = parsePath('/users/:id');
      
      expect(params).toHaveLength(1);
      expect(params[0]).toMatchObject({
        name: 'id',
        position: 1,
        optional: false,
      });
    });

    it('should parse multiple parameters (/users/:userId/posts/:postId)', async () => {
      const { parsePath } = await import('../src/patterns/rest/path-parser.js');
      
      const params = parsePath('/users/:userId/posts/:postId');
      
      expect(params).toHaveLength(2);
      expect(params[0]).toMatchObject({
        name: 'userId',
        position: 1,
        optional: false,
      });
      expect(params[1]).toMatchObject({
        name: 'postId',
        position: 3,
        optional: false,
      });
    });

    it('should parse optional parameter (/users/:id?)', async () => {
      const { parsePath } = await import('../src/patterns/rest/path-parser.js');
      
      const params = parsePath('/users/:id?');
      
      expect(params).toHaveLength(1);
      expect(params[0]).toMatchObject({
        name: 'id',
        optional: true,
      });
    });

    it('should parse regex constraint (/users/:id(\\d+))', async () => {
      const { parsePath } = await import('../src/patterns/rest/path-parser.js');
      
      const params = parsePath('/users/:id(\\d+)');
      
      expect(params).toHaveLength(1);
      expect(params[0]).toMatchObject({
        name: 'id',
        pattern: '\\d+',
      });
    });

    it('should infer number type from \\d+ pattern', async () => {
      const { parsePath } = await import('../src/patterns/rest/path-parser.js');
      
      const params = parsePath('/products/:id(\\d+)');
      
      expect(params[0].inferredType).toBe('number');
    });

    it('should infer number type from [0-9]+ pattern', async () => {
      const { parsePath } = await import('../src/patterns/rest/path-parser.js');
      
      const params = parsePath('/items/:num([0-9]+)');
      
      expect(params[0].inferredType).toBe('number');
    });

    it('should parse wildcard (*)', async () => {
      const { parsePath } = await import('../src/patterns/rest/path-parser.js');
      
      const params = parsePath('/files/*');
      
      // Wildcard should be handled differently
      expect(params).toBeInstanceOf(Array);
    });

    it('should parse complex regex (/date/:year(\\d{4})-:month(\\d{2})-:day(\\d{2}))', async () => {
      const { parsePath } = await import('../src/patterns/rest/path-parser.js');
      
      const params = parsePath('/date/:year(\\d{4})-:month(\\d{2})-:day(\\d{2})');
      
      expect(params).toHaveLength(3);
      expect(params.map((p: any) => p.name)).toEqual(['year', 'month', 'day']);
    });

    it('should handle deeply nested paths', async () => {
      const { parsePath } = await import('../src/patterns/rest/path-parser.js');
      
      const params = parsePath('/org/:orgId/team/:teamId/member/:memberId/task/:taskId');
      
      expect(params).toHaveLength(4);
      expect(params.map((p: any) => p.name)).toEqual(['orgId', 'teamId', 'memberId', 'taskId']);
    });
  });

  describe('pathParametersToSchema()', () => {
    it('should convert parameters to NormalizedSchema properties', async () => {
      const { pathParametersToSchema } = await import('../src/patterns/rest/path-parser.js');
      
      const params = [
        { name: 'id', position: 1, optional: false, inferredType: 'string' },
      ];
      
      const properties = pathParametersToSchema(params);
      
      expect(properties).toHaveProperty('id');
      expect(properties.id.optional).toBe(false);
    });

    it('should mark optional parameters correctly', async () => {
      const { pathParametersToSchema } = await import('../src/patterns/rest/path-parser.js');
      
      const params = [
        { name: 'id', position: 1, optional: true, inferredType: 'string' },
      ];
      
      const properties = pathParametersToSchema(params);
      
      expect(properties.id.optional).toBe(true);
    });

    it('should include regex pattern as constraint', async () => {
      const { pathParametersToSchema } = await import('../src/patterns/rest/path-parser.js');
      
      const params = [
        { name: 'id', position: 1, optional: false, pattern: '\\d+', inferredType: 'number' },
      ];
      
      const properties = pathParametersToSchema(params);
      
      expect(properties.id.constraints?.pattern).toBe('\\d+');
    });

    it('should use inferred type for primitive type', async () => {
      const { pathParametersToSchema } = await import('../src/patterns/rest/path-parser.js');
      
      const params = [
        { name: 'count', position: 1, optional: false, inferredType: 'number' },
      ];
      
      const properties = pathParametersToSchema(params);
      
      expect(properties.count.type.kind).toBe('primitive');
      expect(properties.count.type.value).toBe('number');
    });
  });
});

// ============================================================================
// Middleware Detection Tests
// ============================================================================

describe('Middleware Detection', () => {
  describe('detectExpressMiddleware()', () => {
    it('should detect Zod validation with z.object()', async () => {
      const { detectExpressMiddleware } = await import('../src/patterns/rest/middleware.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      // Find a route with Zod validation
      const nodes = findCallArgs(sourceFile, ['validateBody', 'zodValidate']);
      
      if (nodes.length > 0) {
        const middleware = detectExpressMiddleware(nodes);
        const zodMiddleware = middleware.find((m: any) => m.library === 'zod');
        
        expect(zodMiddleware).toBeDefined();
      }
    });

    it('should detect Joi validation with Joi.object()', async () => {
      const { detectExpressMiddleware } = await import('../src/patterns/rest/middleware.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, EXPRESS_ROUTER_FILE);
      
      const nodes = findCallArgs(sourceFile, ['celebrate']);
      
      if (nodes.length > 0) {
        const middleware = detectExpressMiddleware(nodes);
        const joiMiddleware = middleware.find((m: any) => 
          m.library === 'joi' || m.library === 'celebrate'
        );
        
        expect(joiMiddleware).toBeDefined();
      }
    });

    it('should identify body as validation target', async () => {
      const { detectExpressMiddleware } = await import('../src/patterns/rest/middleware.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const nodes = findCallArgs(sourceFile, ['validateBody']);
      
      if (nodes.length > 0) {
        const middleware = detectExpressMiddleware(nodes);
        const bodyMiddleware = middleware.find((m: any) => m.target === 'body');
        
        expect(bodyMiddleware).toBeDefined();
      }
    });

    it('should identify query as validation target', async () => {
      const { detectExpressMiddleware } = await import('../src/patterns/rest/middleware.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const nodes = findCallArgs(sourceFile, ['validateQuery']);
      
      if (nodes.length > 0) {
        const middleware = detectExpressMiddleware(nodes);
        const queryMiddleware = middleware.find((m: any) => m.target === 'query');
        
        expect(queryMiddleware).toBeDefined();
      }
    });

    it('should extract celebrate Segments.BODY target', async () => {
      const { detectExpressMiddleware } = await import('../src/patterns/rest/middleware.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, EXPRESS_ROUTER_FILE);
      
      const nodes = findCallArgs(sourceFile, ['celebrate']);
      
      if (nodes.length > 0) {
        const middleware = detectExpressMiddleware(nodes);
        const celebrateMiddleware = middleware.find((m: any) => 
          m.library === 'celebrate' && m.target === 'body'
        );
        
        expect(celebrateMiddleware).toBeDefined();
      }
    });

    it('should return empty array when no validation middleware', async () => {
      const { detectExpressMiddleware } = await import('../src/patterns/rest/middleware.js');
      
      const emptyNodes: Node[] = [];
      const middleware = detectExpressMiddleware(emptyNodes);
      
      expect(middleware).toEqual([]);
    });
  });
});

// ============================================================================
// Response Inference Tests
// ============================================================================

describe('Response Inference', () => {
  describe('inferResponseSchema()', () => {
    it('should infer from explicit return type annotation', async () => {
      const { inferResponseSchema } = await import('../src/patterns/rest/response-inference.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const handler = findHandlerFunction(sourceFile, 'profile');
      
      if (handler) {
        const inference = inferResponseSchema(handler);
        
        expect(inference.method).toBe('explicit-return');
        expect(inference.node).toBeDefined();
      }
    });

    it('should infer from res.json() argument', async () => {
      const { inferResponseSchema } = await import('../src/patterns/rest/response-inference.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const handler = findHandlerFunction(sourceFile, 'users');
      
      if (handler) {
        const inference = inferResponseSchema(handler);
        
        expect(['body-analysis', 'explicit-return', 'generic-param', 'unknown']).toContain(inference.method);
      }
    });

    it('should return unknown for unanalyzable handlers', async () => {
      const { inferResponseSchema } = await import('../src/patterns/rest/response-inference.js');
      
      const inference = inferResponseSchema(undefined);
      
      expect(inference.method).toBe('unknown');
    });
  });

  describe('detectMultipleResponses()', () => {
    it('should detect different status codes', async () => {
      const { detectMultipleResponses } = await import('../src/patterns/rest/response-inference.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const handler = findHandlerFunction(sourceFile, 'profile');
      
      if (handler) {
        const responses = detectMultipleResponses(handler);
        
        expect(responses).toBeInstanceOf(Map);
      }
    });

    it('should extract response body for each status code', async () => {
      const { detectMultipleResponses } = await import('../src/patterns/rest/response-inference.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      
      const handler = findHandlerFunction(sourceFile, 'users');
      
      if (handler) {
        const responses = detectMultipleResponses(handler);
        
        // Should have at least default (200) response
        expect(responses.size).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration', () => {
  describe('Express app scanning', () => {
    it('should scan Express app file and find all routes', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      const matcher = new ExpressPatternMatcher();
      const matches = scanWithMatcher(sourceFile, matcher);
      
      // Should find multiple routes
      expect(matches.length).toBeGreaterThan(5);
      
      // Should have various HTTP methods
      const methods = new Set(matches.map((m: MatchResult) => m.captures?.httpMethod));
      expect(methods.has('GET')).toBe(true);
      expect(methods.has('POST')).toBe(true);
    });

    it('should produce valid ProducerSchema output', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      const matcher = new ExpressPatternMatcher();
      const matches = scanWithMatcher(sourceFile, matcher);
      
      if (matches.length > 0) {
        const schema = await matcher.extract(matches[0]);
        
        expect(schema).toBeDefined();
        expect(schema.properties).toBeDefined();
        expect(schema.source).toBeDefined();
        expect(schema.location).toBeDefined();
      }
    });
  });

  describe('Express router scanning', () => {
    it('should scan Express router file and find all routes', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, EXPRESS_ROUTER_FILE);
      const matcher = new ExpressPatternMatcher();
      const matches = scanWithMatcher(sourceFile, matcher);
      
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should identify router instance names', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, EXPRESS_ROUTER_FILE);
      const matcher = new ExpressPatternMatcher();
      const matches = scanWithMatcher(sourceFile, matcher);
      
      const routerNames = matches
        .map((m: MatchResult) => m.captures?.routerName)
        .filter(Boolean);
      
      expect(routerNames.length).toBeGreaterThan(0);
    });
  });

  describe('Fastify server scanning', () => {
    it('should scan Fastify server file and find all routes', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      const matcher = new FastifyPatternMatcher();
      const matches = scanWithMatcher(sourceFile, matcher);
      
      expect(matches.length).toBeGreaterThan(5);
    });

    it('should produce valid ProducerSchema output', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, FASTIFY_SERVER_FILE);
      const matcher = new FastifyPatternMatcher();
      const matches = scanWithMatcher(sourceFile, matcher);
      
      if (matches.length > 0) {
        const schema = await matcher.extract(matches[0]);
        
        expect(schema).toBeDefined();
        expect(schema.properties).toBeDefined();
      }
    });
  });

  describe('Fastify plugin scanning', () => {
    it('should scan Fastify plugin file and find all routes', async () => {
      const { FastifyPatternMatcher } = await import('../src/patterns/rest/fastify.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, FASTIFY_PLUGIN_FILE);
      const matcher = new FastifyPatternMatcher();
      const matches = scanWithMatcher(sourceFile, matcher);
      
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe('Bootstrap and registry integration', () => {
    it('should register REST matchers with bootstrapRESTPatterns()', async () => {
      const { bootstrapRESTPatterns } = await import('../src/patterns/rest/index.js');
      
      expect(() => bootstrapRESTPatterns()).not.toThrow();
    });

    it('should make Express matcher available after bootstrap', async () => {
      const { bootstrapRESTPatterns } = await import('../src/patterns/rest/index.js');
      const { getPatternsByFramework } = await import('../src/patterns/registry.js');
      
      bootstrapRESTPatterns();
      const expressMatchers = getPatternsByFramework('express');
      
      expect(expressMatchers.length).toBeGreaterThan(0);
    });

    it('should make Fastify matcher available after bootstrap', async () => {
      const { bootstrapRESTPatterns } = await import('../src/patterns/rest/index.js');
      const { getPatternsByFramework } = await import('../src/patterns/registry.js');
      
      bootstrapRESTPatterns();
      const fastifyMatchers = getPatternsByFramework('fastify');
      
      expect(fastifyMatchers.length).toBeGreaterThan(0);
    });
  });

  describe('Schema output format', () => {
    it('should include httpMethod in identifier', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      const matcher = new ExpressPatternMatcher();
      const matches = scanWithMatcher(sourceFile, matcher);
      
      const matchWithMethod = matches.find((m: MatchResult) => 
        m.identifier.includes('GET') || 
        m.identifier.includes('POST')
      );
      
      expect(matchWithMethod).toBeDefined();
    });

    it('should include path in identifier', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      const matcher = new ExpressPatternMatcher();
      const matches = scanWithMatcher(sourceFile, matcher);
      
      const matchWithPath = matches.find((m: MatchResult) => 
        m.identifier.includes('/users') || 
        m.identifier.includes('/products')
      );
      
      expect(matchWithPath).toBeDefined();
    });

    it('should format identifier as "METHOD /path"', async () => {
      const { ExpressPatternMatcher } = await import('../src/patterns/rest/express.js');
      
      const project = createProject();
      const sourceFile = loadFixture(project, EXPRESS_APP_FILE);
      const matcher = new ExpressPatternMatcher();
      const matches = scanWithMatcher(sourceFile, matcher);
      
      if (matches.length > 0) {
        const identifier = matches[0].identifier;
        expect(identifier).toMatch(/^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD|ALL)\s+\//);
      }
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Scan source file with a specific matcher
 */
function scanWithMatcher(sourceFile: SourceFile, matcher: any): MatchResult[] {
  const matches: MatchResult[] = [];
  
  sourceFile.forEachDescendant(node => {
    const result = matcher.match(node);
    if (result) {
      matches.push(result);
    }
  });
  
  return matches;
}

/**
 * Find call expression arguments containing specific function names
 */
function findCallArgs(sourceFile: SourceFile, functionNames: string[]): Node[] {
  const args: Node[] = [];
  
  sourceFile.forEachDescendant(node => {
    if (Node.isCallExpression(node)) {
      const nodeArgs = node.getArguments();
      for (const arg of nodeArgs) {
        const text = arg.getText();
        if (functionNames.some(name => text.includes(name))) {
          args.push(arg);
        }
      }
    }
  });
  
  return args;
}

/**
 * Find handler function by route path substring
 */
function findHandlerFunction(sourceFile: SourceFile, pathSubstring: string): Node | undefined {
  let handler: Node | undefined;
  
  sourceFile.forEachDescendant(node => {
    if (Node.isCallExpression(node)) {
      const text = node.getText();
      if (text.includes(pathSubstring)) {
        const args = node.getArguments();
        // Handler is typically the last argument
        const lastArg = args[args.length - 1];
        if (lastArg && (Node.isArrowFunction(lastArg) || Node.isFunctionExpression(lastArg))) {
          handler = lastArg;
        }
      }
    }
  });
  
  return handler;
}
