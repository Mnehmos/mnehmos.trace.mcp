/**
 * Test Fixtures: Chain Patterns
 * 
 * Various method chain patterns used to test PatternMatcher.
 * These examples represent tRPC procedures and similar fluent APIs.
 * 
 * Pattern Type: 'chain' - Method chains like t.procedure.input().query()
 */

import { z } from 'zod';

// ============================================================================
// tRPC-style Method Chains
// ============================================================================

// Mock tRPC types for fixture
type TRPCBuilder = {
  router: (routes: Record<string, any>) => any;
  procedure: TRPCProcedure;
  middleware: (fn: any) => TRPCProcedure;
  mergeRouters: (...routers: any[]) => any;
};

type TRPCProcedure = {
  input: (schema: any) => TRPCProcedure;
  output: (schema: any) => TRPCProcedure;
  query: (fn: any) => any;
  mutation: (fn: any) => any;
  subscription: (fn: any) => any;
  use: (middleware: any) => TRPCProcedure;
};

// Mock tRPC instance
const t: TRPCBuilder = {
  router: (routes) => routes,
  procedure: {
    input: (schema) => t.procedure,
    output: (schema) => t.procedure,
    query: (fn) => fn,
    mutation: (fn) => fn,
    subscription: (fn) => fn,
    use: (middleware) => t.procedure,
  },
  middleware: (fn) => t.procedure,
  mergeRouters: (...routers) => ({}),
};

const publicProcedure = t.procedure;
const protectedProcedure = t.middleware(({ ctx, next }: any) => next());

// ============================================================================
// Simple tRPC Procedure Chains
// ============================================================================

/**
 * Simple query with input
 * Expected: Match terminal 'query' with input schema from .input()
 */
const getUserById = publicProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input }) => {
    return { id: input.id, name: 'John', email: 'john@example.com' };
  });

/**
 * Query without input
 * Expected: Match terminal 'query' with no input schema
 */
const listUsers = publicProcedure.query(async () => {
  return [];
});

/**
 * Mutation with input
 * Expected: Match terminal 'mutation' with input schema
 */
const createUser = publicProcedure
  .input(
    z.object({
      name: z.string().min(1).max(100),
      email: z.string().email(),
      password: z.string().min(8),
    })
  )
  .mutation(async ({ input }) => {
    return { id: '1', name: input.name, email: input.email };
  });

/**
 * Mutation with input and output
 * Expected: Match terminal 'mutation' with both input and output schemas
 */
const updateUser = publicProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      data: z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
      }),
    })
  )
  .output(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string(),
      updatedAt: z.date(),
    })
  )
  .mutation(async ({ input }) => {
    return {
      id: input.id,
      name: input.data.name ?? '',
      email: input.data.email ?? '',
      updatedAt: new Date(),
    };
  });

/**
 * Delete mutation
 */
const deleteUser = protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input }) => {
    return { success: true };
  });

// ============================================================================
// Complex Chain Patterns
// ============================================================================

/**
 * Subscription with input
 * Expected: Match terminal 'subscription'
 */
const onUserCreated = publicProcedure
  .input(z.object({ userId: z.string().optional() }))
  .subscription(({ input }) => {
    // Return observable-like
    return {
      [Symbol.asyncIterator]: async function* () {
        yield { user: { id: '1', name: 'John' } };
      },
    };
  });

/**
 * Chain with middleware
 * Expected: Match with middleware in chain
 */
const adminOnlyAction = t.procedure
  .use(({ ctx, next }: any) => {
    if (!ctx.isAdmin) throw new Error('Not authorized');
    return next();
  })
  .input(z.object({ action: z.string() }))
  .mutation(async ({ input }) => {
    return { result: input.action };
  });

/**
 * Chain with multiple middleware
 */
const multiMiddlewareAction = t.procedure
  .use(({ ctx, next }: any) => next())
  .use(({ ctx, next }: any) => next())
  .use(({ ctx, next }: any) => next())
  .input(z.object({ value: z.number() }))
  .mutation(async ({ input }) => input);

// ============================================================================
// Router Definitions with Chains
// ============================================================================

/**
 * Users router with multiple procedures
 */
const usersRouter = t.router({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => ({ id: input.id })),

  create: publicProcedure
    .input(z.object({ name: z.string(), email: z.string() }))
    .mutation(async ({ input }) => ({ id: '1', ...input })),

  list: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(10),
        offset: z.number().int().min(0).default(0),
        orderBy: z.enum(['name', 'createdAt']).optional(),
      })
    )
    .query(async ({ input }) => []),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: z.object({ name: z.string().optional() }) }))
    .mutation(async ({ input }) => ({ id: input.id })),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => ({ success: true })),
});

/**
 * Posts router
 */
const postsRouter = t.router({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => ({ id: input.id, title: '' })),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        content: z.string(),
        published: z.boolean().default(false),
        tags: z.array(z.string()).optional(),
      })
    )
    .output(
      z.object({
        id: z.string(),
        title: z.string(),
        content: z.string(),
        published: z.boolean(),
        authorId: z.string(),
        createdAt: z.date(),
      })
    )
    .mutation(async ({ input, ctx }) => ({
      id: '1',
      title: input.title,
      content: input.content,
      published: input.published ?? false,
      authorId: 'user-1',
      createdAt: new Date(),
    })),

  listByAuthor: publicProcedure
    .input(
      z.object({
        authorId: z.string(),
        limit: z.number().default(10),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input }) => ({
      items: [],
      nextCursor: null,
    })),
});

/**
 * Nested admin router
 */
const adminRouter = t.router({
  users: t.router({
    ban: protectedProcedure
      .input(z.object({ userId: z.string(), reason: z.string() }))
      .mutation(async ({ input }) => ({ success: true })),

    unban: protectedProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(async ({ input }) => ({ success: true })),

    list: protectedProcedure
      .input(z.object({ status: z.enum(['active', 'banned', 'all']).default('all') }))
      .query(async () => []),
  }),

  stats: protectedProcedure.query(async () => ({
    totalUsers: 0,
    activeUsers: 0,
    totalPosts: 0,
  })),
});

/**
 * Merged app router
 */
const appRouter = t.mergeRouters(
  t.router({
    users: usersRouter,
    posts: postsRouter,
    admin: adminRouter,
    health: publicProcedure.query(() => ({ status: 'ok' })),
  })
);

// ============================================================================
// Zod-style Method Chains (for schema building)
// ============================================================================

/**
 * Zod method chains for schema refinement
 */
const stringChain = z.string().min(1).max(100).trim().toLowerCase();
const numberChain = z.number().int().positive().min(1).max(1000);
const arrayChain = z.array(z.string()).min(1).max(10).nonempty();
const objectChain = z
  .object({ name: z.string(), value: z.number() })
  .strict()
  .partial();

// ============================================================================
// Builder Pattern Chains
// ============================================================================

/**
 * Query builder pattern
 */
interface QueryBuilder<T> {
  select: (...fields: string[]) => QueryBuilder<T>;
  where: (condition: any) => QueryBuilder<T>;
  orderBy: (field: string, direction?: 'asc' | 'desc') => QueryBuilder<T>;
  limit: (n: number) => QueryBuilder<T>;
  offset: (n: number) => QueryBuilder<T>;
  execute: () => Promise<T[]>;
}

const db = {
  users: {
    select: (...fields: string[]) => db.users as unknown as QueryBuilder<any>,
    where: (condition: any) => db.users as unknown as QueryBuilder<any>,
    orderBy: (field: string, direction?: 'asc' | 'desc') => db.users as unknown as QueryBuilder<any>,
    limit: (n: number) => db.users as unknown as QueryBuilder<any>,
    offset: (n: number) => db.users as unknown as QueryBuilder<any>,
    execute: async () => [],
  },
};

// Query builder chain example
const queryChain = db.users
  .select('id', 'name', 'email')
  .where({ active: true })
  .orderBy('createdAt', 'desc')
  .limit(10)
  .offset(0);

// ============================================================================
// Express Router Chain Pattern
// ============================================================================

type RouterChain = {
  get: (path: string, ...handlers: any[]) => RouterChain;
  post: (path: string, ...handlers: any[]) => RouterChain;
  put: (path: string, ...handlers: any[]) => RouterChain;
  delete: (path: string, ...handlers: any[]) => RouterChain;
  use: (...handlers: any[]) => RouterChain;
};

const expressRouter: RouterChain = {
  get: (path, ...handlers) => expressRouter,
  post: (path, ...handlers) => expressRouter,
  put: (path, ...handlers) => expressRouter,
  delete: (path, ...handlers) => expressRouter,
  use: (...handlers) => expressRouter,
};

// Fluent router definition
const apiRoutes = expressRouter
  .use((req: any, res: any, next: any) => next())
  .get('/users', (req: any, res: any) => res.json([]))
  .post('/users', (req: any, res: any) => res.json(req.body))
  .get('/users/:id', (req: any, res: any) => res.json({}))
  .put('/users/:id', (req: any, res: any) => res.json({}))
  .delete('/users/:id', (req: any, res: any) => res.sendStatus(204));

// ============================================================================
// Edge Cases
// ============================================================================

// Very long chain
const longChain = publicProcedure
  .use(({ next }: any) => next())
  .use(({ next }: any) => next())
  .use(({ next }: any) => next())
  .input(z.object({ a: z.string() }))
  .output(z.object({ b: z.string() }))
  .mutation(async ({ input }) => ({ b: input.a }));

// Chain with schema reference
const inputSchema = z.object({ id: z.string() });
const outputSchema = z.object({ success: z.boolean() });

const chainWithRefs = publicProcedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async () => ({ success: true }));

// Chain stored in variable mid-chain
const procedureWithInput = publicProcedure.input(z.object({ value: z.number() }));
const completedProcedure = procedureWithInput.mutation(async ({ input }) => input);

// Inline object schema in chain
const inlineSchemaChain = publicProcedure
  .input(
    z.object({
      nested: z.object({
        deep: z.object({
          value: z.string(),
        }),
      }),
    })
  )
  .query(async ({ input }) => input);

export {
  getUserById,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  onUserCreated,
  adminOnlyAction,
  multiMiddlewareAction,
  usersRouter,
  postsRouter,
  adminRouter,
  appRouter,
  stringChain,
  numberChain,
  arrayChain,
  objectChain,
  queryChain,
  apiRoutes,
  longChain,
  chainWithRefs,
  completedProcedure,
  inlineSchemaChain,
};
