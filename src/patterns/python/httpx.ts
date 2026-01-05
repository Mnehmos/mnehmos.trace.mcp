/**
 * Python httpx library HTTP client detection
 * 
 * Detects calls to the httpx library:
 * - httpx.get(), httpx.post(), etc. (sync)
 * - client.get(), client.post() with Client instances
 * - AsyncClient for async operations
 * 
 * @see .context/TASK_MAP_P3.md - Task P3-4
 */

import type { 
  PythonHttpCall, 
  HttpMethod, 
  PythonHttpLibrary 
} from './types.js';
import { HTTP_CLIENT_PATTERNS, normalizeHttpMethod } from './types.js';

const HTTPX_PATTERN = HTTP_CLIENT_PATTERNS.httpx;

/**
 * Track known client variable names
 */
const clientVars = new Map<string, { isAsync: boolean }>();

/**
 * Detect HTTP calls from the httpx library in Python source code
 */
export function detectHttpxCalls(content: string): PythonHttpCall[] {
  const calls: PythonHttpCall[] = [];
  const lines = content.split('\n');
  
  // First pass: detect imports
  const hasHttpxImport = /^\s*import\s+httpx\b/m.test(content) || 
                         /^\s*from\s+httpx\s+import\s+/.test(content);
  
  if (!hasHttpxImport) {
    return [];
  }
  
  // Second pass: find client variables
  clientVars.clear();
  
  // Match: client = httpx.Client()
  const clientCreateRegex = /\b(\w+)\s*=\s*(?:httpx\.)?Client\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = clientCreateRegex.exec(content)) !== null) {
    clientVars.set(match[1], { isAsync: false });
  }
  
  // Match: client = httpx.AsyncClient()
  const asyncClientCreateRegex = /\b(\w+)\s*=\s*(?:httpx\.)?AsyncClient\s*\(/g;
  while ((match = asyncClientCreateRegex.exec(content)) !== null) {
    clientVars.set(match[1], { isAsync: true });
  }
  
  // Match: with httpx.Client() as client:
  const withClientRegex = /with\s+(?:httpx\.)?Client\s*\([^)]*\)\s+as\s+(\w+)/g;
  while ((match = withClientRegex.exec(content)) !== null) {
    clientVars.set(match[1], { isAsync: false });
  }
  
  // Match: async with httpx.AsyncClient() as client:
  const asyncWithClientRegex = /async\s+with\s+(?:httpx\.)?AsyncClient\s*\([^)]*\)\s+as\s+(\w+)/g;
  while ((match = asyncWithClientRegex.exec(content)) !== null) {
    clientVars.set(match[1], { isAsync: true });
  }
  
  // Third pass: detect HTTP calls line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Detect direct httpx.method() calls
    const directCallRegex = /\bhttpx\.(get|post|put|patch|delete|head|options|request)\s*\(/gi;
    while ((match = directCallRegex.exec(line)) !== null) {
      const method = normalizeHttpMethod(match[1]);
      if (method) {
        const call = createHttpCall(method, 'httpx', line, lineNum, match.index);
        call.isClient = false;
        call.isAsyncClient = false;
        call.isAsync = false;
        calls.push(call);
      }
    }
    
    // Detect await httpx.AsyncClient().method() inline calls
    const inlineAsyncRegex = /await\s+httpx\.AsyncClient\s*\(\s*\)\s*\.(get|post|put|patch|delete|head|options|request)\s*\(/gi;
    while ((match = inlineAsyncRegex.exec(line)) !== null) {
      const method = normalizeHttpMethod(match[1]);
      if (method) {
        const call = createHttpCall(method, 'httpx', line, lineNum, match.index);
        call.isClient = false;
        call.isAsyncClient = true;
        call.isAsync = true;
        calls.push(call);
      }
    }
    
    // Detect client.method() calls
    for (const [clientVar, info] of clientVars) {
      const clientCallRegex = new RegExp(
        `(?:await\\s+)?\\b${escapeRegex(clientVar)}\\.(get|post|put|patch|delete|head|options|request)\\s*\\(`,
        'gi'
      );
      while ((match = clientCallRegex.exec(line)) !== null) {
        const method = normalizeHttpMethod(match[1]);
        if (method) {
          const call = createHttpCall(method, 'httpx', line, lineNum, match.index);
          call.isClient = !info.isAsync;
          call.isAsyncClient = info.isAsync;
          call.isAsync = info.isAsync || line.includes('await');
          calls.push(call);
        }
      }
    }
  }
  
  return calls;
}

/**
 * Create a PythonHttpCall from a detected call
 */
function createHttpCall(
  method: HttpMethod,
  library: PythonHttpLibrary,
  line: string,
  lineNum: number,
  column: number
): PythonHttpCall {
  const call: PythonHttpCall = {
    method,
    library,
    line: lineNum,
    column
  };
  
  // Extract URL
  const urlInfo = extractUrl(line);
  if (urlInfo) {
    call.url = urlInfo.url;
    call.isDynamicUrl = urlInfo.isDynamic;
    call.pathParams = urlInfo.pathParams;
  }
  
  // Detect query params
  if (/\bparams\s*=/.test(line)) {
    call.hasQueryParams = true;
  }
  
  // URL with query string
  if (call.url?.includes('?')) {
    call.hasQueryParams = true;
  }
  
  // Detect headers
  if (/\bheaders\s*=/.test(line)) {
    call.hasHeaders = true;
  }
  
  // Detect body
  if (/\bjson\s*=/.test(line) || /\bdata\s*=/.test(line) || /\bcontent\s*=/.test(line)) {
    call.hasBody = true;
  }
  
  // Extract response variable
  const assignMatch = line.match(/^\s*(\w+)\s*=/);
  if (assignMatch) {
    call.responseVariable = assignMatch[1];
  }
  
  // Also check for async response assignment
  const asyncAssignMatch = line.match(/^\s*(\w+)\s*=\s*await\b/);
  if (asyncAssignMatch) {
    call.responseVariable = asyncAssignMatch[1];
    call.isAsync = true;
  }
  
  return call;
}

/**
 * Extract URL from a call line
 */
function extractUrl(line: string): { url: string; isDynamic: boolean; pathParams: string[] } | null {
  // Match f-strings first
  const fstringMatch = line.match(/f["']([^"']+)["']/);
  if (fstringMatch) {
    const url = fstringMatch[1];
    const pathParams: string[] = [];
    let paramMatch: RegExpExecArray | null;
    const paramRegex = /\{(\w+)\}/g;
    while ((paramMatch = paramRegex.exec(url)) !== null) {
      pathParams.push(paramMatch[1]);
    }
    return { url, isDynamic: true, pathParams };
  }
  
  // Match regular strings - look for method call with string arg
  const stringMatch = line.match(/\.(get|post|put|patch|delete|head|options|request)\s*\(\s*["']([^"']+)["']/i);
  if (stringMatch) {
    return { url: stringMatch[2], isDynamic: false, pathParams: [] };
  }
  
  // Generic string match
  const genericMatch = line.match(/\(\s*["']([^"']+)["']/);
  if (genericMatch) {
    return { url: genericMatch[1], isDynamic: false, pathParams: [] };
  }
  
  return null;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get the response properties that httpx library supports
 */
export function getHttpxResponseProperties(): string[] {
  return HTTPX_PATTERN.responseAccess;
}
