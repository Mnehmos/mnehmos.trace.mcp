/**
 * GraphQL Adapter
 * 
 * Exports for GraphQL SDL parsing.
 * 
 * @see .context/ADR-P2-4-GRAPHQL-SUPPORT.md
 */

export {
  SDLParser,
  parseGraphQLSchema,
  extractQueryType,
  extractMutationType,
  extractSubscriptionType,
  extractObjectTypes,
  extractInputTypes,
  extractEnumTypes,
  extractInterfaceTypes,
  extractUnionTypes,
  graphqlTypeToNormalized,
} from './sdl-parser.js';
