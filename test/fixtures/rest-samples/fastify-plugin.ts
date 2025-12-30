/**
 * Fastify Plugin Fixture
 * 
 * Sample Fastify plugin demonstrating modular route definitions.
 * Tests plugin-specific patterns for REST endpoint detection.
 * 
 * Patterns tested:
 * - fastify.register() with plugin
 * - Plugin with prefix option
 * - Encapsulated plugins
 * - Nested plugin registration
 * - Decorated routes
 */

import Fastify, { FastifyInstance, FastifyPluginAsync, FastifyPluginCallback, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { Type } from '@sinclair/typebox';

// Type declarations for demonstration
type FastifyRequest = any;
type FastifyReply = any;

// ============================================================================
// Plugin Options Types
// ============================================================================

interface UserPluginOptions extends FastifyPluginOptions {
  prefix?: string;
}

interface AdminPluginOptions extends FastifyPluginOptions {
  requireAuth?: boolean;
}

interface CRUDPluginOptions<T = any> extends FastifyPluginOptions {
  tableName: string;
  schema?: T;
}

// ============================================================================
// Async Plugin Pattern - User Routes
// ============================================================================

const userPlugin: FastifyPluginAsync<UserPluginOptions> = async (fastify, options) => {
  // GET - List users
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            users: { type: 'array' },
            total: { type: 'integer' },
            page: { type: 'integer' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return { users: [], total: 0, page: 1 };
  });

  // GET - Get user by ID
  fastify.get('/:id', {
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
            email: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return { id: request.params.id, name: 'John', email: 'john@example.com' };
  });

  // POST - Create user
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
        },
        required: ['name', 'email'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    reply.code(201);
    return { id: 'new-id', ...request.body };
  });

  // PUT - Update user
  fastify.put('/:id', {
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
          email: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return { id: request.params.id, ...request.body };
  });

  // DELETE - Delete user
  fastify.delete('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    reply.code(204);
    return null;
  });
};

// ============================================================================
// Callback Plugin Pattern - Posts Routes
// ============================================================================

const postsPlugin: FastifyPluginCallback = (fastify, options, done) => {
  // GET - List posts
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return { posts: [] };
  });

  // GET - Get post by ID
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return { id: request.params.id, title: 'Post Title' };
  });

  // POST - Create post
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.code(201);
    return { id: 'new-post-id', ...request.body };
  });

  done();
};

// ============================================================================
// TypeBox Schema Plugin
// ============================================================================

// TypeBox schemas
const ProductSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String({ minLength: 1, maxLength: 200 }),
  price: Type.Number({ minimum: 0 }),
  description: Type.Optional(Type.String()),
  category: Type.String(),
  inStock: Type.Boolean(),
});

const CreateProductSchema = Type.Omit(ProductSchema, ['id']);
const UpdateProductSchema = Type.Partial(CreateProductSchema);

const ProductQuerySchema = Type.Object({
  category: Type.Optional(Type.String()),
  minPrice: Type.Optional(Type.Number({ minimum: 0 })),
  maxPrice: Type.Optional(Type.Number()),
  inStock: Type.Optional(Type.Boolean()),
});

const productsPlugin: FastifyPluginAsync = async (fastify) => {
  // GET - List products with TypeBox
  fastify.get('/', {
    schema: {
      querystring: ProductQuerySchema,
      response: {
        200: Type.Object({
          products: Type.Array(ProductSchema),
          total: Type.Integer(),
        }),
      },
    },
  }, async (request: FastifyRequest) => {
    return { products: [], total: 0 };
  });

  // GET - Get product by ID
  fastify.get('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: ProductSchema,
        404: Type.Object({
          error: Type.String(),
          statusCode: Type.Integer(),
        }),
      },
    },
  }, async (request: FastifyRequest) => {
    return { id: request.params.id, name: 'Product', price: 99.99, category: 'Electronics', inStock: true };
  });

  // POST - Create product
  fastify.post('/', {
    schema: {
      body: CreateProductSchema,
      response: {
        201: ProductSchema,
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    reply.code(201);
    return { id: 'new-product-id', ...request.body };
  });

  // PUT - Update product
  fastify.put('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: UpdateProductSchema,
      response: {
        200: ProductSchema,
      },
    },
  }, async (request: FastifyRequest) => {
    return { id: request.params.id, ...request.body };
  });
};

// ============================================================================
// Zod Schema Plugin
// ============================================================================

// Zod schemas
const OrderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
  })),
  total: z.number().positive(),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  createdAt: z.string().datetime(),
});

const CreateOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
});

const UpdateOrderStatusSchema = z.object({
  status: z.enum(['processing', 'shipped', 'delivered', 'cancelled']),
});

const ordersPlugin: FastifyPluginAsync = async (fastify) => {
  // GET - List orders
  fastify.get('/', {
    schema: {
      querystring: z.object({
        status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      }),
      response: {
        200: z.object({
          orders: z.array(OrderSchema),
          total: z.number().int(),
        }),
      },
    },
  }, async (request: FastifyRequest) => {
    return { orders: [], total: 0 };
  });

  // GET - Get order by ID
  fastify.get('/:id', {
    schema: {
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        200: OrderSchema,
      },
    },
  }, async (request: FastifyRequest) => {
    return {
      id: request.params.id,
      userId: 'user-uuid',
      items: [],
      total: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  });

  // POST - Create order
  fastify.post('/', {
    schema: {
      body: CreateOrderSchema,
      response: {
        201: OrderSchema,
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    reply.code(201);
    return {
      id: 'new-order-uuid',
      userId: 'current-user-uuid',
      items: request.body.items.map((item: any) => ({ ...item, price: 10 })),
      total: 100,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  });

  // PATCH - Update order status
  fastify.patch('/:id/status', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: UpdateOrderStatusSchema,
    },
  }, async (request: FastifyRequest) => {
    return { id: request.params.id, status: request.body.status };
  });
};

// ============================================================================
// Encapsulated Plugin with fastify-plugin
// ============================================================================

const authDecoratorsPlugin = fp(async (fastify: FastifyInstance) => {
  // Add decorator to fastify instance
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    // Authentication logic
  });

  // Routes that use decorators
  fastify.get('/me', {
    onRequest: [(fastify as any).authenticate],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest) => {
    return { id: 'user-id', email: 'user@example.com' };
  });
});

// ============================================================================
// Nested Plugin Registration
// ============================================================================

const apiV1Plugin: FastifyPluginAsync = async (fastify) => {
  // Register nested plugins with prefixes
  await fastify.register(userPlugin, { prefix: '/users' });
  await fastify.register(postsPlugin, { prefix: '/posts' });
  await fastify.register(productsPlugin, { prefix: '/products' });
  await fastify.register(ordersPlugin, { prefix: '/orders' });

  // Direct routes at the v1 level
  fastify.get('/health', async () => {
    return { status: 'ok', version: 'v1' };
  });
};

// ============================================================================
// Main Application with Plugin Registration
// ============================================================================

const buildApp = async () => {
  const fastify = Fastify({ logger: true });

  // Register top-level plugins
  await fastify.register(authDecoratorsPlugin);

  // Register API version plugins
  await fastify.register(apiV1Plugin, { prefix: '/api/v1' });

  // Root health check
  fastify.get('/', async () => {
    return { service: 'api', status: 'ok' };
  });

  return fastify;
};

// ============================================================================
// Generic CRUD Plugin Factory
// ============================================================================

function createCRUDPlugin<T>(options: CRUDPluginOptions<T>): FastifyPluginAsync {
  return async (fastify) => {
    const { tableName, schema } = options;

    // GET - List all
    fastify.get('/', async () => {
      return { items: [], tableName };
    });

    // GET - Get by ID
    fastify.get('/:id', async (request: FastifyRequest) => {
      return { id: request.params.id, tableName };
    });

    // POST - Create
    fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
      reply.code(201);
      return { id: 'new-id', ...request.body, tableName };
    });

    // PUT - Update
    fastify.put('/:id', async (request: FastifyRequest) => {
      return { id: request.params.id, ...request.body, tableName };
    });

    // DELETE - Delete
    fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      reply.code(204);
      return null;
    });
  };
}

// Usage of CRUD plugin factory
const categoriesPlugin = createCRUDPlugin({ tableName: 'categories' });
const tagsPlugin = createCRUDPlugin({ tableName: 'tags' });

// ============================================================================
// Exports
// ============================================================================

export { userPlugin };
export { postsPlugin };
export { productsPlugin };
export { ordersPlugin };
export { authDecoratorsPlugin };
export { apiV1Plugin };
export { buildApp };
export { createCRUDPlugin };
export { categoriesPlugin };
export { tagsPlugin };
export default userPlugin;
