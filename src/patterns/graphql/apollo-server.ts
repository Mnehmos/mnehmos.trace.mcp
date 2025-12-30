/**
 * 🔧 Apollo Server Pattern Matcher
 *
 * Detects Apollo Server resolver patterns in TypeScript code.
 * Analyzes resolver objects to extract:
 *
 * - 📋 Query/Mutation/Subscription resolvers
 * - 🔍 Resolver arguments and types
 * - 🎯 Context and info parameter usage
 * - ⚡ Async resolver detection
 * - 🔗 Type resolver relationships
 *
 * @module patterns/graphql/apollo-server
 * @see .context/ADR-P2-4-GRAPHQL-SUPPORT.md
 */

import {
  SourceFile,
  Node,
  SyntaxKind,
  ObjectLiteralExpression,
  PropertyAssignment,
  MethodDeclaration,
  ArrowFunction,
  FunctionExpression,
  VariableDeclaration,
  Identifier,
  ParameterDeclaration,
} from 'ts-morph';
import type {
  ResolverDefinition,
  ResolverField,
  TypeResolver,
  ResolverArgument,
  ResolverReturnType,
  ResolverAnalysisResult,
} from './types.js';

// =============================================================================
// 🏗️ Apollo Server Pattern Matcher Class
// =============================================================================

/**
 * Apollo Server Pattern Matcher class
 */
export class ApolloServerPatternMatcher {
  /**
   * Analyze a source file for Apollo Server resolver patterns
   */
  analyze(sourceFile: SourceFile): ResolverAnalysisResult {
    const queryResolvers = detectQueryResolvers(sourceFile);
    const mutationResolvers = detectMutationResolvers(sourceFile);
    const subscriptionResolvers = detectSubscriptionResolvers(sourceFile);
    const typeResolvers = detectTypeResolvers(sourceFile);
    
    // Enhance with schema field names and mismatch tracking
    return {
      queryResolvers: queryResolvers.map(r => ({
        ...r,
        schemaFieldName: r.name,
        argumentMismatches: [],
      })),
      mutationResolvers: mutationResolvers.map(r => ({
        ...r,
        schemaFieldName: r.name,
        argumentMismatches: [],
      })),
      subscriptionResolvers,
      typeResolvers,
    };
  }
}

// =============================================================================
// 🔍 Resolver Detection Functions
// =============================================================================

/**
 * Detect resolver object literals in a source file
 */
export function detectResolverObject(sourceFile: SourceFile): ResolverDefinition[] {
  const results: ResolverDefinition[] = [];
  
  // Find all variable declarations with object literal expressions
  const variableDeclarations = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  
  for (const varDecl of variableDeclarations) {
    const initializer = varDecl.getInitializer();
    if (!initializer || !Node.isObjectLiteralExpression(initializer)) continue;
    
    const varName = varDecl.getName();
    
    // Check if object has Query, Mutation, Subscription properties
    const resolverDef = analyzeResolverObject(varName, initializer);
    if (resolverDef) {
      results.push(resolverDef);
    }
  }
  
  // Also check object literals inside new ApolloServer() calls
  const newExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression);
  for (const newExpr of newExpressions) {
    const exprText = newExpr.getExpression().getText();
    if (exprText !== 'ApolloServer') continue;
    
    const args = newExpr.getArguments();
    if (args.length === 0) continue;
    
    const configArg = args[0];
    if (!Node.isObjectLiteralExpression(configArg)) continue;
    
    // Find resolvers property
    const resolversProp = configArg.getProperty('resolvers');
    if (!resolversProp || !Node.isPropertyAssignment(resolversProp)) continue;
    
    const resolversInit = resolversProp.getInitializer();
    if (!resolversInit) continue;
    
    if (Node.isObjectLiteralExpression(resolversInit)) {
      const resolverDef = analyzeResolverObject('inlineResolvers', resolversInit);
      if (resolverDef) {
        results.push(resolverDef);
      }
    }
  }
  
  return results;
}

/**
 * Analyze an object literal to extract resolver definition
 */
function analyzeResolverObject(varName: string, obj: ObjectLiteralExpression): ResolverDefinition | null {
  const properties = obj.getProperties();
  
  let hasQuery = false;
  let hasMutation = false;
  let hasSubscription = false;
  const typeResolvers: TypeResolver[] = [];
  const queryResolvers: ResolverField[] = [];
  const mutationResolvers: ResolverField[] = [];
  const subscriptionResolvers: ResolverField[] = [];
  
  for (const prop of properties) {
    if (!Node.isPropertyAssignment(prop) && !Node.isShorthandPropertyAssignment(prop)) {
      continue;
    }
    
    const propName = prop.getName();
    
    if (propName === 'Query') {
      hasQuery = true;
      const queryObj = getPropertyInitializer(prop);
      if (queryObj && Node.isObjectLiteralExpression(queryObj)) {
        queryResolvers.push(...extractResolverFields(queryObj));
      }
    } else if (propName === 'Mutation') {
      hasMutation = true;
      const mutationObj = getPropertyInitializer(prop);
      if (mutationObj && Node.isObjectLiteralExpression(mutationObj)) {
        mutationResolvers.push(...extractResolverFields(mutationObj));
      }
    } else if (propName === 'Subscription') {
      hasSubscription = true;
      const subscriptionObj = getPropertyInitializer(prop);
      if (subscriptionObj && Node.isObjectLiteralExpression(subscriptionObj)) {
        subscriptionResolvers.push(...extractSubscriptionFields(subscriptionObj));
      }
    } else if (!propName.startsWith('__')) {
      // Type resolver (User, Post, etc.)
      const typeObj = getPropertyInitializer(prop);
      if (typeObj && Node.isObjectLiteralExpression(typeObj)) {
        const typeResolver: TypeResolver = {
          typeName: propName,
          fields: extractResolverFields(typeObj),
          hasResolveType: hasResolveTypeMethod(typeObj),
        };
        typeResolvers.push(typeResolver);
      }
    }
  }
  
  // Only return if it looks like a resolver object
  if (!hasQuery && !hasMutation && !hasSubscription && typeResolvers.length === 0) {
    return null;
  }
  
  return {
    variableName: varName,
    hasQuery,
    hasMutation,
    hasSubscription,
    typeResolvers,
    queryResolvers,
    mutationResolvers,
    subscriptionResolvers,
  };
}

/**
 * Get the initializer from a property assignment or shorthand property
 */
function getPropertyInitializer(prop: PropertyAssignment | Node): Node | undefined {
  if (Node.isPropertyAssignment(prop)) {
    return prop.getInitializer();
  }
  return undefined;
}

/**
 * Extract resolver fields from an object literal
 */
function extractResolverFields(obj: ObjectLiteralExpression): ResolverField[] {
  const fields: ResolverField[] = [];
  
  for (const prop of obj.getProperties()) {
    if (Node.isPropertyAssignment(prop)) {
      const name = prop.getName();
      const init = prop.getInitializer();
      
      if (init) {
        const field = extractResolverField(name, init);
        if (field) {
          fields.push(field);
        }
      }
    } else if (Node.isMethodDeclaration(prop)) {
      const name = prop.getName();
      const field = extractResolverFieldFromMethod(name, prop);
      if (field) {
        fields.push(field);
      }
    } else if (Node.isSpreadAssignment(prop)) {
      // Handle spread: ...queryResolvers
      // We can't fully resolve this statically but note it
    }
  }
  
  return fields;
}

/**
 * Extract subscription fields (which have subscribe property)
 */
function extractSubscriptionFields(obj: ObjectLiteralExpression): ResolverField[] {
  const fields: ResolverField[] = [];
  
  for (const prop of obj.getProperties()) {
    if (Node.isPropertyAssignment(prop)) {
      const name = prop.getName();
      const init = prop.getInitializer();
      
      if (init && Node.isObjectLiteralExpression(init)) {
        // Subscription resolver object with subscribe method
        const subscribeProp = init.getProperty('subscribe');
        const hasSubscribe = subscribeProp !== undefined;
        
        let args: ResolverArgument[] = [];
        if (subscribeProp && Node.isPropertyAssignment(subscribeProp)) {
          const subscribeInit = subscribeProp.getInitializer();
          if (subscribeInit) {
            args = extractArgumentsFromFunction(subscribeInit);
          }
        }
        
        fields.push({
          name,
          arguments: args,
          usesContext: false,
          usesInfo: false,
          isAsync: false,
          hasSubscribe,
        });
      }
    }
  }
  
  return fields;
}

/**
 * Extract resolver field from an initializer (arrow function, function expression, or reference)
 */
function extractResolverField(name: string, init: Node): ResolverField | null {
  const args = extractArgumentsFromFunction(init);
  const usesContext = checkUsesContext(init);
  const usesInfo = checkUsesInfo(init);
  const isAsync = checkIsAsync(init);
  
  return {
    name,
    arguments: args,
    usesContext,
    usesInfo,
    isAsync,
  };
}

/**
 * Extract resolver field from a method declaration
 */
function extractResolverFieldFromMethod(name: string, method: MethodDeclaration): ResolverField | null {
  const params = method.getParameters();
  const args = extractArgumentsFromParams(params);
  const usesContext = checkUsesContextInParams(params);
  const usesInfo = checkUsesInfoInParams(params);
  const isAsync = method.isAsync();
  
  return {
    name,
    arguments: args,
    usesContext,
    usesInfo,
    isAsync,
  };
}

/**
 * Extract arguments from a function node
 */
function extractArgumentsFromFunction(node: Node): ResolverArgument[] {
  let params: ParameterDeclaration[] = [];
  
  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
    params = node.getParameters();
  } else if (Node.isFunctionDeclaration(node)) {
    params = node.getParameters();
  }
  
  return extractArgumentsFromParams(params);
}

/**
 * Extract arguments from parameter declarations
 */
function extractArgumentsFromParams(params: ParameterDeclaration[]): ResolverArgument[] {
  // In GraphQL resolvers: (parent, args, context, info)
  // We want to extract from 'args' (second parameter)
  if (params.length < 2) return [];
  
  const argsParam = params[1];
  const result: ResolverArgument[] = [];
  
  // Check if args is destructured: { id, name, ...}
  const nameNode = argsParam.getNameNode();
  if (Node.isObjectBindingPattern(nameNode)) {
    for (const element of nameNode.getElements()) {
      const bindingName = element.getName();
      // Check if element has default value (= xxx) which makes it optional
      const hasDefaultValue = element.getInitializer() !== undefined;
      
      // Try to get type from the parent type annotation on args param
      let typeName = 'unknown';
      let isOptional = hasDefaultValue;
      
      // Check parent type annotation
      const argsTypeNode = argsParam.getTypeNode();
      if (argsTypeNode && Node.isTypeLiteral(argsTypeNode)) {
        for (const member of argsTypeNode.getMembers()) {
          if (Node.isPropertySignature(member) && member.getName() === bindingName) {
            // Get simple type name, not full import path
            const typeText = member.getType()?.getText() ?? 'unknown';
            // Strip import() wrapper if present
            const simpleMatch = typeText.match(/import\([^)]+\)\.(\w+)/);
            typeName = simpleMatch ? simpleMatch[1] : typeText;
            isOptional = isOptional || member.hasQuestionToken();
            break;
          }
        }
      }
      
      result.push({
        name: bindingName,
        type: typeName,
        optional: isOptional,
      });
    }
  } else {
    // Args is a single parameter, try to get its type
    const typeNode = argsParam.getTypeNode();
    if (typeNode && Node.isTypeLiteral(typeNode)) {
      for (const member of typeNode.getMembers()) {
        if (Node.isPropertySignature(member)) {
          const propName = member.getName();
          // Get simple type name, not full import path
          const typeText = member.getType()?.getText() ?? 'unknown';
          const simpleMatch = typeText.match(/import\([^)]+\)\.(\w+)/);
          const propType = simpleMatch ? simpleMatch[1] : typeText;
          const isOptional = member.hasQuestionToken();
          
          result.push({
            name: propName,
            type: propType,
            optional: isOptional,
          });
        }
      }
    }
  }
  
  return result;
}

/**
 * Check if the function uses context parameter
 */
function checkUsesContext(node: Node): boolean {
  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
    const params = node.getParameters();
    return params.length >= 3;
  }
  return false;
}

/**
 * Check if the function uses info parameter
 */
function checkUsesInfo(node: Node): boolean {
  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
    const params = node.getParameters();
    return params.length >= 4;
  }
  return false;
}

/**
 * Check if the function is async
 */
function checkIsAsync(node: Node): boolean {
  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
    return node.isAsync();
  }
  return false;
}

/**
 * Check context usage from parameters
 */
function checkUsesContextInParams(params: ParameterDeclaration[]): boolean {
  return params.length >= 3;
}

/**
 * Check info usage from parameters
 */
function checkUsesInfoInParams(params: ParameterDeclaration[]): boolean {
  return params.length >= 4;
}

/**
 * Check if object has __resolveType method
 */
function hasResolveTypeMethod(obj: ObjectLiteralExpression): boolean {
  return obj.getProperty('__resolveType') !== undefined;
}

// =============================================================================
// 📋 Query/Mutation/Subscription Detection
// =============================================================================

/**
 * Detect Query resolver methods
 */
export function detectQueryResolvers(sourceFile: SourceFile): ResolverField[] {
  const resolverObjects = detectResolverObject(sourceFile);
  const results: ResolverField[] = [];
  
  for (const resolver of resolverObjects) {
    results.push(...resolver.queryResolvers);
  }
  
  return results;
}

/**
 * Detect Mutation resolver methods
 */
export function detectMutationResolvers(sourceFile: SourceFile): ResolverField[] {
  const resolverObjects = detectResolverObject(sourceFile);
  const results: ResolverField[] = [];
  
  for (const resolver of resolverObjects) {
    results.push(...resolver.mutationResolvers);
  }
  
  return results;
}

/**
 * Detect Subscription resolver methods
 */
export function detectSubscriptionResolvers(sourceFile: SourceFile): ResolverField[] {
  const resolverObjects = detectResolverObject(sourceFile);
  const results: ResolverField[] = [];
  
  for (const resolver of resolverObjects) {
    results.push(...resolver.subscriptionResolvers);
  }
  
  return results;
}

/**
 * Detect type resolvers (nested field resolvers)
 */
export function detectTypeResolvers(sourceFile: SourceFile): TypeResolver[] {
  const resolverObjects = detectResolverObject(sourceFile);
  const results: TypeResolver[] = [];
  
  for (const resolver of resolverObjects) {
    results.push(...resolver.typeResolvers);
  }
  
  return results;
}

// =============================================================================
// ⚙️ Argument Extraction & Return Type Inference
// =============================================================================

/**
 * Extract arguments from a resolver function
 */
export function extractResolverArguments(
  sourceFile: SourceFile,
  resolverName: string
): ResolverArgument[] {
  const queryResolvers = detectQueryResolvers(sourceFile);
  const mutationResolvers = detectMutationResolvers(sourceFile);
  const allResolvers = [...queryResolvers, ...mutationResolvers];
  
  const resolver = allResolvers.find(r => r.name === resolverName);
  return resolver?.arguments ?? [];
}

/**
 * Infer the return type of a resolver function
 */
export function inferResolverReturnType(
  sourceFile: SourceFile,
  resolverName: string
): ResolverReturnType {
  const queryResolvers = detectQueryResolvers(sourceFile);
  const mutationResolvers = detectMutationResolvers(sourceFile);
  const allResolvers = [...queryResolvers, ...mutationResolvers];
  
  const resolver = allResolvers.find(r => r.name === resolverName);
  
  // Get the actual resolver function to analyze
  let isAsync = resolver?.isAsync ?? false;
  let nullable = false;
  let isArray = false;
  
  // Find the actual function node to do deeper analysis
  const resolverObjects = detectResolverObject(sourceFile);
  for (const resolverObj of resolverObjects) {
    // Look in Query/Mutation resolvers
    const allFields = [...resolverObj.queryResolvers, ...resolverObj.mutationResolvers];
    for (const field of allFields) {
      if (field.name === resolverName) {
        isAsync = field.isAsync;
        break;
      }
    }
  }
  
  // Also check the actual function implementation for async keyword
  // by searching variable declarations
  const varDecls = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  for (const varDecl of varDecls) {
    const init = varDecl.getInitializer();
    if (!init || !Node.isObjectLiteralExpression(init)) continue;
    
    // Look for Query or Mutation property
    for (const prop of init.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) continue;
      const propName = prop.getName();
      if (propName !== 'Query' && propName !== 'Mutation') continue;
      
      const nestedObj = prop.getInitializer();
      if (!nestedObj || !Node.isObjectLiteralExpression(nestedObj)) continue;
      
      for (const nestedProp of nestedObj.getProperties()) {
        if (Node.isPropertyAssignment(nestedProp) && nestedProp.getName() === resolverName) {
          const resolverFn = nestedProp.getInitializer();
          if (resolverFn && (Node.isArrowFunction(resolverFn) || Node.isFunctionExpression(resolverFn))) {
            isAsync = resolverFn.isAsync();
            
            // Check return type for nullable
            const returnType = resolverFn.getReturnType();
            const returnText = returnType.getText();
            nullable = returnText.includes('null') || returnText.includes('undefined');
            isArray = returnText.includes('[]') || returnText.includes('Array');
          }
        } else if (Node.isMethodDeclaration(nestedProp) && nestedProp.getName() === resolverName) {
          isAsync = nestedProp.isAsync();
          
          const returnType = nestedProp.getReturnType();
          const returnText = returnType.getText();
          nullable = returnText.includes('null') || returnText.includes('undefined');
          isArray = returnText.includes('[]') || returnText.includes('Array');
        }
      }
    }
  }
  
  return {
    isAsync,
    nullable,
    isArray,
  };
}
