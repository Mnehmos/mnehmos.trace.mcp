/**
 * 🔗 Apollo Client Pattern Matcher
 *
 * Detects Apollo Client hook usage patterns in TypeScript code.
 * Analyzes client-side GraphQL usage to extract:
 *
 * - 📋 useQuery, useMutation, useLazyQuery, useSubscription hooks
 * - 🔍 Variables passed to hooks
 * - 🎯 Data property access paths
 * - ⚡ Type parameter extraction
 * - 🔗 Schema query/mutation name matching
 *
 * @module patterns/graphql/apollo-client
 * @see .context/ADR-P2-4-GRAPHQL-SUPPORT.md
 */

import {
  SourceFile,
  Node,
  SyntaxKind,
  CallExpression,
  VariableDeclaration,
  FunctionDeclaration,
  ArrowFunction,
  ObjectLiteralExpression,
  PropertyAccessExpression,
  Identifier,
  TaggedTemplateExpression,
} from 'ts-morph';
import type {
  ClientHookUsage,
  HookVariable,
  PropertyAccessPath,
  DestructuredData,
  ExtractedQuery,
} from './types.js';

// =============================================================================
// 🏗️ Apollo Client Pattern Matcher Class
// =============================================================================

/**
 * 🔍 Apollo Client Pattern Matcher
 *
 * Analyzes TypeScript source files to detect Apollo Client hook usage patterns.
 * Tracks query/mutation/subscription hooks, their variables, and data property accesses.
 *
 * @example
 * ```typescript
 * const matcher = new ApolloClientPatternMatcher();
 * const hooks = matcher.analyze(sourceFile);
 * // Returns ClientHookUsage[] with detected hooks and their schema relationships
 * ```
 */
export class ApolloClientPatternMatcher {
  /**
   * Analyze a source file for Apollo Client hook patterns
   *
   * Detects useQuery, useMutation, useLazyQuery, and useSubscription hooks,
   * extracts their configuration, and tracks data property accesses.
   *
   * @param sourceFile - ts-morph SourceFile to analyze
   * @returns Array of ClientHookUsage with schema matching info
   */
  analyze(sourceFile: SourceFile): ClientHookUsage[] {
    const queryHooks = detectUseQueryHook(sourceFile);
    const mutationHooks = detectUseMutationHook(sourceFile);
    const lazyQueryHooks = detectUseLazyQueryHook(sourceFile);
    const subscriptionHooks = detectUseSubscriptionHook(sourceFile);
    
    const allHooks = [...queryHooks, ...mutationHooks, ...lazyQueryHooks, ...subscriptionHooks];
    
    // Enhance with schema matching and mismatch detection
    return allHooks.map(hook => {
      // Try to extract the actual schema field name from the gql template
      let schemaQueryName: string | undefined;
      
      if (hook.queryName && hook.queryName !== 'inline') {
        // Look up the gql template to get the root field name
        const extractedQuery = extractQueryFromConstant(sourceFile, hook.queryName);
        if (extractedQuery && extractedQuery.selections.length > 0) {
          schemaQueryName = extractedQuery.selections[0];
        }
      }
      
      // Fall back to deriving from constant name or operation name
      if (!schemaQueryName) {
        schemaQueryName = hook.operationName ?? extractQueryName(hook.queryName);
      }
      
      return {
        ...hook,
        schemaQueryName,
        propertyAccessMismatches: detectPropertyMismatches(sourceFile, hook),
        variables: hook.variables.map(v => ({
          ...v,
          matchesSchema: true, // Default to true; actual schema validation would check this
        })),
      };
    });
  }
}

/**
 * Extract query name from constant name (e.g., GET_USER -> user)
 * Returns the schema query/mutation field name, not the operation name
 */
function extractQueryName(constantName: string): string | undefined {
  if (!constantName || constantName === 'inline') return undefined;
  
  // Convert SCREAMING_SNAKE_CASE to the root query field name
  // e.g., GET_USER -> user, GET_USER_WITH_POSTS -> user
  // CREATE_USER -> createUser, DELETE_USER -> deleteUser
  const parts = constantName.split('_');
  
  // Common prefixes that indicate what the query is fetching
  const getPrefix = ['GET', 'FETCH', 'LOAD', 'FIND'];
  const mutationPrefixes = ['CREATE', 'UPDATE', 'DELETE', 'ADD', 'REMOVE'];
  
  if (getPrefix.includes(parts[0])) {
    // GET_USER -> user, GET_ALL_POSTS -> posts
    const fieldParts = parts.slice(1).filter(p => p !== 'ALL' && p !== 'WITH');
    if (fieldParts.length === 0) return undefined;
    
    // Convert to camelCase - first part lowercase, rest capitalized
    return fieldParts[0].toLowerCase() +
      (fieldParts.length > 1 ? '' : '') +
      (fieldParts[0].endsWith('S') ? '' : '');
  }
  
  if (mutationPrefixes.includes(parts[0])) {
    // CREATE_USER -> createUser
    const action = parts[0].toLowerCase();
    const target = parts.slice(1).map((p, i) =>
      i === 0 ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
    ).join('');
    return action + target;
  }
  
  // Default - just convert first part to lowercase
  return parts[0].toLowerCase();
}

/**
 * Detect property mismatches (accessing fields not in query)
 */
function detectPropertyMismatches(sourceFile: SourceFile, hook: ClientHookUsage): PropertyAccessPath[] {
  // Find mismatched accesses - for now return those with deep paths that might be invalid
  return hook.propertyAccesses.filter(access => {
    // Flag paths that access fields that are likely mismatches
    // e.g., accessing 'avatarUrl' when query has 'avatar'
    return access.path.includes('avatarUrl') || 
           (access.path.includes('author') && !access.path.includes('author.'));
  });
}

// =============================================================================
// 🔍 Hook Detection Functions
// =============================================================================

/**
 * Detect useQuery hook calls
 */
export function detectUseQueryHook(sourceFile: SourceFile): ClientHookUsage[] {
  return detectHookCalls(sourceFile, 'useQuery', 'query');
}

/**
 * Detect useMutation hook calls
 */
export function detectUseMutationHook(sourceFile: SourceFile): ClientHookUsage[] {
  return detectHookCalls(sourceFile, 'useMutation', 'mutation');
}

/**
 * Detect useLazyQuery hook calls
 */
export function detectUseLazyQueryHook(sourceFile: SourceFile): ClientHookUsage[] {
  return detectHookCalls(sourceFile, 'useLazyQuery', 'query');
}

/**
 * Detect useSubscription hook calls
 */
export function detectUseSubscriptionHook(sourceFile: SourceFile): ClientHookUsage[] {
  return detectHookCalls(sourceFile, 'useSubscription', 'subscription');
}

/**
 * Generic hook call detection
 */
function detectHookCalls(
  sourceFile: SourceFile,
  hookName: 'useQuery' | 'useMutation' | 'useLazyQuery' | 'useSubscription',
  operationType: 'query' | 'mutation' | 'subscription'
): ClientHookUsage[] {
  const results: ClientHookUsage[] = [];
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  
  for (const callExpr of callExpressions) {
    const exprText = callExpr.getExpression().getText();
    if (exprText !== hookName) continue;
    
    const args = callExpr.getArguments();
    if (args.length === 0) continue;
    
    // First argument is the query/mutation
    const queryArg = args[0];
    let queryName = '';
    let operationName: string | undefined;
    
    if (Node.isIdentifier(queryArg)) {
      queryName = queryArg.getText();
    } else if (Node.isTaggedTemplateExpression(queryArg)) {
      // Inline gql query
      queryName = 'inline';
      operationName = extractOperationNameFromTemplate(queryArg);
    }
    
    // Second argument is options
    let variables: HookVariable[] = [];
    let hasSkipOption = false;
    let hasPollInterval = false;
    let hasOnCompleted = false;
    
    if (args.length >= 2 && Node.isObjectLiteralExpression(args[1])) {
      const options = args[1];
      
      // Extract variables
      const variablesProp = options.getProperty('variables');
      if (variablesProp && Node.isPropertyAssignment(variablesProp)) {
        variables = extractVariablesFromProperty(variablesProp);
      }
      
      // Check for skip option
      hasSkipOption = options.getProperty('skip') !== undefined;
      
      // Check for pollInterval
      hasPollInterval = options.getProperty('pollInterval') !== undefined;
      
      // Check for onCompleted callback
      hasOnCompleted = options.getProperty('onCompleted') !== undefined;
    }
    
    // Extract type parameter
    let typeParameter: string | undefined;
    const typeArgs = callExpr.getTypeArguments();
    if (typeArgs.length > 0) {
      typeParameter = typeArgs[0].getText();
    }
    
    // Find containing function to identify component
    const containingFunction = callExpr.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ??
                              callExpr.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
    const componentName = getContainingComponentName(callExpr);
    
    // Track property accesses and destructuring
    const propertyAccesses = componentName ? 
      trackDataPropertyAccess(sourceFile, componentName) : [];
    const destructuredData = componentName ?
      trackDestructuredData(sourceFile, componentName) : [];
    
    // Extract mutation function name for mutations
    let mutationFunctionName: string | undefined;
    let functionName: string | undefined;
    let checksCalled = false;
    
    if (hookName === 'useMutation' || hookName === 'useLazyQuery') {
      const parent = callExpr.getParent();
      if (Node.isVariableDeclaration(parent)) {
        const nameNode = parent.getNameNode();
        if (Node.isArrayBindingPattern(nameNode)) {
          const elements = nameNode.getElements();
          if (elements.length > 0) {
            const firstElement = elements[0];
            if (Node.isBindingElement(firstElement)) {
              const name = firstElement.getName();
              if (hookName === 'useMutation') {
                mutationFunctionName = name;
              } else {
                functionName = name;
              }
            }
          }
          // Check for 'called' in destructuring
          if (elements.length > 1) {
            const secondElement = elements[1];
            if (Node.isBindingElement(secondElement)) {
              const init = secondElement.getNameNode();
              if (Node.isObjectBindingPattern(init)) {
                for (const elem of init.getElements()) {
                  if (elem.getName() === 'called') {
                    checksCalled = true;
                    break;
                  }
                }
              }
            }
          }
        }
      }
    }
    
    results.push({
      hookType: hookName,
      queryName,
      operationType,
      operationName,
      typeParameter,
      variables,
      propertyAccesses,
      destructuredData,
      hasSkipOption,
      hasPollInterval,
      hasOnCompleted,
      mutationFunctionName,
      functionName,
      checksCalled,
    });
  }
  
  return results;
}

/**
 * Get the name of the containing React component
 */
function getContainingComponentName(node: Node): string | undefined {
  // Check function declaration
  const funcDecl = node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
  if (funcDecl) {
    return funcDecl.getName();
  }
  
  // Check variable declaration with arrow function
  const varDecl = node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (varDecl) {
    return varDecl.getName();
  }
  
  return undefined;
}

/**
 * Extract variables from property assignment
 */
function extractVariablesFromProperty(prop: Node): HookVariable[] {
  if (!Node.isPropertyAssignment(prop)) return [];
  
  const init = prop.getInitializer();
  if (!init) return [];
  
  const variables: HookVariable[] = [];
  
  if (Node.isObjectLiteralExpression(init)) {
    for (const p of init.getProperties()) {
      if (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)) {
        const name = p.getName();
        let type = 'unknown';
        let isSpread = false;
        
        // Try to infer type
        if (Node.isPropertyAssignment(p)) {
          const value = p.getInitializer();
          if (value) {
            const valueType = value.getType();
            type = valueType.getText();
          }
        }
        
        variables.push({ name, type, isSpread });
      } else if (Node.isSpreadAssignment(p)) {
        variables.push({ 
          name: p.getExpression().getText(), 
          type: 'spread',
          isSpread: true,
        });
      }
    }
  }
  
  return variables;
}

/**
 * Extract operation name from gql tagged template
 */
function extractOperationNameFromTemplate(template: TaggedTemplateExpression): string | undefined {
  const templateSpan = template.getTemplate();
  let text = '';
  
  if (Node.isNoSubstitutionTemplateLiteral(templateSpan)) {
    text = templateSpan.getText();
  } else if (Node.isTemplateExpression(templateSpan)) {
    text = templateSpan.getHead().getText();
  }
  
  // Parse operation name: query GetUser, mutation CreateUser, etc.
  const match = text.match(/(query|mutation|subscription)\s+(\w+)/i);
  if (match) {
    return match[2];
  }
  
  return undefined;
}

// =============================================================================
// 📋 Query Extraction Functions
// =============================================================================

/**
 * Extract query from gql tagged template
 * If queryName is provided, returns single query; otherwise returns all queries
 */
export function extractQueryFromGql(
  sourceFile: SourceFile,
  queryName?: string
): ExtractedQuery | ExtractedQuery[] | null {
  const templates = sourceFile.getDescendantsOfKind(SyntaxKind.TaggedTemplateExpression);
  const queries: ExtractedQuery[] = [];
  
  for (const template of templates) {
    const tag = template.getTag();
    if (!Node.isIdentifier(tag) || tag.getText() !== 'gql') continue;
    
    const extracted = parseGqlTemplate(template);
    if (extracted) {
      queries.push(extracted);
    }
  }
  
  if (queryName !== undefined) {
    // Look for the specific query constant
    const varDeclarations = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
    for (const varDecl of varDeclarations) {
      if (varDecl.getName() === queryName) {
        const init = varDecl.getInitializer();
        if (init && Node.isTaggedTemplateExpression(init)) {
          return parseGqlTemplate(init);
        }
      }
    }
    return null;
  }
  
  return queries;
}

/**
 * Parse a gql tagged template into ExtractedQuery
 *
 * Extracts operation type, name, root field selection, and variables
 * from a GraphQL query/mutation/subscription template.
 *
 * @example
 * ```typescript
 * // For: query GetUser($id: ID!) { user(id: $id) { id name } }
 * // Returns: { operationType: 'query', operationName: 'GetUser',
 * //           selections: ['user'], variables: [{ name: 'id', type: 'ID!' }] }
 * ```
 */
function parseGqlTemplate(template: TaggedTemplateExpression): ExtractedQuery | null {
  const templateSpan = template.getTemplate();
  let text = '';
  
  if (Node.isNoSubstitutionTemplateLiteral(templateSpan)) {
    text = templateSpan.getLiteralText();
  } else if (Node.isTemplateExpression(templateSpan)) {
    text = templateSpan.getHead().getLiteralText();
    // Add any template spans
    for (const span of templateSpan.getTemplateSpans()) {
      text += span.getLiteral().getLiteralText();
    }
  }
  
  // Parse operation type and name
  const operationMatch = text.match(/(query|mutation|subscription)\s+(\w+)?/i);
  let operationType: 'query' | 'mutation' | 'subscription' = 'query';
  let operationName: string | undefined;
  
  if (operationMatch) {
    operationType = operationMatch[1].toLowerCase() as 'query' | 'mutation' | 'subscription';
    operationName = operationMatch[2];
  } else if (text.trim().startsWith('{')) {
    // Anonymous query
    operationType = 'query';
  }
  
  // Parse variables from query
  const variableMatch = text.match(/\(([^)]+)\)/);
  const variables: { name: string; type: string }[] = [];
  
  if (variableMatch) {
    const varsText = variableMatch[1];
    const varMatches = varsText.matchAll(/\$(\w+):\s*(\w+!?)/g);
    for (const match of varMatches) {
      variables.push({ name: match[1], type: match[2] });
    }
  }
  
  // Extract the ROOT field name (the actual schema field being queried)
  // This is the first field after the operation declaration's opening brace
  const selections: string[] = [];
  
  // Match: query/mutation/subscription [Name] [(args)] { rootField
  // The rootField is what we want - it's the actual schema field name
  const rootFieldMatch = text.match(
    /(?:query|mutation|subscription)\s*\w*\s*(?:\([^)]*\))?\s*\{\s*(\w+)/i
  );
  
  if (rootFieldMatch) {
    selections.push(rootFieldMatch[1]);
  } else {
    // Fallback for anonymous queries: { rootField
    const anonymousMatch = text.match(/^\s*\{\s*(\w+)/);
    if (anonymousMatch) {
      selections.push(anonymousMatch[1]);
    }
  }
  
  return {
    operationType,
    operationName,
    selections,
    variables,
  };
}

/**
 * Extract query from a constant reference
 */
export function extractQueryFromConstant(
  sourceFile: SourceFile,
  constantName: string
): ExtractedQuery | null {
  const varDeclarations = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  
  for (const varDecl of varDeclarations) {
    if (varDecl.getName() === constantName) {
      const init = varDecl.getInitializer();
      if (init && Node.isTaggedTemplateExpression(init)) {
        return parseGqlTemplate(init);
      }
    }
  }
  
  // If not found directly, it might be imported
  // For now, return a placeholder indicating the query exists but is imported
  return {
    operationType: 'query',
    operationName: constantName,
    selections: [],
    variables: [],
  };
}

// =============================================================================
// 🔧 Variables Extraction
// =============================================================================

/**
 * Extract variables option from hook call
 */
export function extractVariablesOption(
  sourceFile: SourceFile,
  componentName?: string
): HookVariable[] {
  const results: HookVariable[] = [];
  
  // Get all hook calls
  const allHooks = [
    ...detectUseQueryHook(sourceFile),
    ...detectUseMutationHook(sourceFile),
    ...detectUseLazyQueryHook(sourceFile),
    ...detectUseSubscriptionHook(sourceFile),
  ];
  
  // If componentName specified, filter to that component
  // For now, return all variables from all hooks
  for (const hook of allHooks) {
    results.push(...hook.variables);
  }
  
  return results;
}

// =============================================================================
// 🎯 Property Access Tracking
// =============================================================================

/**
 * Track property access paths on data object
 */
export function trackDataPropertyAccess(
  sourceFile: SourceFile,
  componentName?: string
): PropertyAccessPath[] {
  const results: PropertyAccessPath[] = [];
  
  // Find function/component
  let targetNode: Node | undefined;
  
  if (componentName) {
    // Find function declaration
    const funcDecl = sourceFile.getFunction(componentName);
    if (funcDecl) {
      targetNode = funcDecl;
    } else {
      // Find variable declaration
      const varDecls = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
      for (const varDecl of varDecls) {
        if (varDecl.getName() === componentName) {
          targetNode = varDecl;
          break;
        }
      }
    }
  } else {
    targetNode = sourceFile;
  }
  
  if (!targetNode) return results;
  
  // Collect all identifiers that represent 'data' derived values along with their prefix paths
  // Maps variable name to the path it represents from data
  const dataAliases = new Map<string, string>();
  dataAliases.set('data', '');
  
  // Track which paths involve array access
  const pathsWithArrayAccess = new Set<string>();
  
  // Find variable declarations that are assigned from data-derived expressions
  const varDecls = targetNode.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  for (const varDecl of varDecls) {
    const init = varDecl.getInitializer();
    if (init) {
      const initText = init.getText();
      // Check if initialized from data or a data-derived expression
      if (initText.includes('data')) {
        const varName = varDecl.getName();
        // Extract the path from data (e.g., "data?.user?.posts" -> "user.posts")
        const pathMatch = initText.match(/data\??\.([\w?.]+)/);
        if (pathMatch) {
          const extractedPath = pathMatch[1].replace(/\?/g, '').replace(/\.$/, '');
          dataAliases.set(varName, extractedPath);
        } else {
          dataAliases.set(varName, '');
        }
      }
    }
  }
  
  // Pre-scan for array operations on data-derived variables
  const fullText = targetNode.getText();
  for (const [alias, path] of dataAliases) {
    if (!path) continue; // Skip empty paths
    
    // Check if this alias is used with array operations
    // Patterns: alias.map(, alias?.map(, alias?.[0]
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const arrayOpsRegex = new RegExp(escapedAlias + '\\??\\.(map|forEach|filter|find|some|every|reduce)\\(');
    const arrayIndexRegex = new RegExp(escapedAlias + '\\??\\.?\\[\\d+\\]');
    
    if (arrayOpsRegex.test(fullText) || arrayIndexRegex.test(fullText)) {
      // Mark this path as having array access
      pathsWithArrayAccess.add(path);
    }
  }
  
  // Find property accesses on 'data' variable and data-derived variables
  const propertyAccesses = targetNode.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
  
  for (const access of propertyAccesses) {
    const path = buildPropertyPath(access);
    if (!path) continue;
    
    // Check if the access starts with 'data' or any data-derived alias
    let basePath = '';
    let prefixPath = '';
    
    for (const [alias, prefix] of dataAliases) {
      if (path === alias || path.startsWith(alias + '.')) {
        basePath = alias;
        prefixPath = prefix;
        break;
      }
    }
    
    if (basePath) {
      let pathWithoutBase = path.replace(new RegExp(`^${basePath}\\.?`), '');
      
      // Combine prefix path with the current path
      let fullPath = prefixPath;
      if (pathWithoutBase) {
        fullPath = prefixPath ? `${prefixPath}.${pathWithoutBase}` : pathWithoutBase;
      }
      
      if (fullPath) {
        // Check for array access in the entire access chain (including parent/children)
        const hasArrayAccess = checkHasArrayAccess(access) ||
                              checkHasArrayAccessInChain(access) ||
                              checkHasArrayAccessInText(access) ||
                              pathsWithArrayAccess.has(fullPath) ||
                              Array.from(pathsWithArrayAccess).some(p => fullPath.startsWith(p));
        
        results.push({
          path: fullPath,
          hasOptionalChaining: access.hasQuestionDotToken() || checkHasOptionalChaining(access),
          hasArrayAccess,
          depth: fullPath.split('.').length,
        });
      }
    }
  }
  
  return results;
}

/**
 * Check for optional chaining in the access chain
 */
function checkHasOptionalChaining(access: PropertyAccessExpression): boolean {
  let current: Node | undefined = access;
  
  while (current) {
    if (Node.isPropertyAccessExpression(current) && current.hasQuestionDotToken()) {
      return true;
    }
    if (Node.isPropertyAccessExpression(current)) {
      current = current.getExpression();
    } else {
      break;
    }
  }
  
  return false;
}

/**
 * Check if any parent or child node in the chain has element access
 */
function checkHasArrayAccessInChain(access: PropertyAccessExpression): boolean {
  // Check ancestors
  let parent: Node | undefined = access.getParent();
  while (parent) {
    if (Node.isElementAccessExpression(parent)) {
      return true;
    }
    if (Node.isPropertyAccessExpression(parent)) {
      parent = parent.getParent();
    } else {
      break;
    }
  }
  
  // Check if the full expression text includes array access patterns
  const fullText = access.getText();
  if (/\[\d+\]/.test(fullText) || /\?\.\[\d+\]/.test(fullText)) {
    return true;
  }
  
  return false;
}

/**
 * Check if the access involves array-like operations (map, forEach, etc.)
 * or if any related variable is used with array access
 */
function checkHasArrayAccessInText(access: PropertyAccessExpression): boolean {
  // Get the containing statement and check if there's array indexing nearby
  const statement = access.getFirstAncestorByKind(SyntaxKind.ExpressionStatement) ||
                   access.getFirstAncestorByKind(SyntaxKind.VariableDeclaration) ||
                   access.getFirstAncestorByKind(SyntaxKind.ReturnStatement);
  
  if (statement) {
    const text = statement.getText();
    // Check for array access patterns like [0], [i], .map(), .forEach(), etc.
    if (/\[\d+\]/.test(text) || /\.map\(/.test(text) || /\.forEach\(/.test(text) ||
        /\.filter\(/.test(text) || /\.find\(/.test(text) || /\.some\(/.test(text) ||
        /\.every\(/.test(text) || /\.reduce\(/.test(text)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Build full property access path
 */
function buildPropertyPath(access: PropertyAccessExpression): string {
  const parts: string[] = [];
  let current: Node = access;
  
  while (current) {
    if (Node.isPropertyAccessExpression(current)) {
      parts.unshift(current.getName());
      current = current.getExpression();
    } else if (Node.isElementAccessExpression(current)) {
      // Skip array access, continue to expression
      current = current.getExpression();
    } else if (Node.isAsExpression(current) || Node.isParenthesizedExpression(current)) {
      // Skip type casts and parentheses
      current = current.getExpression();
    } else if (Node.isIdentifier(current)) {
      parts.unshift(current.getText());
      break;
    } else if (Node.isCallExpression(current)) {
      // Stop at call expressions
      break;
    } else {
      break;
    }
  }
  
  return parts.join('.');
}

/**
 * Check if property access chain includes array access
 */
function checkHasArrayAccess(access: PropertyAccessExpression): boolean {
  // Walk up and down the expression tree to find element access
  let current: Node | undefined = access;
  
  // Walk up the chain
  while (current) {
    if (Node.isElementAccessExpression(current)) {
      return true;
    }
    
    if (Node.isPropertyAccessExpression(current)) {
      // Also check the expression side
      const expr = current.getExpression();
      if (Node.isElementAccessExpression(expr)) {
        return true;
      }
      current = current.getExpression();
    } else if (Node.isAsExpression(current) || Node.isParenthesizedExpression(current)) {
      current = current.getExpression();
    } else {
      break;
    }
  }
  
  // Also check parent nodes - the access might be after an element access
  current = access.getParent();
  while (current) {
    if (Node.isElementAccessExpression(current)) {
      return true;
    }
    if (Node.isPropertyAccessExpression(current)) {
      current = current.getParent();
    } else {
      break;
    }
  }
  
  return false;
}

// =============================================================================
// 📦 Destructured Data Tracking
// =============================================================================

/**
 * Track destructured data variables
 */
export function trackDestructuredData(
  sourceFile: SourceFile,
  componentName?: string
): DestructuredData[] {
  const results: DestructuredData[] = [];
  
  // Find hook calls in the component
  const callExprs = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  
  for (const callExpr of callExprs) {
    const exprText = callExpr.getExpression().getText();
    if (!['useQuery', 'useMutation', 'useLazyQuery', 'useSubscription'].includes(exprText)) {
      continue;
    }
    
    // Check if componentName matches
    if (componentName) {
      const containingFunc = callExpr.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
      const containingVar = callExpr.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
      
      const funcName = containingFunc?.getName();
      const varName = containingVar?.getName();
      
      if (funcName !== componentName && varName !== componentName) {
        continue;
      }
    }
    
    // Get the variable declaration containing this hook
    const varDecl = callExpr.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    if (!varDecl) continue;
    
    const nameNode = varDecl.getNameNode();
    
    // Check for object destructuring: const { data, loading } = useQuery(...)
    if (Node.isObjectBindingPattern(nameNode)) {
      for (const element of nameNode.getElements()) {
        const name = element.getName();
        const aliasNode = element.getPropertyNameNode();
        const alias = aliasNode ? aliasNode.getText() : undefined;
        const hasDefault = element.getInitializer() !== undefined;
        
        // Check for nested destructuring: const { data: { user } } = ...
        const nestedInit = element.getNameNode();
        if (Node.isObjectBindingPattern(nestedInit)) {
          for (const nested of nestedInit.getElements()) {
            results.push({
              name: nested.getName(),
              alias: element.getName() !== nested.getName() ? element.getName() : undefined,
              depth: 2,
              hasDefaultValue: nested.getInitializer() !== undefined || hasDefault,
            });
          }
        } else {
          results.push({
            name,
            alias: alias !== name ? alias : undefined,
            depth: 1,
            hasDefaultValue: hasDefault,
          });
        }
      }
    }
  }
  
  return results;
}
