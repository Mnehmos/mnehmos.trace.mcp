/**
 * Barrel file for types module.
 * Tests re-export chain resolution.
 */

// Star re-exports - exports all from user.ts
export * from './user';

// Star re-exports - exports all from order.ts
export * from './order';

// Named re-export with alias
export { User as AppUser } from './user';

// Default re-export pattern (for testing)
export { Order as default } from './order';

// Local type that combines imported types
export interface ApiResponse<T> {
  data: T;
  status: 'success' | 'error';
  timestamp: Date;
}
