/**
 * Sample tRPC Router Fixture
 * 
 * This file provides a realistic tRPC router structure for testing
 * the TRPCAdapter schema extraction functionality.
 * 
 * Note: This fixture uses mock tRPC types to avoid requiring @trpc/server
 * as a dependency. The structure mirrors real tRPC routers.
 */

import { z } from 'zod';

// ============================================================================
// Mock tRPC Types (for testing without @trpc/server dependency)
// ============================================================================

interface ProcedureBuilder {
  input: <T extends z.ZodType>(schema: T) => ProcedureBuilderWithInput<T>;
  query: <R>(fn: () => R) => ProcedureDef<undefined, R, 'query'>;
  mutation: <R>(fn: () => R) => ProcedureDef<undefined, R, 'mutation'>;
}

interface ProcedureBuilderWithInput<TInput extends z.ZodType> {
  output: <TOutput extends z.ZodType>(schema: TOutput) => ProcedureBuilderWithInputOutput<TInput, TOutput>;
  query: <R>(fn: (opts: { input: z.infer<TInput> }) => R) => ProcedureDef<TInput, R, 'query'>;
  mutation: <R>(fn: (opts: { input: z.infer<TInput> }) => R) => ProcedureDef<TInput, R, 'mutation'>;
}

interface ProcedureBuilderWithInputOutput<TInput extends z.ZodType, TOutput extends z.ZodType> {
  query: <R>(fn: (opts: { input: z.infer<TInput> }) => R) => ProcedureDef<TInput, z.infer<TOutput>, 'query'>;
  mutation: <R>(fn: (opts: { input: z.infer<TInput> }) => R) => ProcedureDef<TInput, z.infer<TOutput>, 'mutation'>;
}

interface ProcedureDef<TInput, TOutput, TType extends 'query' | 'mutation' | 'subscription'> {
  _def: {
    type: TType;
    input?: TInput;
    output?: TOutput;
  };
}

interface RouterDef<TRoutes extends Record<string, unknown>> {
  _def: {
    routes: TRoutes;
    router: true;
  };
}

// Mock tRPC builder
const createProcedure = (): ProcedureBuilder => ({
  input: <T extends z.ZodType>(schema: T) => ({
    output: <TOutput extends z.ZodType>(outputSchema: TOutput) => ({
      query: <R>(fn: (opts: { input: z.infer<T> }) => R) => ({
        _def: { type: 'query' as const, input: schema, output: outputSchema },
      }),
      mutation: <R>(fn: (opts: { input: z.infer<T> }) => R) => ({
        _def: { type: 'mutation' as const, input: schema, output: outputSchema },
      }),
    }),
    query: <R>(fn: (opts: { input: z.infer<T> }) => R) => ({
      _def: { type: 'query' as const, input: schema },
    }),
    mutation: <R>(fn: (opts: { input: z.infer<T> }) => R) => ({
      _def: { type: 'mutation' as const, input: schema },
    }),
  }),
  query: <R>(fn: () => R) => ({
    _def: { type: 'query' as const },
  }),
  mutation: <R>(fn: () => R) => ({
    _def: { type: 'mutation' as const },
  }),
});

const createRouter = <TRoutes extends Record<string, unknown>>(
  routes: TRoutes
): RouterDef<TRoutes> => ({
  _def: {
    routes,
    router: true,
  },
});

// Mock tRPC instance
const t = {
  router: createRouter,
  procedure: createProcedure(),
};

// ============================================================================
// Zod Schemas (Shared)
// ============================================================================

/**
 * User schema - represents a user entity
 */
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  status: z.enum(['active', 'inactive', 'pending']),
  createdAt: z.date(),
});

/**
 * Schema for creating a new user
 */
export const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
});

/**
 * Schema for updating an existing user
 */
export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
});

/**
 * Post schema - represents a blog post
 */
export const PostSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string(),
  authorId: z.string().uuid(),
  published: z.boolean(),
  createdAt: z.date(),
});

/**
 * Schema for creating a new post
 */
export const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string(),
  authorId: z.string().uuid(),
});

// ============================================================================
// Router Definitions
// ============================================================================

/**
 * User router - handles user-related operations
 */
const userRouter = t.router({
  /**
   * Get a user by ID
   */
  getById: t.procedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input }) => {
      return { id: input.id, name: 'Test User', email: 'test@example.com', status: 'active' as const, createdAt: new Date() };
    }),

  /**
   * Create a new user
   */
  create: t.procedure
    .input(CreateUserSchema)
    .output(UserSchema)
    .mutation(({ input }) => {
      return { id: '123', ...input, status: 'pending' as const, createdAt: new Date() };
    }),

  /**
   * Update an existing user
   */
  update: t.procedure
    .input(z.object({
      id: z.string().uuid(),
      data: UpdateUserSchema,
    }))
    .output(UserSchema)
    .mutation(({ input }) => {
      return { id: input.id, name: 'Updated', status: 'active' as const, createdAt: new Date() };
    }),

  /**
   * Delete a user
   */
  delete: t.procedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ input }) => {
      return { success: true };
    }),

  /**
   * List all users (no input)
   */
  list: t.procedure
    .query(() => {
      return [] as Array<z.infer<typeof UserSchema>>;
    }),
});

/**
 * Post router - handles blog post operations
 */
const postRouter = t.router({
  /**
   * Get a post by ID
   */
  getById: t.procedure
    .input(z.object({ postId: z.string().uuid() }))
    .query(({ input }) => {
      return null as z.infer<typeof PostSchema> | null;
    }),

  /**
   * Create a new post
   */
  create: t.procedure
    .input(CreatePostSchema)
    .output(PostSchema)
    .mutation(({ input }) => {
      return { 
        id: '456', 
        ...input, 
        published: false, 
        createdAt: new Date() 
      };
    }),

  /**
   * List posts by author
   */
  listByAuthor: t.procedure
    .input(z.object({
      authorId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).default(10),
      offset: z.number().int().min(0).default(0),
    }))
    .query(({ input }) => {
      return [] as Array<z.infer<typeof PostSchema>>;
    }),

  /**
   * Publish a post
   */
  publish: t.procedure
    .input(z.object({ postId: z.string().uuid() }))
    .output(PostSchema)
    .mutation(({ input }) => {
      return { 
        id: input.postId, 
        title: 'Published', 
        content: '', 
        authorId: '', 
        published: true, 
        createdAt: new Date() 
      };
    }),
});

/**
 * Main application router with nested routers
 */
export const appRouter = t.router({
  /**
   * User-related procedures
   */
  users: userRouter,

  /**
   * Post-related procedures
   */
  posts: postRouter,

  /**
   * Health check endpoint (no input or output schema)
   */
  health: t.procedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  /**
   * Deeply nested router for testing path resolution
   */
  admin: t.router({
    users: t.router({
      ban: t.procedure
        .input(z.object({
          userId: z.string().uuid(),
          reason: z.string().min(1),
          duration: z.number().int().positive().optional(),
        }))
        .mutation(({ input }) => {
          return { banned: true, userId: input.userId };
        }),

      unban: t.procedure
        .input(z.object({ userId: z.string().uuid() }))
        .mutation(({ input }) => {
          return { banned: false, userId: input.userId };
        }),
    }),

    stats: t.procedure
      .query(() => {
        return { 
          totalUsers: 100, 
          activeUsers: 75, 
          bannedUsers: 5 
        };
      }),
  }),
});

/**
 * Type export for client type inference
 */
export type AppRouter = typeof appRouter;

// ============================================================================
// Additional Test Fixtures
// ============================================================================

/**
 * Empty router for testing edge cases
 */
export const emptyRouter = t.router({});

/**
 * Single procedure router
 */
export const singleProcedureRouter = t.router({
  ping: t.procedure.query(() => 'pong'),
});

/**
 * Router with complex nested input
 */
export const complexInputRouter = t.router({
  search: t.procedure
    .input(z.object({
      query: z.string(),
      filters: z.object({
        status: z.enum(['active', 'inactive', 'all']).optional(),
        dateRange: z.object({
          start: z.date(),
          end: z.date(),
        }).optional(),
        tags: z.array(z.string()).optional(),
      }).optional(),
      pagination: z.object({
        page: z.number().int().min(1),
        pageSize: z.number().int().min(1).max(100),
      }),
    }))
    .query(({ input }) => {
      return { results: [], total: 0 };
    }),
});
