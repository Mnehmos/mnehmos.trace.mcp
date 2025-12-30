/**
 * Express Router Fixture
 * 
 * Sample Express Router module demonstrating modular route definitions.
 * Tests router-specific patterns for REST endpoint detection.
 * 
 * Patterns tested:
 * - express.Router() creation
 * - router.METHOD() patterns
 * - Router with prefix mounting
 * - Nested routers
 * - Router-level middleware
 */

import express from 'express';
import { z } from 'zod';
import Joi from 'joi';
import { celebrate, Segments } from 'celebrate';

// Type declarations for demonstration (not runtime)
type Request = any;
type Response = any;
type NextFunction = any;

// ============================================================================
// User Router - Basic router.METHOD() patterns
// ============================================================================

const userRouter = express.Router();

// GET - List users
userRouter.get('/', (req: Request, res: Response) => {
  res.json({ users: [] });
});

// GET - Get user by ID
userRouter.get('/:id', (req: Request, res: Response) => {
  res.json({ id: req.params.id });
});

// POST - Create user
userRouter.post('/', (req: Request, res: Response) => {
  res.status(201).json(req.body);
});

// PUT - Update user
userRouter.put('/:id', (req: Request, res: Response) => {
  res.json({ id: req.params.id, ...req.body });
});

// DELETE - Delete user
userRouter.delete('/:id', (req: Request, res: Response) => {
  res.status(204).send();
});

// PATCH - Partial update
userRouter.patch('/:id', (req: Request, res: Response) => {
  res.json({ id: req.params.id, ...req.body });
});

// ============================================================================
// Posts Router - Nested under users
// ============================================================================

const postsRouter = express.Router({ mergeParams: true });

// GET - List posts for user
postsRouter.get('/', (req: Request, res: Response) => {
  const { userId } = req.params;
  res.json({ userId, posts: [] });
});

// GET - Get specific post
postsRouter.get('/:postId', (req: Request, res: Response) => {
  const { userId, postId } = req.params;
  res.json({ userId, postId });
});

// POST - Create post for user
postsRouter.post('/', (req: Request, res: Response) => {
  const { userId } = req.params;
  res.status(201).json({ userId, ...req.body });
});

// Mount posts router under user router
userRouter.use('/:userId/posts', postsRouter);

// ============================================================================
// API Router - With Zod validation middleware
// ============================================================================

const apiRouter = express.Router();

// Zod schemas for validation
const CreateItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  price: z.number().positive(),
  quantity: z.number().int().nonnegative(),
});

const UpdateItemSchema = CreateItemSchema.partial();

const ItemQuerySchema = z.object({
  category: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  inStock: z.coerce.boolean().optional(),
});

// Mock Zod validation middleware
function zodValidate<T>(schema: z.ZodType<T>, target: 'body' | 'query' | 'params') {
  return (req: Request, res: Response, next: NextFunction) => {
    next();
  };
}

// GET - List items with query validation
apiRouter.get('/items',
  zodValidate(ItemQuerySchema, 'query'),
  (req: Request, res: Response) => {
    res.json({ items: [] });
  }
);

// POST - Create item with body validation
apiRouter.post('/items',
  zodValidate(CreateItemSchema, 'body'),
  (req: Request, res: Response) => {
    res.status(201).json(req.body);
  }
);

// PUT - Update item with body validation
apiRouter.put('/items/:id',
  zodValidate(UpdateItemSchema, 'body'),
  (req: Request, res: Response) => {
    res.json({ id: req.params.id, ...req.body });
  }
);

// ============================================================================
// Admin Router - With Joi/Celebrate validation
// ============================================================================

const adminRouter = express.Router();

// Joi schemas
const CreateAdminSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  role: Joi.string().valid('admin', 'superadmin').required(),
});

const UpdateAdminSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30),
  email: Joi.string().email(),
  role: Joi.string().valid('admin', 'superadmin'),
}).min(1);

// POST - Create admin with celebrate validation
adminRouter.post('/admins',
  celebrate({
    [Segments.BODY]: CreateAdminSchema,
  }),
  (req: Request, res: Response) => {
    res.status(201).json(req.body);
  }
);

// PUT - Update admin with celebrate validation
adminRouter.put('/admins/:id',
  celebrate({
    [Segments.BODY]: UpdateAdminSchema,
    [Segments.PARAMS]: Joi.object({
      id: Joi.string().uuid().required(),
    }),
  }),
  (req: Request, res: Response) => {
    res.json({ id: req.params.id, ...req.body });
  }
);

// GET - Admin with query validation
adminRouter.get('/admins',
  celebrate({
    [Segments.QUERY]: Joi.object({
      role: Joi.string().valid('admin', 'superadmin'),
      active: Joi.boolean(),
      page: Joi.number().integer().min(1),
      limit: Joi.number().integer().min(1).max(100),
    }),
  }),
  (req: Request, res: Response) => {
    res.json({ admins: [] });
  }
);

// ============================================================================
// Auth Router - Multiple middleware chain
// ============================================================================

const authRouter = express.Router();

// Middleware
function logRequest(req: Request, res: Response, next: NextFunction) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
}

function checkApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  next();
}

function rateLimit(limit: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    next();
  };
}

// Apply router-level middleware
authRouter.use(logRequest);
authRouter.use(checkApiKey);

// POST - Login
authRouter.post('/login',
  rateLimit(5),
  (req: Request, res: Response) => {
    res.json({ token: 'jwt-token' });
  }
);

// POST - Refresh token
authRouter.post('/refresh',
  rateLimit(10),
  (req: Request, res: Response) => {
    res.json({ token: 'new-jwt-token' });
  }
);

// POST - Logout
authRouter.post('/logout', (req: Request, res: Response) => {
  res.status(204).send();
});

// ============================================================================
// Comments Router - Route chaining with router.route()
// ============================================================================

const commentsRouter = express.Router();

commentsRouter.route('/')
  .get((req: Request, res: Response) => {
    res.json({ comments: [] });
  })
  .post((req: Request, res: Response) => {
    res.status(201).json(req.body);
  });

commentsRouter.route('/:id')
  .get((req: Request, res: Response) => {
    res.json({ id: req.params.id });
  })
  .put((req: Request, res: Response) => {
    res.json({ id: req.params.id, ...req.body });
  })
  .patch((req: Request, res: Response) => {
    res.json({ id: req.params.id, ...req.body });
  })
  .delete((req: Request, res: Response) => {
    res.status(204).send();
  });

// ============================================================================
// Complex Path Parameters Router
// ============================================================================

const pathParamsRouter = express.Router();

// Simple parameter
pathParamsRouter.get('/simple/:id', (req: Request, res: Response) => {
  res.json({ id: req.params.id });
});

// Multiple parameters
pathParamsRouter.get('/multi/:first/:second/:third', (req: Request, res: Response) => {
  res.json(req.params);
});

// Optional parameter
pathParamsRouter.get('/optional/:id?', (req: Request, res: Response) => {
  res.json({ id: req.params.id || 'default' });
});

// Numeric constraint
pathParamsRouter.get('/numeric/:num(\\d+)', (req: Request, res: Response) => {
  res.json({ num: parseInt(req.params.num, 10) });
});

// Alphanumeric constraint
pathParamsRouter.get('/alpha/:code([a-zA-Z]+)', (req: Request, res: Response) => {
  res.json({ code: req.params.code });
});

// Complex regex
pathParamsRouter.get('/date/:year(\\d{4})-:month(\\d{2})-:day(\\d{2})', (req: Request, res: Response) => {
  res.json({
    year: req.params.year,
    month: req.params.month,
    day: req.params.day,
  });
});

// ============================================================================
// Exports
// ============================================================================

export { userRouter };
export { postsRouter };
export { apiRouter };
export { adminRouter };
export { authRouter };
export { commentsRouter };
export { pathParamsRouter };
export default userRouter;
