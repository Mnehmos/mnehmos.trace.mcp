/**
 * Path Parser
 * 
 * Parses Express/Fastify route paths and extracts path parameters.
 * 
 * @module patterns/rest/path-parser
 * @see .context/ADR-P2-2-REST-DETECTION.md
 */

import type { NormalizedType, PropertyDef } from '../../core/types.js';
import type { PathParameter } from './types.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 📋 Constants
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Regular expression to match path parameters.
 *
 * Matches:
 * - `:id` - simple parameter
 * - `:id?` - optional parameter
 * - `:id(\d+)` - regex constrained parameter
 * - `:id(\d+)?` - optional regex constrained parameter
 */
const PATH_PARAM_REGEX = /:([a-zA-Z_][a-zA-Z0-9_]*)(?:\(([^)]+)\))?(\?)?/g;

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔍 Public API
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Parse a route path and extract all path parameters.
 * 
 * @param path - Route path like '/users/:id' or '/users/:userId/posts/:postId'
 * @returns Array of parsed path parameters
 * 
 * @example
 * ```typescript
 * parsePath('/users/:id');
 * // [{ name: 'id', position: 1, optional: false, inferredType: 'string' }]
 * 
 * parsePath('/users/:id(\\d+)?');
 * // [{ name: 'id', position: 1, optional: true, pattern: '\\d+', inferredType: 'number' }]
 * ```
 */
export function parsePath(path: string): PathParameter[] {
  const params: PathParameter[] = [];
  
  // Split path into segments to determine positions
  const segments = path.split('/').filter(Boolean);
  
  // Reset regex lastIndex
  PATH_PARAM_REGEX.lastIndex = 0;
  
  let match: RegExpExecArray | null;
  while ((match = PATH_PARAM_REGEX.exec(path)) !== null) {
    const [fullMatch, name, pattern, optionalMark] = match;
    
    // Find position by looking for the segment that contains this param
    const position = segments.findIndex(seg => seg.includes(fullMatch) || seg.includes(`:${name}`));
    
    // Infer type from pattern
    const inferredType = inferTypeFromPattern(pattern);
    
    params.push({
      name,
      position: position >= 0 ? position : params.length,
      optional: optionalMark === '?',
      pattern,
      inferredType,
    });
  }
  
  return params;
}

/**
 * Infer the JavaScript type from a regex pattern.
 * 
 * @param pattern - Regex pattern string (e.g., '\\d+', '[0-9]+')
 * @returns Inferred type
 */
function inferTypeFromPattern(pattern?: string): 'string' | 'number' | 'any' {
  if (!pattern) {
    return 'string';
  }
  
  // Patterns that indicate numeric type
  const numericPatterns = [
    /^\\d\+?$/,            // \d or \d+
    /^\\d\*$/,             // \d*
    /^\\d\{[\d,]+\}$/,     // \d{4} or \d{1,3}
    /^\[0-9\]\+?$/,        // [0-9] or [0-9]+
    /^\[0-9\]\*$/,         // [0-9]*
    /^\[0-9\]\{[\d,]+\}$/, // [0-9]{4}
  ];
  
  // Normalize the pattern for matching
  const normalized = pattern.trim();
  
  for (const numericPattern of numericPatterns) {
    if (numericPattern.test(normalized)) {
      return 'number';
    }
  }
  
  return 'string';
}

/**
 * Convert path parameters to a schema properties object.
 * 
 * @param params - Array of path parameters
 * @returns Record of property definitions suitable for NormalizedSchema
 * 
 * @example
 * ```typescript
 * const params = parsePath('/users/:id(\\d+)');
 * const properties = pathParametersToSchema(params);
 * // {
 * //   id: {
 * //     type: { kind: 'primitive', value: 'number' },
 * //     optional: false,
 * //     nullable: false,
 * //     readonly: false,
 * //     deprecated: false,
 * //     constraints: { pattern: '\\d+' }
 * //   }
 * // }
 * ```
 */
export function pathParametersToSchema(
  params: PathParameter[]
): Record<string, PropertyDef> {
  const properties: Record<string, PropertyDef> = {};
  
  for (const param of params) {
    const type: NormalizedType = {
      kind: 'primitive',
      value: param.inferredType === 'number' ? 'number' : 'string',
    };
    
    const propDef: PropertyDef = {
      type,
      optional: param.optional,
      nullable: false,
      readonly: false,
      deprecated: false,
    };
    
    // Add pattern constraint if present
    if (param.pattern) {
      propDef.constraints = {
        pattern: param.pattern,
      };
    }
    
    properties[param.name] = propDef;
  }
  
  return properties;
}
