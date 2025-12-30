/**
 * 📊 GraphQL Pattern Types
 *
 * Type definitions for GraphQL SDL parsing and Apollo pattern detection.
 * Provides comprehensive type coverage for:
 *
 * - 📋 SDL schema parsing (types, queries, mutations, subscriptions)
 * - 🔧 Resolver analysis (arguments, return types, context usage)
 * - 🎣 Client hook tracking (useQuery, useMutation, etc.)
 * - 🔍 Property access and mismatch detection
 *
 * @module patterns/graphql/types
 * @see .context/ADR-P2-4-GRAPHQL-SUPPORT.md
 */

// =============================================================================
// 📋 SDL Types - GraphQL Schema Definition Language
// =============================================================================

/**
 * Represents a GraphQL type reference (scalar, object, list, etc.)
 */
export interface GraphQLTypeRef {
  name: string;
  nullable: boolean;
  isList: boolean;
  ofType?: GraphQLTypeRef;
}

/**
 * Represents a field argument in GraphQL
 */
export interface GraphQLArgumentDefinition {
  name: string;
  type: GraphQLTypeRef;
  defaultValue?: unknown;
  description?: string;
}

/**
 * Represents a field in a GraphQL type
 */
export interface GraphQLFieldDefinition {
  name: string;
  type: GraphQLTypeRef;
  arguments: GraphQLArgumentDefinition[];
  description?: string;
  /** Normalized return type for schema compatibility checking */
  returnType?: GraphQLNormalizedType;
}

/**
 * Extended normalized type with GraphQL-specific properties
 */
export interface GraphQLNormalizedType {
  kind: 'primitive' | 'array' | 'ref' | 'reference' | 'object' | 'union' | 'any' | 'unknown';
  name?: string;
  nullable?: boolean;
  value?: string;
  element?: GraphQLNormalizedType;
  ofType?: GraphQLNormalizedType;
}

/**
 * Represents a GraphQL type definition (object, input, interface, etc.)
 */
export interface GraphQLTypeDefinition {
  name: string;
  kind: 'object' | 'input' | 'interface' | 'enum' | 'union' | 'scalar';
  fields: GraphQLFieldDefinition[];
  values?: string[]; // For enums
  memberTypes?: string[]; // For unions
  interfaces?: string[]; // Implemented interfaces
  description?: string;
}

/**
 * Represents the complete schema definition
 */
export interface GraphQLSchemaDefinition {
  types: GraphQLTypeDefinition[];
  queries: GraphQLFieldDefinition[];
  mutations: GraphQLFieldDefinition[];
  subscriptions: GraphQLFieldDefinition[];
  inputs: GraphQLTypeDefinition[];
  enums: GraphQLTypeDefinition[];
  interfaces: GraphQLTypeDefinition[];
  unions: GraphQLTypeDefinition[];
}

// =============================================================================
// 🔧 Resolver Types - Server-side Resolver Definitions
// =============================================================================

/**
 * Represents a resolver argument extracted from TypeScript
 */
export interface ResolverArgument {
  name: string;
  type: string;
  optional: boolean;
}

/**
 * Represents a resolver field definition
 */
export interface ResolverField {
  name: string;
  arguments: ResolverArgument[];
  usesContext: boolean;
  usesInfo: boolean;
  isAsync: boolean;
  returnType?: string;
  hasSubscribe?: boolean;
}

/**
 * Represents a type resolver (for nested fields)
 */
export interface TypeResolver {
  typeName: string;
  fields: ResolverField[];
  hasResolveType: boolean;
}

/**
 * Represents a resolver object definition
 */
export interface ResolverDefinition {
  variableName: string;
  hasQuery: boolean;
  hasMutation: boolean;
  hasSubscription: boolean;
  typeResolvers: TypeResolver[];
  queryResolvers: ResolverField[];
  mutationResolvers: ResolverField[];
  subscriptionResolvers: ResolverField[];
}

// =============================================================================
// 🎣 Client Hook Types - Apollo Client Hook Usage
// =============================================================================

/**
 * Represents a variable used in a hook call
 */
export interface HookVariable {
  name: string;
  type: string;
  isSpread: boolean;
  matchesSchema?: boolean;
}

/**
 * Represents a property access path on data
 */
export interface PropertyAccessPath {
  path: string;
  hasOptionalChaining: boolean;
  hasArrayAccess: boolean;
  depth: number;
}

/**
 * Represents a destructured data variable
 */
export interface DestructuredData {
  name: string;
  alias?: string;
  depth: number;
  hasDefaultValue: boolean;
}

/**
 * Represents a client hook usage
 */
export interface ClientHookUsage {
  hookType: 'useQuery' | 'useMutation' | 'useLazyQuery' | 'useSubscription';
  queryName: string;
  operationType: 'query' | 'mutation' | 'subscription';
  operationName?: string;
  typeParameter?: string;
  variables: HookVariable[];
  propertyAccesses: PropertyAccessPath[];
  destructuredData: DestructuredData[];
  hasSkipOption: boolean;
  hasPollInterval: boolean;
  hasOnCompleted: boolean;
  mutationFunctionName?: string;
  functionName?: string; // For lazy query
  checksCalled: boolean;
  schemaQueryName?: string;
  propertyAccessMismatches?: PropertyAccessPath[];
}

/**
 * Represents an extracted query from gql tag
 */
export interface ExtractedQuery {
  operationType: 'query' | 'mutation' | 'subscription';
  operationName?: string;
  selections: string[];
  variables: { name: string; type: string }[];
}

// =============================================================================
// 📈 Analysis Result Types - Pattern Matching Results
// =============================================================================

/**
 * Return type inference result
 */
export interface ResolverReturnType {
  isAsync: boolean;
  nullable: boolean;
  isArray: boolean;
  typeName?: string;
}

/**
 * Resolver analysis result
 */
export interface ResolverAnalysisResult {
  queryResolvers: (ResolverField & { 
    schemaFieldName?: string;
    argumentMismatches?: { argName: string; expected: string; actual: string }[];
  })[];
  mutationResolvers: (ResolverField & { 
    schemaFieldName?: string;
    argumentMismatches?: { argName: string; expected: string; actual: string }[];
  })[];
  subscriptionResolvers: ResolverField[];
  typeResolvers: TypeResolver[];
}
