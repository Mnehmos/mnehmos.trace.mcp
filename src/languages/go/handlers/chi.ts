/**
 * Go Chi Router Detection
 * Detects Chi router patterns (r.Get, r.Post, r.Route, r.Mount)
 */

import type { GoRoute } from '../types.js';

/**
 * HTTP methods supported by Chi
 */
const HTTP_METHODS = ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Head', 'Options', 'Connect', 'Trace'];

/**
 * Extract Chi path parameters from path
 * Chi uses {param} or {param:regex} syntax
 */
export function extractChiParams(path: string): string[] {
  const params: string[] = [];
  
  // Match {param} or {param:regex}
  const regex = /\{([^}:]+)(?::[^}]*)?\}/g;
  let match;
  
  while ((match = regex.exec(path)) !== null) {
    params.push(match[1]);
  }
  
  return params;
}

/**
 * Detect Chi router route registrations
 */
export function detectChiRoutes(content: string): GoRoute[] {
  if (!content.includes('chi.NewRouter') && !content.includes('chi.NewMux')) {
    return [];
  }

  const routes: GoRoute[] = [];
  const lines = content.split('\n');

  // Track route groups/prefixes
  const groupStack: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect r.Route("/prefix", func...) - opening a group
    const routeGroupMatch = line.match(
      /(\w+)\.Route\s*\(\s*"([^"]+)"\s*,\s*func\s*\(\s*\w+\s+chi\.Router\s*\)/
    );
    if (routeGroupMatch) {
      groupStack.push(routeGroupMatch[2]);
      continue;
    }

    // Detect closing of a route group (heuristic - closing brace with closing paren)
    if (line.trim() === '})' && groupStack.length > 0) {
      groupStack.pop();
      continue;
    }

    // Detect HTTP method routes: r.Get, r.Post, etc.
    for (const method of HTTP_METHODS) {
      const methodRegex = new RegExp(
        `(\\w+)\\.${method}\\s*\\(\\s*"([^"]+)"\\s*,\\s*([^)]+)\\)`
      );
      const methodMatch = line.match(methodRegex);
      if (methodMatch) {
        const routePath = methodMatch[2];
        const fullPath = [...groupStack, routePath].join('').replace(/\/+/g, '/');
        const normalizedPath = fullPath || '/';

        routes.push({
          path: normalizedPath,
          method: method.toUpperCase(),
          pathParams: extractChiParams(normalizedPath),
          handler: extractHandlerName(methodMatch[3]),
          line: i + 1,
        });
        break;
      }
    }

    // Detect r.MethodFunc("METHOD", "/path", handler)
    const methodFuncMatch = line.match(
      /(\w+)\.MethodFunc\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*([^)]+)\)/
    );
    if (methodFuncMatch) {
      const httpMethod = methodFuncMatch[2];
      const routePath = methodFuncMatch[3];
      const fullPath = [...groupStack, routePath].join('').replace(/\/+/g, '/');
      const normalizedPath = fullPath || '/';

      routes.push({
        path: normalizedPath,
        method: httpMethod.toUpperCase(),
        pathParams: extractChiParams(normalizedPath),
        handler: extractHandlerName(methodFuncMatch[4]),
        line: i + 1,
      });
      continue;
    }

    // Detect r.Mount("/prefix", subrouter)
    const mountMatch = line.match(
      /(\w+)\.Mount\s*\(\s*"([^"]+)"\s*,\s*([^)]+)\)/
    );
    if (mountMatch) {
      const mountPath = mountMatch[2];
      const fullPath = [...groupStack, mountPath].join('').replace(/\/+/g, '/');

      // Mount represents a subrouter - we add a placeholder route
      routes.push({
        path: fullPath,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        pathParams: extractChiParams(fullPath),
        handler: extractHandlerName(mountMatch[3]),
        line: i + 1,
      });
      continue;
    }
  }

  // Second pass: detect routes inside subrouter functions
  const subrouterRoutes = detectSubrouterRoutes(content);
  routes.push(...subrouterRoutes);

  return routes;
}

/**
 * Detect routes inside subrouter functions
 */
function detectSubrouterRoutes(content: string): GoRoute[] {
  const routes: GoRoute[] = [];
  const lines = content.split('\n');

  // Find subrouter functions like: func userRouter() http.Handler { r := chi.NewRouter(); ... }
  let inSubrouter = false;
  let subrouterPrefix = '';
  
  // Look for Mount calls to understand prefixes
  const mountPrefixes = new Map<string, string>();
  for (const line of lines) {
    const mountMatch = line.match(
      /\.Mount\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*\(\s*\)/
    );
    if (mountMatch) {
      mountPrefixes.set(mountMatch[2], mountMatch[1]);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect start of subrouter function
    const subrouterFuncMatch = line.match(
      /func\s+(\w+)\s*\(\s*\)\s+http\.Handler\s*\{/
    );
    if (subrouterFuncMatch) {
      inSubrouter = true;
      subrouterPrefix = mountPrefixes.get(subrouterFuncMatch[1]) || '';
      continue;
    }

    // Detect end of function
    if (inSubrouter && line.trim() === '}' && !lines[i-1]?.includes('{')) {
      // Check if this is the end of the function by looking at brace balance
      let braceCount = 0;
      for (let j = i; j >= 0; j--) {
        for (const char of lines[j]) {
          if (char === '}') braceCount++;
          if (char === '{') braceCount--;
        }
        if (lines[j].match(/^func\s/)) break;
      }
      if (braceCount <= 0) {
        inSubrouter = false;
        subrouterPrefix = '';
      }
    }

    if (!inSubrouter) continue;

    // Detect routes inside subrouter
    for (const method of HTTP_METHODS) {
      const methodRegex = new RegExp(
        `(\\w+)\\.${method}\\s*\\(\\s*"([^"]+)"\\s*,\\s*([^)]+)\\)`
      );
      const methodMatch = line.match(methodRegex);
      if (methodMatch) {
        const routePath = methodMatch[2];
        const fullPath = (subrouterPrefix + routePath).replace(/\/+/g, '/');
        
        // Don't add if we already have this route with same method
        const exists = routes.some(
          r => r.path === fullPath && r.method === method.toUpperCase()
        );
        if (!exists) {
          routes.push({
            path: fullPath || '/',
            method: method.toUpperCase(),
            pathParams: extractChiParams(fullPath),
            handler: extractHandlerName(methodMatch[3]),
            line: i + 1,
          });
        }
        break;
      }
    }
  }

  return routes;
}

/**
 * Extract handler name from handler expression
 */
function extractHandlerName(handlerExpr: string): string | undefined {
  const trimmed = handlerExpr.trim();

  // Anonymous function
  if (trimmed.startsWith('func(')) {
    return undefined;
  }

  // Function call like userRouter()
  const funcCallMatch = trimmed.match(/^(\w+)\s*\(\s*\)$/);
  if (funcCallMatch) {
    return funcCallMatch[1];
  }

  // Simple function name
  const nameMatch = trimmed.match(/^(\w+)$/);
  if (nameMatch) {
    return nameMatch[1];
  }

  return trimmed;
}

/**
 * ChiHandler class for stateful route detection
 */
export class ChiHandler {
  /**
   * Detect all Chi routes in content
   */
  static detect(content: string): GoRoute[] {
    return detectChiRoutes(content);
  }
}
