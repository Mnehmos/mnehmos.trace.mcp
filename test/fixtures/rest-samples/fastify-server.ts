/**
 * Fastify Server Fixture
 * 
 * Sample Fastify server with various route patterns for testing
 * REST endpoint detection in the pattern matcher.
 * 
 * Patterns tested:
 * - Shorthand methods (fastify.get, fastify.post, etc.)
 * - fastify.route() with full options
 * - Schema extraction (body, querystring, params, response)
 * - JSON Schema format
 * - TypeBox format
 * - Zod with fastify-type-provider-zod
 */

import Fastify from 'fastify';
import { z } from 'zod';
import { Type, Static } from '@sinclair/typebox';

// Type declarations for demonstration
type FastifyRequest = any;
type FastifyReply = any;

// Create Fastify instance
const fastify = Fastify({ logger: true });

// Also test with alternative instance names
const server = Fastify();
const app = Fastify();

// ============================================================================
// Shorthand HTTP Methods - No Options
// ============================================================================

// GET - Simple handler
fastify.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
  return { users: [] };
});

// POST - Simple handler
fastify.post('/users', async (request: FastifyRequest, reply: FastifyReply) => {
  return { id: '123', ...request.body };
});

// PUT - Simple handler
fastify.put('/users/:id', async (request: FastifyRequest, reply: FastifyReply) => {
  return { id: request.params.id, ...request.body };
});

// DELETE - Simple handler
fastify.delete('/users/:id', async (request: FastifyRequest, reply: FastifyReply) => {
  reply.code(204);
  return null;
});

// PATCH - Simple handler
fastify.patch('/users/:id', async (request: FastifyRequest, reply: FastifyReply) => {
  return { id: request.params.id, ...request.body };
});

// OPTIONS - Simple handler
fastify.options('/users', async (request: FastifyRequest, reply: FastifyReply) => {
  reply.header('Allow', 'GET, POST, OPTIONS');
  reply.code(204);
  return null;
});

// HEAD - Simple handler
fastify.head('/users/:id', async (request: FastifyRequest, reply: FastifyReply) => {
  reply.code(200);
  return null;
});

// ALL - Catch-all handler
fastify.all('/health', async (request: FastifyRequest, reply: FastifyReply) => {
  return { status: 'ok' };
});

// ============================================================================
// Shorthand with Options Object - JSON Schema
// ============================================================================

// GET with params schema
fastify.get('/users/:id', {
  schema: {
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
      required: ['id'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      },
    },
  },
}, async (request: FastifyRequest, reply: FastifyReply) => {
  return { id: request.params.id, name: 'John', email: 'john@example.com' };
});

// POST with body schema
fastify.post('/users', {
  schema: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        email: { type: 'string', format: 'email' },
        age: { type: 'integer', minimum: 0, maximum: 150 },
      },
      required: ['name', 'email'],
    },
    response: {
      201: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string' },
        },
      },
    },
  },
}, async (request: FastifyRequest, reply: FastifyReply) => {
  reply.code(201);
  return { id: 'uuid', ...request.body };
});

// GET with querystring schema
fastify.get('/search', {
  schema: {
    querystring: {
      type: 'object',
      properties: {
        q: { type: 'string', minLength: 1 },
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
        sort: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
      },
      required: ['q'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          results: { type: 'array', items: { type: 'object' } },
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
        },
      },
    },
  },
}, async (request: FastifyRequest, reply: FastifyReply) => {
  return { results: [], total: 0, page: request.query.page, limit: request.query.limit };
});

// POST with headers schema
fastify.post('/api/secure', {
  schema: {
    headers: {
      type: 'object',
      properties: {
        'x-api-key': { type: 'string', minLength: 32 },
        'x-request-id': { type: 'string', format: 'uuid' },
      },
      required: ['x-api-key'],
    },
    body: {
      type: 'object',
      properties: {
        data: { type: 'string' },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
        },
      },
    },
  },
}, async (request: FastifyRequest, reply: FastifyReply) => {
  return { success: true };
});

// ============================================================================
// Shorthand with TypeBox Schema
// ============================================================================

// TypeBox schema definitions
const UserParams = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

const UserBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  email: Type.String({ format: 'email' }),
  age: Type.Optional(Type.Integer({ minimum: 0, maximum: 150 })),
});

const UserResponse = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  email: Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
});

const ErrorResponse = Type.Object({
  error: Type.String(),
  message: Type.String(),
  statusCode: Type.Integer(),
});

// GET with TypeBox
fastify.get('/api/users/:id', {
  schema: {
    params: UserParams,
    response: {
      200: UserResponse,
      404: ErrorResponse,
    },
  },
}, async (request: FastifyRequest, reply: FastifyReply) => {
  return { id: request.params.id, name: 'John', email: 'john@example.com', createdAt: new Date().toISOString() };
});

// POST with TypeBox
fastify.post('/api/users', {
  schema: {
    body: UserBody,
    response: {
      201: UserResponse,
      400: ErrorResponse,
    },
  },
}, async (request: FastifyRequest, reply: FastifyReply) => {
  reply.code(201);
  return { id: 'uuid', ...request.body, createdAt: new Date().toISOString() };
});

// ============================================================================
// fastify.route() Method - Full Options
// ============================================================================

// route() with method as string
fastify.route({
  method: 'GET',
  url: '/products',
  schema: {
    querystring: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        minPrice: { type: 'number' },
        maxPrice: { type: 'number' },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          products: { type: 'array' },
        },
      },
    },
  },
  handler: async (request: FastifyRequest, reply: FastifyReply) => {
    return { products: [] };
  },
});

// route() with POST
fastify.route({
  method: 'POST',
  url: '/products',
  schema: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        price: { type: 'number', minimum: 0 },
        description: { type: 'string' },
        category: { type: 'string' },
      },
      required: ['name', 'price'],
    },
    response: {
      201: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' },
        },
      },
    },
  },
  handler: async (request: FastifyRequest, reply: FastifyReply) => {
    reply.code(201);
    return { id: 'product-id', ...request.body };
  },
});

// route() with params
fastify.route({
  method: 'PUT',
  url: '/products/:id',
  schema: {
    params: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    },
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        price: { type: 'number' },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' },
          updatedAt: { type: 'string' },
        },
      },
    },
  },
  handler: async (request: FastifyRequest, reply: FastifyReply) => {
    return { id: request.params.id, ...request.body, updatedAt: new Date().toISOString() };
  },
});

// route() with DELETE
fastify.route({
  method: 'DELETE',
  url: '/products/:id',
  schema: {
    params: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    },
    response: {
      204: {
        type: 'null',
        description: 'No content',
      },
    },
  },
  handler: async (request: FastifyRequest, reply: FastifyReply) => {
    reply.code(204);
    return null;
  },
});

// route() with multiple methods (array)
fastify.route({
  method: ['GET', 'HEAD'],
  url: '/status',
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded', 'down'] },
          uptime: { type: 'number' },
          version: { type: 'string' },
        },
      },
    },
  },
  handler: async (request: FastifyRequest, reply: FastifyReply) => {
    return { status: 'ok', uptime: process.uptime(), version: '1.0.0' };
  },
});

// ============================================================================
// Route with Zod (fastify-type-provider-zod)
// ============================================================================

// Zod schema definitions
const ZodUserParams = z.object({
  id: z.string().uuid(),
});

const ZodUserBody = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['user', 'admin', 'moderator']).default('user'),
});

const ZodUserResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
  createdAt: z.string().datetime(),
});

// Fastify with Zod type provider
fastify.route({
  method: 'GET',
  url: '/v2/users/:id',
  schema: {
    params: ZodUserParams,
    response: {
      200: ZodUserResponse,
    },
  },
  handler: async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      id: request.params.id,
      name: 'John',
      email: 'john@example.com',
      role: 'user',
      createdAt: new Date().toISOString(),
    };
  },
});

fastify.route({
  method: 'POST',
  url: '/v2/users',
  schema: {
    body: ZodUserBody,
    response: {
      201: ZodUserResponse,
    },
  },
  handler: async (request: FastifyRequest, reply: FastifyReply) => {
    reply.code(201);
    return {
      id: 'new-uuid',
      ...request.body,
      createdAt: new Date().toISOString(),
    };
  },
});

// ============================================================================
// Alternative Instance Names
// ============================================================================

// Using 'server' instance
server.get('/api/health', async () => {
  return { status: 'ok' };
});

server.post('/api/data', {
  schema: {
    body: {
      type: 'object',
      properties: {
        payload: { type: 'string' },
      },
    },
  },
}, async (request: FastifyRequest) => {
  return { received: request.body };
});

// Using 'app' instance
app.get('/v1/ping', async () => {
  return { pong: true };
});

app.route({
  method: 'POST',
  url: '/v1/echo',
  schema: {
    body: {
      type: 'object',
      additionalProperties: true,
    },
  },
  handler: async (request: FastifyRequest) => {
    return request.body;
  },
});

// ============================================================================
// Path Parameters Variations
// ============================================================================

// Simple parameter
fastify.get('/items/:id', async (request: FastifyRequest) => {
  return { id: request.params.id };
});

// Multiple parameters
fastify.get('/users/:userId/orders/:orderId', async (request: FastifyRequest) => {
  return { userId: request.params.userId, orderId: request.params.orderId };
});

// Nested resources
fastify.get('/organizations/:orgId/teams/:teamId/members/:memberId', async (request: FastifyRequest) => {
  return request.params;
});

// Wildcard parameter
fastify.get('/files/*', async (request: FastifyRequest) => {
  return { path: request.params['*'] };
});

// ============================================================================
// Export
// ============================================================================

export { fastify, server, app };
export default fastify;
