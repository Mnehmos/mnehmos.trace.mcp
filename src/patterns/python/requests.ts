/**
 * Python requests library HTTP client detection
 * 
 * Detects calls to the requests library:
 * - requests.get(), requests.post(), etc.
 * - session.get(), session.post() with Session instances
 * 
 * @see .context/TASK_MAP_P3.md - Task P3-4
 */

import type { 
  PythonHttpCall, 
  HttpMethod, 
  PythonHttpLibrary 
} from './types.js';
import { HTTP_CLIENT_PATTERNS, normalizeHttpMethod } from './types.js';

const REQUESTS_PATTERN = HTTP_CLIENT_PATTERNS.requests;

/**
 * Regex patterns for detecting requests library calls
 */
const PATTERNS = {
  // Import detection
  importRequests: /^\s*import\s+requests\b/m,
  fromRequests: /^\s*from\s+requests\s+import\s+(.+)/m,
  
  // Direct function calls: requests.get(...), requests.post(...)
  directCall: /\brequests\.(get|post|put|patch|delete|head|options|request)\s*\(/gi,
  
  // Session creation: requests.Session(), Session()
  sessionCreate: /\b(\w+)\s*=\s*(?:requests\.)?Session\s*\(\s*\)/g,
  
  // Session method calls: session.get(...), session.post(...)
  sessionCall: /\b(\w+)\.(get|post|put|patch|delete|head|options|request)\s*\(/gi,
  
  // Response assignment: response = requests.get(...)
  responseAssign: /\b(\w+)\s*=\s*(?:requests\.)?(?:\w+\.)?(get|post|put|patch|delete|head|options|request)\s*\(/gi,
  
  // URL extraction from calls (first string argument)
  urlArg: /\(\s*(?:url\s*=\s*)?["'f]([^"']+)["']|f["']([^"']+)["']/,
  
  // f-string path params
  fstringParams: /\{(\w+)\}/g,
  
  // Query params detection
  queryParams: /\bparams\s*=/,
  
  // Headers detection
  headers: /\bheaders\s*=/,
  
  // JSON body detection
  jsonBody: /\bjson\s*=/,
  
  // Data body detection  
  dataBody: /\bdata\s*=/
};

/**
 * Track known session variable names
 */
const sessionVars = new Set<string>();

/**
 * Detect HTTP calls from the requests library in Python source code
 */
export function detectRequestsCalls(content: string): PythonHttpCall[] {
  const calls: PythonHttpCall[] = [];
  const lines = content.split('\n');
  
  // First pass: detect imports
  const hasRequestsImport = PATTERNS.importRequests.test(content) || 
                            PATTERNS.fromRequests.test(content);
  
  if (!hasRequestsImport) {
    return [];
  }
  
  // Second pass: find session variables
  sessionVars.clear();
  let match: RegExpExecArray | null;
  
  // Match both requests.Session() and Session() (when imported directly)
  const sessionCreateRegex = /\b(\w+)\s*=\s*(?:requests\.)?Session\s*\(\s*\)/g;
  while ((match = sessionCreateRegex.exec(content)) !== null) {
    sessionVars.add(match[1]);
  }
  
  // Also match session created via from requests import Session
  // and Session() call in the same file
  const fromImportMatch = content.match(/from\s+requests\s+import\s+.*\bSession\b/);
  if (fromImportMatch) {
    // Look for any variable = Session() patterns
    const directSessionRegex = /\b(\w+)\s*=\s*Session\s*\(\s*\)/g;
    while ((match = directSessionRegex.exec(content)) !== null) {
      sessionVars.add(match[1]);
    }
  }
  
  // Third pass: detect HTTP calls line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Get multi-line context (look ahead up to 10 lines for multiline calls)
    const multilineContext = getMultilineContext(lines, i);
    
    // Detect direct requests.method() calls
    const directCallRegex = /\brequests\.(get|post|put|patch|delete|head|options|request)\s*\(/gi;
    while ((match = directCallRegex.exec(line)) !== null) {
      const method = normalizeHttpMethod(match[1]);
      if (method) {
        const call = createHttpCall(method, 'requests', multilineContext, lineNum, match.index);
        call.isSession = false;
        calls.push(call);
      }
    }
    
    // Detect session.method() calls
    for (const sessionVar of sessionVars) {
      const sessionCallRegex = new RegExp(
        `\\b${escapeRegex(sessionVar)}\\.(get|post|put|patch|delete|head|options|request)\\s*\\(`,
        'gi'
      );
      while ((match = sessionCallRegex.exec(line)) !== null) {
        const method = normalizeHttpMethod(match[1]);
        if (method) {
          const call = createHttpCall(method, 'requests', multilineContext, lineNum, match.index);
          call.isSession = true;
          calls.push(call);
        }
      }
    }
  }
  
  return calls;
}

/**
 * Get multi-line context for a call starting at line index
 * Looks ahead up to 10 lines to capture multiline function calls
 */
function getMultilineContext(lines: string[], startIndex: number): string {
  let context = lines[startIndex];
  let parenDepth = 0;
  let inCall = false;
  
  // Count opening parens in the first line
  for (const char of context) {
    if (char === '(') {
      parenDepth++;
      inCall = true;
    } else if (char === ')') {
      parenDepth--;
    }
  }
  
  // If call is complete (balanced parens), return single line
  if (inCall && parenDepth === 0) {
    return context;
  }
  
  // Look ahead for closing paren
  for (let i = 1; i <= 10 && startIndex + i < lines.length; i++) {
    const nextLine = lines[startIndex + i];
    context += '\n' + nextLine;
    
    for (const char of nextLine) {
      if (char === '(') {
        parenDepth++;
      } else if (char === ')') {
        parenDepth--;
      }
    }
    
    // Found matching close
    if (parenDepth === 0) {
      break;
    }
  }
  
  return context;
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
  if (PATTERNS.queryParams.test(line)) {
    call.hasQueryParams = true;
  }
  
  // URL with query string
  if (call.url?.includes('?')) {
    call.hasQueryParams = true;
  }
  
  // Detect headers
  if (PATTERNS.headers.test(line)) {
    call.hasHeaders = true;
  }
  
  // Detect body
  if (PATTERNS.jsonBody.test(line) || PATTERNS.dataBody.test(line)) {
    call.hasBody = true;
  }
  
  // Extract response variable
  const assignMatch = line.match(/^\s*(\w+)\s*=/);
  if (assignMatch) {
    call.responseVariable = assignMatch[1];
  }
  
  return call;
}

/**
 * Extract URL from a call line
 */
function extractUrl(line: string): { url: string; isDynamic: boolean; pathParams: string[] } | null {
  // Try to find URL in the call
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
  
  // Match regular strings
  const stringMatch = line.match(/\(\s*["']([^"']+)["']/);
  if (stringMatch) {
    return { url: stringMatch[1], isDynamic: false, pathParams: [] };
  }
  
  // Match url= keyword argument
  const kwargMatch = line.match(/url\s*=\s*["']([^"']+)["']/);
  if (kwargMatch) {
    return { url: kwargMatch[1], isDynamic: false, pathParams: [] };
  }
  
  // Match url= with f-string
  const kwargFstringMatch = line.match(/url\s*=\s*f["']([^"']+)["']/);
  if (kwargFstringMatch) {
    const url = kwargFstringMatch[1];
    const pathParams: string[] = [];
    let paramMatch: RegExpExecArray | null;
    const paramRegex = /\{(\w+)\}/g;
    while ((paramMatch = paramRegex.exec(url)) !== null) {
      pathParams.push(paramMatch[1]);
    }
    return { url, isDynamic: true, pathParams };
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
 * Get the response properties that requests library supports
 */
export function getRequestsResponseProperties(): string[] {
  return REQUESTS_PATTERN.responseAccess;
}
