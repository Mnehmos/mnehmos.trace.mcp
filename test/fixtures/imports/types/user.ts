/**
 * User interface for testing import resolution.
 * This file serves as the base type definition imported by other files.
 */

/**
 * Represents a user in the system
 */
export interface User {
  /** Unique user identifier */
  id: string;
  
  /** User's display name */
  name: string;
  
  /** User's email address (optional) */
  email?: string;
  
  /** Whether the user is active */
  isActive: boolean;
  
  /** User's role in the system */
  role: UserRole;
}

/**
 * Available user roles
 */
export type UserRole = 'admin' | 'user' | 'guest';

/**
 * A minimal user representation
 */
export type UserSummary = Pick<User, 'id' | 'name'>;

/**
 * User with timestamp metadata
 */
export interface UserWithTimestamps extends User {
  createdAt: Date;
  updatedAt: Date;
}

// Internal type - NOT exported (for testing export-only behavior)
interface InternalUserData {
  passwordHash: string;
  salt: string;
}
