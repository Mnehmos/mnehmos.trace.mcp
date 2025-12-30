/**
 * Type Inference Utilities
 * 
 * Find and prioritize type inference sources for HTTP client responses.
 * This enables schema inference from consumer code patterns.
 * 
 * @module patterns/http-clients/type-inference
 * @see .context/ADR-P2-3-HTTP-CLIENT-TRACING.md
 */

import { Node, SyntaxKind } from 'ts-morph';
import type { TypeInferenceSource } from './types.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔍 Public API
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Find all type inference sources for a call expression.
 * 
 * Priority order (highest to lowest):
 * 1. Generic type parameters: `axios.get<User>()`
 * 2. Variable annotation: `const user: User = await fetch()`
 * 3. Cast expression: `fetch() as User`
 * 4. Return type: in function context
 * 5. Property access: inferring from `response.user.name`
 * 
 * @param callNode - The call expression node
 * @returns Array of type inference sources, sorted by priority
 * 
 * @example
 * ```typescript
 * const sources = findTypeInferenceSources(axiosCall);
 * // [{ method: 'generic-param', typeText: 'User', confidence: 'high' }]
 * ```
 */
export function findTypeInferenceSources(callNode: Node): TypeInferenceSource[] {
  const sources: TypeInferenceSource[] = [];

  if (!Node.isCallExpression(callNode)) {
    return sources;
  }

  // 1. Check for generic type arguments on the call
  const typeArgs = callNode.getTypeArguments();
  if (typeArgs.length > 0) {
    for (const typeArg of typeArgs) {
      sources.push({
        method: 'generic-param',
        typeText: typeArg.getText(),
        confidence: 'high',
        node: typeArg,
      });
    }
  }

  // 2. Check parent context for variable annotations
  const variableAnnotation = findVariableAnnotation(callNode);
  if (variableAnnotation) {
    sources.push(variableAnnotation);
  }

  // 3. Check for cast expressions (as Type or <Type>)
  const castSource = findCastExpression(callNode);
  if (castSource) {
    sources.push(castSource);
  }

  // 4. Check function return type context
  const returnTypeSource = findReturnTypeContext(callNode);
  if (returnTypeSource) {
    sources.push(returnTypeSource);
  }

  // Sort by confidence (high > medium > low)
  const confidenceOrder = { high: 0, medium: 1, low: 2 };
  sources.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence]);

  return sources;
}

/**
 * Get the best type text from inference sources.
 * 
 * Returns the highest confidence type, or undefined if none found.
 * 
 * @param sources - Type inference sources to select from
 * @returns Best type text or undefined
 * 
 * @example
 * ```typescript
 * const sources = findTypeInferenceSources(call);
 * const bestType = getBestInferredType(sources);
 * // 'User' (from highest confidence source)
 * ```
 */
export function getBestInferredType(sources: TypeInferenceSource[]): string | undefined {
  if (sources.length === 0) return undefined;
  
  // Sources should already be sorted by confidence
  return sources[0].typeText;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 📋 Variable Annotation Detection
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Find variable annotation for a call expression.
 * 
 * Handles: `const user: User = await fetch()`
 * 
 * @internal
 */
function findVariableAnnotation(callNode: Node): TypeInferenceSource | undefined {
  // Walk up to find variable declaration
  let current: Node | undefined = callNode;
  
  while (current) {
    const parent = current.getParent();
    
    if (!parent) break;
    
    // Check for variable declaration
    if (Node.isVariableDeclaration(parent)) {
      const typeNode = parent.getTypeNode();
      if (typeNode) {
        return {
          method: 'variable-annotation',
          typeText: typeNode.getText(),
          confidence: 'high',
          node: typeNode,
        };
      }
      break;
    }
    
    // Skip await expressions and parenthesized expressions
    if (Node.isAwaitExpression(parent) || Node.isParenthesizedExpression(parent)) {
      current = parent;
      continue;
    }
    
    // Handle chained calls (fetch().then())
    if (Node.isCallExpression(parent)) {
      const expr = parent.getExpression();
      if (Node.isPropertyAccessExpression(expr)) {
        const propName = expr.getName();
        if (propName === 'then' || propName === 'json') {
          // Check the callback's return type in .then()
          if (propName === 'then') {
            const args = parent.getArguments();
            if (args.length > 0) {
              const callback = args[0];
              if (Node.isArrowFunction(callback) || Node.isFunctionExpression(callback)) {
                const returnType = callback.getReturnType();
                const returnTypeText = returnType.getText();
                if (returnTypeText && returnTypeText !== 'void' && returnTypeText !== 'unknown') {
                  return {
                    method: 'return-type',
                    typeText: returnTypeText,
                    confidence: 'medium',
                    node: callback,
                  };
                }
              }
            }
          }
          current = parent;
          continue;
        }
      }
    }
    
    break;
  }
  
  return undefined;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 🎯 Cast Expression Detection
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Find cast expressions for a call result.
 * 
 * Handles:
 * - `fetch() as User`
 * - `<User>fetch()`
 * 
 * @internal
 */
function findCastExpression(callNode: Node): TypeInferenceSource | undefined {
  const parent = callNode.getParent();
  
  if (!parent) return undefined;
  
  // TypeScript "as" assertion: expr as Type
  if (Node.isAsExpression(parent)) {
    const typeNode = parent.getTypeNode();
    if (typeNode) {
      return {
        method: 'cast-expression',
        typeText: typeNode.getText(),
        confidence: 'high',  // Type assertions are explicit - high confidence
        node: typeNode,
      };
    }
  }
  
  // TypeScript angle bracket assertion: <Type>expr
  if (Node.isTypeAssertion(parent)) {
    const typeNode = parent.getTypeNode();
    if (typeNode) {
      return {
        method: 'cast-expression',
        typeText: typeNode.getText(),
        confidence: 'high',  // Type assertions are explicit - high confidence
        node: typeNode,
      };
    }
  }
  
  // Check if the call is wrapped in an await that's then cast
  if (Node.isAwaitExpression(parent)) {
    const awaitParent = parent.getParent();
    if (awaitParent && Node.isAsExpression(awaitParent)) {
      const typeNode = awaitParent.getTypeNode();
      if (typeNode) {
        return {
          method: 'cast-expression',
          typeText: typeNode.getText(),
          confidence: 'high',  // Type assertions are explicit - high confidence
          node: typeNode,
        };
      }
    }
  }
  
  return undefined;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ↩️ Return Type Context Detection
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Find return type context for a call expression.
 * 
 * Handles: `function getUser(): User { return fetch() }`
 * 
 * @internal
 */
function findReturnTypeContext(callNode: Node): TypeInferenceSource | undefined {
  // Walk up to find return statement or arrow function body
  let current: Node | undefined = callNode;
  
  while (current) {
    const parent = current.getParent();
    if (!parent) break;
    
    // Check for return statement
    if (Node.isReturnStatement(parent)) {
      // Find the containing function
      const containingFunc = parent.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ||
                            parent.getFirstAncestorByKind(SyntaxKind.FunctionExpression) ||
                            parent.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ||
                            parent.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);
      
      if (containingFunc) {
        const returnTypeNode = containingFunc.getReturnTypeNode?.() || 
                              (Node.isArrowFunction(containingFunc) ? containingFunc.getReturnTypeNode() : undefined);
        if (returnTypeNode) {
          let typeText = returnTypeNode.getText();
          // Unwrap Promise<T> to T
          const promiseMatch = typeText.match(/^Promise<(.+)>$/);
          if (promiseMatch) {
            typeText = promiseMatch[1];
          }
          return {
            method: 'return-type',
            typeText,
            confidence: 'medium',
            node: returnTypeNode,
          };
        }
      }
      break;
    }
    
    // Check for arrow function with expression body (implicit return)
    if (Node.isArrowFunction(parent)) {
      const body = parent.getBody();
      // If the body is the call expression itself (expression body)
      if (body === current || (Node.isAwaitExpression(body) && body.getExpression() === current)) {
        const returnTypeNode = parent.getReturnTypeNode();
        if (returnTypeNode) {
          let typeText = returnTypeNode.getText();
          // Unwrap Promise<T> to T
          const promiseMatch = typeText.match(/^Promise<(.+)>$/);
          if (promiseMatch) {
            typeText = promiseMatch[1];
          }
          return {
            method: 'return-type',
            typeText,
            confidence: 'medium',
            node: returnTypeNode,
          };
        }
      }
      break;
    }
    
    // Continue walking up for parentheses and await
    if (Node.isParenthesizedExpression(parent) || Node.isAwaitExpression(parent)) {
      current = parent;
      continue;
    }
    
    break;
  }
  
  return undefined;
}
