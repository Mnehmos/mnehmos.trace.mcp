/**
 * Test fixtures for type inference patterns in HTTP client calls
 * 
 * These fixtures cover all the ways types can be inferred from HTTP client usage:
 * - Generic type parameters
 * - Variable annotations
 * - Type assertions (as, angle bracket)
 * - Function return types
 * - Property access inference
 * 
 * Used by test/http-client-tracing.test.ts
 */

import axios, { AxiosResponse } from 'axios';

// ============================================================================
// Type definitions for testing
// ============================================================================

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  profile: {
    avatar: string;
    bio: string;
    settings: {
      theme: 'light' | 'dark';
      notifications: boolean;
    };
  };
}

interface Post {
  id: string;
  title: string;
  content: string;
  author: User;
  tags: string[];
  metadata: {
    views: number;
    likes: number;
    createdAt: string;
  };
}

interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
}

interface CreateUserResponse {
  user: User;
  token: string;
  expiresAt: number;
}

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string>;
}

type UserRole = 'admin' | 'user' | 'guest';

// ============================================================================
// Generic Type Parameter Patterns (axios.get<T>())
// ============================================================================

// Single generic type parameter
async function getWithGeneric() {
  const { data } = await axios.get<User>('/api/users/1');
  return data;
}

// Generic with array type
async function getArrayWithGeneric() {
  const { data } = await axios.get<User[]>('/api/users');
  return data;
}

// Generic with nested type
async function getPaginatedWithGeneric() {
  const { data } = await axios.get<PaginatedResponse<User>>('/api/users?page=1');
  return data;
}

// Generic POST with response type
async function postWithResponseGeneric() {
  const { data } = await axios.post<CreateUserResponse>('/api/users', {
    name: 'John',
    email: 'john@example.com',
    password: 'secret'
  });
  return data;
}

// Multiple generics on axios methods (AxiosResponse<T, D>)
async function postWithMultipleGenerics() {
  const response = await axios.post<
    CreateUserResponse,
    AxiosResponse<CreateUserResponse>,
    CreateUserRequest
  >('/api/users', { name: 'John', email: 'john@example.com', password: 'secret' });
  return response.data;
}

// Generic with union type
async function getWithUnionGeneric() {
  const { data } = await axios.get<User | ApiError>('/api/users/1');
  return data;
}

// Generic with inline object type
async function getWithInlineGeneric() {
  const { data } = await axios.get<{ id: string; status: 'active' | 'inactive' }>('/api/status');
  return data;
}

// ============================================================================
// Variable Type Annotation Patterns
// ============================================================================

// Variable with type annotation
async function fetchWithVariableAnnotation() {
  const user: User = await fetch('/api/users/1').then(r => r.json());
  return user;
}

// Variable with array type annotation
async function fetchArrayWithAnnotation() {
  const users: User[] = await fetch('/api/users').then(r => r.json());
  return users;
}

// Variable with complex type annotation
async function fetchComplexWithAnnotation() {
  const response: PaginatedResponse<Post> = await fetch('/api/posts').then(r => r.json());
  return response;
}

// AxiosResponse annotation
async function axiosWithResponseAnnotation() {
  const response: AxiosResponse<User> = await axios.get('/api/users/1');
  return response.data;
}

// Destructured with annotation
async function fetchWithDestructuredAnnotation() {
  const { data }: { data: User } = await axios.get('/api/users/1');
  return data;
}

// Let declaration with annotation
async function fetchWithLetAnnotation() {
  let user: User;
  user = await fetch('/api/users/1').then(r => r.json());
  return user;
}

// ============================================================================
// Type Assertion Patterns ('as' and angle bracket)
// ============================================================================

// 'as' type assertion
async function fetchWithAsAssertion() {
  const user = await fetch('/api/users/1').then(r => r.json()) as User;
  return user;
}

// 'as' assertion on axios response
async function axiosWithAsAssertion() {
  const response = await axios.get('/api/users/1');
  const user = response.data as User;
  return user;
}

// Nested 'as' assertion in chain
async function fetchWithNestedAsAssertion() {
  const user = await fetch('/api/users/1')
    .then(r => r.json())
    .then(data => data as User);
  return user;
}

// 'as const' assertion (for literal types)
async function fetchWithAsConst() {
  const config = { method: 'GET' as const, url: '/api/users' };
  const response = await fetch(config.url);
  return response.json();
}

// Double assertion pattern
async function fetchWithDoubleAssertion() {
  const data = await fetch('/api/users/1').then(r => r.json());
  const user = data as unknown as User;
  return user;
}

// 'as' with array
async function fetchArrayWithAsAssertion() {
  const users = await fetch('/api/users').then(r => r.json()) as User[];
  return users;
}

// ============================================================================
// Function Return Type Annotation Patterns
// ============================================================================

// Promise<T> return type
async function getUserWithReturnType(): Promise<User> {
  return fetch('/api/users/1').then(r => r.json());
}

// Promise<T[]> return type
async function getUsersWithReturnType(): Promise<User[]> {
  return fetch('/api/users').then(r => r.json());
}

// Promise with complex return type
async function getPaginatedWithReturnType(): Promise<PaginatedResponse<User>> {
  const { data } = await axios.get('/api/users');
  return data;
}

// Arrow function with return type
const getUser: () => Promise<User> = async () => {
  return fetch('/api/users/1').then(r => r.json());
};

// Function type annotation
type GetUserFn = (id: string) => Promise<User>;
const fetchUser: GetUserFn = async (id) => {
  return fetch(`/api/users/${id}`).then(r => r.json());
};

// Method return type
class UserService {
  async getUser(id: string): Promise<User> {
    return fetch(`/api/users/${id}`).then(r => r.json());
  }

  async getUsers(): Promise<User[]> {
    return fetch('/api/users').then(r => r.json());
  }
}

// Generic function return type
async function getResource<T>(url: string): Promise<T> {
  return fetch(url).then(r => r.json());
}

// ============================================================================
// Property Access Inference (no explicit types, infer from usage)
// ============================================================================

// Access properties on untyped response
async function inferFromPropertyAccess() {
  const data = await fetch('/api/users/1').then(r => r.json());
  
  // These accesses infer expected properties
  console.log(data.id);
  console.log(data.name);
  console.log(data.email);
  console.log(data.profile.avatar);
  console.log(data.profile.settings.theme);
  
  return data;
}

// Access properties in .then callback
function inferFromThenCallback() {
  fetch('/api/posts/1')
    .then(r => r.json())
    .then(post => {
      // Infer from these accesses
      console.log(post.title);
      console.log(post.content);
      console.log(post.author.name);
      console.log(post.tags[0]);
      console.log(post.metadata.views);
    });
}

// Access array elements
async function inferFromArrayAccess() {
  const data = await fetch('/api/users').then(r => r.json());
  
  // Infer array with element properties
  console.log(data[0].id);
  console.log(data[0].name);
  console.log(data.length);
  
  data.forEach((user: any) => {
    console.log(user.email);
  });
  
  return data;
}

// Method calls that reveal type
async function inferFromMethodCalls() {
  const response = await fetch('/api/users').then(r => r.json());
  
  // Array methods reveal this is an array
  const names = response.map((u: any) => u.name);
  const admins = response.filter((u: any) => u.role === 'admin');
  const first = response.find((u: any) => u.id === '1');
  
  return { names, admins, first };
}

// Destructuring reveals properties
async function inferFromDestructuring() {
  const { id, name, email, profile } = await fetch('/api/users/1').then(r => r.json());
  
  // Further destructuring
  const { avatar, settings: { theme } } = profile;
  
  return { id, name, email, avatar, theme };
}

// ============================================================================
// Combined Inference Patterns
// ============================================================================

// Generic + property access
async function combinedGenericAndAccess() {
  const { data } = await axios.get<User>('/api/users/1');
  console.log(data.name);  // Already typed, but also tracked
  console.log(data.profile.avatar);
  return data;
}

// Variable annotation + assertion
async function combinedAnnotationAndAssertion() {
  const data: User = await fetch('/api/users/1').then(r => r.json()) as User;
  return data;
}

// Return type + generic
async function combinedReturnAndGeneric(): Promise<User> {
  const { data } = await axios.get<User>('/api/users/1');
  return data;
}

// ============================================================================
// Edge Cases
// ============================================================================

// Any type (no inference possible)
async function fetchWithAny() {
  const data: any = await fetch('/api/unknown').then(r => r.json());
  return data;
}

// Unknown type
async function fetchWithUnknown() {
  const data: unknown = await fetch('/api/unknown').then(r => r.json());
  return data;
}

// Type predicate function
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && obj !== null && 'id' in obj;
}

async function fetchWithTypePredicate() {
  const data = await fetch('/api/users/1').then(r => r.json());
  if (isUser(data)) {
    return data;  // Now typed as User
  }
  throw new Error('Invalid user data');
}

// Conditional type based on status
async function fetchWithConditionalType(url: string) {
  const response = await fetch(url);
  if (response.ok) {
    const data = await response.json() as User;
    return data;
  } else {
    const error = await response.json() as ApiError;
    throw error;
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  // Generic patterns
  getWithGeneric,
  getArrayWithGeneric,
  getPaginatedWithGeneric,
  postWithResponseGeneric,
  postWithMultipleGenerics,
  getWithUnionGeneric,
  getWithInlineGeneric,
  
  // Variable annotation patterns
  fetchWithVariableAnnotation,
  fetchArrayWithAnnotation,
  fetchComplexWithAnnotation,
  axiosWithResponseAnnotation,
  fetchWithDestructuredAnnotation,
  fetchWithLetAnnotation,
  
  // Type assertion patterns
  fetchWithAsAssertion,
  axiosWithAsAssertion,
  fetchWithNestedAsAssertion,
  fetchWithAsConst,
  fetchWithDoubleAssertion,
  fetchArrayWithAsAssertion,
  
  // Return type patterns
  getUserWithReturnType,
  getUsersWithReturnType,
  getPaginatedWithReturnType,
  getUser,
  fetchUser,
  UserService,
  getResource,
  
  // Property access patterns
  inferFromPropertyAccess,
  inferFromThenCallback,
  inferFromArrayAccess,
  inferFromMethodCalls,
  inferFromDestructuring,
  
  // Combined patterns
  combinedGenericAndAccess,
  combinedAnnotationAndAssertion,
  combinedReturnAndGeneric,
  
  // Edge cases
  fetchWithAny,
  fetchWithUnknown,
  isUser,
  fetchWithTypePredicate,
  fetchWithConditionalType,
};
