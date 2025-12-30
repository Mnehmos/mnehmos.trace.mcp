/**
 * Express Application Fixture
 * 
 * Sample Express application with various route patterns for testing
 * REST endpoint detection in the pattern matcher.
 * 
 * Patterns tested:
 * - Basic HTTP methods (GET, POST, PUT, DELETE, PATCH)
 * - Path parameters (:id, :userId)
 * - Optional parameters (:id?)
 * - Regex constraints (:id(\\d+))
 * - Validation middleware (Zod, Joi)
 * - Multiple middleware handlers
 * - Route chaining
 * - app.all() and app.use()
 */

import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Types for demonstration
interface User {
  id: string;
  name: string;
  email: string;
}

interface CreateUserDto {
  name: string;
  email: string;
}

interface UpdateUserDto {
  name?: string;
  email?: string;
}

// Mock validation middleware
function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    next();
  };
}

function validateQuery<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    next();
  };
}

// Create Express app
const app = express();

// ============================================================================
// Basic HTTP Methods - app.METHOD()
// ============================================================================

// GET - List all users
app.get('/users', (req: Request, res: Response) => {
  res.json({ users: [] });
});

// GET - Get user by ID with path parameter
app.get('/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  res.json({ id, name: 'John Doe', email: 'john@example.com' });
});

// POST - Create user
app.post('/users', (req: Request, res: Response) => {
  const user = req.body as CreateUserDto;
  res.status(201).json({ id: '123', ...user });
});

// PUT - Update user (full replacement)
app.put('/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.body as UpdateUserDto;
  res.json({ id, ...user });
});

// DELETE - Delete user
app.delete('/users/:id', (req: Request, res: Response) => {
  res.status(204).send();
});

// PATCH - Partial update
app.patch('/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body as Partial<UpdateUserDto>;
  res.json({ id, ...updates });
});

// OPTIONS - CORS preflight
app.options('/users', (req: Request, res: Response) => {
  res.set('Allow', 'GET, POST, OPTIONS');
  res.status(204).send();
});

// HEAD - Check resource exists
app.head('/users/:id', (req: Request, res: Response) => {
  res.status(200).send();
});

// ALL - Match all HTTP methods
app.all('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// ============================================================================
// Path Parameter Variations
// ============================================================================

// Multiple path parameters
app.get('/users/:userId/posts/:postId', (req: Request, res: Response) => {
  const { userId, postId } = req.params;
  res.json({ userId, postId });
});

// Optional path parameter
app.get('/files/:filename?', (req: Request, res: Response) => {
  const { filename } = req.params;
  res.json({ filename: filename || 'index.html' });
});

// Regex-constrained parameter (numeric ID)
app.get('/products/:id(\\d+)', (req: Request, res: Response) => {
  const { id } = req.params;
  res.json({ id: parseInt(id, 10) });
});

// Regex-constrained parameter (UUID)
app.get('/orders/:orderId([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', (req: Request, res: Response) => {
  res.json({ orderId: req.params.orderId });
});

// Wildcard path (catch-all)
app.get('/docs/*', (req: Request, res: Response) => {
  res.json({ path: req.params[0] });
});

// ============================================================================
// Validation Middleware - Zod
// ============================================================================

// Zod schemas
const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

const QuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sort: z.enum(['asc', 'desc']).optional(),
});

// POST with Zod body validation
app.post('/api/users',
  validateBody(CreateUserSchema),
  (req: Request, res: Response) => {
    res.status(201).json(req.body);
  }
);

// PUT with Zod body validation
app.put('/api/users/:id',
  validateBody(UpdateUserSchema),
  (req: Request, res: Response) => {
    res.json({ id: req.params.id, ...req.body });
  }
);

// GET with Zod query validation
app.get('/api/users',
  validateQuery(QuerySchema),
  (req: Request, res: Response) => {
    res.json({ users: [], pagination: req.query });
  }
);

// ============================================================================
// Multiple Middleware Handlers
// ============================================================================

// Authentication middleware
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Rate limiting middleware
function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  next();
}

// Logging middleware
function logMiddleware(req: Request, res: Response, next: NextFunction) {
  console.log(`${req.method} ${req.path}`);
  next();
}

// Route with multiple middleware
app.get('/protected/resource',
  logMiddleware,
  authMiddleware,
  rateLimitMiddleware,
  (req: Request, res: Response) => {
    res.json({ secret: 'data' });
  }
);

// Route with validation AND auth middleware
app.post('/protected/resource',
  authMiddleware,
  validateBody(CreateUserSchema),
  (req: Request, res: Response) => {
    res.status(201).json(req.body);
  }
);

// ============================================================================
// Route Chaining - app.route()
// ============================================================================

app.route('/articles')
  .get((req: Request, res: Response) => {
    res.json({ articles: [] });
  })
  .post((req: Request, res: Response) => {
    res.status(201).json(req.body);
  });

app.route('/articles/:id')
  .get((req: Request, res: Response) => {
    res.json({ id: req.params.id });
  })
  .put((req: Request, res: Response) => {
    res.json({ id: req.params.id, ...req.body });
  })
  .delete((req: Request, res: Response) => {
    res.status(204).send();
  });

// ============================================================================
// Typed Responses - res.json<T>()
// ============================================================================

interface ProfileResponse {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface ErrorResponse {
  error: string;
  code: number;
}

app.get('/profile', (req: Request, res: Response) => {
  // TypeScript type annotation on response
  const profile: ProfileResponse = {
    id: '123',
    name: 'John',
    email: 'john@example.com',
    createdAt: new Date().toISOString(),
  };
  res.json(profile);
});

app.get('/profile/:id', (req: Request, res: Response): void => {
  // Using res.json<T>() generic
  if (!req.params.id) {
    res.status(400).json<ErrorResponse>({ error: 'Missing ID', code: 400 });
    return;
  }
  res.json<ProfileResponse>({
    id: req.params.id,
    name: 'John',
    email: 'john@example.com',
    createdAt: new Date().toISOString(),
  });
});

// ============================================================================
// app.use() - Middleware and Router Mounting
// ============================================================================

// Middleware for all routes
app.use(express.json());

// Prefix-based middleware
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  req.headers['x-api-version'] = '1';
  next();
});

export default app;
