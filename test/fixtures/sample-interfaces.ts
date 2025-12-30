/**
 * Sample TypeScript Interfaces, Types, and Enums
 * Test fixture for TypeScript interface extraction tests
 * 
 * This file contains various TypeScript constructs that should be extracted
 * by the new extractInterfaces() method in TypeScriptParser.
 */

// ============================================================================
// Simple Interfaces with Primitives
// ============================================================================

/**
 * Simple user interface with primitive types
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User's display name */
  name: string;
  /** User's email address (optional) */
  email?: string;
}

/**
 * Interface with readonly property
 */
export interface ImmutableRecord {
  readonly id: string;
  readonly createdAt: Date;
  mutableField: number;
}

/**
 * Interface with nested object property
 */
export interface Profile {
  user: User;
  settings: {
    theme: string;
    notifications: boolean;
  };
}

/**
 * Interface with array properties
 */
export interface Team {
  name: string;
  members: User[];
  tags: string[];
}

// ============================================================================
// Type Aliases
// ============================================================================

/**
 * Simple object type alias
 */
export type Point = {
  x: number;
  y: number;
  z?: number;
};

/**
 * String literal union type
 */
export type Status = 'active' | 'inactive' | 'pending';

/**
 * Type alias for intersection
 */
interface Base {
  id: string;
}

interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

export type Entity = Base & Timestamps;

/**
 * Union of object types
 */
interface SuccessResult {
  success: true;
  data: string;
}

interface ErrorResult {
  success: false;
  error: string;
}

export type Result = SuccessResult | ErrorResult;

// ============================================================================
// Enums
// ============================================================================

/**
 * Numeric enum (default values)
 */
export enum Priority {
  Low = 0,
  Medium = 1,
  High = 2,
}

/**
 * String enum
 */
export enum StatusEnum {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending',
}

// ============================================================================
// Utility Types (for optional testing)
// ============================================================================

/**
 * Full user with all fields
 */
export interface FullUser {
  id: string;
  name: string;
  email: string;
  password: string;
  age: number;
  isAdmin: boolean;
}

/**
 * Pick utility type - only id and name
 */
export type UserSummary = Pick<FullUser, 'id' | 'name'>;

/**
 * Omit utility type - without password
 */
export type SafeUser = Omit<FullUser, 'password'>;

/**
 * Partial utility type - all optional
 */
export type UserUpdate = Partial<FullUser>;

/**
 * Required utility type - all required
 */
export type RequiredUser = Required<{
  id?: string;
  name?: string;
}>;

// ============================================================================
// Record Type
// ============================================================================

/**
 * Record type alias
 */
export type StringMap = Record<string, number>;

/**
 * Record with union keys
 */
export type ConfigMap = Record<'host' | 'port' | 'debug', string>;

// ============================================================================
// Non-Exported (Should NOT be extracted)
// ============================================================================

/**
 * Internal config - NOT exported
 */
interface InternalConfig {
  secret: string;
  internalId: number;
}

/**
 * Internal type - NOT exported
 */
type InternalHelper = {
  helper: boolean;
};

// ============================================================================
// Complex Types
// ============================================================================

/**
 * Generic interface (for future support)
 */
export interface Container<T> {
  value: T;
  isEmpty: boolean;
}

/**
 * Interface extending another
 */
export interface ExtendedUser extends User {
  role: string;
  permissions: string[];
}

/**
 * Nullable property
 */
export interface NullableFields {
  required: string;
  maybeNull: string | null;
  maybeUndefined: string | undefined;
  both: string | null | undefined;
}

/**
 * Deprecated property marker
 */
export interface WithDeprecated {
  current: string;
  /** @deprecated Use current instead */
  legacy?: string;
}

/**
 * Array of various types
 */
export interface ArrayTypes {
  strings: string[];
  numbers: Array<number>;
  readonly readonlyStrings: readonly string[];
  tupleType: [string, number];
  nestedArray: number[][];
}
