/**
 * GraphQL Pattern Detection
 * 
 * Exports for GraphQL SDL parsing and Apollo pattern detection.
 * 
 * @see .context/ADR-P2-4-GRAPHQL-SUPPORT.md
 */

// Types
export type {
  GraphQLTypeRef,
  GraphQLArgumentDefinition,
  GraphQLFieldDefinition,
  GraphQLTypeDefinition,
  GraphQLSchemaDefinition,
  ResolverArgument,
  ResolverField,
  TypeResolver,
  ResolverDefinition,
  HookVariable,
  PropertyAccessPath,
  DestructuredData,
  ClientHookUsage,
  ExtractedQuery,
  ResolverReturnType,
  ResolverAnalysisResult,
} from './types.js';

// Apollo Server patterns
export {
  ApolloServerPatternMatcher,
  detectResolverObject,
  detectQueryResolvers,
  detectMutationResolvers,
  detectSubscriptionResolvers,
  detectTypeResolvers,
  extractResolverArguments,
  inferResolverReturnType,
} from './apollo-server.js';

// Apollo Client patterns
export {
  ApolloClientPatternMatcher,
  detectUseQueryHook,
  detectUseMutationHook,
  detectUseLazyQueryHook,
  detectUseSubscriptionHook,
  extractQueryFromGql,
  extractQueryFromConstant,
  extractVariablesOption,
  trackDataPropertyAccess,
  trackDestructuredData,
} from './apollo-client.js';
