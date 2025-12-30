/**
 * Response Inference
 * 
 * Infers response schema from handler function implementations.
 * 
 * @module patterns/rest/response-inference
 * @see .context/ADR-P2-2-REST-DETECTION.md
 */

import { Node, CallExpression, SyntaxKind } from 'ts-morph';
import type { NormalizedType } from '../../core/types.js';
import type { ResponseInference } from './types.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔍 Public API
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Infer the response schema from a handler function.
 * 
 * Uses multiple strategies:
 * 1. Explicit return type annotation
 * 2. Generic type parameter on res.json<T>()
 * 3. Analysis of res.json() argument structure
 * 
 * @param handler - The handler function AST node
 * @returns Response inference result with method and optional schema node
 * 
 * @example
 * ```typescript
 * // Handler: (req, res) => res.json<ProfileResponse>({ id: '123', name: 'John' })
 * const inference = inferResponseSchema(handler);
 * // { method: 'generic-param', node: <ProfileResponse node> }
 * ```
 */
export function inferResponseSchema(handler: Node | undefined): ResponseInference {
  if (!handler) {
    return { method: 'unknown' };
  }
  
  // Check for explicit return type annotation
  const returnType = getExplicitReturnType(handler);
  if (returnType) {
    return { method: 'explicit-return', node: returnType };
  }
  
  // Look for res.json<T>() generic parameter
  const genericParam = findResJsonGenericParam(handler);
  if (genericParam) {
    return { method: 'generic-param', node: genericParam };
  }
  
  // Analyze body of res.json() calls
  const jsonArg = findResJsonArgument(handler);
  if (jsonArg) {
    return { method: 'body-analysis', node: jsonArg };
  }
  
  return { method: 'unknown' };
}

/**
 * Detect multiple response schemas by status code.
 * 
 * @param handler - The handler function AST node
 * @returns Map of status codes to response schema nodes
 * 
 * @example
 * ```typescript
 * // Handler with res.status(200).json(ok) and res.status(400).json(error)
 * const responses = detectMultipleResponses(handler);
 * // Map { 200 => <ok node>, 400 => <error node> }
 * ```
 */
export function detectMultipleResponses(handler: Node | undefined): Map<number, Node> {
  const responses = new Map<number, Node>();
  
  if (!handler) {
    return responses;
  }
  
  // Find all call expressions in the handler
  handler.forEachDescendant(node => {
    if (!Node.isCallExpression(node)) return;
    
    // Check for res.status(code).json(body) or res.json(body)
    const statusAndBody = extractStatusAndBody(node);
    if (statusAndBody) {
      responses.set(statusAndBody.status, statusAndBody.body);
    }
  });
  
  return responses;
}

/**
 * Get explicit return type annotation from a function
 */
function getExplicitReturnType(handler: Node): Node | undefined {
  if (Node.isFunctionDeclaration(handler) || 
      Node.isFunctionExpression(handler) ||
      Node.isArrowFunction(handler) ||
      Node.isMethodDeclaration(handler)) {
    const returnTypeNode = handler.getReturnTypeNode();
    if (returnTypeNode) {
      return returnTypeNode;
    }
  }
  return undefined;
}

/**
 * Find res.json<T>() generic type parameter
 */
function findResJsonGenericParam(handler: Node): Node | undefined {
  let result: Node | undefined;
  
  handler.forEachDescendant(node => {
    if (result) return; // Already found
    
    if (!Node.isCallExpression(node)) return;
    
    const expression = node.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) return;
    
    const methodName = expression.getName();
    if (methodName !== 'json') return;
    
    // Check if caller is 'res' or a chain containing 'res'
    if (!isResponseObject(expression.getExpression())) return;
    
    // Check for generic type argument
    const typeArgs = node.getTypeArguments();
    if (typeArgs.length > 0) {
      result = typeArgs[0];
    }
  });
  
  return result;
}

/**
 * Find the argument passed to res.json()
 */
function findResJsonArgument(handler: Node): Node | undefined {
  let result: Node | undefined;
  
  handler.forEachDescendant(node => {
    if (result) return; // Already found
    
    if (!Node.isCallExpression(node)) return;
    
    const expression = node.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) return;
    
    const methodName = expression.getName();
    if (methodName !== 'json' && methodName !== 'send') return;
    
    // Check if caller is 'res' or a chain containing 'res'
    if (!isResponseObject(expression.getExpression())) return;
    
    // Get the first argument
    const args = node.getArguments();
    if (args.length > 0) {
      result = args[0];
    }
  });
  
  return result;
}

/**
 * Extract status code and body from a response chain
 * Handles: res.status(200).json(body), res.json(body), res.sendStatus(200)
 */
function extractStatusAndBody(call: CallExpression): { status: number; body: Node } | undefined {
  const expression = call.getExpression();
  
  if (!Node.isPropertyAccessExpression(expression)) return undefined;
  
  const methodName = expression.getName();
  const calleeExpr = expression.getExpression();
  
  // Case: res.json(body) - default 200
  if ((methodName === 'json' || methodName === 'send') && isResponseObject(calleeExpr)) {
    const args = call.getArguments();
    if (args.length > 0) {
      return { status: 200, body: args[0] };
    }
  }
  
  // Case: res.status(code).json(body)
  if (methodName === 'json' || methodName === 'send') {
    // Check if callee is a status() call
    if (Node.isCallExpression(calleeExpr)) {
      const statusExpr = calleeExpr.getExpression();
      if (Node.isPropertyAccessExpression(statusExpr) && 
          (statusExpr.getName() === 'status' || statusExpr.getName() === 'code')) {
        const statusArgs = calleeExpr.getArguments();
        if (statusArgs.length > 0) {
          const statusValue = getNumericValue(statusArgs[0]);
          const bodyArgs = call.getArguments();
          if (statusValue !== undefined && bodyArgs.length > 0) {
            return { status: statusValue, body: bodyArgs[0] };
          }
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Check if an expression is likely the response object ('res', 'reply')
 */
function isResponseObject(expr: Node): boolean {
  if (Node.isIdentifier(expr)) {
    const name = expr.getText();
    return name === 'res' || name === 'reply' || name === 'response';
  }
  
  // Could be a chain like res.status(200)
  if (Node.isCallExpression(expr)) {
    const callExpr = expr.getExpression();
    if (Node.isPropertyAccessExpression(callExpr)) {
      return isResponseObject(callExpr.getExpression());
    }
  }
  
  if (Node.isPropertyAccessExpression(expr)) {
    return isResponseObject(expr.getExpression());
  }
  
  return false;
}

/**
 * Extract numeric value from a literal or identifier
 */
function getNumericValue(node: Node): number | undefined {
  if (Node.isNumericLiteral(node)) {
    return parseInt(node.getText(), 10);
  }
  
  // Could be a constant reference, but we'd need to resolve it
  return undefined;
}
