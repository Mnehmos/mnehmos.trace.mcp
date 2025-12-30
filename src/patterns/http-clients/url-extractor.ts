/**
 * URL Extraction Utilities
 * 
 * Extract URL information from AST nodes for HTTP client calls.
 * Handles static strings, template literals, variable references,
 * and string concatenation.
 * 
 * @module patterns/http-clients/url-extractor
 * @see .context/ADR-P2-3-HTTP-CLIENT-TRACING.md
 */

import { Node, SyntaxKind } from 'ts-morph';
import type { URLExtractionResult } from './types.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔗 Public API
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Extract URL information from an AST node.
 * 
 * Handles:
 * - String literals: `'/api/users'`
 * - Template literals: `` `/api/users/${id}` ``
 * - Variable references: `API_URL`
 * - Concatenation: `baseUrl + '/users'`
 * 
 * @param node - The AST node to extract URL from
 * @returns URLExtractionResult or undefined if not extractable
 * 
 * @example
 * ```typescript
 * const urlNode = callExpr.getArguments()[0];
 * const result = extractURL(urlNode);
 * // { raw: '/api/users', static: '/api/users', isDynamic: false }
 * ```
 */
export function extractURL(node: Node): URLExtractionResult | undefined {
  if (!node) return undefined;

  // Handle string literals
  if (Node.isStringLiteral(node)) {
    const value = node.getLiteralValue();
    return parseStaticURL(value);
  }

  // Handle no-substitution template literals (static templates)
  if (Node.isNoSubstitutionTemplateLiteral(node)) {
    const value = node.getLiteralValue();
    return parseStaticURL(value);
  }

  // Handle template expressions with substitutions
  if (Node.isTemplateExpression(node)) {
    return parseTemplateExpression(node);
  }

  // Handle identifier references (variable names)
  if (Node.isIdentifier(node)) {
    return resolveIdentifier(node);
  }

  // Handle binary expressions (concatenation)
  if (Node.isBinaryExpression(node)) {
    return parseBinaryExpression(node);
  }

  // Handle call expressions like URL.toString()
  if (Node.isCallExpression(node)) {
    const expr = node.getExpression();
    if (Node.isPropertyAccessExpression(expr)) {
      const methodName = expr.getName();
      if (methodName === 'toString') {
        // URL object's toString() - mark as dynamic
        return {
          raw: 'URL.toString()',
          isDynamic: true,
          pathParams: [],
          queryParams: [],
        };
      }
    }
  }

  return undefined;
}

/**
 * Compose a baseURL with a path.
 * 
 * Handles:
 * - Trailing slashes in baseURL
 * - Missing leading slashes in path
 * - Full URL baseURLs
 * 
 * @param baseURL - Base URL (e.g., '/api' or 'https://api.example.com')
 * @param path - Path to append (e.g., '/users' or 'users')
 * @returns Composed URL
 * 
 * @example
 * ```typescript
 * composeURL('/api', '/users')           // '/api/users'
 * composeURL('/api/', 'users')           // '/api/users'
 * composeURL('https://api.com', '/users') // 'https://api.com/users'
 * ```
 */
export function composeURL(baseURL: string, path: string): string {
  // Normalize base URL - remove trailing slash
  const normalizedBase = baseURL.replace(/\/+$/, '');
  
  // Normalize path - ensure leading slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return normalizedBase + normalizedPath;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔧 Static URL Parsing
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Parse a static URL string and extract path/query params.
 * 
 * @internal
 */
function parseStaticURL(url: string): URLExtractionResult {
  const pathParams: string[] = [];
  const queryParams: string[] = [];
  
  // Check for Express-style path params like :userId
  const expressParamRegex = /:(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = expressParamRegex.exec(url)) !== null) {
    pathParams.push(match[1]);
  }

  // Extract query parameters
  const queryIndex = url.indexOf('?');
  if (queryIndex !== -1) {
    const queryString = url.slice(queryIndex + 1);
    const params = queryString.split('&');
    for (const param of params) {
      const [key] = param.split('=');
      if (key) {
        // Remove any template placeholders in query param names
        const cleanKey = key.replace(/\$\{[^}]+\}/, '').trim();
        if (cleanKey) {
          queryParams.push(cleanKey);
        }
      }
    }
  }

  const hasExpressParams = pathParams.length > 0;

  return {
    raw: url,
    static: hasExpressParams ? undefined : url,
    isDynamic: hasExpressParams,
    pattern: hasExpressParams ? url : undefined,
    pathParams: pathParams.length > 0 ? pathParams : undefined,
    queryParams: queryParams.length > 0 ? queryParams : undefined,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 📝 Template Expression Parsing
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get the literal text from a template head/middle/tail node.
 * 
 * @internal
 */
function getTemplatePartText(node: Node): string {
  // Use getText() and strip the template delimiters
  const text = node.getText();
  
  // TemplateHead: `text${  -> extract "text"
  // TemplateMiddle: }text${  -> extract "text"
  // TemplateTail: }text`  -> extract "text"
  
  // Remove leading ` or }
  let result = text;
  if (result.startsWith('`')) {
    result = result.slice(1);
  } else if (result.startsWith('}')) {
    result = result.slice(1);
  }
  
  // Remove trailing ${ or `
  if (result.endsWith('${')) {
    result = result.slice(0, -2);
  } else if (result.endsWith('`')) {
    result = result.slice(0, -1);
  }
  
  return result;
}

/**
 * Parse a template expression with substitutions.
 * 
 * @internal
 */
function parseTemplateExpression(node: Node): URLExtractionResult {
  if (!Node.isTemplateExpression(node)) return { raw: '', isDynamic: true };

  const head = node.getHead();
  const spans = node.getTemplateSpans();
  
  let pattern = getTemplatePartText(head);
  const pathParams: string[] = [];
  const queryParams: string[] = [];

  for (const span of spans) {
    const expr = span.getExpression();
    let paramName = 'param';

    // Try to extract parameter name from expression
    if (Node.isIdentifier(expr)) {
      paramName = expr.getText();
    } else if (Node.isPropertyAccessExpression(expr)) {
      // Get the property name: user.id -> id
      paramName = expr.getName();
    } else if (Node.isElementAccessExpression(expr)) {
      // Get array index identifier if possible
      const argExpr = expr.getArgumentExpression();
      if (argExpr && Node.isNumericLiteral(argExpr)) {
        paramName = `item${argExpr.getText()}`;
      }
    }

    // Check if we're in query params section
    const literal = span.getLiteral();
    const literalText = getTemplatePartText(literal);
    const isInQuerySection = pattern.includes('?') || literalText.includes('?');
    
    if (isInQuerySection && !pattern.includes('?')) {
      // We're adding a query param
      const beforeQuestion = literalText.indexOf('?');
      if (beforeQuestion !== -1) {
        pattern += `:${paramName}` + literalText.slice(0, beforeQuestion + 1);
        pathParams.push(paramName);
        // Continue parsing query params
        const afterQuestion = literalText.slice(beforeQuestion + 1);
        if (afterQuestion.includes('=')) {
          const queryKey = afterQuestion.split('=')[0];
          if (queryKey) queryParams.push(queryKey);
        }
        pattern += afterQuestion;
      } else {
        pattern += `:${paramName}` + literalText;
        queryParams.push(paramName);
      }
    } else {
      pattern += `:${paramName}` + literalText;
      pathParams.push(paramName);
    }

    // Extract any query params from literal text
    const queryMatch = literalText.match(/[?&](\w+)=/g);
    if (queryMatch) {
      for (const q of queryMatch) {
        const key = q.replace(/[?&=]/g, '');
        if (key && !queryParams.includes(key)) {
          queryParams.push(key);
        }
      }
    }
  }

  // Build the raw template string representation
  const rawParts = [getTemplatePartText(head)];
  for (const span of spans) {
    rawParts.push('${', span.getExpression().getText(), '}');
    rawParts.push(getTemplatePartText(span.getLiteral()));
  }
  const raw = rawParts.join('');

  return {
    raw,
    isDynamic: true,
    pattern,
    pathParams: pathParams.length > 0 ? pathParams : undefined,
    queryParams: queryParams.length > 0 ? queryParams : undefined,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 🔍 Identifier Resolution
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Resolve an identifier to its value.
 * 
 * @internal
 */
function resolveIdentifier(node: Node): URLExtractionResult | undefined {
  if (!Node.isIdentifier(node)) return undefined;

  const name = node.getText();
  const symbol = node.getSymbol();
  
  if (!symbol) {
    return {
      raw: name,
      isDynamic: true,
      pathParams: [],
    };
  }

  // Try to find the variable declaration
  const declarations = symbol.getDeclarations();
  for (const decl of declarations) {
    if (Node.isVariableDeclaration(decl)) {
      const initializer = decl.getInitializer();
      if (initializer) {
        const result = extractURL(initializer);
        if (result) return result;
      }
    }
  }

  return {
    raw: name,
    isDynamic: true,
    pathParams: [],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ➕ Binary Expression Parsing
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Parse binary expression (concatenation).
 * 
 * @internal
 */
function parseBinaryExpression(node: Node): URLExtractionResult | undefined {
  if (!Node.isBinaryExpression(node)) return undefined;

  const operator = node.getOperatorToken().getKind();
  if (operator !== SyntaxKind.PlusToken) return undefined;

  const left = extractURL(node.getLeft());
  const right = extractURL(node.getRight());

  if (!left && !right) {
    return {
      raw: node.getText(),
      isDynamic: true,
      pathParams: [],
    };
  }

  const leftRaw = left?.raw || node.getLeft().getText();
  const rightRaw = right?.raw || node.getRight().getText();

  return {
    raw: leftRaw + rightRaw,
    isDynamic: true,
    pathParams: [
      ...(left?.pathParams || []),
      ...(right?.pathParams || []),
    ],
    queryParams: [
      ...(left?.queryParams || []),
      ...(right?.queryParams || []),
    ],
  };
}
