/**
 * Test Fixtures: Call Patterns
 * 
 * Various method call patterns used to test PatternMatcher.
 * These examples represent common API framework patterns.
 * 
 * Pattern Type: 'call' - Method calls like app.get(), server.tool()
 */

import { z } from 'zod';

// ============================================================================
// MCP Server Patterns
// ============================================================================

/**
 * MCP server.tool() pattern with inline Zod schema
 * Expected: Match with signature='tool', receiver='server'
 */
const server = {
  tool: (name: string, description: string, schema: any, handler: any) => {},
};

// Simple tool with inline schema
server.tool(
  'get_user',
  'Get user by ID',
  z.object({ id: z.string().uuid() }),
  async ({ id }) => ({ name: 'John' })
);

// Tool with complex schema
server.tool(
  'create_post',
  'Create a new post',
  z.object({
    title: z.string().min(1).max(200),
    content: z.string(),
    authorId: z.string().uuid(),
    tags: z.array(z.string()).optional(),
    published: z.boolean().default(false),
  }),
  async (input) => ({ id: '123', ...input })
);

// Tool with schema reference
const searchSchema = z.object({
  query: z.string(),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
});

server.tool('search', 'Search items', searchSchema, async (input) => []);

// ============================================================================
// Express-style Patterns
// ============================================================================

/**
 * Express app.get/post/put/delete patterns
 * Expected: Match with signature=/^(get|post|put|delete)$/i, receiver='app'
 */
const app = {
  get: (path: string, handler: any) => {},
  post: (path: string, handler: any) => {},
  put: (path: string, handler: any) => {},
  delete: (path: string, handler: any) => {},
  patch: (path: string, handler: any) => {},
  options: (path: string, handler: any) => {},
  use: (middleware: any) => {},
};

// GET route
app.get('/users', (req: any, res: any) => {
  res.json([]);
});

// GET with path parameter
app.get('/users/:id', (req: any, res: any) => {
  res.json({ id: req.params.id });
});

// POST route
app.post('/users', (req: any, res: any) => {
  res.json(req.body);
});

// PUT route
app.put('/users/:id', (req: any, res: any) => {
  res.json({ ...req.body, id: req.params.id });
});

// DELETE route
app.delete('/users/:id', (req: any, res: any) => {
  res.sendStatus(204);
});

// PATCH route
app.patch('/users/:id', (req: any, res: any) => {
  res.json({ ...req.body, id: req.params.id });
});

// ============================================================================
// Express Router Patterns
// ============================================================================

/**
 * Express router patterns
 * Expected: Match with receiver='router'
 */
const router = {
  get: (path: string, handler: any) => {},
  post: (path: string, handler: any) => {},
};

router.get('/api/posts', (req: any, res: any) => {
  res.json([]);
});

router.post('/api/posts', (req: any, res: any) => {
  res.json(req.body);
});

// ============================================================================
// Fastify-style Patterns
// ============================================================================

/**
 * Fastify route patterns
 * Expected: Match with signature='route', receiver='fastify'
 */
const fastify = {
  route: (options: {
    method: string;
    url: string;
    schema?: any;
    handler: any;
  }) => {},
  get: (path: string, opts: any, handler?: any) => {},
  post: (path: string, opts: any, handler?: any) => {},
};

// Fastify route with schema object
fastify.route({
  method: 'GET',
  url: '/api/users',
  schema: {
    querystring: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
    response: {
      200: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    },
  },
  handler: async (request: any, reply: any) => {
    return [];
  },
});

// Fastify POST with body schema
fastify.route({
  method: 'POST',
  url: '/api/users',
  schema: {
    body: {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
      },
    },
  },
  handler: async (request: any, reply: any) => {
    return { id: '123' };
  },
});

// Fastify shorthand
fastify.get(
  '/health',
  {
    schema: {
      response: {
        200: { type: 'object', properties: { status: { type: 'string' } } },
      },
    },
  },
  async () => ({ status: 'ok' })
);

// ============================================================================
// Hono-style Patterns
// ============================================================================

/**
 * Hono app patterns (similar to Express but with c context)
 */
const hono = {
  get: (path: string, handler: any) => {},
  post: (path: string, handler: any) => {},
};

hono.get('/api/items', (c: any) => c.json([]));
hono.post('/api/items', async (c: any) => {
  const body = await c.req.json();
  return c.json(body);
});

// ============================================================================
// Edge Cases
// ============================================================================

// Chained method on different receiver (should not match typical patterns)
const db = {
  query: (sql: string) => ({ then: (fn: any) => {} }),
};
db.query('SELECT * FROM users');

// Method with same name but different context
const logger = {
  get: () => console,
  post: (message: string) => console.log(message),
};
logger.get();
logger.post('Hello');

// Nested object method call
const services = {
  users: {
    get: (id: string) => ({ id, name: 'Test' }),
    create: (data: any) => ({ id: '1', ...data }),
  },
};
services.users.get('123');
services.users.create({ name: 'John' });

export { server, app, router, fastify, hono, db, logger, services };
