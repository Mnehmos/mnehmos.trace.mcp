/**
 * HTTP Client Tracing Tests
 * 
 * Tests for FetchPatternMatcher and AxiosPatternMatcher implementations.
 * Tests should fail until implementation in src/patterns/http-clients/ is complete.
 * 
 * @see .context/ADR-P2-3-HTTP-CLIENT-TRACING.md
 */

import { describe, it, expect } from 'vitest';
import { Project, SourceFile, Node } from 'ts-morph';
import path from 'path';

// Core pattern types that already exist
import type { MatchResult } from '../src/patterns/types.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const FIXTURES_DIR = path.resolve(process.cwd(), 'test', 'fixtures', 'http-client-samples');
const FETCH_CALLS_FILE = path.join(FIXTURES_DIR, 'fetch-calls.ts');
const AXIOS_CALLS_FILE = path.join(FIXTURES_DIR, 'axios-calls.ts');
const AXIOS_INSTANCE_FILE = path.join(FIXTURES_DIR, 'axios-instance.ts');
const TYPE_INFERENCE_FILE = path.join(FIXTURES_DIR, 'type-inference.ts');
const PROPERTY_ACCESS_FILE = path.join(FIXTURES_DIR, 'property-access.ts');

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

/**
 * Scan source file with a specific matcher
 */
function scanWithMatcher(sourceFile: SourceFile, matcher: { match(node: Node): MatchResult | null }): MatchResult[] {
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
 * Find the first call expression in a source file
 */
function findFirstCallExpression(sourceFile: SourceFile): Node | undefined {
  let result: Node | undefined;
  sourceFile.forEachDescendant((node) => {
    if (!result && Node.isCallExpression(node)) {
      result = node;
    }
  });
  return result;
}

// =============================================================================
// FetchPatternMatcher Tests
// =============================================================================

describe('FetchPatternMatcher', () => {
  describe('matcher properties', () => {
    it('should have correct name "fetch-client"', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      const matcher = new FetchPatternMatcher();
      expect(matcher.name).toBe('fetch-client');
    });

    it('should have correct framework identifier "fetch"', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      const matcher = new FetchPatternMatcher();
      expect(matcher.framework).toBe('fetch');
    });

    it('should support call and chain pattern types', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      const matcher = new FetchPatternMatcher();
      expect(matcher.supportedTypes).toContain('call');
      expect(matcher.supportedTypes).toContain('chain');
    });
  });

  describe('call detection', () => {
    it('should detect basic fetch() call with string literal URL', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const getMatches = matches.filter((m: MatchResult) => 
        m.captures?.httpMethod === 'GET'
      );
      
      expect(getMatches.length).toBeGreaterThan(0);
      expect(getMatches.some((m: MatchResult) => m.identifier.includes('/api/users'))).toBe(true);
    });

    it('should detect fetch() call with variable URL reference', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      // Should detect even with variable URL
      const urlMatch = matches.find((m: MatchResult) => {
        const url = m.captures?.url as { isDynamic?: boolean } | undefined;
        return url?.isDynamic === false;
      });
      expect(urlMatch).toBeDefined();
    });

    it('should detect fetch() with POST method in options', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const postMatch = matches.find((m: MatchResult) => 
        m.captures?.httpMethod === 'POST'
      );
      
      expect(postMatch).toBeDefined();
      expect(postMatch!.identifier).toContain('POST');
    });

    it('should detect fetch() with PUT method', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const putMatch = matches.find((m: MatchResult) => 
        m.captures?.httpMethod === 'PUT'
      );
      
      expect(putMatch).toBeDefined();
    });

    it('should detect fetch() with DELETE method', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const deleteMatch = matches.find((m: MatchResult) => 
        m.captures?.httpMethod === 'DELETE'
      );
      
      expect(deleteMatch).toBeDefined();
    });

    it('should detect fetch() with PATCH method', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const patchMatch = matches.find((m: MatchResult) => 
        m.captures?.httpMethod === 'PATCH'
      );
      
      expect(patchMatch).toBeDefined();
    });

    it('should default to GET method when not specified', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const getMatches = matches.filter((m: MatchResult) => 
        m.captures?.httpMethod === 'GET'
      );
      
      expect(getMatches.length).toBeGreaterThan(0);
    });
  });

  describe('URL extraction', () => {
    it('should extract static string URL', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const staticUrl = matches.find((m: MatchResult) => {
        const url = m.captures?.url as { static?: string; isDynamic?: boolean } | undefined;
        return url?.static === '/api/users' && url?.isDynamic === false;
      });
      
      expect(staticUrl).toBeDefined();
    });

    it('should extract template literal URL with single variable', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const templateMatch = matches.find((m: MatchResult) => {
        const url = m.captures?.url as { isDynamic?: boolean; pattern?: string; pathParams?: string[] } | undefined;
        return url?.isDynamic === true && 
               url?.pattern?.includes(':userId') &&
               url?.pathParams?.includes('userId');
      });
      
      expect(templateMatch).toBeDefined();
    });

    it('should extract template literal URL with multiple variables', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const multiVarMatch = matches.find((m: MatchResult) => {
        const url = m.captures?.url as { pathParams?: string[]; pattern?: string } | undefined;
        return url?.pathParams?.length === 2 &&
               url?.pattern?.includes(':userId') &&
               url?.pattern?.includes(':postId');
      });
      
      expect(multiVarMatch).toBeDefined();
    });

    it('should extract query parameters from URL', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const queryMatch = matches.find((m: MatchResult) => {
        const url = m.captures?.url as { queryParams?: string[] } | undefined;
        return url?.queryParams?.includes('page') ||
               url?.queryParams?.includes('limit');
      });
      
      expect(queryMatch).toBeDefined();
    });

    it('should handle URL concatenation', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      // Concatenation creates dynamic URL
      const dynamicMatch = matches.find((m: MatchResult) => {
        const url = m.captures?.url as { isDynamic?: boolean } | undefined;
        return url?.isDynamic;
      });
      expect(dynamicMatch).toBeDefined();
    });
  });

  describe('options extraction', () => {
    it('should extract request body from JSON.stringify', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const bodyMatch = matches.find((m: MatchResult) => 
        m.captures?.requestBody !== undefined &&
        m.captures?.httpMethod === 'POST'
      );
      
      expect(bodyMatch).toBeDefined();
    });

    it('should extract Content-Type header', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const headerMatch = matches.find((m: MatchResult) => {
        const headers = m.captures?.requestHeaders as { static?: Record<string, string> } | undefined;
        return headers?.static?.['Content-Type'] === 'application/json';
      });
      
      expect(headerMatch).toBeDefined();
    });

    it('should extract Authorization header', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const authMatch = matches.find((m: MatchResult) => {
        const headers = m.captures?.requestHeaders as { static?: Record<string, string>; dynamic?: string[] } | undefined;
        return headers?.static?.['Authorization'] !== undefined ||
               headers?.dynamic?.includes('Authorization');
      });
      
      expect(authMatch).toBeDefined();
    });

    it('should track dynamic headers', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      // Some headers like X-Request-ID are dynamic
      const dynamicHeaderMatch = matches.find((m: MatchResult) => {
        const headers = m.captures?.requestHeaders as { dynamic?: string[] } | undefined;
        return (headers?.dynamic?.length ?? 0) > 0;
      });
      expect(dynamicHeaderMatch).toBeDefined();
    });
  });

  describe('response parsing detection', () => {
    it('should detect .then(r => r.json()) chain', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      // Matcher should track JSON parsing in response chain
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should detect await response.json() pattern', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      // Should still be tracked even with separate json() call
      expect(matches.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// AxiosPatternMatcher Tests
// =============================================================================

describe('AxiosPatternMatcher', () => {
  describe('matcher properties', () => {
    it('should have correct name "axios-client"', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      const matcher = new AxiosPatternMatcher();
      expect(matcher.name).toBe('axios-client');
    });

    it('should have correct framework identifier "axios"', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      const matcher = new AxiosPatternMatcher();
      expect(matcher.framework).toBe('axios');
    });

    it('should support call pattern type', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      const matcher = new AxiosPatternMatcher();
      expect(matcher.supportedTypes).toContain('call');
    });
  });

  describe('method detection', () => {
    it('should detect axios.get() call', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const getMatch = matches.find((m: MatchResult) => 
        m.captures?.httpMethod === 'GET' &&
        m.identifier.includes('GET')
      );
      
      expect(getMatch).toBeDefined();
    });

    it('should detect axios.post() call', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const postMatch = matches.find((m: MatchResult) => 
        m.captures?.httpMethod === 'POST'
      );
      
      expect(postMatch).toBeDefined();
    });

    it('should detect axios.put() call', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const putMatch = matches.find((m: MatchResult) => 
        m.captures?.httpMethod === 'PUT'
      );
      
      expect(putMatch).toBeDefined();
    });

    it('should detect axios.delete() call', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const deleteMatch = matches.find((m: MatchResult) => 
        m.captures?.httpMethod === 'DELETE'
      );
      
      expect(deleteMatch).toBeDefined();
    });

    it('should detect axios.patch() call', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const patchMatch = matches.find((m: MatchResult) => 
        m.captures?.httpMethod === 'PATCH'
      );
      
      expect(patchMatch).toBeDefined();
    });

    it('should detect axios.head() call', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const headMatch = matches.find((m: MatchResult) => 
        m.captures?.httpMethod === 'HEAD'
      );
      
      expect(headMatch).toBeDefined();
    });

    it('should detect axios.options() call', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const optionsMatch = matches.find((m: MatchResult) => 
        m.captures?.httpMethod === 'OPTIONS'
      );
      
      expect(optionsMatch).toBeDefined();
    });

    it('should detect axios.request() call', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const requestMatch = matches.find((m: MatchResult) => 
        m.identifier.includes('/api/data')
      );
      
      expect(requestMatch).toBeDefined();
    });
  });

  describe('type inference from generics', () => {
    it('should extract type from axios.get<User>()', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const typedMatch = matches.find((m: MatchResult) => {
        const typeInference = m.captures?.typeInference as Array<{ method?: string; typeText?: string }> | undefined;
        return typeInference?.some(t => 
          t.method === 'generic-param' && 
          t.typeText === 'User'
        );
      });
      
      expect(typedMatch).toBeDefined();
    });

    it('should extract array type from axios.get<User[]>()', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const arrayMatch = matches.find((m: MatchResult) => {
        const typeInference = m.captures?.typeInference as Array<{ method?: string; typeText?: string }> | undefined;
        return typeInference?.some(t => 
          t.method === 'generic-param' && 
          t.typeText === 'User[]'
        );
      });
      
      expect(arrayMatch).toBeDefined();
    });

    it('should extract response type from axios.post<CreateUserResponse>()', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const postTypedMatch = matches.find((m: MatchResult) => {
        const typeInference = m.captures?.typeInference as Array<{ method?: string; typeText?: string }> | undefined;
        return m.captures?.httpMethod === 'POST' &&
               typeInference?.some(t => 
                 t.method === 'generic-param' && 
                 t.typeText?.includes('Response')
               );
      });
      
      expect(postTypedMatch).toBeDefined();
    });

    it('should mark generic param type inference as high confidence', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const typedMatch = matches.find((m: MatchResult) => {
        const typeInference = m.captures?.typeInference as Array<{ method?: string; confidence?: string }> | undefined;
        return typeInference?.some(t => 
          t.method === 'generic-param' && 
          t.confidence === 'high'
        );
      });
      
      expect(typedMatch).toBeDefined();
    });
  });

  describe('axios config object pattern', () => {
    it('should detect axios({ method, url }) call', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const configMatch = matches.find((m: MatchResult) => 
        m.identifier.includes('/api/users') &&
        m.captures?.clientLibrary === 'axios'
      );
      
      expect(configMatch).toBeDefined();
    });

    it('should extract method from config object', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const postConfigMatch = matches.find((m: MatchResult) => {
        const url = m.captures?.url as { raw?: string } | undefined;
        return m.captures?.httpMethod === 'POST' &&
               url?.raw?.includes('/api/users');
      });
      
      expect(postConfigMatch).toBeDefined();
    });

    it('should extract baseURL from config object', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const baseUrlMatch = matches.find((m: MatchResult) => {
        const url = m.captures?.url as { baseURL?: string } | undefined;
        return url?.baseURL?.includes('https://api.example.com');
      });
      
      expect(baseUrlMatch).toBeDefined();
    });

    it('should extract data from config object', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      const dataMatch = matches.find((m: MatchResult) => 
        m.captures?.requestBody !== undefined &&
        m.captures?.httpMethod === 'POST'
      );
      
      expect(dataMatch).toBeDefined();
    });
  });

  describe('instance tracking', () => {
    it('should track axios.create() with baseURL', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_INSTANCE_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      // Should have detected instance usage
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should resolve api.get() to baseURL + path', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_INSTANCE_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      // api instance has baseURL '/api'
      // api.get('/users') should resolve to '/api/users'
      const resolvedMatch = matches.find((m: MatchResult) => {
        const url = m.captures?.url as { baseURL?: string; raw?: string } | undefined;
        return (url?.baseURL === '/api' && 
                url?.raw === '/users') ||
               m.identifier.includes('/api/users');
      });
      
      expect(resolvedMatch).toBeDefined();
    });

    it('should track multiple instances with different baseURLs', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_INSTANCE_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      // Should find matches for authApi, dataApi, adminApi
      const authMatches = matches.filter((m: MatchResult) => {
        const url = m.captures?.url as { baseURL?: string } | undefined;
        return url?.baseURL === '/auth' ||
               m.identifier.includes('/auth/');
      });
      const dataMatches = matches.filter((m: MatchResult) => {
        const url = m.captures?.url as { baseURL?: string } | undefined;
        return url?.baseURL === '/data' ||
               m.identifier.includes('/data/');
      });
      
      expect(authMatches.length).toBeGreaterThan(0);
      expect(dataMatches.length).toBeGreaterThan(0);
    });

    it('should track axiosInstance property on captures', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_INSTANCE_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      const instanceMatch = matches.find((m: MatchResult) => {
        const axiosInstance = m.captures?.axiosInstance as string | undefined;
        return axiosInstance !== undefined && axiosInstance !== 'axios';
      });
      
      expect(instanceMatch).toBeDefined();
    });

    it('should recognize common instance variable names', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_INSTANCE_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      // httpClient, client, instance, axiosInstance, http, request
      const namedMatches = matches.filter((m: MatchResult) => {
        const axiosInstance = m.captures?.axiosInstance as string | undefined;
        return ['httpClient', 'client', 'instance', 'axiosInstance', 'http', 'request', 'api']
          .includes(axiosInstance || '');
      });
      
      expect(namedMatches.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// URL Extraction Tests
// =============================================================================

describe('URL Extraction', () => {
  describe('extractURL function', () => {
    it('should extract static string URL', async () => {
      const { extractURL } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-url.ts',
        `fetch('/api/users');`,
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const urlArg = call.getArguments()[0];
        const result = extractURL(urlArg);
        
        expect(result).toBeDefined();
        expect(result!.raw).toBe('/api/users');
        expect(result!.static).toBe('/api/users');
        expect(result!.isDynamic).toBe(false);
      }
    });

    it('should extract template literal with variable', async () => {
      const { extractURL } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-url2.ts',
        'const id = "123"; fetch(`/api/users/${id}`);',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const urlArg = call.getArguments()[0];
        const result = extractURL(urlArg);
        
        expect(result).toBeDefined();
        expect(result!.isDynamic).toBe(true);
        expect(result!.pattern).toContain(':id');
        expect(result!.pathParams).toContain('id');
      }
    });

    it('should extract template literal with multiple variables', async () => {
      const { extractURL } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-url3.ts',
        'const userId = "1"; const postId = "2"; fetch(`/api/users/${userId}/posts/${postId}`);',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const urlArg = call.getArguments()[0];
        const result = extractURL(urlArg);
        
        expect(result).toBeDefined();
        expect(result!.pathParams).toHaveLength(2);
        expect(result!.pathParams).toContain('userId');
        expect(result!.pathParams).toContain('postId');
        expect(result!.pattern).toContain(':userId');
        expect(result!.pattern).toContain(':postId');
      }
    });

    it('should handle no substitution template literal', async () => {
      const { extractURL } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-url4.ts',
        'fetch(`/api/users`);',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const urlArg = call.getArguments()[0];
        const result = extractURL(urlArg);
        
        expect(result).toBeDefined();
        expect(result!.raw).toBe('/api/users');
        expect(result!.isDynamic).toBe(false);
      }
    });

    it('should resolve URL from identifier', async () => {
      const { extractURL } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-url5.ts',
        'const API_URL = "/api/users"; fetch(API_URL);',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const urlArg = call.getArguments()[0];
        const result = extractURL(urlArg);
        
        expect(result).toBeDefined();
        expect(result!.static).toBe('/api/users');
      }
    });

    it('should extract query parameters from URL', async () => {
      const { extractURL } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-url6.ts',
        'fetch("/api/users?page=1&limit=10");',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const urlArg = call.getArguments()[0];
        const result = extractURL(urlArg);
        
        expect(result).toBeDefined();
        expect(result!.queryParams).toContain('page');
        expect(result!.queryParams).toContain('limit');
      }
    });

    it('should extract Express-style path parameters', async () => {
      const { extractURL } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-url7.ts',
        'fetch("/api/users/:userId/posts/:postId");',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const urlArg = call.getArguments()[0];
        const result = extractURL(urlArg);
        
        expect(result).toBeDefined();
        expect(result!.pathParams).toContain('userId');
        expect(result!.pathParams).toContain('postId');
      }
    });
  });

  describe('composeURL function', () => {
    it('should compose baseURL with path', async () => {
      const { composeURL } = await import('../src/patterns/http-clients/index.js');
      const result = composeURL('/api', '/users');
      expect(result).toBe('/api/users');
    });

    it('should handle trailing slash in baseURL', async () => {
      const { composeURL } = await import('../src/patterns/http-clients/index.js');
      const result = composeURL('/api/', '/users');
      expect(result).toBe('/api/users');
    });

    it('should handle missing leading slash in path', async () => {
      const { composeURL } = await import('../src/patterns/http-clients/index.js');
      const result = composeURL('/api', 'users');
      expect(result).toBe('/api/users');
    });

    it('should handle full URL baseURL', async () => {
      const { composeURL } = await import('../src/patterns/http-clients/index.js');
      const result = composeURL('https://api.example.com/v1', '/users');
      expect(result).toBe('https://api.example.com/v1/users');
    });
  });
});

// =============================================================================
// Type Inference Tests
// =============================================================================

describe('Type Inference', () => {
  describe('findTypeInferenceSources function', () => {
    it('should find generic type parameter on axios call', async () => {
      const { findTypeInferenceSources } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-type1.ts',
        'import axios from "axios"; const { data } = await axios.get<User>("/api/users/1");',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const sources = findTypeInferenceSources(call);
        
        expect(sources).toContainEqual(expect.objectContaining({
          method: 'generic-param',
          typeText: 'User',
          confidence: 'high',
        }));
      }
    });

    it('should find variable type annotation', async () => {
      const { findTypeInferenceSources } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-type2.ts',
        'interface User { name: string } const user: User = await fetch("/api/users/1").then(r => r.json());',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const sources = findTypeInferenceSources(call);
        
        expect(sources).toContainEqual(expect.objectContaining({
          method: 'variable-annotation',
          typeText: 'User',
          confidence: 'high',
        }));
      }
    });

    it('should find type assertion (as T)', async () => {
      const { findTypeInferenceSources } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-type3.ts',
        'interface User { name: string } const user = await fetch("/api/users/1").then(r => r.json()) as User;',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const sources = findTypeInferenceSources(call);
        
        expect(sources).toContainEqual(expect.objectContaining({
          method: 'cast-expression',
          typeText: 'User',
          confidence: 'high',
        }));
      }
    });

    it('should find function return type annotation', async () => {
      const { findTypeInferenceSources } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-type4.ts',
        'interface User { name: string } async function getUser(): Promise<User> { return fetch("/api/users/1").then(r => r.json()); }',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const sources = findTypeInferenceSources(call);
        
        expect(sources).toContainEqual(expect.objectContaining({
          method: 'return-type',
          confidence: 'medium',
        }));
      }
    });

    it('should unwrap Promise<T> to get T', async () => {
      const { findTypeInferenceSources } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-type5.ts',
        'interface User { name: string } async function getUser(): Promise<User> { return fetch("/api/users/1").then(r => r.json()); }',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const sources = findTypeInferenceSources(call);
        
        interface TypeSource { method: string; typeText?: string }
        const returnTypeSource = sources.find((s: TypeSource) => s.method === 'return-type');
        // Should unwrap Promise<User> to User
        expect(returnTypeSource?.typeText).toBe('User');
      }
    });

    it('should rank sources by confidence: generic > annotation > return', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, TYPE_INFERENCE_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      // Tests where multiple sources exist should prefer higher confidence
      const multiSourceMatch = matches.find((m: MatchResult) => {
        const typeInference = m.captures?.typeInference as unknown[] | undefined;
        return typeInference && typeInference.length > 1;
      });
      
      if (multiSourceMatch) {
        const typeInference = multiSourceMatch.captures?.typeInference as Array<{ confidence?: string }>;
        // First source should be highest confidence
        expect(typeInference[0].confidence).toBe('high');
      }
    });
  });
});

// =============================================================================
// Property Access Tracking Tests
// =============================================================================

describe('Property Access Tracking', () => {
  interface PropertyAccess {
    path: string;
    segments: string[];
    location?: { file: string; line: number };
  }

  describe('trackPropertyAccesses function', () => {
    it('should track direct property access: data.name', async () => {
      const { trackPropertyAccesses } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-prop1.ts',
        'const data = await fetch("/api").then(r => r.json()); console.log(data.name);',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const accesses = trackPropertyAccesses(call, 'data');
        
        expect(accesses).toContainEqual(expect.objectContaining({
          path: 'name',
          segments: ['name'],
        }));
      }
    });

    it('should track nested property access: data.user.email', async () => {
      const { trackPropertyAccesses } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-prop2.ts',
        'const data = await fetch("/api").then(r => r.json()); console.log(data.user.email);',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const accesses = trackPropertyAccesses(call, 'data');
        
        expect(accesses).toContainEqual(expect.objectContaining({
          path: 'user.email',
          segments: ['user', 'email'],
        }));
      }
    });

    it('should track deeply nested property access', async () => {
      const { trackPropertyAccesses } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-prop3.ts',
        'const data = await fetch("/api").then(r => r.json()); console.log(data.user.profile.settings.theme);',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const accesses = trackPropertyAccesses(call, 'data');
        
        expect(accesses).toContainEqual(expect.objectContaining({
          path: 'user.profile.settings.theme',
          segments: ['user', 'profile', 'settings', 'theme'],
        }));
      }
    });

    it('should track array index access: data[0]', async () => {
      const { trackPropertyAccesses } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-prop4.ts',
        'const data = await fetch("/api").then(r => r.json()); console.log(data[0].name);',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const accesses = trackPropertyAccesses(call, 'data');
        
        const hasArrayAccess = accesses.some((a: PropertyAccess) => 
          a.path.includes('[0]') || a.segments.some((s: string) => s.includes('['))
        );
        expect(hasArrayAccess).toBe(true);
      }
    });

    it('should track object destructuring: const { name, email } = data', async () => {
      const { trackPropertyAccesses } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-prop5.ts',
        'const { name, email } = await fetch("/api").then(r => r.json());',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const accesses = trackPropertyAccesses(call);
        
        expect(accesses).toContainEqual(expect.objectContaining({
          path: 'name',
          segments: ['name'],
        }));
        expect(accesses).toContainEqual(expect.objectContaining({
          path: 'email',
          segments: ['email'],
        }));
      }
    });

    it('should track nested destructuring: const { user: { name } } = data', async () => {
      const { trackPropertyAccesses } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-prop6.ts',
        'const { user: { name } } = await fetch("/api").then(r => r.json());',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const accesses = trackPropertyAccesses(call);
        
        expect(accesses).toContainEqual(expect.objectContaining({
          path: 'user.name',
          segments: ['user', 'name'],
        }));
      }
    });

    it('should track property access in .then() callback', async () => {
      const { trackPropertyAccesses } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-prop7.ts',
        'fetch("/api").then(r => r.json()).then(data => { console.log(data.name); });',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const accesses = trackPropertyAccesses(call);
        
        expect(accesses).toContainEqual(expect.objectContaining({
          path: 'name',
          segments: ['name'],
        }));
      }
    });

    it('should deduplicate property accesses', async () => {
      const { trackPropertyAccesses } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-prop9.ts',
        'const data = await fetch("/api").then(r => r.json()); data.name; data.name; data.name;',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const accesses = trackPropertyAccesses(call, 'data');
        
        const nameAccesses = accesses.filter((a: PropertyAccess) => a.path === 'name');
        expect(nameAccesses).toHaveLength(1);
      }
    });

    it('should track optional chaining: data?.user?.name', async () => {
      const { trackPropertyAccesses } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const sourceFile = project.createSourceFile(
        'test-prop10.ts',
        'const data = await fetch("/api").then(r => r.json()); console.log(data?.user?.name);',
        { overwrite: true }
      );
      
      const call = findFirstCallExpression(sourceFile);
      expect(call).toBeDefined();
      
      if (Node.isCallExpression(call!)) {
        const accesses = trackPropertyAccesses(call, 'data');
        
        // Should track despite optional chaining
        const hasUserAccess = accesses.some((a: PropertyAccess) => 
          a.path.includes('user') || a.path.includes('name')
        );
        expect(hasUserAccess).toBe(true);
      }
    });
  });

  describe('buildTypeFromAccesses function', () => {
    it('should build object type from flat accesses', async () => {
      const { buildTypeFromAccesses } = await import('../src/patterns/http-clients/index.js');
      
      const accesses: PropertyAccess[] = [
        { path: 'name', segments: ['name'], location: { file: '', line: 1 } },
        { path: 'email', segments: ['email'], location: { file: '', line: 2 } },
      ];
      
      const result = buildTypeFromAccesses(accesses);
      
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('email');
    });

    it('should build nested object type from nested accesses', async () => {
      const { buildTypeFromAccesses } = await import('../src/patterns/http-clients/index.js');
      
      const accesses: PropertyAccess[] = [
        { path: 'user.name', segments: ['user', 'name'], location: { file: '', line: 1 } },
        { path: 'user.email', segments: ['user', 'email'], location: { file: '', line: 2 } },
      ];
      
      const result = buildTypeFromAccesses(accesses) as Record<string, Record<string, unknown>>;
      
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('name');
      expect(result.user).toHaveProperty('email');
    });

    it('should mark array accesses correctly', async () => {
      const { buildTypeFromAccesses } = await import('../src/patterns/http-clients/index.js');
      
      const accesses: PropertyAccess[] = [
        { path: '[0].name', segments: ['[0]', 'name'], location: { file: '', line: 1 } },
        { path: '[1].email', segments: ['[1]', 'email'], location: { file: '', line: 2 } },
      ];
      
      const result = buildTypeFromAccesses(accesses) as { _isArray?: boolean; _element?: unknown };
      
      expect(result._isArray || result._element).toBeDefined();
    });
  });
});

// =============================================================================
// ConsumerUsage Output Tests
// =============================================================================

describe('ConsumerUsage Output', () => {
  describe('format validation', () => {
    it('should produce ConsumerUsage with correct identifier format', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      for (const match of matches.slice(0, 5)) {
        const schema = await matcher.extract(match);
        
        // identifier should be "METHOD /path"
        expect(schema.name).toMatch(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) /);
      }
    });

    it('should include method in ConsumerUsage', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      for (const match of matches.slice(0, 3)) {
        const httpMethod = match.captures?.httpMethod;
        expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
          .toContain(httpMethod);
      }
    });

    it('should include URL in ConsumerUsage', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      for (const match of matches.slice(0, 3)) {
        const url = match.captures?.url as { raw?: string } | undefined;
        expect(url).toBeDefined();
        expect(url?.raw).toBeTruthy();
      }
    });

    it('should include expectedResponse type when available', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      const typedMatch = matches.find((m: MatchResult) => {
        const typeInference = m.captures?.typeInference as Array<{ method?: string }> | undefined;
        return typeInference?.some((t) => t.method === 'generic-param');
      });
      
      if (typedMatch) {
        const schema = await matcher.extract(typedMatch);
        // Schema should contain type information
        expect(schema).toBeDefined();
      }
    });

    it('should include requestBody for POST/PUT/PATCH', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      const postMatch = matches.find((m: MatchResult) => 
        m.captures?.httpMethod === 'POST' &&
        m.captures?.requestBody !== undefined
      );
      
      expect(postMatch).toBeDefined();
    });

    it('should include location for error reporting', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, FETCH_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      for (const match of matches.slice(0, 3)) {
        expect(match.location).toBeDefined();
        expect(match.location.file).toBeTruthy();
        expect(typeof match.location.line).toBe('number');
      }
    });

    it('should include clientLibrary identifier', async () => {
      const { FetchPatternMatcher, AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const fetchMatcher = new FetchPatternMatcher();
      const axiosMatcher = new AxiosPatternMatcher();
      
      const fetchFile = loadFixture(project, FETCH_CALLS_FILE);
      const axiosFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const fetchMatches = scanWithMatcher(fetchFile, fetchMatcher);
      const axiosMatches = scanWithMatcher(axiosFile, axiosMatcher);
      
      expect(fetchMatches.every((m: MatchResult) => 
        m.captures?.clientLibrary === 'fetch'
      )).toBe(true);
      
      expect(axiosMatches.every((m: MatchResult) => 
        m.captures?.clientLibrary === 'axios'
      )).toBe(true);
    });

    it('should include accessedProperties list', async () => {
      const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new FetchPatternMatcher();
      const sourceFile = loadFixture(project, PROPERTY_ACCESS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      const matchWithAccesses = matches.find((m: MatchResult) => {
        const propertyAccesses = m.captures?.propertyAccesses as unknown[] | undefined;
        return (propertyAccesses?.length ?? 0) > 0;
      });
      
      expect(matchWithAccesses).toBeDefined();
      
      if (matchWithAccesses) {
        const schema = await matcher.extract(matchWithAccesses);
        expect(schema).toBeDefined();
      }
    });

    it('should include typeSource for traceability', async () => {
      const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
      
      const project = createProject();
      const matcher = new AxiosPatternMatcher();
      const sourceFile = loadFixture(project, AXIOS_CALLS_FILE);
      
      const matches = scanWithMatcher(sourceFile, matcher);
      
      for (const match of matches.slice(0, 3)) {
        const typeInference = match.captures?.typeInference as Array<{ method?: string }> | undefined;
        if (typeInference && typeInference.length > 0) {
          expect(['generic-param', 'variable-annotation', 'cast-expression', 
                  'return-type', 'property-access', 'unknown'])
            .toContain(typeInference[0].method);
        }
      }
    });
  });
});

// =============================================================================
// Bootstrap and Integration Tests
// =============================================================================

describe('Bootstrap and Integration', () => {
  it('should export bootstrapHTTPClientPatterns function', async () => {
    const { bootstrapHTTPClientPatterns } = await import('../src/patterns/http-clients/index.js');
    expect(typeof bootstrapHTTPClientPatterns).toBe('function');
  });

  it('should register matchers when bootstrapped', async () => {
    const { bootstrapHTTPClientPatterns } = await import('../src/patterns/http-clients/index.js');
    
    // Bootstrap should not throw
    expect(() => bootstrapHTTPClientPatterns()).not.toThrow();
  });

  it('should export FetchPatternMatcher class', async () => {
    const { FetchPatternMatcher } = await import('../src/patterns/http-clients/index.js');
    
    expect(FetchPatternMatcher).toBeDefined();
    expect(new FetchPatternMatcher()).toBeInstanceOf(FetchPatternMatcher);
  });

  it('should export AxiosPatternMatcher class', async () => {
    const { AxiosPatternMatcher } = await import('../src/patterns/http-clients/index.js');
    
    expect(AxiosPatternMatcher).toBeDefined();
    expect(new AxiosPatternMatcher()).toBeInstanceOf(AxiosPatternMatcher);
  });

  it('should export utility functions', async () => {
    const httpClients = await import('../src/patterns/http-clients/index.js');
    
    expect(typeof httpClients.extractURL).toBe('function');
    expect(typeof httpClients.composeURL).toBe('function');
    expect(typeof httpClients.findTypeInferenceSources).toBe('function');
    expect(typeof httpClients.trackPropertyAccesses).toBe('function');
    expect(typeof httpClients.buildTypeFromAccesses).toBe('function');
  });

  it('should make fetch matcher available after bootstrap', async () => {
    const { bootstrapHTTPClientPatterns } = await import('../src/patterns/http-clients/index.js');
    const { getPatternsByFramework } = await import('../src/patterns/registry.js');
    
    bootstrapHTTPClientPatterns();
    const fetchMatchers = getPatternsByFramework('fetch');
    
    expect(fetchMatchers.length).toBeGreaterThan(0);
  });

  it('should make axios matcher available after bootstrap', async () => {
    const { bootstrapHTTPClientPatterns } = await import('../src/patterns/http-clients/index.js');
    const { getPatternsByFramework } = await import('../src/patterns/registry.js');
    
    bootstrapHTTPClientPatterns();
    const axiosMatchers = getPatternsByFramework('axios');
    
    expect(axiosMatchers.length).toBeGreaterThan(0);
  });
});
