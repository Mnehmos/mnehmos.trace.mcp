/**
 * GraphQL SDL Parser
 *
 * Parses GraphQL Schema Definition Language (SDL) files.
 * Uses the graphql package for robust parsing.
 *
 * @module GraphQL SDL Parser
 * @see .context/ADR-P2-4-GRAPHQL-SUPPORT.md
 */

import {
  parse,
  buildSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLNonNull,
  GraphQLList,
  GraphQLType,
  GraphQLNamedType,
  GraphQLField,
  GraphQLInputField,
  GraphQLArgument,
  GraphQLScalarType,
  isNonNullType,
  isListType,
  isNamedType,
} from 'graphql';

import type {
  GraphQLSchemaDefinition,
  GraphQLTypeDefinition,
  GraphQLFieldDefinition,
  GraphQLTypeRef,
  GraphQLArgumentDefinition,
  GraphQLNormalizedType,
} from '../../patterns/graphql/types.js';

// =============================================================================
// SDL Parser Class
// =============================================================================

/**
 * SDL Parser class for parsing GraphQL schema files
 */
export class SDLParser {
  /**
   * Parse a GraphQL SDL schema string
   */
  parse(schemaContent: string): GraphQLSchemaDefinition {
    const schema = buildSchema(schemaContent);
    
    const result: GraphQLSchemaDefinition = {
      types: [],
      queries: [],
      mutations: [],
      subscriptions: [],
      inputs: [],
      enums: [],
      interfaces: [],
      unions: [],
    };
    
    // Extract Query type
    const queryType = schema.getQueryType();
    if (queryType) {
      result.queries = this.extractFields(queryType);
    }
    
    // Extract Mutation type
    const mutationType = schema.getMutationType();
    if (mutationType) {
      result.mutations = this.extractFields(mutationType);
    }
    
    // Extract Subscription type
    const subscriptionType = schema.getSubscriptionType();
    if (subscriptionType) {
      result.subscriptions = this.extractFields(subscriptionType);
    }
    
    // Extract all types
    const typeMap = schema.getTypeMap();
    for (const [name, type] of Object.entries(typeMap)) {
      // Skip internal types
      if (name.startsWith('__')) continue;
      // Skip root types
      if (name === 'Query' || name === 'Mutation' || name === 'Subscription') continue;
      
      if (type instanceof GraphQLObjectType) {
        result.types.push(this.convertObjectType(type));
      } else if (type instanceof GraphQLInputObjectType) {
        result.inputs.push(this.convertInputType(type));
      } else if (type instanceof GraphQLEnumType) {
        result.enums.push(this.convertEnumType(type));
      } else if (type instanceof GraphQLInterfaceType) {
        result.interfaces.push(this.convertInterfaceType(type));
      } else if (type instanceof GraphQLUnionType) {
        result.unions.push(this.convertUnionType(type));
      }
    }
    
    return result;
  }
  
  private extractFields(type: GraphQLObjectType): GraphQLFieldDefinition[] {
    const fields = type.getFields();
    return Object.values(fields).map(field => this.convertField(field));
  }
  
  private convertField(field: GraphQLField<unknown, unknown>): GraphQLFieldDefinition {
    const typeRef = this.convertTypeRef(field.type);
    return {
      name: field.name,
      type: typeRef,
      arguments: field.args.map(arg => this.convertArgument(arg)),
      description: field.description ?? undefined,
      returnType: graphqlTypeToNormalized(typeRef),
    };
  }
  
  private convertInputField(field: GraphQLInputField): GraphQLFieldDefinition {
    return {
      name: field.name,
      type: this.convertTypeRef(field.type),
      arguments: [],
      description: field.description ?? undefined,
    };
  }
  
  private convertArgument(arg: GraphQLArgument): GraphQLArgumentDefinition {
    return {
      name: arg.name,
      type: this.convertTypeRef(arg.type),
      defaultValue: arg.defaultValue,
      description: arg.description ?? undefined,
    };
  }
  
  private convertTypeRef(type: GraphQLType): GraphQLTypeRef {
    let nullable = true;
    let currentType = type;
    
    // Handle NonNull wrapper
    if (isNonNullType(currentType)) {
      nullable = false;
      currentType = currentType.ofType;
    }
    
    // Handle List wrapper
    if (isListType(currentType)) {
      let innerType = currentType.ofType;
      let innerNullable = true;
      
      // Check if inner type is non-null
      if (isNonNullType(innerType)) {
        innerNullable = false;
        innerType = innerType.ofType;
      }
      
      return {
        name: (innerType as GraphQLNamedType).name,
        nullable,
        isList: true,
        ofType: {
          name: (innerType as GraphQLNamedType).name,
          nullable: innerNullable,
          isList: false,
        },
      };
    }
    
    // Named type
    if (isNamedType(currentType)) {
      return {
        name: currentType.name,
        nullable,
        isList: false,
      };
    }
    
    // Fallback
    return {
      name: 'Unknown',
      nullable: true,
      isList: false,
    };
  }
  
  private convertObjectType(type: GraphQLObjectType): GraphQLTypeDefinition {
    const fields = type.getFields();
    const interfaces = type.getInterfaces();
    
    return {
      name: type.name,
      kind: 'object',
      fields: Object.values(fields).map(field => this.convertField(field)),
      interfaces: interfaces.map(i => i.name),
      description: type.description ?? undefined,
    };
  }
  
  private convertInputType(type: GraphQLInputObjectType): GraphQLTypeDefinition {
    const fields = type.getFields();
    
    return {
      name: type.name,
      kind: 'input',
      fields: Object.values(fields).map(field => this.convertInputField(field)),
      description: type.description ?? undefined,
    };
  }
  
  private convertEnumType(type: GraphQLEnumType): GraphQLTypeDefinition {
    return {
      name: type.name,
      kind: 'enum',
      fields: [],
      values: type.getValues().map(v => v.name),
      description: type.description ?? undefined,
    };
  }
  
  private convertInterfaceType(type: GraphQLInterfaceType): GraphQLTypeDefinition {
    const fields = type.getFields();
    
    return {
      name: type.name,
      kind: 'interface',
      fields: Object.values(fields).map(field => this.convertField(field)),
      description: type.description ?? undefined,
    };
  }
  
  private convertUnionType(type: GraphQLUnionType): GraphQLTypeDefinition {
    return {
      name: type.name,
      kind: 'union',
      fields: [],
      memberTypes: type.getTypes().map(t => t.name),
      description: type.description ?? undefined,
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse a GraphQL schema string into a schema definition
 */
export function parseGraphQLSchema(schemaContent: string): GraphQLSchemaDefinition {
  const parser = new SDLParser();
  return parser.parse(schemaContent);
}

/**
 * Extract the Query type from a schema
 */
export function extractQueryType(schemaContent: string): GraphQLTypeDefinition | null {
  try {
    const schema = buildSchema(schemaContent);
    const queryType = schema.getQueryType();
    
    if (!queryType) return null;
    
    const parser = new SDLParser();
    const fields = queryType.getFields();
    
    return {
      name: 'Query',
      kind: 'object',
      fields: Object.values(fields).map(field => ({
        name: field.name,
        type: convertTypeRefStatic(field.type),
        arguments: field.args.map(arg => ({
          name: arg.name,
          type: convertTypeRefStatic(arg.type),
          defaultValue: arg.defaultValue,
          description: arg.description ?? undefined,
        })),
        description: field.description ?? undefined,
      })),
      description: queryType.description ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Extract the Mutation type from a schema
 */
export function extractMutationType(schemaContent: string): GraphQLTypeDefinition | null {
  try {
    const schema = buildSchema(schemaContent);
    const mutationType = schema.getMutationType();
    
    if (!mutationType) return null;
    
    const fields = mutationType.getFields();
    
    return {
      name: 'Mutation',
      kind: 'object',
      fields: Object.values(fields).map(field => ({
        name: field.name,
        type: convertTypeRefStatic(field.type),
        arguments: field.args.map(arg => ({
          name: arg.name,
          type: convertTypeRefStatic(arg.type),
          defaultValue: arg.defaultValue,
          description: arg.description ?? undefined,
        })),
        description: field.description ?? undefined,
      })),
      description: mutationType.description ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Extract the Subscription type from a schema
 */
export function extractSubscriptionType(schemaContent: string): GraphQLTypeDefinition | null {
  try {
    const schema = buildSchema(schemaContent);
    const subscriptionType = schema.getSubscriptionType();
    
    if (!subscriptionType) return null;
    
    const fields = subscriptionType.getFields();
    
    return {
      name: 'Subscription',
      kind: 'object',
      fields: Object.values(fields).map(field => ({
        name: field.name,
        type: convertTypeRefStatic(field.type),
        arguments: field.args.map(arg => ({
          name: arg.name,
          type: convertTypeRefStatic(arg.type),
          defaultValue: arg.defaultValue,
          description: arg.description ?? undefined,
        })),
        description: field.description ?? undefined,
      })),
      description: subscriptionType.description ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Extract all object types from a schema
 */
export function extractObjectTypes(schemaContent: string): GraphQLTypeDefinition[] {
  try {
    const schema = buildSchema(schemaContent);
    const typeMap = schema.getTypeMap();
    const result: GraphQLTypeDefinition[] = [];
    
    for (const [name, type] of Object.entries(typeMap)) {
      // Skip internal types
      if (name.startsWith('__')) continue;
      // Skip root types
      if (name === 'Query' || name === 'Mutation' || name === 'Subscription') continue;
      
      if (type instanceof GraphQLObjectType) {
        const fields = type.getFields();
        const interfaces = type.getInterfaces();
        
        result.push({
          name: type.name,
          kind: 'object',
          fields: Object.values(fields).map(field => ({
            name: field.name,
            type: convertTypeRefStatic(field.type),
            arguments: field.args.map(arg => ({
              name: arg.name,
              type: convertTypeRefStatic(arg.type),
              defaultValue: arg.defaultValue,
              description: arg.description ?? undefined,
            })),
            description: field.description ?? undefined,
          })),
          interfaces: interfaces.map(i => i.name),
          description: type.description ?? undefined,
        });
      }
    }
    
    return result;
  } catch {
    return [];
  }
}

/**
 * Extract all input types from a schema
 */
export function extractInputTypes(schemaContent: string): GraphQLTypeDefinition[] {
  try {
    const schema = buildSchema(schemaContent);
    const typeMap = schema.getTypeMap();
    const result: GraphQLTypeDefinition[] = [];
    
    for (const [name, type] of Object.entries(typeMap)) {
      if (name.startsWith('__')) continue;
      
      if (type instanceof GraphQLInputObjectType) {
        const fields = type.getFields();
        
        result.push({
          name: type.name,
          kind: 'input',
          fields: Object.values(fields).map(field => ({
            name: field.name,
            type: convertTypeRefStatic(field.type),
            arguments: [],
            description: field.description ?? undefined,
          })),
          description: type.description ?? undefined,
        });
      }
    }
    
    return result;
  } catch {
    return [];
  }
}

/**
 * Extract all enum types from a schema
 */
export function extractEnumTypes(schemaContent: string): GraphQLTypeDefinition[] {
  try {
    const schema = buildSchema(schemaContent);
    const typeMap = schema.getTypeMap();
    const result: GraphQLTypeDefinition[] = [];
    
    for (const [name, type] of Object.entries(typeMap)) {
      if (name.startsWith('__')) continue;
      
      if (type instanceof GraphQLEnumType) {
        result.push({
          name: type.name,
          kind: 'enum',
          fields: [],
          values: type.getValues().map(v => v.name),
          description: type.description ?? undefined,
        });
      }
    }
    
    return result;
  } catch {
    return [];
  }
}

/**
 * Extract all interface types from a schema
 */
export function extractInterfaceTypes(schemaContent: string): GraphQLTypeDefinition[] {
  try {
    const schema = buildSchema(schemaContent);
    const typeMap = schema.getTypeMap();
    const result: GraphQLTypeDefinition[] = [];
    
    for (const [name, type] of Object.entries(typeMap)) {
      if (name.startsWith('__')) continue;
      
      if (type instanceof GraphQLInterfaceType) {
        const fields = type.getFields();
        
        result.push({
          name: type.name,
          kind: 'interface',
          fields: Object.values(fields).map(field => ({
            name: field.name,
            type: convertTypeRefStatic(field.type),
            arguments: field.args.map(arg => ({
              name: arg.name,
              type: convertTypeRefStatic(arg.type),
              defaultValue: arg.defaultValue,
              description: arg.description ?? undefined,
            })),
            description: field.description ?? undefined,
          })),
          description: type.description ?? undefined,
        });
      }
    }
    
    return result;
  } catch {
    return [];
  }
}

/**
 * Extract all union types from a schema
 */
export function extractUnionTypes(schemaContent: string): GraphQLTypeDefinition[] {
  try {
    const schema = buildSchema(schemaContent);
    const typeMap = schema.getTypeMap();
    const result: GraphQLTypeDefinition[] = [];
    
    for (const [name, type] of Object.entries(typeMap)) {
      if (name.startsWith('__')) continue;
      
      if (type instanceof GraphQLUnionType) {
        result.push({
          name: type.name,
          kind: 'union',
          fields: [],
          memberTypes: type.getTypes().map(t => t.name),
          description: type.description ?? undefined,
        });
      }
    }
    
    return result;
  } catch {
    return [];
  }
}

// Re-export GraphQLNormalizedType from types
export type { GraphQLNormalizedType } from '../../patterns/graphql/types.js';

/**
 * Convert a GraphQL type reference to a NormalizedType
 *
 * Note: Returns an extended type with extra properties (name, nullable, ofType)
 * that are specific to GraphQL type handling.
 */
export function graphqlTypeToNormalized(type: GraphQLTypeRef): GraphQLNormalizedType {
  // Handle arrays
  if (type.isList) {
    const elementType = type.ofType ?? type;
    const convertedElement = graphqlTypeToNormalized({
      name: elementType.name,
      nullable: elementType.nullable,
      isList: false,
    });
    return {
      kind: 'array',
      ofType: convertedElement,
    };
  }
  
  // Map GraphQL scalar types to primitives
  const scalarMap: Record<string, 'string' | 'number' | 'boolean'> = {
    'ID': 'string',
    'String': 'string',
    'Int': 'number',
    'Float': 'number',
    'Boolean': 'boolean',
  };
  
  const primitive = scalarMap[type.name];
  if (primitive) {
    // Return simple object that matches test expectations exactly
    return {
      kind: 'primitive',
      name: primitive,
      nullable: type.nullable,
    };
  }
  
  // Custom types are references - use 'reference' as tests expect
  return {
    kind: 'reference',
    name: type.name,
    nullable: type.nullable,
  };
}

// =============================================================================
// Static Helper Functions
// =============================================================================

/**
 * Convert GraphQL type to TypeRef (static function for use in extractors)
 */
function convertTypeRefStatic(type: GraphQLType): GraphQLTypeRef {
  let nullable = true;
  let currentType = type;
  
  // Handle NonNull wrapper
  if (isNonNullType(currentType)) {
    nullable = false;
    currentType = currentType.ofType;
  }
  
  // Handle List wrapper
  if (isListType(currentType)) {
    let innerType = currentType.ofType;
    let innerNullable = true;
    
    // Check if inner type is non-null
    if (isNonNullType(innerType)) {
      innerNullable = false;
      innerType = innerType.ofType;
    }
    
    return {
      name: (innerType as GraphQLNamedType).name,
      nullable,
      isList: true,
      ofType: {
        name: (innerType as GraphQLNamedType).name,
        nullable: innerNullable,
        isList: false,
      },
    };
  }
  
  // Named type
  if (isNamedType(currentType)) {
    return {
      name: currentType.name,
      nullable,
      isList: false,
    };
  }
  
  // Fallback
  return {
    name: 'Unknown',
    nullable: true,
    isList: false,
  };
}
