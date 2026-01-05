/**
 * Python HTTP Client Tracing Tests
 * 
 * Tests for Python HTTP client detection (requests, httpx, aiohttp)
 * Tests the traceUsage() method in PythonASTParser
 * 
 * @see .context/TASK_MAP_P3.md - Task P3-4
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import { PythonASTParser } from '../src/languages/python-ast/parser.js';
import type { ConsumerSchema } from '../src/types.js';
import type { PythonParseOptions } from '../src/languages/python-ast/types.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const FIXTURES_DIR = path.resolve(process.cwd(), 'test', 'fixtures', 'python-http-samples');

function loadFixture(filename: string): string {
  return readFileSync(path.join(FIXTURES_DIR, filename), 'utf-8');
}

// =============================================================================
// Test Setup
// =============================================================================

describe('Python HTTP Client Tracing', () => {
  let parser: PythonASTParser;
  let requestsContent: string;
  let httpxContent: string;
  let aiohttpContent: string;

  beforeAll(async () => {
    parser = new PythonASTParser();
    await parser.initialize();
    
    requestsContent = loadFixture('requests-calls.py');
    httpxContent = loadFixture('httpx-calls.py');
    aiohttpContent = loadFixture('aiohttp-calls.py');
  });

  // ===========================================================================
  // requests library detection
  // ===========================================================================
  
  describe('requests library', () => {
    it('should detect requests.get() calls', async () => {
      const schemas = await parser.traceUsage({ 
        rootDir: FIXTURES_DIR 
      } as PythonParseOptions & { content?: string });
      
      // Use content-based parsing
      const options: PythonParseOptions = { content: requestsContent };
      const results = await traceHttpCalls(parser, options);
      
      const getRequests = results.filter(s => 
        s.toolName.includes('GET') && 
        s.argumentsProvided?.library === 'requests'
      );
      
      expect(getRequests.length).toBeGreaterThan(0);
    });

    it('should detect requests.post() calls', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      const postRequests = results.filter(s => 
        s.toolName.includes('POST') && 
        s.argumentsProvided?.library === 'requests'
      );
      
      expect(postRequests.length).toBeGreaterThan(0);
    });

    it('should detect requests.put() calls', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      const putRequests = results.filter(s => 
        s.toolName.includes('PUT') &&
        s.argumentsProvided?.library === 'requests'
      );
      
      expect(putRequests.length).toBeGreaterThan(0);
    });

    it('should detect requests.patch() calls', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      const patchRequests = results.filter(s => 
        s.toolName.includes('PATCH') &&
        s.argumentsProvided?.library === 'requests'
      );
      
      expect(patchRequests.length).toBeGreaterThan(0);
    });

    it('should detect requests.delete() calls', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      const deleteRequests = results.filter(s => 
        s.toolName.includes('DELETE') &&
        s.argumentsProvided?.library === 'requests'
      );
      
      expect(deleteRequests.length).toBeGreaterThan(0);
    });

    it('should detect session.get() calls with Session', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      const sessionRequests = results.filter(s => 
        s.argumentsProvided?.isSession === true
      );
      
      expect(sessionRequests.length).toBeGreaterThan(0);
    });

    it('should extract URL from requests call', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      const withUrl = results.filter(s => 
        s.argumentsProvided?.url !== undefined
      );
      
      expect(withUrl.length).toBeGreaterThan(0);
      
      // Check that at least one has a specific URL
      const specificUrl = withUrl.find(s => 
        (s.argumentsProvided?.url as string)?.includes('api.example.com')
      );
      expect(specificUrl).toBeDefined();
    });

    it('should detect response.json() property access', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      const withJsonAccess = results.filter(s => 
        s.expectedProperties?.includes('json')
      );
      
      expect(withJsonAccess.length).toBeGreaterThan(0);
    });

    it('should detect response.text property access', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      const withTextAccess = results.filter(s => 
        s.expectedProperties?.includes('text')
      );
      
      expect(withTextAccess.length).toBeGreaterThan(0);
    });

    it('should detect response.status_code property access', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      const withStatusAccess = results.filter(s => 
        s.expectedProperties?.includes('status_code')
      );
      
      expect(withStatusAccess.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // httpx library detection
  // ===========================================================================
  
  describe('httpx library', () => {
    it('should detect httpx.get() calls', async () => {
      const results = await traceHttpCalls(parser, { content: httpxContent });
      
      const getRequests = results.filter(s => 
        s.toolName.includes('GET') && 
        s.argumentsProvided?.library === 'httpx'
      );
      
      expect(getRequests.length).toBeGreaterThan(0);
    });

    it('should detect httpx.post() calls', async () => {
      const results = await traceHttpCalls(parser, { content: httpxContent });
      
      const postRequests = results.filter(s => 
        s.toolName.includes('POST') && 
        s.argumentsProvided?.library === 'httpx'
      );
      
      expect(postRequests.length).toBeGreaterThan(0);
    });

    it('should detect httpx.Client() usage', async () => {
      const results = await traceHttpCalls(parser, { content: httpxContent });
      
      const clientRequests = results.filter(s => 
        s.argumentsProvided?.isClient === true &&
        s.argumentsProvided?.library === 'httpx'
      );
      
      expect(clientRequests.length).toBeGreaterThan(0);
    });

    it('should detect httpx.AsyncClient() usage', async () => {
      const results = await traceHttpCalls(parser, { content: httpxContent });
      
      const asyncClientRequests = results.filter(s => 
        s.argumentsProvided?.isAsyncClient === true
      );
      
      expect(asyncClientRequests.length).toBeGreaterThan(0);
    });

    it('should detect async/await httpx patterns', async () => {
      const results = await traceHttpCalls(parser, { content: httpxContent });
      
      const asyncRequests = results.filter(s => 
        s.argumentsProvided?.isAsync === true &&
        s.argumentsProvided?.library === 'httpx'
      );
      
      expect(asyncRequests.length).toBeGreaterThan(0);
    });

    it('should detect response.is_success property (httpx-specific)', async () => {
      const results = await traceHttpCalls(parser, { content: httpxContent });
      
      const withIsSuccess = results.filter(s => 
        s.expectedProperties?.includes('is_success')
      );
      
      expect(withIsSuccess.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // aiohttp library detection
  // ===========================================================================
  
  describe('aiohttp library', () => {
    it('should detect aiohttp.ClientSession().get() calls', async () => {
      const results = await traceHttpCalls(parser, { content: aiohttpContent });
      
      const getRequests = results.filter(s => 
        s.toolName.includes('GET') && 
        s.argumentsProvided?.library === 'aiohttp'
      );
      
      expect(getRequests.length).toBeGreaterThan(0);
    });

    it('should detect aiohttp.ClientSession().post() calls', async () => {
      const results = await traceHttpCalls(parser, { content: aiohttpContent });
      
      const postRequests = results.filter(s => 
        s.toolName.includes('POST') && 
        s.argumentsProvided?.library === 'aiohttp'
      );
      
      expect(postRequests.length).toBeGreaterThan(0);
    });

    it('should detect session.delete() calls', async () => {
      const results = await traceHttpCalls(parser, { content: aiohttpContent });
      
      const deleteRequests = results.filter(s => 
        s.toolName.includes('DELETE') &&
        s.argumentsProvided?.library === 'aiohttp'
      );
      
      expect(deleteRequests.length).toBeGreaterThan(0);
    });

    it('should detect async context manager patterns', async () => {
      const results = await traceHttpCalls(parser, { content: aiohttpContent });
      
      // aiohttp always uses async context managers
      const asyncRequests = results.filter(s => 
        s.argumentsProvided?.isAsync === true &&
        s.argumentsProvided?.library === 'aiohttp'
      );
      
      expect(asyncRequests.length).toBeGreaterThan(0);
    });

    it('should detect response.json() awaited call', async () => {
      const results = await traceHttpCalls(parser, { content: aiohttpContent });
      
      const withJsonAccess = results.filter(s => 
        s.expectedProperties?.includes('json') &&
        s.argumentsProvided?.library === 'aiohttp'
      );
      
      expect(withJsonAccess.length).toBeGreaterThan(0);
    });

    it('should detect response.text() awaited call', async () => {
      const results = await traceHttpCalls(parser, { content: aiohttpContent });
      
      const withTextAccess = results.filter(s => 
        s.expectedProperties?.includes('text') &&
        s.argumentsProvided?.library === 'aiohttp'
      );
      
      expect(withTextAccess.length).toBeGreaterThan(0);
    });

    it('should detect response.status property access', async () => {
      const results = await traceHttpCalls(parser, { content: aiohttpContent });
      
      const withStatusAccess = results.filter(s => 
        s.expectedProperties?.includes('status')
      );
      
      expect(withStatusAccess.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // URL extraction tests
  // ===========================================================================
  
  describe('URL extraction', () => {
    it('should extract static string URLs', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      const staticUrls = results.filter(s => {
        const url = s.argumentsProvided?.url as string;
        return url?.startsWith('https://');
      });
      
      expect(staticUrls.length).toBeGreaterThan(0);
    });

    it('should extract f-string URLs with path parameters', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      const dynamicUrls = results.filter(s => 
        s.argumentsProvided?.isDynamicUrl === true
      );
      
      expect(dynamicUrls.length).toBeGreaterThan(0);
    });

    it('should extract path parameters from URLs', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      const withPathParams = results.filter(s => {
        const params = s.argumentsProvided?.pathParams as string[];
        return params && params.length > 0;
      });
      
      expect(withPathParams.length).toBeGreaterThan(0);
    });

    it('should detect query parameters', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      const withQueryParams = results.filter(s => 
        s.argumentsProvided?.hasQueryParams === true
      );
      
      expect(withQueryParams.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // ConsumerSchema format tests
  // ===========================================================================
  
  describe('ConsumerSchema format', () => {
    it('should produce ConsumerSchema with toolName as METHOD URL', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      expect(results.length).toBeGreaterThan(0);
      
      // toolName should be "METHOD URL" format
      for (const schema of results.slice(0, 5)) {
        expect(schema.toolName).toMatch(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)/);
      }
    });

    it('should include callSite with file and line', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      for (const schema of results.slice(0, 5)) {
        expect(schema.callSite).toBeDefined();
        expect(typeof schema.callSite.line).toBe('number');
        expect(schema.callSite.line).toBeGreaterThan(0);
      }
    });

    it('should include argumentsProvided with request info', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      for (const schema of results.slice(0, 5)) {
        expect(schema.argumentsProvided).toBeDefined();
        expect(schema.argumentsProvided.method).toBeDefined();
        expect(schema.argumentsProvided.library).toBeDefined();
      }
    });

    it('should include expectedProperties for response access', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      const withProperties = results.filter(s => 
        s.expectedProperties && s.expectedProperties.length > 0
      );
      
      expect(withProperties.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Edge cases and combined tests
  // ===========================================================================
  
  describe('edge cases', () => {
    it('should handle multiple requests in same file', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      // Should find multiple HTTP calls
      expect(results.length).toBeGreaterThan(5);
    });

    it('should handle requests with headers', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      const withHeaders = results.filter(s => 
        s.argumentsProvided?.hasHeaders === true
      );
      
      expect(withHeaders.length).toBeGreaterThan(0);
    });

    it('should handle requests with JSON body', async () => {
      const results = await traceHttpCalls(parser, { content: requestsContent });
      
      const withBody = results.filter(s => 
        s.argumentsProvided?.hasBody === true
      );
      
      expect(withBody.length).toBeGreaterThan(0);
    });

    it('should handle all three libraries in combined content', async () => {
      const combined = requestsContent + '\n\n' + httpxContent + '\n\n' + aiohttpContent;
      const results = await traceHttpCalls(parser, { content: combined });
      
      const requestsLib = results.filter(s => s.argumentsProvided?.library === 'requests');
      const httpxLib = results.filter(s => s.argumentsProvided?.library === 'httpx');
      const aiohttpLib = results.filter(s => s.argumentsProvided?.library === 'aiohttp');
      
      expect(requestsLib.length).toBeGreaterThan(0);
      expect(httpxLib.length).toBeGreaterThan(0);
      expect(aiohttpLib.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Helper function to trace HTTP calls
// =============================================================================

/**
 * Helper to trace HTTP client calls from Python content
 */
async function traceHttpCalls(parser: PythonASTParser, options: PythonParseOptions): Promise<ConsumerSchema[]> {
  // Use the traceUsage method with content
  const extendedOptions = {
    ...options,
    rootDir: options.rootDir || FIXTURES_DIR,
  };
  
  // The parser's traceUsage now accepts content directly
  return parser.traceUsage(extendedOptions as PythonParseOptions & { content?: string });
}
