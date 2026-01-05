/**
 * Go stdlib HTTP Handler Detection
 * Detects http.HandleFunc() and http.Handle() patterns
 */

import type { GoRoute } from '../types.js';

/**
 * Detect stdlib HTTP handler registrations
 */
export function detectStdlibHandlers(content: string): GoRoute[] {
  const routes: GoRoute[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match http.HandleFunc("/path", handler)
    const handleFuncMatch = line.match(
      /http\.HandleFunc\s*\(\s*"([^"]+)"\s*,\s*([^)]+)\)/
    );
    if (handleFuncMatch) {
      routes.push({
        path: handleFuncMatch[1],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
        handler: extractHandlerName(handleFuncMatch[2]),
        line: i + 1,
      });
      continue;
    }

    // Match http.Handle("/path", handler)
    const handleMatch = line.match(
      /http\.Handle\s*\(\s*"([^"]+)"\s*,\s*([^)]+)\)/
    );
    if (handleMatch) {
      routes.push({
        path: handleMatch[1],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
        handler: extractHandlerName(handleMatch[2]),
        line: i + 1,
      });
      continue;
    }

    // Match mux.HandleFunc("/path", handler) - where mux is a *http.ServeMux
    const muxHandleFuncMatch = line.match(
      /(\w+)\.HandleFunc\s*\(\s*"([^"]+)"\s*,\s*([^)]+)\)/
    );
    if (muxHandleFuncMatch) {
      const muxVar = muxHandleFuncMatch[1];
      // Skip if it looks like a Chi router (will be handled by chi.ts)
      if (muxVar === 'r' && content.includes('chi.NewRouter')) {
        continue;
      }
      routes.push({
        path: muxHandleFuncMatch[2],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
        handler: extractHandlerName(muxHandleFuncMatch[3]),
        line: i + 1,
      });
      continue;
    }

    // Match mux.Handle("/path", handler)
    const muxHandleMatch = line.match(
      /(\w+)\.Handle\s*\(\s*"([^"]+)"\s*,\s*([^)]+)\)/
    );
    if (muxHandleMatch) {
      const muxVar = muxHandleMatch[1];
      // Skip if it looks like a Gin router (will be handled by gin.ts)
      if (content.includes('gin.Default') || content.includes('gin.New')) {
        continue;
      }
      routes.push({
        path: muxHandleMatch[2],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
        handler: extractHandlerName(muxHandleMatch[3]),
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

  // http.HandlerFunc wrapper
  const handlerFuncMatch = trimmed.match(/http\.HandlerFunc\s*\(\s*([^)]+)\)/);
  if (handlerFuncMatch) {
    return handlerFuncMatch[1].trim();
  }

  // Struct instance like &healthHandler{}
  const structMatch = trimmed.match(/&?(\w+)\{/);
  if (structMatch) {
    return structMatch[1];
  }

  // Method reference like s.handleUsers
  const methodMatch = trimmed.match(/(\w+)\.(\w+)/);
  if (methodMatch) {
    return `${methodMatch[1]}.${methodMatch[2]}`;
  }

  // Simple function name
  const nameMatch = trimmed.match(/^(\w+)$/);
  if (nameMatch) {
    return nameMatch[1];
  }

  return trimmed;
}

/**
 * StdlibHandler class for stateful route detection
 */
export class StdlibHandler {
  /**
   * Detect all stdlib routes in content
   */
  static detect(content: string): GoRoute[] {
    return detectStdlibHandlers(content);
  }
}
