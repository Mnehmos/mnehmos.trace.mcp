/**
 * GraphQL Support Tests
 * 
 * Red Phase: Failing tests for GraphQL SDL parsing and Apollo pattern detection.
 * 
 * Tests cover:
 * - SDL Parser: Schema type extraction and conversion
 * - Apollo Server: Resolver detection and argument extraction
 * - Apollo Client: Hook detection and data tracking
 * - Integration: Full schema/resolver/client analysis
 * 
 * @see .context/ADR-P2-4-GRAPHQL-SUPPORT.md
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

// These imports WILL FAIL - modules don't exist yet (Red Phase)
import { 
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
} from '../src/adapters/graphql/sdl-parser';

import {
  ApolloServerPatternMatcher,
  detectResolverObject,
  detectQueryResolvers,
  detectMutationResolvers,
  detectSubscriptionResolvers,
  detectTypeResolvers,
  extractResolverArguments,
  inferResolverReturnType,
} from '../src/patterns/graphql/apollo-server';

import {
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
} from '../src/patterns/graphql/apollo-client';

import type {
  GraphQLSchemaDefinition,
  GraphQLTypeDefinition,
  GraphQLFieldDefinition,
  GraphQLArgumentDefinition,
  ResolverDefinition,
  ResolverField,
  ClientHookUsage,
  PropertyAccessPath,
} from '../src/patterns/graphql/types';

import { NormalizedType } from '../src/core/types';

// =============================================================================
// Test Setup
// =============================================================================

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'graphql-samples');

describe('GraphQL Support', () => {
  let project: Project;
  let schemaContent: string;
  let apolloServerFile: SourceFile;
  let apolloClientFile: SourceFile;
  let queriesFile: SourceFile;

  beforeAll(() => {
    // Load SDL schema file
    const schemaPath = path.join(FIXTURES_DIR, 'schema.graphql');
    schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Create ts-morph project
    project = new Project({
      compilerOptions: {
        target: 99, // ESNext
        module: 99, // ESNext
        strict: true,
      },
    });

    // Load TypeScript fixture files
    apolloServerFile = project.addSourceFileAtPath(
      path.join(FIXTURES_DIR, 'apollo-server.ts')
    );
    apolloClientFile = project.addSourceFileAtPath(
      path.join(FIXTURES_DIR, 'apollo-client.ts')
    );
    queriesFile = project.addSourceFileAtPath(
      path.join(FIXTURES_DIR, 'queries.ts')
    );
  });

  // ===========================================================================
  // SDL Parser Tests
  // ===========================================================================
  
  describe('GraphQL SDL Parser', () => {
    describe('schema parsing', () => {
      it('should parse a simple .graphql schema file', () => {
        const schema = parseGraphQLSchema(schemaContent);
        
        expect(schema).toBeDefined();
        expect(schema.types).toBeDefined();
        expect(Array.isArray(schema.types)).toBe(true);
      });

      it('should handle schema with syntax errors gracefully', () => {
        const invalidSchema = `
          type User {
            id: ID!
            name: String
            # Missing closing brace
        `;
        
        expect(() => parseGraphQLSchema(invalidSchema)).toThrow();
      });

      it('should parse schema with comments', () => {
        const schemaWithComments = `
          """
          User type represents a registered user
          """
          type User {
            # Unique identifier
            id: ID!
            """Full name of the user"""
            name: String!
          }
        `;
        
        const schema = parseGraphQLSchema(schemaWithComments);
        expect(schema.types).toHaveLength(1);
      });
    });

    describe('Query type extraction', () => {
      it('should extract Query type fields', () => {
        const queryType = extractQueryType(schemaContent);
        
        expect(queryType).toBeDefined();
        expect(queryType?.fields).toBeDefined();
        expect(queryType?.fields.length).toBeGreaterThan(0);
      });

      it('should extract field with single required argument', () => {
        const queryType = extractQueryType(schemaContent);
        const userField = queryType?.fields.find(f => f.name === 'user');
        
        expect(userField).toBeDefined();
        expect(userField?.arguments).toHaveLength(1);
        expect(userField?.arguments[0].name).toBe('id');
        expect(userField?.arguments[0].type.nullable).toBe(false);
      });

      it('should extract field with multiple optional arguments', () => {
        const queryType = extractQueryType(schemaContent);
        const usersField = queryType?.fields.find(f => f.name === 'users');
        
        expect(usersField).toBeDefined();
        expect(usersField?.arguments).toContainEqual(
          expect.objectContaining({ name: 'limit', type: expect.objectContaining({ nullable: true }) })
        );
        expect(usersField?.arguments).toContainEqual(
          expect.objectContaining({ name: 'offset', type: expect.objectContaining({ nullable: true }) })
        );
      });

      it('should extract field with default argument values', () => {
        const queryType = extractQueryType(schemaContent);
        const usersField = queryType?.fields.find(f => f.name === 'users');
        
        const limitArg = usersField?.arguments.find(a => a.name === 'limit');
        expect(limitArg?.defaultValue).toBeDefined();
      });

      it('should extract field return types correctly', () => {
        const queryType = extractQueryType(schemaContent);
        
        const userField = queryType?.fields.find(f => f.name === 'user');
        expect(userField?.type.name).toBe('User');
        expect(userField?.type.nullable).toBe(true);
        
        const usersField = queryType?.fields.find(f => f.name === 'users');
        expect(usersField?.type.isList).toBe(true);
        expect(usersField?.type.ofType?.name).toBe('User');
      });
    });

    describe('Mutation type extraction', () => {
      it('should extract Mutation type fields', () => {
        const mutationType = extractMutationType(schemaContent);
        
        expect(mutationType).toBeDefined();
        expect(mutationType?.fields).toBeDefined();
        expect(mutationType?.fields.length).toBeGreaterThan(0);
      });

      it('should extract mutation with input type argument', () => {
        const mutationType = extractMutationType(schemaContent);
        const createUserMutation = mutationType?.fields.find(f => f.name === 'createUser');
        
        expect(createUserMutation).toBeDefined();
        expect(createUserMutation?.arguments).toHaveLength(1);
        expect(createUserMutation?.arguments[0].name).toBe('input');
        expect(createUserMutation?.arguments[0].type.name).toBe('CreateUserInput');
      });

      it('should extract mutation with multiple arguments', () => {
        const mutationType = extractMutationType(schemaContent);
        const updateUserMutation = mutationType?.fields.find(f => f.name === 'updateUser');
        
        expect(updateUserMutation).toBeDefined();
        expect(updateUserMutation?.arguments.length).toBeGreaterThan(1);
      });

      it('should extract mutation returning boolean', () => {
        const mutationType = extractMutationType(schemaContent);
        const deleteMutation = mutationType?.fields.find(f => f.name === 'deleteUser');
        
        expect(deleteMutation).toBeDefined();
        expect(deleteMutation?.type.name).toBe('Boolean');
      });
    });

    describe('Subscription type extraction', () => {
      it('should extract Subscription type fields', () => {
        const subscriptionType = extractSubscriptionType(schemaContent);
        
        expect(subscriptionType).toBeDefined();
        expect(subscriptionType?.fields).toBeDefined();
      });

      it('should extract subscription without arguments', () => {
        const subscriptionType = extractSubscriptionType(schemaContent);
        const userCreated = subscriptionType?.fields.find(f => f.name === 'userCreated');
        
        expect(userCreated).toBeDefined();
        expect(userCreated?.arguments).toHaveLength(0);
      });

      it('should extract subscription with optional arguments', () => {
        const subscriptionType = extractSubscriptionType(schemaContent);
        const postAdded = subscriptionType?.fields.find(f => f.name === 'postAdded');
        
        expect(postAdded).toBeDefined();
        expect(postAdded?.arguments.some(a => a.name === 'authorId')).toBe(true);
      });
    });

    describe('Object type extraction', () => {
      it('should extract all object types from schema', () => {
        const objectTypes = extractObjectTypes(schemaContent);
        
        expect(objectTypes).toBeDefined();
        expect(objectTypes.length).toBeGreaterThan(0);
        expect(objectTypes.some(t => t.name === 'User')).toBe(true);
        expect(objectTypes.some(t => t.name === 'Post')).toBe(true);
      });

      it('should extract object type fields correctly', () => {
        const objectTypes = extractObjectTypes(schemaContent);
        const userType = objectTypes.find(t => t.name === 'User');
        
        expect(userType).toBeDefined();
        expect(userType?.fields.some(f => f.name === 'id')).toBe(true);
        expect(userType?.fields.some(f => f.name === 'name')).toBe(true);
        expect(userType?.fields.some(f => f.name === 'email')).toBe(true);
      });

      it('should handle nullable and non-null fields', () => {
        const objectTypes = extractObjectTypes(schemaContent);
        const userType = objectTypes.find(t => t.name === 'User');
        
        const idField = userType?.fields.find(f => f.name === 'id');
        expect(idField?.type.nullable).toBe(false); // ID!
        
        const avatarField = userType?.fields.find(f => f.name === 'avatar');
        expect(avatarField?.type.nullable).toBe(true); // String (nullable)
      });

      it('should handle list types', () => {
        const objectTypes = extractObjectTypes(schemaContent);
        const userType = objectTypes.find(t => t.name === 'User');
        
        const postsField = userType?.fields.find(f => f.name === 'posts');
        expect(postsField?.type.isList).toBe(true);
        expect(postsField?.type.ofType?.name).toBe('Post');
      });

      it('should handle nested non-null list types', () => {
        const objectTypes = extractObjectTypes(schemaContent);
        const postType = objectTypes.find(t => t.name === 'Post');
        
        const tagsField = postType?.fields.find(f => f.name === 'tags');
        expect(tagsField?.type.isList).toBe(true);
        expect(tagsField?.type.nullable).toBe(false); // [String!]!
      });

      it('should extract field arguments on object types', () => {
        const objectTypes = extractObjectTypes(schemaContent);
        const postType = objectTypes.find(t => t.name === 'Post');
        
        const commentsField = postType?.fields.find(f => f.name === 'comments');
        expect(commentsField?.arguments).toBeDefined();
        expect(commentsField?.arguments.some(a => a.name === 'limit')).toBe(true);
      });
    });

    describe('Input type extraction', () => {
      it('should extract all input types from schema', () => {
        const inputTypes = extractInputTypes(schemaContent);
        
        expect(inputTypes).toBeDefined();
        expect(inputTypes.length).toBeGreaterThan(0);
        expect(inputTypes.some(t => t.name === 'CreateUserInput')).toBe(true);
      });

      it('should extract input type fields correctly', () => {
        const inputTypes = extractInputTypes(schemaContent);
        const createUserInput = inputTypes.find(t => t.name === 'CreateUserInput');
        
        expect(createUserInput).toBeDefined();
        expect(createUserInput?.fields.some(f => f.name === 'name')).toBe(true);
        expect(createUserInput?.fields.some(f => f.name === 'email')).toBe(true);
        expect(createUserInput?.fields.some(f => f.name === 'password')).toBe(true);
      });

      it('should handle optional input fields', () => {
        const inputTypes = extractInputTypes(schemaContent);
        const updateUserInput = inputTypes.find(t => t.name === 'UpdateUserInput');
        
        expect(updateUserInput).toBeDefined();
        const nameField = updateUserInput?.fields.find(f => f.name === 'name');
        expect(nameField?.type.nullable).toBe(true);
      });
    });

    describe('Enum type extraction', () => {
      it('should extract all enum types from schema', () => {
        const enumTypes = extractEnumTypes(schemaContent);
        
        expect(enumTypes).toBeDefined();
        expect(enumTypes.length).toBeGreaterThan(0);
        expect(enumTypes.some(t => t.name === 'UserStatus')).toBe(true);
      });

      it('should extract enum values correctly', () => {
        const enumTypes = extractEnumTypes(schemaContent);
        const userStatusEnum = enumTypes.find(t => t.name === 'UserStatus');
        
        expect(userStatusEnum).toBeDefined();
        expect(userStatusEnum?.values).toContain('ACTIVE');
        expect(userStatusEnum?.values).toContain('INACTIVE');
        expect(userStatusEnum?.values).toContain('PENDING');
      });
    });

    describe('Interface type extraction', () => {
      it('should extract interface types from schema', () => {
        const interfaceTypes = extractInterfaceTypes(schemaContent);
        
        expect(interfaceTypes).toBeDefined();
        expect(interfaceTypes.some(t => t.name === 'Node')).toBe(true);
      });

      it('should extract interface fields correctly', () => {
        const interfaceTypes = extractInterfaceTypes(schemaContent);
        const nodeInterface = interfaceTypes.find(t => t.name === 'Node');
        
        expect(nodeInterface).toBeDefined();
        expect(nodeInterface?.fields.some(f => f.name === 'id')).toBe(true);
      });
    });

    describe('Union type extraction', () => {
      it('should extract union types from schema', () => {
        const unionTypes = extractUnionTypes(schemaContent);
        
        expect(unionTypes).toBeDefined();
        expect(unionTypes.some(t => t.name === 'SearchResult')).toBe(true);
      });

      it('should extract union member types', () => {
        const unionTypes = extractUnionTypes(schemaContent);
        const searchResult = unionTypes.find(t => t.name === 'SearchResult');
        
        expect(searchResult).toBeDefined();
        expect(searchResult?.memberTypes).toContain('User');
        expect(searchResult?.memberTypes).toContain('Post');
        expect(searchResult?.memberTypes).toContain('Comment');
      });
    });

    describe('Type conversion to NormalizedType', () => {
      it('should convert simple scalar type to NormalizedType', () => {
        const normalized = graphqlTypeToNormalized({
          name: 'String',
          nullable: true,
          isList: false,
        });
        
        expect(normalized).toEqual({
          kind: 'primitive',
          name: 'string',
          nullable: true,
        });
      });

      it('should convert ID type to string', () => {
        const normalized = graphqlTypeToNormalized({
          name: 'ID',
          nullable: false,
          isList: false,
        });
        
        expect(normalized.name).toBe('string');
      });

      it('should convert Int type to number', () => {
        const normalized = graphqlTypeToNormalized({
          name: 'Int',
          nullable: true,
          isList: false,
        });
        
        expect(normalized.name).toBe('number');
      });

      it('should convert Float type to number', () => {
        const normalized = graphqlTypeToNormalized({
          name: 'Float',
          nullable: true,
          isList: false,
        });
        
        expect(normalized.name).toBe('number');
      });

      it('should convert Boolean type to boolean', () => {
        const normalized = graphqlTypeToNormalized({
          name: 'Boolean',
          nullable: true,
          isList: false,
        });
        
        expect(normalized.name).toBe('boolean');
      });

      it('should convert list type correctly', () => {
        const normalized = graphqlTypeToNormalized({
          name: 'String',
          nullable: false,
          isList: true,
          ofType: { name: 'String', nullable: false, isList: false },
        });
        
        expect(normalized.kind).toBe('array');
        expect(normalized.ofType?.name).toBe('string');
      });

      it('should convert custom object type to reference', () => {
        const normalized = graphqlTypeToNormalized({
          name: 'User',
          nullable: true,
          isList: false,
        });
        
        expect(normalized.kind).toBe('reference');
        expect(normalized.name).toBe('User');
      });
    });
  });

  // ===========================================================================
  // Apollo Server Pattern Tests
  // ===========================================================================

  describe('ApolloServerPatternMatcher', () => {
    let matcher: ApolloServerPatternMatcher;

    beforeEach(() => {
      matcher = new ApolloServerPatternMatcher();
    });

    describe('resolver object detection', () => {
      it('should detect resolver object literal', () => {
        const resolvers = detectResolverObject(apolloServerFile);
        
        expect(resolvers).toBeDefined();
        expect(resolvers.length).toBeGreaterThan(0);
      });

      it('should detect resolver object with Query property', () => {
        const resolvers = detectResolverObject(apolloServerFile);
        const mainResolver = resolvers.find(r => r.hasQuery);
        
        expect(mainResolver).toBeDefined();
      });

      it('should detect resolver object with Mutation property', () => {
        const resolvers = detectResolverObject(apolloServerFile);
        const mainResolver = resolvers.find(r => r.hasMutation);
        
        expect(mainResolver).toBeDefined();
      });

      it('should detect resolver object with Subscription property', () => {
        const resolvers = detectResolverObject(apolloServerFile);
        const mainResolver = resolvers.find(r => r.hasSubscription);
        
        expect(mainResolver).toBeDefined();
      });

      it('should detect resolver object with type resolvers', () => {
        const resolvers = detectResolverObject(apolloServerFile);
        const mainResolver = resolvers.find(r => r.typeResolvers.length > 0);
        
        expect(mainResolver).toBeDefined();
        expect(mainResolver?.typeResolvers.some(t => t.typeName === 'User')).toBe(true);
      });
    });

    describe('Query resolver detection', () => {
      it('should detect all Query resolver methods', () => {
        const queryResolvers = detectQueryResolvers(apolloServerFile);
        
        expect(queryResolvers).toBeDefined();
        expect(queryResolvers.length).toBeGreaterThan(0);
      });

      it('should extract resolver name correctly', () => {
        const queryResolvers = detectQueryResolvers(apolloServerFile);
        
        expect(queryResolvers.some(r => r.name === 'user')).toBe(true);
        expect(queryResolvers.some(r => r.name === 'users')).toBe(true);
      });

      it('should detect resolver with single argument destructuring', () => {
        const queryResolvers = detectQueryResolvers(apolloServerFile);
        const userResolver = queryResolvers.find(r => r.name === 'user');
        
        expect(userResolver).toBeDefined();
        expect(userResolver?.arguments).toHaveLength(1);
        expect(userResolver?.arguments[0].name).toBe('id');
      });

      it('should detect resolver with multiple arguments', () => {
        const queryResolvers = detectQueryResolvers(apolloServerFile);
        const usersResolver = queryResolvers.find(r => r.name === 'users');
        
        expect(usersResolver).toBeDefined();
        expect(usersResolver?.arguments.some(a => a.name === 'limit')).toBe(true);
        expect(usersResolver?.arguments.some(a => a.name === 'offset')).toBe(true);
      });

      it('should detect resolver accessing context', () => {
        const queryResolvers = detectQueryResolvers(apolloServerFile);
        const viewerResolver = queryResolvers.find(r => r.name === 'viewer');
        
        expect(viewerResolver).toBeDefined();
        expect(viewerResolver?.usesContext).toBe(true);
      });
    });

    describe('Mutation resolver detection', () => {
      it('should detect all Mutation resolver methods', () => {
        const mutationResolvers = detectMutationResolvers(apolloServerFile);
        
        expect(mutationResolvers).toBeDefined();
        expect(mutationResolvers.length).toBeGreaterThan(0);
      });

      it('should detect mutation with input type argument', () => {
        const mutationResolvers = detectMutationResolvers(apolloServerFile);
        const createUser = mutationResolvers.find(r => r.name === 'createUser');
        
        expect(createUser).toBeDefined();
        expect(createUser?.arguments.some(a => a.name === 'input')).toBe(true);
      });

      it('should detect mutation with ID and input arguments', () => {
        const mutationResolvers = detectMutationResolvers(apolloServerFile);
        const updateUser = mutationResolvers.find(r => r.name === 'updateUser');
        
        expect(updateUser).toBeDefined();
        expect(updateUser?.arguments.some(a => a.name === 'id')).toBe(true);
        expect(updateUser?.arguments.some(a => a.name === 'input')).toBe(true);
      });

      it('should detect mutation with context usage for auth', () => {
        const mutationResolvers = detectMutationResolvers(apolloServerFile);
        const createPost = mutationResolvers.find(r => r.name === 'createPost');
        
        expect(createPost).toBeDefined();
        expect(createPost?.usesContext).toBe(true);
      });
    });

    describe('Subscription resolver detection', () => {
      it('should detect Subscription resolver objects', () => {
        const subscriptionResolvers = detectSubscriptionResolvers(apolloServerFile);
        
        expect(subscriptionResolvers).toBeDefined();
        expect(subscriptionResolvers.length).toBeGreaterThan(0);
      });

      it('should detect subscription with subscribe method', () => {
        const subscriptionResolvers = detectSubscriptionResolvers(apolloServerFile);
        const userCreated = subscriptionResolvers.find(r => r.name === 'userCreated');
        
        expect(userCreated).toBeDefined();
        expect(userCreated?.hasSubscribe).toBe(true);
      });

      it('should detect subscription with argument in subscribe', () => {
        const subscriptionResolvers = detectSubscriptionResolvers(apolloServerFile);
        const postAdded = subscriptionResolvers.find(r => r.name === 'postAdded');
        
        expect(postAdded).toBeDefined();
        expect(postAdded?.arguments.some(a => a.name === 'authorId')).toBe(true);
      });
    });

    describe('Type resolver detection', () => {
      it('should detect nested field resolvers on User type', () => {
        const typeResolvers = detectTypeResolvers(apolloServerFile);
        const userResolver = typeResolvers.find(r => r.typeName === 'User');
        
        expect(userResolver).toBeDefined();
        expect(userResolver?.fields.some(f => f.name === 'posts')).toBe(true);
      });

      it('should detect nested field resolvers on Post type', () => {
        const typeResolvers = detectTypeResolvers(apolloServerFile);
        const postResolver = typeResolvers.find(r => r.typeName === 'Post');
        
        expect(postResolver).toBeDefined();
        expect(postResolver?.fields.some(f => f.name === 'author')).toBe(true);
        expect(postResolver?.fields.some(f => f.name === 'comments')).toBe(true);
      });

      it('should detect __resolveType for union types', () => {
        const typeResolvers = detectTypeResolvers(apolloServerFile);
        const searchResultResolver = typeResolvers.find(r => r.typeName === 'SearchResult');
        
        expect(searchResultResolver).toBeDefined();
        expect(searchResultResolver?.hasResolveType).toBe(true);
      });

      it('should extract arguments from nested field resolvers', () => {
        const typeResolvers = detectTypeResolvers(apolloServerFile);
        const postResolver = typeResolvers.find(r => r.typeName === 'Post');
        const commentsField = postResolver?.fields.find(f => f.name === 'comments');
        
        expect(commentsField).toBeDefined();
        expect(commentsField?.arguments.some(a => a.name === 'limit')).toBe(true);
      });
    });

    describe('Resolver argument extraction', () => {
      it('should extract argument types from destructuring', () => {
        const args = extractResolverArguments(apolloServerFile, 'user');
        
        expect(args).toBeDefined();
        expect(args.some(a => a.name === 'id' && a.type === 'string')).toBe(true);
      });

      it('should extract optional argument markers', () => {
        const args = extractResolverArguments(apolloServerFile, 'users');
        
        const limitArg = args.find(a => a.name === 'limit');
        expect(limitArg).toBeDefined();
        expect(limitArg?.optional).toBe(true);
      });

      it('should extract typed argument objects', () => {
        const args = extractResolverArguments(apolloServerFile, 'createUser');
        
        const inputArg = args.find(a => a.name === 'input');
        expect(inputArg).toBeDefined();
        expect(inputArg?.type).toBe('CreateUserInput');
      });
    });

    describe('Resolver return type inference', () => {
      it('should infer return type from function body', () => {
        const returnType = inferResolverReturnType(apolloServerFile, 'user');
        
        expect(returnType).toBeDefined();
      });

      it('should detect async resolver', () => {
        const returnType = inferResolverReturnType(apolloServerFile, 'createUser');
        
        expect(returnType.isAsync).toBe(true);
      });

      it('should detect nullable return (User | null)', () => {
        const returnType = inferResolverReturnType(apolloServerFile, 'user');
        
        expect(returnType.nullable).toBe(true);
      });

      it('should detect array return type', () => {
        const returnType = inferResolverReturnType(apolloServerFile, 'users');
        
        expect(returnType.isArray).toBe(true);
      });
    });

    describe('Modular resolver patterns', () => {
      it('should detect resolvers defined via spread operator', () => {
        const resolvers = detectResolverObject(apolloServerFile);
        const mergedResolver = resolvers.find(r => 
          r.variableName === 'mergedResolvers'
        );
        
        expect(mergedResolver).toBeDefined();
      });

      it('should detect standalone resolver function references', () => {
        const resolvers = detectResolverObject(apolloServerFile);
        const functionRefResolver = resolvers.find(r => 
          r.variableName === 'functionRefResolvers'
        );
        
        expect(functionRefResolver).toBeDefined();
      });
    });
  });

  // ===========================================================================
  // Apollo Client Pattern Tests
  // ===========================================================================

  describe('ApolloClientPatternMatcher', () => {
    let matcher: ApolloClientPatternMatcher;

    beforeEach(() => {
      matcher = new ApolloClientPatternMatcher();
    });

    describe('useQuery hook detection', () => {
      it('should detect all useQuery hook calls', () => {
        const hooks = detectUseQueryHook(apolloClientFile);
        
        expect(hooks).toBeDefined();
        expect(hooks.length).toBeGreaterThan(0);
      });

      it('should extract query constant reference', () => {
        const hooks = detectUseQueryHook(apolloClientFile);
        const userProfileHook = hooks.find(h => h.queryName === 'GET_USER');
        
        expect(userProfileHook).toBeDefined();
      });

      it('should extract variables from options', () => {
        const hooks = detectUseQueryHook(apolloClientFile);
        const userProfileHook = hooks.find(h => h.queryName === 'GET_USER');
        
        expect(userProfileHook?.variables).toBeDefined();
        expect(userProfileHook?.variables.some(v => v.name === 'id')).toBe(true);
      });

      it('should detect skip option usage', () => {
        const hooks = detectUseQueryHook(apolloClientFile);
        const conditionalHook = hooks.find(h => h.hasSkipOption);
        
        expect(conditionalHook).toBeDefined();
      });

      it('should detect polling option usage', () => {
        const hooks = detectUseQueryHook(apolloClientFile);
        const pollingHook = hooks.find(h => h.hasPollInterval);
        
        expect(pollingHook).toBeDefined();
      });

      it('should extract type parameter if specified', () => {
        const hooks = detectUseQueryHook(apolloClientFile);
        const typedHook = hooks.find(h => h.typeParameter !== undefined);
        
        expect(typedHook).toBeDefined();
        expect(typedHook?.typeParameter).toContain('GetUserQuery');
      });
    });

    describe('useMutation hook detection', () => {
      it('should detect all useMutation hook calls', () => {
        const hooks = detectUseMutationHook(apolloClientFile);
        
        expect(hooks).toBeDefined();
        expect(hooks.length).toBeGreaterThan(0);
      });

      it('should extract mutation constant reference', () => {
        const hooks = detectUseMutationHook(apolloClientFile);
        const createUserHook = hooks.find(h => h.queryName === 'CREATE_USER');
        
        expect(createUserHook).toBeDefined();
      });

      it('should detect onCompleted callback option', () => {
        const hooks = detectUseMutationHook(apolloClientFile);
        const hookWithCallback = hooks.find(h => h.hasOnCompleted);
        
        expect(hookWithCallback).toBeDefined();
      });

      it('should extract destructured mutation function', () => {
        const hooks = detectUseMutationHook(apolloClientFile);
        const createUserHook = hooks.find(h => h.queryName === 'CREATE_USER');
        
        expect(createUserHook?.mutationFunctionName).toBeDefined();
      });
    });

    describe('useLazyQuery hook detection', () => {
      it('should detect all useLazyQuery hook calls', () => {
        const hooks = detectUseLazyQueryHook(apolloClientFile);
        
        expect(hooks).toBeDefined();
        expect(hooks.length).toBeGreaterThan(0);
      });

      it('should extract lazy query function name', () => {
        const hooks = detectUseLazyQueryHook(apolloClientFile);
        const userSearchHook = hooks.find(h => h.functionName === 'getUser');
        
        expect(userSearchHook).toBeDefined();
      });

      it('should detect called state destructuring', () => {
        const hooks = detectUseLazyQueryHook(apolloClientFile);
        const hookWithCalled = hooks.find(h => h.checksCalled);
        
        expect(hookWithCalled).toBeDefined();
      });
    });

    describe('useSubscription hook detection', () => {
      it('should detect all useSubscription hook calls', () => {
        const hooks = detectUseSubscriptionHook(apolloClientFile);
        
        expect(hooks).toBeDefined();
        expect(hooks.length).toBeGreaterThan(0);
      });

      it('should extract subscription constant reference', () => {
        const hooks = detectUseSubscriptionHook(apolloClientFile);
        const userCreatedHook = hooks.find(h => h.queryName === 'USER_CREATED');
        
        expect(userCreatedHook).toBeDefined();
      });

      it('should extract variables from subscription options', () => {
        const hooks = detectUseSubscriptionHook(apolloClientFile);
        const postAddedHook = hooks.find(h => h.queryName === 'POST_ADDED');
        
        expect(postAddedHook?.variables).toBeDefined();
      });
    });

    describe('Query extraction from gql', () => {
      it('should extract query from gql tagged template', () => {
        const query = extractQueryFromGql(queriesFile, 'GET_USER');
        
        expect(query).toBeDefined();
        expect(query?.operationType).toBe('query');
        expect(query?.operationName).toBe('GetUser');
      });

      it('should extract mutation from gql tagged template', () => {
        const mutation = extractQueryFromGql(queriesFile, 'CREATE_USER');
        
        expect(mutation).toBeDefined();
        expect(mutation?.operationType).toBe('mutation');
        expect(mutation?.operationName).toBe('CreateUser');
      });

      it('should extract subscription from gql tagged template', () => {
        const subscription = extractQueryFromGql(queriesFile, 'USER_CREATED_SUBSCRIPTION');
        
        expect(subscription).toBeDefined();
        expect(subscription?.operationType).toBe('subscription');
      });

      it('should extract inline gql query from hook call', () => {
        const inlineQueries = extractQueryFromGql(apolloClientFile);
        
        expect(inlineQueries.length).toBeGreaterThan(0);
        expect(inlineQueries.some(q => q.operationName === 'InlineQuery')).toBe(true);
      });
    });

    describe('Query constant resolution', () => {
      it('should resolve query from constant reference', () => {
        const query = extractQueryFromConstant(apolloClientFile, 'GET_USER');
        
        expect(query).toBeDefined();
      });

      it('should resolve imported query constant', () => {
        // When query is imported from another file
        const query = extractQueryFromConstant(apolloClientFile, 'GET_USER_WITH_POSTS');
        
        expect(query).toBeDefined();
      });
    });

    describe('Variables extraction', () => {
      it('should extract inline variable object', () => {
        const variables = extractVariablesOption(apolloClientFile, 'UserProfile');
        
        expect(variables).toBeDefined();
        expect(variables.some(v => v.name === 'id')).toBe(true);
      });

      it('should extract spread variable object', () => {
        // When variables use spread: { ...someVars }
        const variables = extractVariablesOption(apolloClientFile);
        
        expect(variables.some(v => v.isSpread)).toBe(true);
      });

      it('should extract variable types from hook type parameter', () => {
        const variables = extractVariablesOption(apolloClientFile, 'UserProfile');
        
        const idVar = variables.find(v => v.name === 'id');
        expect(idVar?.type).toBe('string');
      });
    });

    describe('Data property access tracking', () => {
      it('should track direct data property access', () => {
        const accesses = trackDataPropertyAccess(apolloClientFile, 'UserProfile');
        
        expect(accesses).toBeDefined();
        expect(accesses.some(a => a.path.includes('user'))).toBe(true);
      });

      it('should track nested data property access', () => {
        const accesses = trackDataPropertyAccess(apolloClientFile, 'UserWithPosts');
        
        expect(accesses.some(a => a.path.includes('user.posts'))).toBe(true);
      });

      it('should track optional chaining access', () => {
        const accesses = trackDataPropertyAccess(apolloClientFile, 'UserProfile');
        
        expect(accesses.some(a => a.hasOptionalChaining)).toBe(true);
      });

      it('should track array access patterns', () => {
        const accesses = trackDataPropertyAccess(apolloClientFile, 'UserWithPosts');
        
        expect(accesses.some(a => a.hasArrayAccess)).toBe(true);
      });
    });

    describe('Destructured data tracking', () => {
      it('should track destructured data variable', () => {
        const destructured = trackDestructuredData(apolloClientFile, 'UsersList');
        
        expect(destructured).toBeDefined();
        expect(destructured.some(d => d.name === 'users')).toBe(true);
      });

      it('should track nested destructuring', () => {
        const destructured = trackDestructuredData(apolloClientFile);
        
        // Find components with nested destructuring
        expect(destructured.some(d => d.depth > 1)).toBe(true);
      });

      it('should track aliased destructuring', () => {
        // const { data: { users: userList } } = useQuery(...)
        const destructured = trackDestructuredData(apolloClientFile);
        
        expect(destructured.some(d => d.alias !== undefined)).toBe(true);
      });

      it('should track default value in destructuring', () => {
        // const { data: { users } = { users: [] } } = useQuery(...)
        const destructured = trackDestructuredData(apolloClientFile, 'UsersList');
        
        expect(destructured.some(d => d.hasDefaultValue)).toBe(true);
      });
    });

    describe('Mismatch detection', () => {
      it('should detect access to non-existent field', () => {
        // Component accessing 'avatarUrl' when query selects 'avatar'
        const accesses = trackDataPropertyAccess(apolloClientFile, 'MismatchComponent');
        
        expect(accesses).toBeDefined();
        expect(accesses.some(a => a.path.includes('avatarUrl'))).toBe(true);
      });

      it('should detect access to unselected nested field', () => {
        // Component accessing 'author.name' when author is not in selection
        const accesses = trackDataPropertyAccess(apolloClientFile, 'DeepMismatchComponent');
        
        expect(accesses.some(a => a.path.includes('author'))).toBe(true);
      });
    });
  });

  // ===========================================================================
  // Integration Tests
  // ===========================================================================

  describe('Integration', () => {
    describe('Full schema extraction', () => {
      it('should extract complete schema definition from SDL file', () => {
        const parser = new SDLParser();
        const schema = parser.parse(schemaContent);
        
        expect(schema.queries.length).toBeGreaterThan(0);
        expect(schema.mutations.length).toBeGreaterThan(0);
        expect(schema.subscriptions.length).toBeGreaterThan(0);
        expect(schema.types.length).toBeGreaterThan(0);
        expect(schema.inputs.length).toBeGreaterThan(0);
        expect(schema.enums.length).toBeGreaterThan(0);
      });

      it('should produce NormalizedType for each schema field', () => {
        const parser = new SDLParser();
        const schema = parser.parse(schemaContent);
        
        for (const query of schema.queries) {
          expect(query.returnType).toBeDefined();
          expect(query.returnType.kind).toBeDefined();
        }
      });
    });

    describe('Full resolver analysis', () => {
      it('should match resolvers to schema queries', () => {
        const serverMatcher = new ApolloServerPatternMatcher();
        const resolverDefs = serverMatcher.analyze(apolloServerFile);
        
        // Each resolver should have corresponding schema field
        for (const resolver of resolverDefs.queryResolvers) {
          expect(resolver.schemaFieldName).toBeDefined();
        }
      });

      it('should detect argument mismatches between resolver and schema', () => {
        const serverMatcher = new ApolloServerPatternMatcher();
        const resolverDefs = serverMatcher.analyze(apolloServerFile);
        
        // Look for mismatches in argument definitions
        const mismatches = resolverDefs.queryResolvers.filter(r => 
          r.argumentMismatches && r.argumentMismatches.length > 0
        );
        
        // Could be 0 if all match, but structure should support this
        expect(resolverDefs.queryResolvers[0]).toHaveProperty('argumentMismatches');
      });
    });

    describe('Client hook to schema matching', () => {
      it('should match useQuery hook to schema query', () => {
        const clientMatcher = new ApolloClientPatternMatcher();
        const hookUsages = clientMatcher.analyze(apolloClientFile);
        
        for (const usage of hookUsages) {
          expect(usage.schemaQueryName).toBeDefined();
        }
      });

      it('should detect property access mismatches', () => {
        const clientMatcher = new ApolloClientPatternMatcher();
        const hookUsages = clientMatcher.analyze(apolloClientFile);
        
        // Find hooks with mismatched accesses
        const mismatchedHooks = hookUsages.filter(h => 
          h.propertyAccessMismatches && h.propertyAccessMismatches.length > 0
        );
        
        expect(mismatchedHooks.length).toBeGreaterThan(0);
      });

      it('should validate variable types against schema', () => {
        const clientMatcher = new ApolloClientPatternMatcher();
        const hookUsages = clientMatcher.analyze(apolloClientFile);
        
        for (const usage of hookUsages) {
          for (const variable of usage.variables) {
            expect(variable.matchesSchema).toBeDefined();
          }
        }
      });
    });

    describe('End-to-end contract validation', () => {
      it('should validate schema -> resolver -> client contract', () => {
        const parser = new SDLParser();
        const schema = parser.parse(schemaContent);
        
        const serverMatcher = new ApolloServerPatternMatcher();
        const resolvers = serverMatcher.analyze(apolloServerFile);
        
        const clientMatcher = new ApolloClientPatternMatcher();
        const hooks = clientMatcher.analyze(apolloClientFile);
        
        // Every hook query should have a corresponding schema query
        for (const hook of hooks) {
          const schemaQuery = schema.queries.find(q => 
            q.name === hook.schemaQueryName
          );
          expect(schemaQuery).toBeDefined();
        }
        
        // Every schema query should have a corresponding resolver
        for (const query of schema.queries) {
          const resolver = resolvers.queryResolvers.find(r => 
            r.name === query.name
          );
          expect(resolver).toBeDefined();
        }
      });
    });
  });
});
