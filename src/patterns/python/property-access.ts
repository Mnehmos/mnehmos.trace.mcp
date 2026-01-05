/**
 * Python Response Property Access Detection
 * 
 * Tracks property access on HTTP response objects:
 * - response.json(), response.text, response.status_code
 * - Correlates with response variable names from HTTP calls
 * 
 * @see .context/TASK_MAP_P3.md - Task P3-4
 */

import type { 
  PythonPropertyAccess,
  PythonHttpCall,
  PythonHttpLibrary
} from './types.js';
import { HTTP_CLIENT_PATTERNS } from './types.js';

/**
 * All known response properties/methods across libraries
 */
const ALL_RESPONSE_PROPERTIES = new Set([
  // Common
  'json', 'text', 'content', 'headers', 'cookies', 'url', 'encoding',
  // requests
  'status_code', 'ok', 'reason',
  // httpx
  'is_success', 'is_error', 'is_redirect',
  // aiohttp
  'status', 'read', 'content_type'
]);

/**
 * Detect property access on response variables in Python source code
 */
export function detectPropertyAccess(
  content: string, 
  responseVariables: Set<string>
): PythonPropertyAccess[] {
  const accesses: PythonPropertyAccess[] = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Check each known response variable
    for (const varName of responseVariables) {
      // Method call: response.json()
      const methodCallRegex = new RegExp(
        `\\b${escapeRegex(varName)}\\.(\\w+)\\s*\\(`,
        'g'
      );
      let match: RegExpExecArray | null;
      while ((match = methodCallRegex.exec(line)) !== null) {
        const prop = match[1];
        if (ALL_RESPONSE_PROPERTIES.has(prop)) {
          accesses.push({
            variable: varName,
            property: prop,
            isMethodCall: true,
            line: lineNum
          });
        }
      }
      
      // Property access: response.text, response.status_code
      // Avoid matching method calls by checking what comes after
      const propertyAccessRegex = new RegExp(
        `\\b${escapeRegex(varName)}\\.(\\w+)(?!\\s*\\()`,
        'g'
      );
      while ((match = propertyAccessRegex.exec(line)) !== null) {
        const prop = match[1];
        if (ALL_RESPONSE_PROPERTIES.has(prop)) {
          accesses.push({
            variable: varName,
            property: prop,
            isMethodCall: false,
            line: lineNum
          });
        }
      }
      
      // Await method calls: await response.json()
      const awaitMethodRegex = new RegExp(
        `await\\s+${escapeRegex(varName)}\\.(\\w+)\\s*\\(`,
        'g'
      );
      while ((match = awaitMethodRegex.exec(line)) !== null) {
        const prop = match[1];
        if (ALL_RESPONSE_PROPERTIES.has(prop)) {
          accesses.push({
            variable: varName,
            property: prop,
            isMethodCall: true,
            line: lineNum
          });
        }
      }
    }
  }
  
  return accesses;
}

/**
 * Map property access back to HTTP calls based on variable names
 */
export function correlatePropertyAccess(
  calls: PythonHttpCall[],
  content: string
): Map<PythonHttpCall, string[]> {
  const result = new Map<PythonHttpCall, string[]>();
  
  // Collect all response variables
  const responseVars = new Set<string>();
  for (const call of calls) {
    if (call.responseVariable) {
      responseVars.add(call.responseVariable);
    }
  }
  
  // Detect property accesses
  const accesses = detectPropertyAccess(content, responseVars);
  
  // Group accesses by variable name
  const accessByVar = new Map<string, Set<string>>();
  for (const access of accesses) {
    if (!accessByVar.has(access.variable)) {
      accessByVar.set(access.variable, new Set());
    }
    accessByVar.get(access.variable)!.add(access.property);
  }
  
  // Correlate with HTTP calls
  for (const call of calls) {
    const varName = call.responseVariable;
    if (varName && accessByVar.has(varName)) {
      result.set(call, Array.from(accessByVar.get(varName)!));
    } else {
      result.set(call, []);
    }
  }
  
  return result;
}

/**
 * Get response properties specific to a library
 */
export function getLibraryResponseProperties(library: PythonHttpLibrary): string[] {
  return HTTP_CLIENT_PATTERNS[library].responseAccess;
}

/**
 * Check if a property is valid for a given library
 */
export function isValidResponseProperty(property: string, library: PythonHttpLibrary): boolean {
  return HTTP_CLIENT_PATTERNS[library].responseAccess.includes(property);
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
