/**
 * Apollo Server Resolver Fixture
 * 
 * Contains various Apollo Server resolver patterns for testing detection.
 * @see .context/ADR-P2-4-GRAPHQL-SUPPORT.md
 */

// Type definitions for testing
interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';
  createdAt: Date;
  updatedAt?: Date;
}

interface Post {
  id: string;
  title: string;
  content?: string;
  authorId: string;
  published: boolean;
  tags: string[];
  createdAt: Date;
  publishedAt?: Date;
}

interface Comment {
  id: string;
  body: string;
  authorId: string;
  postId: string;
  createdAt: Date;
}

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}

interface UpdateUserInput {
  name?: string;
  email?: string;
  avatar?: string;
  status?: User['status'];
}

interface CreatePostInput {
  title: string;
  content?: string;
  published?: boolean;
  tags?: string[];
}

interface UpdatePostInput {
  title?: string;
  content?: string;
  published?: boolean;
  tags?: string[];
}

// Mock database functions
declare function getUserById(id: string): Promise<User | null>;
declare function getUsers(limit?: number, offset?: number): Promise<User[]>;
declare function getPosts(authorId?: string): Promise<Post[]>;
declare function getPostById(id: string): Promise<Post | null>;
declare function getPostsByAuthor(authorId: string): Promise<Post[]>;
declare function getCommentsByPost(postId: string, limit?: number): Promise<Comment[]>;
declare function createUser(input: CreateUserInput): Promise<User>;
declare function updateUser(id: string, input: UpdateUserInput): Promise<User | null>;
declare function deleteUser(id: string): Promise<boolean>;
declare function createPost(authorId: string, input: CreatePostInput): Promise<Post>;
declare function updatePost(id: string, input: UpdatePostInput): Promise<Post | null>;
declare function deletePost(id: string): Promise<boolean>;
declare function searchContent(query: string, type?: string): Promise<(User | Post | Comment)[]>;

// Mock PubSub
const pubsub = {
  asyncIterator: (event: string) => ({ event }),
  publish: (event: string, payload: unknown) => { console.log(event, payload); },
};

// =============================================================================
// Pattern 1: Standard Object Literal Resolvers
// =============================================================================

/**
 * Standard resolver map with Query, Mutation, and Subscription
 */
const resolvers = {
  Query: {
    // Simple resolver with single argument
    user: (_parent: unknown, { id }: { id: string }) => getUserById(id),
    
    // Resolver with multiple optional arguments
    users: (_parent: unknown, { limit, offset }: { limit?: number; offset?: number }) => 
      getUsers(limit, offset),
    
    // Resolver with optional argument
    posts: (_parent: unknown, { authorId }: { authorId?: string }) => 
      getPosts(authorId),
    
    // Resolver with type argument
    search: (_parent: unknown, { query, type }: { query: string; type?: string }) =>
      searchContent(query, type),
    
    // Resolver accessing context
    viewer: (_parent: unknown, _args: unknown, context: { userId?: string }) => 
      context.userId ? getUserById(context.userId) : null,
  },
  
  Mutation: {
    // Mutation with input type
    createUser: (_parent: unknown, { input }: { input: CreateUserInput }) => 
      createUser(input),
    
    // Mutation with ID and input
    updateUser: (_parent: unknown, { id, input }: { id: string; input: UpdateUserInput }) =>
      updateUser(id, input),
    
    // Mutation returning boolean
    deleteUser: (_parent: unknown, { id }: { id: string }) => 
      deleteUser(id),
    
    // Mutation with context for authentication
    createPost: (
      _parent: unknown, 
      { input }: { input: CreatePostInput }, 
      context: { userId: string }
    ) => createPost(context.userId, input),
    
    // Mutation with multiple arguments
    updatePost: (_parent: unknown, { id, input }: { id: string; input: UpdatePostInput }) =>
      updatePost(id, input),
    
    // Simple mutation
    deletePost: (_parent: unknown, { id }: { id: string }) =>
      deletePost(id),
  },
  
  Subscription: {
    // Simple subscription
    userCreated: {
      subscribe: () => pubsub.asyncIterator('USER_CREATED'),
    },
    
    // Subscription with argument filter
    postAdded: {
      subscribe: (_parent: unknown, { authorId }: { authorId?: string }) => 
        pubsub.asyncIterator(authorId ? `POST_ADDED_${authorId}` : 'POST_ADDED'),
    },
    
    // Subscription with required argument
    userUpdated: {
      subscribe: (_parent: unknown, { id }: { id: string }) =>
        pubsub.asyncIterator(`USER_UPDATED_${id}`),
    },
  },
  
  // Type resolvers (nested field resolvers)
  User: {
    // Resolver for user's posts
    posts: (user: User) => getPostsByAuthor(user.id),
    
    // Resolver for user's settings (returns mock)
    settings: (_user: User) => ({
      emailNotifications: true,
      theme: 'LIGHT',
      language: 'en',
    }),
  },
  
  Post: {
    // Resolver for post's author
    author: (post: Post) => getUserById(post.authorId),
    
    // Resolver with argument
    comments: (post: Post, { limit }: { limit?: number }) => 
      getCommentsByPost(post.id, limit),
  },
  
  Comment: {
    // Resolver for comment's author
    author: (comment: Comment) => getUserById(comment.authorId),
    
    // Resolver for comment's post
    post: (comment: Comment) => getPostById(comment.postId),
  },
  
  // Union type resolver
  SearchResult: {
    __resolveType: (obj: User | Post | Comment) => {
      if ('email' in obj) return 'User';
      if ('title' in obj) return 'Post';
      return 'Comment';
    },
  },
};

// =============================================================================
// Pattern 2: Async Resolvers
// =============================================================================

/**
 * Resolvers using async/await syntax
 */
const asyncResolvers = {
  Query: {
    user: async (_: unknown, { id }: { id: string }): Promise<User | null> => {
      const user = await getUserById(id);
      return user;
    },
    
    users: async (_: unknown, args: { limit?: number; offset?: number }): Promise<User[]> => {
      const users = await getUsers(args.limit, args.offset);
      return users;
    },
  },
  
  Mutation: {
    createUser: async (
      _: unknown, 
      { input }: { input: CreateUserInput }
    ): Promise<User> => {
      const user = await createUser(input);
      pubsub.publish('USER_CREATED', { userCreated: user });
      return user;
    },
  },
};

// =============================================================================
// Pattern 3: Modular Resolvers (Spread Pattern)
// =============================================================================

/**
 * Modular Query resolvers
 */
const queryResolvers = {
  user: (_: unknown, { id }: { id: string }) => getUserById(id),
  users: (_: unknown, { limit, offset }: { limit?: number; offset?: number }) => 
    getUsers(limit, offset),
};

/**
 * Modular Mutation resolvers
 */
const mutationResolvers = {
  createUser: (_: unknown, { input }: { input: CreateUserInput }) => createUser(input),
  updateUser: (_: unknown, { id, input }: { id: string; input: UpdateUserInput }) =>
    updateUser(id, input),
};

/**
 * Merged resolvers using spread
 */
const mergedResolvers = {
  Query: {
    ...queryResolvers,
    posts: (_: unknown, { authorId }: { authorId?: string }) => getPosts(authorId),
  },
  Mutation: {
    ...mutationResolvers,
    deleteUser: (_: unknown, { id }: { id: string }) => deleteUser(id),
  },
};

// =============================================================================
// Pattern 4: Resolvers with Type Annotations
// =============================================================================

type ResolverContext = {
  userId?: string;
  isAdmin?: boolean;
  token?: string;
};

type UserArgs = {
  id: string;
};

type UsersArgs = {
  limit?: number;
  offset?: number;
};

/**
 * Resolvers with explicit type annotations
 */
const typedResolvers = {
  Query: {
    user: (
      _parent: unknown,
      args: UserArgs,
      _context: ResolverContext
    ): Promise<User | null> => getUserById(args.id),
    
    users: (
      _parent: unknown,
      args: UsersArgs,
      _context: ResolverContext
    ): Promise<User[]> => getUsers(args.limit, args.offset),
  },
};

// =============================================================================
// Pattern 5: Function-based Resolvers
// =============================================================================

/**
 * Standalone resolver function
 */
function userResolver(_parent: unknown, { id }: { id: string }) {
  return getUserById(id);
}

/**
 * Async standalone resolver function
 */
async function createUserResolver(
  _parent: unknown,
  { input }: { input: CreateUserInput }
): Promise<User> {
  const user = await createUser(input);
  return user;
}

/**
 * Resolvers referencing standalone functions
 */
const functionRefResolvers = {
  Query: {
    user: userResolver,
  },
  Mutation: {
    createUser: createUserResolver,
  },
};

// =============================================================================
// Pattern 6: ApolloServer Configuration
// =============================================================================

// Mock ApolloServer class
class ApolloServer {
  constructor(config: {
    typeDefs: unknown;
    resolvers: Record<string, unknown>;
    context?: (req: unknown) => Promise<ResolverContext>;
  }) {
    console.log('ApolloServer created with', config);
  }
  
  async start() {
    console.log('Server started');
  }
}

// Mock typeDefs (gql tag)
const typeDefs = {} as unknown;

/**
 * Server with inline resolvers in constructor
 */
const serverWithInlineResolvers = new ApolloServer({
  typeDefs,
  resolvers: {
    Query: {
      user: (_: unknown, { id }: { id: string }) => getUserById(id),
      users: (_: unknown, args: { limit?: number }) => getUsers(args.limit),
    },
    Mutation: {
      createUser: (_: unknown, { input }: { input: CreateUserInput }) => createUser(input),
    },
  },
  context: async (req) => ({
    userId: 'user-123',
    isAdmin: false,
    token: req?.toString(),
  }),
});

/**
 * Server with external resolvers object
 */
const serverWithExternalResolvers = new ApolloServer({
  typeDefs,
  resolvers,
});

// =============================================================================
// Exports for Testing
// =============================================================================

export {
  resolvers,
  asyncResolvers,
  queryResolvers,
  mutationResolvers,
  mergedResolvers,
  typedResolvers,
  functionRefResolvers,
  serverWithInlineResolvers,
  serverWithExternalResolvers,
  userResolver,
  createUserResolver,
};

export type {
  User,
  Post,
  Comment,
  CreateUserInput,
  UpdateUserInput,
  CreatePostInput,
  UpdatePostInput,
  ResolverContext,
};
