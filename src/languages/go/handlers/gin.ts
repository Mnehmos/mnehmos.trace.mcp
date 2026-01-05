/**
 * Go Gin Framework Detection
 * Detects Gin router patterns (router.GET, router.POST, router.Group)
 */

import type { GoRoute } from '../types.js';

/**
 * HTTP methods supported by Gin
 */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

/**
 * Extract Gin path parameters from path
 * Gin uses :param for params and *param for wildcards
 */
export function extractGinParams(path: string): string[] {
  const params: string[] = [];
  
  // Match :param (colon-prefixed)
  const colonRegex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let match;
  
  while ((match = colonRegex.exec(path)) !== null) {
    params.push(match[1]);
  }
  
  // Match *param (wildcard)
  const wildcardRegex = /\*([a-zA-Z_][a-zA-Z0-9_]*)/g;
  
  while ((match = wildcardRegex.exec(path)) !== null) {
    params.push(match[1]);
  }
  
  return params;
}

/**
 * Detect Gin router route registrations
 */
export function detectGinRoutes(content: string): GoRoute[] {
  if (!content.includes('gin.Default') && !content.includes('gin.New')) {
    return [];
  }

  const routes: GoRoute[] = [];
  const lines = content.split('\n');

  // Track route groups/prefixes
  interface GroupInfo {
    prefix: string;
    variable: string;
  }
  const groups: GroupInfo[] = [];

  // First pass: identify group variables and their prefixes
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect group: api := router.Group("/api")
    const groupMatch = line.match(
      /(\w+)\s*:?=\s*(\w+)\.Group\s*\(\s*"([^"]+)"/
    );
    if (groupMatch) {
      const groupVar = groupMatch[1];
      const parentVar = groupMatch[2];
      const prefix = groupMatch[3];

      // Find parent prefix
      let fullPrefix = prefix;
      const parentGroup = groups.find(g => g.variable === parentVar);
      if (parentGroup) {
        fullPrefix = (parentGroup.prefix + prefix).replace(/\/+/g, '/');
      }

      groups.push({ prefix: fullPrefix, variable: groupVar });
    }
  }

  // Second pass: detect routes
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect HTTP method routes: router.GET, router.POST, etc.
    for (const method of HTTP_METHODS) {
      const methodRegex = new RegExp(
        `(\\w+)\\.${method}\\s*\\(\\s*"([^"]+)"\\s*,\\s*([^)]+)\\)`
      );
      const methodMatch = line.match(methodRegex);
      if (methodMatch) {
        const routerVar = methodMatch[1];
        const routePath = methodMatch[2];

        // Find prefix from group
        let fullPath = routePath;
        const group = groups.find(g => g.variable === routerVar);
        if (group) {
          fullPath = (group.prefix + routePath).replace(/\/+/g, '/');
        }

        const normalizedPath = fullPath || '/';

        routes.push({
          path: normalizedPath,
          method,
          pathParams: extractGinParams(normalizedPath),
          handler: extractHandlerName(methodMatch[3]),
          line: i + 1,
        });
        break;
      }
    }

    // Detect router.Handle("METHOD", "/path", handler)
    const handleMatch = line.match(
      /(\w+)\.Handle\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*([^)]+)\)/
    );
    if (handleMatch) {
      const routerVar = handleMatch[1];
      const httpMethod = handleMatch[2];
      const routePath = handleMatch[3];

      // Find prefix from group
      let fullPath = routePath;
      const group = groups.find(g => g.variable === routerVar);
      if (group) {
        fullPath = (group.prefix + routePath).replace(/\/+/g, '/');
      }

      const normalizedPath = fullPath || '/';

      routes.push({
        path: normalizedPath,
        method: httpMethod.toUpperCase(),
        pathParams: extractGinParams(normalizedPath),
        handler: extractHandlerName(handleMatch[4]),
        line: i + 1,
      });
      continue;
    }

    // Detect router.Any("/path", handler) - registers all methods
    const anyMatch = line.match(
      /(\w+)\.Any\s*\(\s*"([^"]+)"\s*,\s*([^)]+)\)/
    );
    if (anyMatch) {
      const routerVar = anyMatch[1];
      const routePath = anyMatch[2];

      // Find prefix from group
      let fullPath = routePath;
      const group = groups.find(g => g.variable === routerVar);
      if (group) {
        fullPath = (group.prefix + routePath).replace(/\/+/g, '/');
      }

      const normalizedPath = fullPath || '/';

      routes.push({
        path: normalizedPath,
        methods: HTTP_METHODS,
        pathParams: extractGinParams(normalizedPath),
        handler: extractHandlerName(anyMatch[3]),
        line: i + 1,
      });
      continue;
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

  // Simple function name
  const nameMatch = trimmed.match(/^(\w+)$/);
  if (nameMatch) {
    return nameMatch[1];
  }

  return trimmed;
}

/**
 * GinHandler class for stateful route detection
 */
export class GinHandler {
  /**
   * Detect all Gin routes in content
   */
  static detect(content: string): GoRoute[] {
    return detectGinRoutes(content);
  }
}
