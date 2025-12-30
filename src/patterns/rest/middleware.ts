/**
 * Middleware Detection
 * 
 * Detects validation middleware in Express route handlers.
 * 
 * @module patterns/rest/middleware
 * @see .context/ADR-P2-2-REST-DETECTION.md
 */

import { Node, CallExpression, Identifier, PropertyAccessExpression } from 'ts-morph';
import type { ValidationMiddleware } from './types.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 📋 Middleware Pattern Definitions
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Known validation middleware patterns
 */
interface MiddlewarePattern {
  /** Function/method name patterns */
  names: string[];
  /** Library identifier */
  library: ValidationMiddleware['library'];
  /** Default target if not explicitly specified */
  defaultTarget: ValidationMiddleware['target'];
  /** How to extract the target from the call */
  targetExtractor?: (call: CallExpression) => ValidationMiddleware['target'] | undefined;
}

/**
 * Known validation middleware patterns for different libraries
 */
const MIDDLEWARE_PATTERNS: MiddlewarePattern[] = [
  // Zod-based validation
  {
    names: ['validateBody', 'zodValidate', 'zValidator'],
    library: 'zod',
    defaultTarget: 'body',
    targetExtractor: extractTargetFromName,
  },
  {
    names: ['validateQuery'],
    library: 'zod',
    defaultTarget: 'query',
  },
  {
    names: ['validateParams'],
    library: 'zod',
    defaultTarget: 'params',
  },
  // Celebrate/Joi patterns
  {
    names: ['celebrate'],
    library: 'celebrate',
    defaultTarget: 'body',
    targetExtractor: extractCelebrateTarget,
  },
  {
    names: ['joiValidate', 'validateJoi'],
    library: 'joi',
    defaultTarget: 'body',
    targetExtractor: extractTargetFromName,
  },
  // Express-validator
  {
    names: ['body', 'check'],
    library: 'express-validator',
    defaultTarget: 'body',
  },
  {
    names: ['query'],
    library: 'express-validator',
    defaultTarget: 'query',
  },
  {
    names: ['param'],
    library: 'express-validator',
    defaultTarget: 'params',
  },
  // Yup validation
  {
    names: ['yupValidate', 'validateYup'],
    library: 'yup',
    defaultTarget: 'body',
    targetExtractor: extractTargetFromName,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔍 Public API
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Detect validation middleware from a list of route handler arguments.
 * 
 * @param args - Array of AST nodes representing route handler arguments
 * @returns Array of detected validation middleware
 * 
 * @example
 * ```typescript
 * // For: app.post('/users', validateBody(CreateUserSchema), handler)
 * const middleware = detectExpressMiddleware(args);
 * // [{ library: 'zod', target: 'body', schemaNode: <node>, middlewareIndex: 1 }]
 * ```
 */
export function detectExpressMiddleware(args: Node[]): ValidationMiddleware[] {
  const middleware: ValidationMiddleware[] = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // Skip if not a call expression or identifier reference
    if (!arg) continue;
    
    // Try to detect middleware from this argument
    const detected = detectMiddlewareFromNode(arg, i);
    if (detected) {
      middleware.push(detected);
    }
  }
  
  return middleware;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔧 Detection Helpers
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Detect middleware from a single node.
 *
 * @param node - AST node to analyze
 * @param index - Position in middleware chain
 * @returns Detected middleware or null
 */
function detectMiddlewareFromNode(node: Node, index: number): ValidationMiddleware | null {
  // Check for call expression: validateBody(schema)
  if (Node.isCallExpression(node)) {
    return detectFromCallExpression(node, index);
  }
  
  // Check for identifier that might be a pre-configured middleware
  if (Node.isIdentifier(node)) {
    // Could be a variable holding middleware, but we can't easily detect the library
    return null;
  }
  
  return null;
}

/**
 * Detect middleware from a call expression
 */
function detectFromCallExpression(call: CallExpression, index: number): ValidationMiddleware | null {
  const expression = call.getExpression();
  
  // Get the function name
  let functionName: string | undefined;
  
  if (Node.isIdentifier(expression)) {
    functionName = expression.getText();
  } else if (Node.isPropertyAccessExpression(expression)) {
    // For patterns like validators.body() or z.validate()
    functionName = expression.getName();
  }
  
  if (!functionName) {
    return null;
  }
  
  // Find matching pattern
  for (const pattern of MIDDLEWARE_PATTERNS) {
    if (pattern.names.some(name => 
      functionName?.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase() === functionName?.toLowerCase()
    )) {
      // Extract target using pattern-specific extractor or use default
      let target = pattern.defaultTarget;
      if (pattern.targetExtractor) {
        const extracted = pattern.targetExtractor(call);
        if (extracted) {
          target = extracted;
        }
      }
      
      // Get the schema node (usually the first argument)
      const schemaArg = call.getArguments()[0];
      
      if (schemaArg) {
        return {
          library: pattern.library,
          target,
          schemaNode: schemaArg,
          middlewareIndex: index,
        };
      }
    }
  }
  
  // Check for inline zod schema detection (z.object())
  const text = call.getText();
  if (text.includes('z.object') || text.includes('z.array') || text.includes('z.string')) {
    return {
      library: 'zod',
      target: 'body', // Default, would need context to determine
      schemaNode: call,
      middlewareIndex: index,
    };
  }
  
  return null;
}

/**
 * Extract target from function name suffix
 * e.g., validateBody -> body, validateQuery -> query
 */
function extractTargetFromName(call: CallExpression): ValidationMiddleware['target'] | undefined {
  const expression = call.getExpression();
  const name = Node.isIdentifier(expression) 
    ? expression.getText().toLowerCase()
    : Node.isPropertyAccessExpression(expression)
      ? expression.getName().toLowerCase()
      : '';
  
  if (name.includes('body')) return 'body';
  if (name.includes('query')) return 'query';
  if (name.includes('param')) return 'params';
  if (name.includes('header')) return 'headers';
  
  return undefined;
}

/**
 * Extract target from celebrate() configuration
 * celebrate({ [Segments.BODY]: schema, [Segments.QUERY]: schema })
 */
function extractCelebrateTarget(call: CallExpression): ValidationMiddleware['target'] | undefined {
  const args = call.getArguments();
  if (args.length === 0) return undefined;
  
  const configArg = args[0];
  if (!Node.isObjectLiteralExpression(configArg)) return undefined;
  
  // Check which segment is being validated
  const text = configArg.getText();
  
  // Look for Segments enum usage
  if (text.includes('BODY') || text.includes('body')) return 'body';
  if (text.includes('QUERY') || text.includes('query')) return 'query';
  if (text.includes('PARAMS') || text.includes('params')) return 'params';
  if (text.includes('HEADERS') || text.includes('headers')) return 'headers';
  
  return 'body'; // Default to body for celebrate
}
