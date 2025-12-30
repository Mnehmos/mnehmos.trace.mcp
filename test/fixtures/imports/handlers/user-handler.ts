/**
 * User handler for testing relative import resolution.
 * Imports from ../types (parent directory reference).
 */

import { User, UserRole, UserSummary, ApiResponse } from '../types';

/**
 * Input for creating a new user
 */
export interface CreateUserInput {
  name: string;
  email: string;
  role?: UserRole;
}

/**
 * Input for updating an existing user
 */
export interface UpdateUserInput {
  id: string;
  name?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

/**
 * Response type for user operations
 */
export type UserResponse = ApiResponse<User>;

/**
 * Response type for user list operations
 */
export type UserListResponse = ApiResponse<UserSummary[]>;

/**
 * User handler with CRUD operations
 */
export interface UserHandler {
  /**
   * Create a new user
   */
  create(input: CreateUserInput): Promise<UserResponse>;
  
  /**
   * Get a user by ID
   */
  get(id: string): Promise<UserResponse>;
  
  /**
   * Update an existing user
   */
  update(input: UpdateUserInput): Promise<UserResponse>;
  
  /**
   * Delete a user
   */
  delete(id: string): Promise<ApiResponse<void>>;
  
  /**
   * List all users
   */
  list(): Promise<UserListResponse>;
}
