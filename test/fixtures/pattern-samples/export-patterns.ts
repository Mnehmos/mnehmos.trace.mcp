/**
 * Test Fixtures: Export Patterns
 * 
 * Various exported schema declaration patterns used to test PatternMatcher.
 * These examples represent Zod schemas, TypeBox, and type exports.
 * 
 * Pattern Type: 'export' - Exported declarations like export const schema = ...
 */

import { z } from 'zod';

// ============================================================================
// Zod Schema Exports
// ============================================================================

/**
 * Simple Zod object schema
 * Expected: Match export with name ending in 'Schema'
 */
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Zod schema with inferred type export
 */
export type User = z.infer<typeof UserSchema>;

/**
 * Create DTO schema
 */
export const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  age: z.number().int().positive().optional(),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

/**
 * Update DTO schema (partial)
 */
export const UpdateUserSchema = CreateUserSchema.partial().omit({ password: true });

export type UpdateUser = z.infer<typeof UpdateUserSchema>;

/**
 * Complex nested schema
 */
export const PostSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string(),
  author: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  tags: z.array(z.string()),
  metadata: z.object({
    views: z.number().int().nonnegative(),
    likes: z.number().int().nonnegative(),
    published: z.boolean(),
    publishedAt: z.date().optional(),
  }),
  comments: z.array(
    z.object({
      id: z.string().uuid(),
      text: z.string(),
      authorId: z.string().uuid(),
      createdAt: z.date(),
    })
  ).optional(),
});

export type Post = z.infer<typeof PostSchema>;

/**
 * Schema with refinements
 */
export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain special character');

/**
 * Schema with transform
 */
export const DateStringSchema = z.string().transform((str) => new Date(str));

/**
 * Enum schema
 */
export const UserRoleSchema = z.enum(['admin', 'moderator', 'user', 'guest']);
export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * Union schema
 */
export const ResponseSchema = z.union([
  z.object({ success: z.literal(true), data: z.any() }),
  z.object({ success: z.literal(false), error: z.string() }),
]);

/**
 * Intersection schema
 */
export const TimestampedSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const TimestampedUserSchema = UserSchema.merge(TimestampedSchema);

// ============================================================================
// TypeScript Interface/Type Exports
// ============================================================================

/**
 * Simple interface export
 */
export interface IUser {
  id: string;
  name: string;
  email: string;
  age?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface with index signature
 */
export interface IConfig {
  [key: string]: string | number | boolean;
}

/**
 * Interface extending another
 */
export interface ITimestamped {
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserWithTimestamps extends IUser, ITimestamped {}

/**
 * Type alias export
 */
export type UserId = string;

/**
 * Generic type export
 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Mapped type export
 */
export type Optional<T> = {
  [P in keyof T]?: T[P];
};

/**
 * Conditional type export
 */
export type NonNullableKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? never : K;
}[keyof T];

// ============================================================================
// JSON Schema Exports
// ============================================================================

/**
 * JSON Schema object export
 */
export const userJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', minLength: 1, maxLength: 100 },
    email: { type: 'string', format: 'email' },
    age: { type: 'integer', minimum: 0 },
  },
  required: ['id', 'name', 'email'],
} as const;

/**
 * JSON Schema with definitions/refs
 */
export const apiSchemas = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  definitions: {
    User: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['id', 'name'],
    },
    Post: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        author: { $ref: '#/definitions/User' },
      },
      required: ['id', 'title'],
    },
  },
} as const;

// ============================================================================
// Class Exports (TypeORM/Prisma style)
// ============================================================================

/**
 * Entity class export
 */
export class UserEntity {
  id!: string;
  name!: string;
  email!: string;
  passwordHash!: string;
  age?: number;
  createdAt!: Date;
  updatedAt!: Date;
}

/**
 * DTO class export
 */
export class CreateUserDto {
  name!: string;
  email!: string;
  password!: string;
  age?: number;
}

// ============================================================================
// Default Exports
// ============================================================================

/**
 * Default export schema
 */
const defaultSchema = z.object({
  message: z.string(),
  code: z.number(),
});

export default defaultSchema;

// ============================================================================
// Re-exports
// ============================================================================

// Re-export from zod (pattern should not match these)
export { z };

// Named re-export
export { UserSchema as UserValidationSchema };

// ============================================================================
// Edge Cases
// ============================================================================

// Export without initializer (declaration only)
export let mutableSchema: z.ZodSchema;

// Export with type assertion
export const strictSchema = z.object({
  value: z.string(),
}) as z.ZodObject<{ value: z.ZodString }>;

// Destructured export
const { shape: userShape } = UserSchema;
export { userShape };

// Export from object destructuring
export const { parse: parseUser, safeParse: safeParseUser } = UserSchema;

// Function export that returns schema
export function createSchema<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape);
}

// Arrow function export
export const makeSchema = <T extends z.ZodRawShape>(shape: T) => z.object(shape);

// Namespace export
export namespace Schemas {
  export const User = UserSchema;
  export const Post = PostSchema;
}

// Const assertion export
export const literalSchema = z.literal('specific-value') as const;

// Array schema export
export const StringArraySchema = z.array(z.string());
export const UserArraySchema = z.array(UserSchema);

// Tuple schema export
export const CoordinatesSchema = z.tuple([z.number(), z.number()]);

// Record schema export
export const StringMapSchema = z.record(z.string());
export const UserMapSchema = z.record(UserSchema);

// Nullable/optional variations
export const NullableUserSchema = UserSchema.nullable();
export const OptionalUserSchema = UserSchema.optional();
export const NullishUserSchema = UserSchema.nullish();
