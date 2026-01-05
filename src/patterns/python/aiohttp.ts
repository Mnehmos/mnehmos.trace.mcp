/**
 * Python aiohttp library HTTP client detection
 * 
 * Detects calls to the aiohttp library:
 * - aiohttp.ClientSession().get(), etc.
 * - session.get(), session.post() within context managers
 * 
 * aiohttp is always async and uses context managers heavily
 * 
 * @see .context/TASK_MAP_P3.md - Task P3-4
 */

import type { 
  PythonHttpCall, 
  HttpMethod, 
  PythonHttpLibrary 
} from './types.js';
import { HTTP_CLIENT_PATTERNS, normalizeHttpMethod } from './types.js';

const AIOHTTP_PATTERN = HTTP_CLIENT_PATTERNS.aiohttp;

/**
 * Track known session variable names
 */
const sessionVars = new Set<string>();

/**
 * Detect HTTP calls from the aiohttp library in Python source code
 */
export function detectAiohttpCalls(content: string): PythonHttpCall[] {
  const calls: PythonHttpCall[] = [];
  const lines = content.split('\n');
  
  // First pass: detect imports
  const hasAiohttpImport = /^\s*import\s+aiohttp\b/m.test(content) || 
                           /^\s*from\s+aiohttp\s+import\s+/.test(content);
  
  if (!hasAiohttpImport) {
    return [];
  }
  
  // Second pass: find session variables
  sessionVars.clear();
  
  // Match: async with aiohttp.ClientSession() as session:
  const asyncWithSessionRegex = /async\s+with\s+(?:aiohttp\.)?ClientSession\s*\([^)]*\)\s+as\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = asyncWithSessionRegex.exec(content)) !== null) {
    sessionVars.add(match[1]);
  }
  
  // Match: session = aiohttp.ClientSession()
  const sessionCreateRegex = /\b(\w+)\s*=\s*(?:aiohttp\.)?ClientSession\s*\(/g;
  while ((match = sessionCreateRegex.exec(content)) !== null) {
    sessionVars.add(match[1]);
  }
  
  // Also match common variable names that might be sessions
  // (client, session, http_session, api_session)
  const commonSessionNames = ['session', 'client', 'http_session', 'api_session'];
  for (const name of commonSessionNames) {
    const regex = new RegExp(`\\b${name}\\s*=\\s*(?:aiohttp\\.)?ClientSession\\s*\\(`, 'g');
    if (regex.test(content)) {
      sessionVars.add(name);
    }
  }
  
  // Third pass: detect HTTP calls line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Detect session.method() calls in context managers
    // Pattern: async with session.get(...) as response:
    const asyncWithMethodRegex = /async\s+with\s+(\w+)\.(get|post|put|patch|delete|head|options|request)\s*\(/gi;
    while ((match = asyncWithMethodRegex.exec(line)) !== null) {
      const sessionVar = match[1];
      const method = normalizeHttpMethod(match[2]);
      
      // Check if it's a known session or likely a session
      if (method && (sessionVars.has(sessionVar) || isLikelySession(sessionVar, content))) {
        const call = createHttpCall(method, 'aiohttp', line, lineNum, match.index);
        call.isSession = true;
        call.isAsync = true;
        
        // Extract response variable from "as response"
        const asMatch = line.match(/as\s+(\w+)\s*:/);
        if (asMatch) {
          call.responseVariable = asMatch[1];
        }
        
        calls.push(call);
      }
    }
    
    // Detect await session.method() calls (not in context manager)
    // Pattern: await session.get(...)
    for (const sessionVar of sessionVars) {
      const awaitCallRegex = new RegExp(
        `await\\s+${escapeRegex(sessionVar)}\\.(get|post|put|patch|delete|head|options|request)\\s*\\(`,
        'gi'
      );
      while ((match = awaitCallRegex.exec(line)) !== null) {
        const method = normalizeHttpMethod(match[1]);
        if (method) {
          const call = createHttpCall(method, 'aiohttp', line, lineNum, match.index);
          call.isSession = true;
          call.isAsync = true;
          calls.push(call);
        }
      }
    }
  }
  
  return calls;
}

/**
 * Check if a variable name is likely a session based on context
 */
function isLikelySession(varName: string, content: string): boolean {
  // Common patterns that indicate aiohttp session
  const sessionIndicators = [
    `${varName} = aiohttp.ClientSession`,
    `${varName} = ClientSession`,
    `aiohttp.ClientSession() as ${varName}`,
    `ClientSession() as ${varName}`
  ];
  
  for (const indicator of sessionIndicators) {
    if (content.includes(indicator)) {
      return true;
    }
  }
  
  // Variable names that suggest sessions
  const sessionNamePatterns = /^(session|client|http_client|api_client|http_session|api_session)$/i;
  return sessionNamePatterns.test(varName);
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
    column,
    isAsync: true  // aiohttp is always async
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
  if (/\bjson\s*=/.test(line) || /\bdata\s*=/.test(line)) {
    call.hasBody = true;
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
  
  // Generic string match after opening paren
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
 * Get the response properties that aiohttp library supports
 */
export function getAiohttpResponseProperties(): string[] {
  return AIOHTTP_PATTERN.responseAccess;
}
