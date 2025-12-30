/**
 * Property Access Tracking
 * 
 * Track property accesses on HTTP client response data to infer types.
 * This enables consumer schema inference from how response data is used.
 * 
 * @module patterns/http-clients/property-access
 * @see .context/ADR-P2-3-HTTP-CLIENT-TRACING.md
 */

import { Node, SyntaxKind } from 'ts-morph';
import type { PropertyAccess } from './types.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔍 Public API
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Track all property accesses on a variable assigned from a call expression.
 * 
 * Handles:
 * - Direct access: `response.data`
 * - Chained access: `response.data.user.name`
 * - Destructuring: `const { data } = response`
 * - Optional chaining: `response?.data?.user`
 * 
 * @param callNode - The call expression node
 * @param variableName - Optional variable name to track (derived if not provided)
 * @returns Array of property accesses found
 * 
 * @example
 * ```typescript
 * const accesses = trackPropertyAccesses(fetchCall);
 * // [{ path: 'data.user.name', segments: ['data', 'user', 'name'] }]
 * ```
 */
export function trackPropertyAccesses(callNode: Node, variableName?: string): PropertyAccess[] {
  const accesses: PropertyAccess[] = [];
  
  if (!Node.isCallExpression(callNode)) {
    return accesses;
  }

  // First, find the innermost fetch/axios call in the chain
  const rootCall = findRootCallInChain(callNode);
  
  // Find the variable name if not provided
  const varName = variableName || findVariableName(rootCall);
  
  // Check for destructuring patterns first
  const destructuringAccesses = findDestructuringFromCall(rootCall);
  for (const access of destructuringAccesses) {
    addUniqueAccess(accesses, access);
  }
  
  // If we have a variable name, track direct accesses on it
  if (varName) {
    // Get the source file to search for usages
    const sourceFile = rootCall.getSourceFile();
    
    // Find all identifiers with this name in the file
    const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
    
    for (const id of identifiers) {
      if (id.getText() !== varName) continue;
      
      // Skip the declaration itself
      const parent = id.getParent();
      if (Node.isVariableDeclaration(parent)) continue;
      
      // Check if this is a property access
      const propertyAccess = findFullPropertyAccessChain(id, varName);
      if (propertyAccess) {
        addUniqueAccess(accesses, propertyAccess);
      }
      
      // Check for element access (array index)
      const elementAccess = findElementAccessChain(id, varName);
      if (elementAccess) {
        addUniqueAccess(accesses, elementAccess);
      }
    }
  }
  
  // Track accesses in chained .then() callbacks starting from root
  const chainedAccesses = trackChainedAccesses(rootCall);
  for (const access of chainedAccesses) {
    addUniqueAccess(accesses, access);
  }
  
  // Find ALL .then() callbacks in the entire call tree and extract accesses
  const allThenAccesses = findAllThenCallbackAccesses(callNode);
  for (const access of allThenAccesses) {
    addUniqueAccess(accesses, access);
  }

  return accesses;
}

/**
 * Build an inferred type structure from property accesses.
 * 
 * @param accesses - Property accesses observed
 * @returns Nested object representing the inferred type structure
 * 
 * @example
 * ```typescript
 * const accesses = [{ path: 'user.name' }, { path: 'user.email' }];
 * const type = buildTypeFromAccesses(accesses);
 * // { user: { name: 'unknown', email: 'unknown' } }
 * ```
 */
export function buildTypeFromAccesses(accesses: PropertyAccess[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const access of accesses) {
    let current: Record<string, unknown> = result;
    const segments = access.segments;
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      // Handle array access segments
      if (segment.startsWith('[') && segment.endsWith(']')) {
        // Mark current level as array
        if (!current._isArray) {
          current._isArray = true;
          current._element = {};
        }
        // Continue building inside element
        if (i < segments.length - 1) {
          current = current._element as Record<string, unknown>;
        }
        continue;
      }
      
      if (i === segments.length - 1) {
        // Leaf node - mark as unknown type
        if (!(segment in current)) {
          current[segment] = 'unknown';
        }
      } else {
        // Intermediate node - ensure it's an object
        if (!(segment in current) || typeof current[segment] !== 'object') {
          current[segment] = {};
        }
        current = current[segment] as Record<string, unknown>;
      }
    }
  }
  
  return result;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔗 Chain Navigation
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Find the root call expression in a method chain.
 * 
 * For `fetch().then().then()`, returns `fetch()`.
 * 
 * @internal
 */
function findRootCallInChain(callNode: Node): Node {
  if (!Node.isCallExpression(callNode)) {
    return callNode;
  }
  
  const expr = callNode.getExpression();
  
  // If it's a property access like .then(), walk down
  if (Node.isPropertyAccessExpression(expr)) {
    const innerExpr = expr.getExpression();
    if (Node.isCallExpression(innerExpr)) {
      return findRootCallInChain(innerExpr);
    }
  }
  
  return callNode;
}

/**
 * Collect all call expressions in a method chain.
 * 
 * @internal
 */
function collectChainedCalls(startNode: Node): Node[] {
  const calls: Node[] = [];
  
  // Walk up through the chain collecting all call expressions
  let current: Node = startNode;
  
  while (current) {
    const parent = current.getParent();
    if (!parent) break;
    
    if (Node.isPropertyAccessExpression(parent)) {
      const grandparent = parent.getParent();
      if (grandparent && Node.isCallExpression(grandparent)) {
        calls.push(grandparent);
        current = grandparent;
        continue;
      }
    }
    
    break;
  }
  
  return calls;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 🎯 .then() Callback Tracking
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Find all .then() callbacks in a call tree and extract property accesses from them.
 * 
 * @internal
 */
function findAllThenCallbackAccesses(callNode: Node): PropertyAccess[] {
  const accesses: PropertyAccess[] = [];
  
  // Recursively find all .then() calls in the entire tree
  findThenCallsRecursive(callNode, accesses);
  
  // Also check the source file for any .then() calls we might have missed
  const sourceFile = callNode.getSourceFile();
  sourceFile.forEachDescendant((node) => {
    if (Node.isCallExpression(node)) {
      findThenCallsRecursive(node, accesses);
    }
  });
  
  return accesses;
}

/**
 * Recursively find .then() callbacks and extract property accesses.
 * 
 * @internal
 */
function findThenCallsRecursive(node: Node, accesses: PropertyAccess[]): void {
  if (!Node.isCallExpression(node)) return;
  
  const expr = node.getExpression();
  
  // Check if this is a .then() call
  if (Node.isPropertyAccessExpression(expr)) {
    const methodName = expr.getName();
    if (methodName === 'then' || methodName === 'catch' || methodName === 'finally') {
      // Get the callback argument
      const args = node.getArguments();
      if (args.length > 0) {
        const callback = args[0];
        if (Node.isArrowFunction(callback) || Node.isFunctionExpression(callback)) {
          const params = callback.getParameters();
          if (params.length > 0) {
            const paramName = params[0].getName();
            
            // Extract property accesses from the callback
            extractPropertyAccessesFromCallback(callback, paramName, accesses);
          }
        }
      }
    }
  }
}

/**
 * Extract property accesses from a callback function.
 * 
 * @internal
 */
function extractPropertyAccessesFromCallback(
  callback: Node,
  paramName: string,
  accesses: PropertyAccess[]
): void {
  // Get the body of the callback
  let body: Node | undefined;
  if (Node.isArrowFunction(callback)) {
    body = callback.getBody();
  } else if (Node.isFunctionExpression(callback)) {
    body = callback.getBody();
  }
  
  if (!body) return;
  
  // For expression bodies like `data => data.name`, body IS the expression
  if (Node.isPropertyAccessExpression(body)) {
    // Check if root is the param
    let root = body.getExpression();
    while (Node.isPropertyAccessExpression(root)) {
      root = root.getExpression();
    }
    if (Node.isIdentifier(root) && root.getText() === paramName) {
      const chain = extractPropertyChain(body);
      if (chain.length > 0) {
        addUniqueAccess(accesses, {
          path: chain.join('.'),
          segments: chain,
          location: getLocation(body),
        });
      }
    }
  }
  
  // For block bodies like `data => { console.log(data.name); }`
  // Find all property access expressions
  body.forEachDescendant((descendant) => {
    if (Node.isPropertyAccessExpression(descendant)) {
      // Check if the root expression is the param identifier
      let root = descendant.getExpression();
      while (Node.isPropertyAccessExpression(root)) {
        root = root.getExpression();
      }
      
      if (Node.isIdentifier(root) && root.getText() === paramName) {
        const chain = extractPropertyChain(descendant);
        if (chain.length > 0) {
          addUniqueAccess(accesses, {
            path: chain.join('.'),
            segments: chain,
            location: getLocation(descendant),
          });
        }
      }
    }
  });
}

/**
 * Extract property chain from a property access expression.
 * 
 * For `data.user.name`, returns `['user', 'name']`.
 * 
 * @internal
 */
function extractPropertyChain(propAccess: Node): string[] {
  const chain: string[] = [];
  let current: Node | undefined = propAccess;
  
  // Walk up through chained property accesses
  while (current && Node.isPropertyAccessExpression(current)) {
    const parent = current.getParent();
    if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === current) {
      // This property access is the base of another - continue up
      current = parent;
    } else {
      break;
    }
  }
  
  // Now walk down collecting names
  while (current && Node.isPropertyAccessExpression(current)) {
    chain.push(current.getName());
    const expr = current.getExpression();
    if (Node.isPropertyAccessExpression(expr)) {
      current = expr;
    } else {
      break;
    }
  }
  
  return chain.reverse();
}

/**
 * Track accesses in all .then() callbacks in the chain.
 * 
 * @internal
 */
function trackChainedAccesses(callNode: Node): PropertyAccess[] {
  const accesses: PropertyAccess[] = [];
  
  // Collect all .then() calls in the chain starting from this node and going up
  const chainedCalls = collectChainedCalls(callNode);
  
  for (const chainCall of chainedCalls) {
    if (!Node.isCallExpression(chainCall)) continue;
    
    const expr = chainCall.getExpression();
    if (!Node.isPropertyAccessExpression(expr)) continue;
    
    const methodName = expr.getName();
    if (methodName === 'then' || methodName === 'catch' || methodName === 'finally') {
      // Get the callback argument
      const args = chainCall.getArguments();
      if (args.length > 0) {
        const callback = args[0];
        
        // Track accesses inside the callback
        if (Node.isArrowFunction(callback) || Node.isFunctionExpression(callback)) {
          const params = callback.getParameters();
          if (params.length > 0) {
            const paramName = params[0].getName();
            const body = callback.getBody();
            if (body) {
              const callbackAccesses = trackAccessesInCallbackBody(body, paramName);
              for (const access of callbackAccesses) {
                addUniqueAccess(accesses, access);
              }
            }
          }
        }
      }
    }
  }
  
  // Also check if the callNode itself is a .then() call and process it
  if (Node.isCallExpression(callNode)) {
    const expr = callNode.getExpression();
    if (Node.isPropertyAccessExpression(expr)) {
      const methodName = expr.getName();
      if (methodName === 'then' || methodName === 'catch' || methodName === 'finally') {
        const args = callNode.getArguments();
        if (args.length > 0) {
          const callback = args[0];
          if (Node.isArrowFunction(callback) || Node.isFunctionExpression(callback)) {
            const params = callback.getParameters();
            if (params.length > 0) {
              const paramName = params[0].getName();
              const body = callback.getBody();
              if (body) {
                const callbackAccesses = trackAccessesInCallbackBody(body, paramName);
                for (const access of callbackAccesses) {
                  addUniqueAccess(accesses, access);
                }
              }
            }
          }
        }
      }
    }
  }
  
  return accesses;
}

/**
 * Track property accesses in a callback body for a parameter.
 * 
 * @internal
 */
function trackAccessesInCallbackBody(body: Node, paramName: string): PropertyAccess[] {
  const accesses: PropertyAccess[] = [];
  
  if (!body) return accesses;
  
  // Also check if body itself is a property access (expression body)
  if (Node.isPropertyAccessExpression(body)) {
    const rootIdentifier = getRootIdentifier(body);
    if (rootIdentifier && rootIdentifier.getText() === paramName) {
      const chain = buildFullChainFromRoot(body, paramName);
      if (chain.length > 0) {
        const path = chain.join('.');
        addUniqueAccess(accesses, {
          path,
          segments: chain,
          location: getLocation(body),
        });
      }
    }
  }
  
  // Use body.getDescendantsOfKind directly
  const bodyPropAccesses = body.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
  
  for (const node of bodyPropAccesses) {
    // Check if the root is the parameter
    const rootIdentifier = getRootIdentifier(node);
    if (rootIdentifier && rootIdentifier.getText() === paramName) {
      const chain = buildFullChainFromRoot(node, paramName);
      if (chain.length > 0) {
        const path = chain.join('.');
        addUniqueAccess(accesses, {
          path,
          segments: chain,
          location: getLocation(node),
        });
      }
    }
  }
  
  return accesses;
}

/**
 * Track property accesses if the current call is a .then() callback.
 * 
 * @internal
 */
function trackAccessesInCurrentCall(callNode: Node): PropertyAccess[] {
  const accesses: PropertyAccess[] = [];
  
  if (!Node.isCallExpression(callNode)) {
    return accesses;
  }
  
  const expr = callNode.getExpression();
  if (!Node.isPropertyAccessExpression(expr)) {
    return accesses;
  }
  
  const methodName = expr.getName();
  if (methodName !== 'then' && methodName !== 'catch' && methodName !== 'finally') {
    return accesses;
  }
  
  // Get the callback argument
  const args = callNode.getArguments();
  if (args.length > 0) {
    const callback = args[0];
    
    if (Node.isArrowFunction(callback) || Node.isFunctionExpression(callback)) {
      const params = callback.getParameters();
      if (params.length > 0) {
        const paramName = params[0].getName();
        
        // Find property accesses directly by searching the source file
        // within the callback's text range
        const sourceFile = callNode.getSourceFile();
        const callbackStart = callback.getStart();
        const callbackEnd = callback.getEnd();
        
        // Get all property access expressions in the source file
        const allPropertyAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
        
        for (const propAccess of allPropertyAccesses) {
          // Check if this property access is within the callback
          const propStart = propAccess.getStart();
          if (propStart < callbackStart || propStart > callbackEnd) {
            continue;
          }
          
          // Check if root is the parameter
          const rootId = getRootIdentifier(propAccess);
          if (rootId && rootId.getText() === paramName) {
            const chain = buildFullChainFromRoot(propAccess, paramName);
            if (chain.length > 0) {
              const path = chain.join('.');
              addUniqueAccess(accesses, {
                path,
                segments: chain,
                location: getLocation(propAccess),
              });
            }
          }
        }
      }
    }
  }
  
  return accesses;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 📦 Destructuring Support
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Find destructuring patterns from a call expression.
 * 
 * Handles:
 * - `const { name, email } = await fetch()`
 * - `const { user: { name } } = await fetch()` (nested)
 * 
 * @internal
 */
function findDestructuringFromCall(callNode: Node): PropertyAccess[] {
  const accesses: PropertyAccess[] = [];
  
  // Walk up to find variable declaration
  let current: Node | undefined = callNode;
  
  while (current) {
    const parent = current.getParent();
    if (!parent) break;
    
    if (Node.isVariableDeclaration(parent)) {
      const nameNode = parent.getNameNode();
      if (Node.isObjectBindingPattern(nameNode)) {
        // Extract all bound properties
        extractBindingPatternAccesses(nameNode, [], accesses);
      }
      break;
    }
    
    // Skip await and parentheses
    if (Node.isAwaitExpression(parent) || Node.isParenthesizedExpression(parent)) {
      current = parent;
      continue;
    }
    
    // Handle chained calls
    if (Node.isCallExpression(parent) || Node.isPropertyAccessExpression(parent)) {
      current = parent;
      continue;
    }
    
    break;
  }
  
  return accesses;
}

/**
 * Extract property accesses from an object binding pattern.
 * 
 * @internal
 */
function extractBindingPatternAccesses(
  pattern: Node,
  pathPrefix: string[],
  accesses: PropertyAccess[]
): void {
  if (!Node.isObjectBindingPattern(pattern)) return;
  
  const elements = pattern.getElements();
  for (const elem of elements) {
    const nameNode = elem.getNameNode();
    const propertyName = elem.getPropertyNameNode();
    
    // Get the property name being accessed
    let propName: string;
    if (propertyName && Node.isIdentifier(propertyName)) {
      propName = propertyName.getText();
    } else if (Node.isIdentifier(nameNode)) {
      propName = nameNode.getText();
    } else {
      continue;
    }
    
    const fullPath = [...pathPrefix, propName];
    
    // Check if the name node is another binding pattern (nested destructuring)
    if (Node.isObjectBindingPattern(nameNode)) {
      // Recursively extract nested patterns
      extractBindingPatternAccesses(nameNode, fullPath, accesses);
    } else {
      // Leaf node - add the access
      accesses.push({
        path: fullPath.join('.'),
        segments: fullPath,
        location: getLocation(elem),
      });
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔗 Property Chain Building
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Find the variable name from a call expression's context.
 * 
 * @internal
 */
function findVariableName(callNode: Node): string | undefined {
  let current: Node | undefined = callNode;
  
  while (current) {
    const parent = current.getParent();
    if (!parent) break;
    
    // Found variable declaration
    if (Node.isVariableDeclaration(parent)) {
      const nameNode = parent.getNameNode();
      if (Node.isIdentifier(nameNode)) {
        return nameNode.getText();
      }
      // Handle destructuring pattern - we need to track the original object
      if (Node.isObjectBindingPattern(nameNode)) {
        // Return undefined to trigger destructuring tracking
        return undefined;
      }
      break;
    }
    
    // Skip await and parentheses
    if (Node.isAwaitExpression(parent) || Node.isParenthesizedExpression(parent)) {
      current = parent;
      continue;
    }
    
    // Handle chained calls
    if (Node.isCallExpression(parent) || Node.isPropertyAccessExpression(parent)) {
      current = parent;
      continue;
    }
    
    break;
  }
  
  return undefined;
}

/**
 * Get the root identifier from a property access chain.
 * 
 * @internal
 */
function getRootIdentifier(node: Node): Node | undefined {
  let current = node;
  
  while (Node.isPropertyAccessExpression(current)) {
    current = current.getExpression();
  }
  
  if (Node.isIdentifier(current)) {
    return current;
  }
  
  return undefined;
}

/**
 * Build the full chain from root, excluding root name.
 * 
 * @internal
 */
function buildFullChainFromRoot(node: Node, rootName: string): string[] {
  if (!Node.isPropertyAccessExpression(node)) return [];
  
  // Collect the entire chain from innermost to outermost
  const chain: string[] = [];
  let current: Node | undefined = node;
  
  // Walk up to find the outermost property access
  while (current) {
    const parent = current.getParent();
    if (parent && Node.isPropertyAccessExpression(parent) && parent.getExpression() === current) {
      current = parent;
    } else {
      break;
    }
  }
  
  // Now walk down collecting property names
  let walkNode: Node | undefined = current;
  while (walkNode && Node.isPropertyAccessExpression(walkNode)) {
    chain.push(walkNode.getName());
    const expr = walkNode.getExpression();
    if (Node.isPropertyAccessExpression(expr)) {
      walkNode = expr;
    } else {
      break;
    }
  }
  
  return chain.reverse();
}

/**
 * Find the full property access chain starting from an identifier.
 * 
 * For `data.user.email`, returns `{ path: 'user.email', segments: ['user', 'email'] }`.
 * 
 * @internal
 */
function findFullPropertyAccessChain(identifier: Node, rootName: string): PropertyAccess | undefined {
  // The identifier must be the start of a property access chain
  const parent = identifier.getParent();
  
  if (!parent) return undefined;
  
  // Check for property access expression where identifier is the object
  if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === identifier) {
    // Walk up to find the outermost property access
    let outermost = parent;
    let current: Node | undefined = parent;
    
    while (current) {
      const currentParent = current.getParent();
      if (currentParent && Node.isPropertyAccessExpression(currentParent) && 
          currentParent.getExpression() === current) {
        outermost = currentParent;
        current = currentParent;
      } else {
        break;
      }
    }
    
    // Build the chain from identifier to outermost
    const chain = buildChainFromIdentifier(outermost, rootName);
    if (chain.length > 0) {
      return {
        path: chain.join('.'),
        segments: chain,
        location: getLocation(outermost),
      };
    }
  }
  
  return undefined;
}

/**
 * Build chain from a property access expression, excluding the root identifier.
 * 
 * @internal
 */
function buildChainFromIdentifier(node: Node, rootName: string): string[] {
  const chain: string[] = [];
  let current: Node | undefined = node;
  
  while (current && Node.isPropertyAccessExpression(current)) {
    chain.unshift(current.getName());
    const expr = current.getExpression();
    
    if (Node.isIdentifier(expr)) {
      if (expr.getText() === rootName) {
        break;
      }
    }
    
    if (Node.isPropertyAccessExpression(expr)) {
      current = expr;
    } else {
      break;
    }
  }
  
  return chain;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 📊 Element Access (Array Indexing)
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Find element access chain (array indexing).
 * 
 * For `data[0].name`, returns appropriate access.
 * 
 * @internal
 */
function findElementAccessChain(identifier: Node, rootName: string): PropertyAccess | undefined {
  const parent = identifier.getParent();
  
  if (!parent) return undefined;
  
  // Check for element access expression (data[0])
  if (Node.isElementAccessExpression(parent) && parent.getExpression() === identifier) {
    const argExpr = parent.getArgumentExpression();
    if (!argExpr) return undefined;
    
    const indexText = argExpr.getText();
    
    // Check if there's property access after the element access
    const grandparent = parent.getParent();
    if (grandparent && Node.isPropertyAccessExpression(grandparent) && 
        grandparent.getExpression() === parent) {
      // data[0].name
      const propChain = buildChainFromElementAccess(grandparent, parent);
      const chain = [`[${indexText}]`, ...propChain];
      return {
        path: chain.join('.'),
        segments: chain,
        location: getLocation(grandparent),
      };
    }
    
    // Just data[0]
    return {
      path: `[${indexText}]`,
      segments: [`[${indexText}]`],
      location: getLocation(parent),
    };
  }
  
  return undefined;
}

/**
 * Build chain from property access after element access.
 * 
 * @internal
 */
function buildChainFromElementAccess(node: Node, elementAccess: Node): string[] {
  const chain: string[] = [];
  let current: Node | undefined = node;
  
  while (current && Node.isPropertyAccessExpression(current)) {
    chain.unshift(current.getName());
    const expr = current.getExpression();
    
    if (expr === elementAccess) {
      break;
    }
    
    if (Node.isPropertyAccessExpression(expr)) {
      current = expr;
    } else {
      break;
    }
  }
  
  return chain.reverse();
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 🛠️ Utility Functions
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Add access if not already present (deduplication).
 * 
 * @internal
 */
function addUniqueAccess(accesses: PropertyAccess[], access: PropertyAccess): void {
  const existing = accesses.find(a => a.path === access.path);
  if (!existing) {
    accesses.push(access);
  }
}

/**
 * Get source location for a node.
 * 
 * @internal
 */
function getLocation(node: Node): { file: string; line: number } {
  const sourceFile = node.getSourceFile();
  return {
    file: sourceFile.getFilePath(),
    line: node.getStartLineNumber(),
  };
}
