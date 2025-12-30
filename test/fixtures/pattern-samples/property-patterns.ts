/**
 * Test Fixtures: Property Patterns
 * 
 * Various object property patterns used to test PatternMatcher.
 * These examples represent GraphQL resolvers and similar property-based APIs.
 * 
 * Pattern Type: 'property' - Object properties like Query: { user: ... }
 */

// ============================================================================
// GraphQL Resolver Pattern
// ============================================================================

/**
 * GraphQL resolvers object
 * Expected: Match properties under Query, Mutation, Subscription
 */
const resolvers = {
  Query: {
    // Simple resolver
    user: (_parent: any, args: { id: string }, context: any) => {
      return { id: args.id, name: 'John', email: 'john@example.com' };
    },

    // Resolver with complex args
    users: (
      _parent: any,
      args: { limit?: number; offset?: number; filter?: string },
      context: any
    ) => {
      return [];
    },

    // Resolver returning array
    posts: (_parent: any, args: { authorId?: string }, context: any) => {
      return [];
    },

    // Resolver with nested input
    search: (
      _parent: any,
      args: {
        query: string;
        filters: {
          category?: string;
          tags?: string[];
          dateRange?: { from: string; to: string };
        };
      },
      context: any
    ) => {
      return [];
    },
  },

  Mutation: {
    // Create mutation
    createUser: (
      _parent: any,
      args: { input: { name: string; email: string; password: string } },
      context: any
    ) => {
      return { id: '1', name: args.input.name, email: args.input.email };
    },

    // Update mutation
    updateUser: (
      _parent: any,
      args: { id: string; input: { name?: string; email?: string } },
      context: any
    ) => {
      return { id: args.id, name: '', email: '' };
    },

    // Delete mutation
    deleteUser: (_parent: any, args: { id: string }, context: any) => {
      return true;
    },

    // Mutation with complex input
    createPost: (
      _parent: any,
      args: {
        input: {
          title: string;
          content: string;
          tags?: string[];
          published?: boolean;
        };
      },
      context: any
    ) => {
      return { id: '1', ...args.input };
    },
  },

  Subscription: {
    // Simple subscription
    userCreated: {
      subscribe: (_parent: any, _args: any, context: any) => {
        return context.pubsub.asyncIterator(['USER_CREATED']);
      },
    },

    // Subscription with filter
    postUpdated: {
      subscribe: (_parent: any, args: { authorId: string }, context: any) => {
        return context.pubsub.asyncIterator(['POST_UPDATED']);
      },
      resolve: (payload: any) => {
        return payload;
      },
    },
  },

  // Type resolvers
  User: {
    posts: (parent: { id: string }, _args: any, context: any) => {
      return [];
    },
    friends: (parent: { id: string }, args: { limit?: number }, context: any) => {
      return [];
    },
  },

  Post: {
    author: (parent: { authorId: string }, _args: any, context: any) => {
      return { id: parent.authorId, name: '', email: '' };
    },
    comments: (parent: { id: string }, args: { limit?: number }, context: any) => {
      return [];
    },
  },
};

// ============================================================================
// Apollo Server Type Defs Pattern
// ============================================================================

const typeDefs = `
  type Query {
    user(id: ID!): User
    users(limit: Int, offset: Int): [User!]!
    posts(authorId: ID): [Post!]!
  }

  type Mutation {
    createUser(input: CreateUserInput!): User!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    deleteUser(id: ID!): Boolean!
  }

  type User {
    id: ID!
    name: String!
    email: String!
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    author: User!
  }

  input CreateUserInput {
    name: String!
    email: String!
    password: String!
  }

  input UpdateUserInput {
    name: String
    email: String
  }
`;

// ============================================================================
// Schema Builder Pattern (Pothos/Nexus style)
// ============================================================================

const schemaBuilder = {
  queryType: {
    definition: (t: any) => ({
      user: t.field({
        type: 'User',
        args: { id: t.arg.id({ required: true }) },
        resolve: (root: any, args: any) => null,
      }),
      users: t.field({
        type: ['User'],
        args: {
          limit: t.arg.int({ required: false }),
          offset: t.arg.int({ required: false }),
        },
        resolve: (root: any, args: any) => [],
      }),
    }),
  },
  mutationType: {
    definition: (t: any) => ({
      createUser: t.field({
        type: 'User',
        args: {
          input: t.arg({
            type: 'CreateUserInput',
            required: true,
          }),
        },
        resolve: (root: any, args: any) => null,
      }),
    }),
  },
};

// ============================================================================
// Redux Slice Pattern (property-based actions)
// ============================================================================

const usersSlice = {
  name: 'users',
  initialState: { users: [], loading: false, error: null },
  reducers: {
    setUsers: (state: any, action: { payload: any[] }) => {
      state.users = action.payload;
    },
    addUser: (state: any, action: { payload: any }) => {
      state.users.push(action.payload);
    },
    updateUser: (state: any, action: { payload: { id: string; data: any } }) => {
      const index = state.users.findIndex((u: any) => u.id === action.payload.id);
      if (index !== -1) {
        state.users[index] = { ...state.users[index], ...action.payload.data };
      }
    },
    removeUser: (state: any, action: { payload: string }) => {
      state.users = state.users.filter((u: any) => u.id !== action.payload);
    },
    setLoading: (state: any, action: { payload: boolean }) => {
      state.loading = action.payload;
    },
    setError: (state: any, action: { payload: string | null }) => {
      state.error = action.payload;
    },
  },
};

// ============================================================================
// Express Route Config Pattern
// ============================================================================

const routeConfig = {
  '/users': {
    GET: {
      handler: (req: any, res: any) => res.json([]),
      middleware: [],
      schema: {
        query: { limit: 'number', offset: 'number' },
      },
    },
    POST: {
      handler: (req: any, res: any) => res.json(req.body),
      middleware: ['auth', 'validate'],
      schema: {
        body: { name: 'string', email: 'string' },
      },
    },
  },
  '/users/:id': {
    GET: {
      handler: (req: any, res: any) => res.json({ id: req.params.id }),
      middleware: [],
    },
    PUT: {
      handler: (req: any, res: any) => res.json({ ...req.body, id: req.params.id }),
      middleware: ['auth'],
      schema: {
        body: { name: 'string?', email: 'string?' },
      },
    },
    DELETE: {
      handler: (req: any, res: any) => res.sendStatus(204),
      middleware: ['auth', 'admin'],
    },
  },
};

// ============================================================================
// Vuex Store Pattern
// ============================================================================

const store = {
  state: {
    count: 0,
    items: [],
    user: null,
  },
  getters: {
    doubleCount: (state: any) => state.count * 2,
    itemsCount: (state: any) => state.items.length,
    isLoggedIn: (state: any) => state.user !== null,
  },
  mutations: {
    increment: (state: any) => {
      state.count++;
    },
    setItems: (state: any, items: any[]) => {
      state.items = items;
    },
    setUser: (state: any, user: any) => {
      state.user = user;
    },
  },
  actions: {
    fetchItems: async (context: any) => {
      const items = await fetch('/api/items').then(r => r.json());
      context.commit('setItems', items);
    },
    login: async (context: any, credentials: { email: string; password: string }) => {
      const user = await fetch('/api/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }).then(r => r.json());
      context.commit('setUser', user);
    },
  },
};

// ============================================================================
// Edge Cases
// ============================================================================

// Computed property names
const methodName = 'dynamicMethod';
const dynamicResolvers = {
  Query: {
    [methodName]: () => 'dynamic',
  },
};

// Spread properties
const baseResolvers = {
  Query: { health: () => 'ok' },
};
const extendedResolvers = {
  ...baseResolvers,
  Query: {
    ...baseResolvers.Query,
    extended: () => 'extended',
  },
};

// Shorthand property
const existingResolver = () => 'existing';
const shorthandResolvers = {
  Query: {
    existingResolver,
  },
};

// Nested objects
const deeplyNested = {
  level1: {
    level2: {
      level3: {
        resolver: () => 'deep',
      },
    },
  },
};

export {
  resolvers,
  typeDefs,
  schemaBuilder,
  usersSlice,
  routeConfig,
  store,
  dynamicResolvers,
  extendedResolvers,
  shorthandResolvers,
  deeplyNested,
};
