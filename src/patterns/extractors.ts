/**
 * Schema Extractors
 *
 * Utilities for extracting schema nodes based on {@link SchemaLocation} specifications.
 * These functions navigate AST structures to locate schema definitions in various
 * positions (arguments, return types, method chains, decorators, etc.).
 *
 * @module patterns/extractors
 * @see .context/ADR-P2-1-PATTERN-MATCHER.md
 *
 * @example
 * ```typescript
 * import { extractSchemaNode } from './patterns';
 *
 * const schemaNode = extractSchemaNode(match, { type: 'arg', index: 0 });
 * if (schemaNode) {
 *   // Process the schema node
 * }
 * ```
 */

import { Node, SyntaxKind } from 'ts-morph';
import type { SchemaLocation, MatchResult } from './types.js';

/**
 * Extract a schema AST node from a pattern match based on location specification.
 *
 * This is the primary entry point for schema extraction. It dispatches to
 * specialized extractors based on the {@link SchemaLocation} type.
 *
 * @param match - The pattern match result containing the matched AST node
 * @param location - Specification of where to find the schema in the AST
 * @returns The schema AST node, or `null` if not found at the specified location
 *
 * @example
 * ```typescript
 * // Extract first argument from a call expression
 * const inputSchema = extractSchemaNode(match, { type: 'arg', index: 0 });
 *
 * // Extract from method chain like .input(schema)
 * const chainSchema = extractSchemaNode(match, {
 *   type: 'chain-method',
 *   method: 'input'
 * });
 * ```
 */
export function extractSchemaNode(
  match: MatchResult,
  location: SchemaLocation
): Node | null {
  const { node, captures } = match;

  switch (location.type) {
    case 'arg':
      return extractFromArg(node, location.index);

    case 'arg-named':
      return extractFromNamedArg(node, location.name);

    case 'return':
      return extractFromReturn(node);

    case 'type-param':
      return extractFromTypeParam(node, location.index);

    case 'body':
      return extractFromBody(node);

    case 'chain-method':
      // Check if already captured during matching
      const capturedNode = captures[`${location.method}SchemaNode`];
      if (capturedNode && Node.isNode(capturedNode)) {
        return capturedNode;
      }
      return extractFromChainMethod(node, location.method);

    case 'decorator-arg':
      return extractFromDecoratorArg(node, location.index);

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Extractor Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract a positional argument from a call expression.
 *
 * @param node - The call expression node
 * @param index - Zero-based index of the argument to extract
 * @returns The argument node at the specified index, or `null` if not found
 *
 * @example
 * ```typescript
 * // For: app.get('/users', schema, handler)
 * const routePath = extractFromArg(callNode, 0);  // '/users'
 * const schema = extractFromArg(callNode, 1);     // schema
 * ```
 */
export function extractFromArg(node: Node, index: number): Node | null {
  if (!Node.isCallExpression(node)) return null;
  const args = node.getArguments();
  return args[index] ?? null;
}

/**
 * Extract a named property from an options object argument.
 *
 * Searches through all object literal arguments to find a property
 * with the specified name.
 *
 * @param node - The call expression node
 * @param name - Name of the property to find
 * @returns The property's initializer node, or `null` if not found
 *
 * @example
 * ```typescript
 * // For: server.tool({ schema: z.object({...}), handler })
 * const schemaNode = extractFromNamedArg(callNode, 'schema');
 * ```
 */
export function extractFromNamedArg(node: Node, name: string): Node | null {
  if (!Node.isCallExpression(node)) return null;
  const args = node.getArguments();

  for (const arg of args) {
    if (Node.isObjectLiteralExpression(arg)) {
      for (const prop of arg.getProperties()) {
        if (Node.isPropertyAssignment(prop) && prop.getName() === name) {
          return prop.getInitializer() ?? null;
        }
      }
    }
  }
  return null;
}

/**
 * Extract return type annotation from an enclosing function.
 *
 * Walks up the AST to find the nearest function declaration,
 * method declaration, or arrow function, then extracts its return type.
 *
 * @param node - A node within a function body
 * @returns The return type node, or `null` if no explicit return type
 *
 * @example
 * ```typescript
 * // For: function getUser(): UserSchema { ... }
 * const returnType = extractFromReturn(bodyNode);  // UserSchema
 * ```
 */
export function extractFromReturn(node: Node): Node | null {
  // Walk up to find function declaration
  const func = node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration)
    ?? node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration)
    ?? node.getFirstAncestorByKind(SyntaxKind.ArrowFunction);

  if (!func) return null;

  // Check if the node has getReturnTypeNode method
  if ('getReturnTypeNode' in func && typeof func.getReturnTypeNode === 'function') {
    return func.getReturnTypeNode() ?? null;
  }

  return null;
}

/**
 * Extract a generic type parameter at a specified index.
 *
 * Works with both type references (`Foo<T, U>`) and call expressions
 * with type arguments (`foo<T>()`).
 *
 * @param node - A type reference or call expression node
 * @param index - Zero-based index of the type argument
 * @returns The type argument node, or `null` if not found
 *
 * @example
 * ```typescript
 * // For: Response<UserSchema, ErrorSchema>
 * const successType = extractFromTypeParam(typeRef, 0);  // UserSchema
 * const errorType = extractFromTypeParam(typeRef, 1);    // ErrorSchema
 * ```
 */
export function extractFromTypeParam(node: Node, index: number): Node | null {
  // Handle type references with type arguments
  if (Node.isTypeReference(node)) {
    const typeArgs = node.getTypeArguments();
    return typeArgs[index] ?? null;
  }

  // Handle call expressions with type arguments
  if (Node.isCallExpression(node)) {
    const typeArgs = node.getTypeArguments();
    return typeArgs[index] ?? null;
  }

  return null;
}

/**
 * Extract schema from function body or variable initializer.
 *
 * For functions: finds return statements and extracts the returned expression.
 * For arrow functions: returns the expression body directly.
 * For variable declarations: returns the initializer.
 *
 * @param node - A function-like node or variable declaration
 * @returns The inferred schema node, or `null` if not found
 *
 * @example
 * ```typescript
 * // For: const schema = z.object({ name: z.string() })
 * const schemaValue = extractFromBody(varDecl);  // z.object(...)
 *
 * // For: const handler = () => z.object({})
 * const returnValue = extractFromBody(arrowFn);  // z.object({})
 * ```
 */
export function extractFromBody(node: Node): Node | null {
  // If node is a function-like, get its body
  let body: Node | undefined;

  if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) {
    body = node.getBody();
  } else if (Node.isArrowFunction(node)) {
    body = node.getBody();
  } else if (Node.isVariableDeclaration(node)) {
    // For variable declarations like `const schema = z.object(...)`
    const initializer = node.getInitializer();
    return initializer ?? null;
  }

  if (!body) return node;

  // If body is a block, find return statement
  if (Node.isBlock(body)) {
    const returnStmt = body.getFirstDescendantByKind(SyntaxKind.ReturnStatement);
    if (returnStmt) {
      return returnStmt.getExpression() ?? null;
    }
  }

  // If body is an expression (arrow function), return it directly
  return body;
}

/**
 * Extract schema from a method in a call chain.
 *
 * Traverses a method chain (like tRPC's fluent API) to find a specific
 * method call and extract its first argument.
 *
 * @param node - The call expression representing the chain
 * @param methodName - Name of the method to find (e.g., 'input', 'output')
 * @returns The first argument of the method, or `null` if not found
 *
 * @example
 * ```typescript
 * // For: t.procedure.input(userSchema).query(...)
 * const inputSchema = extractFromChainMethod(callNode, 'input');
 *
 * // For: router.route().output(responseSchema).get()
 * const outputSchema = extractFromChainMethod(callNode, 'output');
 * ```
 */
export function extractFromChainMethod(node: Node, methodName: string): Node | null {
  if (!Node.isCallExpression(node)) return null;

  // Walk up the call chain to find the method
  let current: Node = node;

  while (current) {
    if (Node.isCallExpression(current)) {
      const expr = current.getExpression();
      if (Node.isPropertyAccessExpression(expr)) {
        const name = expr.getName();
        if (name === methodName) {
          // Found the method, return its first argument
          const args = current.getArguments();
          return args[0] ?? null;
        }
        // Move to the receiver
        current = expr.getExpression();
        continue;
      }
    }
    break;
  }

  // Also check children (for cases where node is the start of chain)
  const descendants = node.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const desc of descendants) {
    const expr = desc.getExpression();
    if (Node.isPropertyAccessExpression(expr) && expr.getName() === methodName) {
      const args = desc.getArguments();
      return args[0] ?? null;
    }
  }

  return null;
}

/**
 * Extract an argument from a decorator's call expression.
 *
 * @param node - The decorator node
 * @param index - Zero-based index of the argument
 * @returns The argument node, or `null` if not found
 *
 * @example
 * ```typescript
 * // For: @Body(validationSchema)
 * const schema = extractFromDecoratorArg(decoratorNode, 0);
 *
 * // For: @Param('id', ParseIntPipe)
 * const paramName = extractFromDecoratorArg(decoratorNode, 0);  // 'id'
 * const pipe = extractFromDecoratorArg(decoratorNode, 1);       // ParseIntPipe
 * ```
 */
export function extractFromDecoratorArg(node: Node, index: number): Node | null {
  if (!Node.isDecorator(node)) return null;

  const callExpr = node.getCallExpression();
  if (!callExpr) return null;

  const args = callExpr.getArguments();
  return args[index] ?? null;
}
