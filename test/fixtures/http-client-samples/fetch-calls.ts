/**
 * Test fixtures for Fetch API pattern detection
 * 
 * These fixtures cover various fetch() call patterns for HTTP client tracing.
 * Used by test/http-client-tracing.test.ts
 */

// Types for testing type inference
interface User {
  id: string;
  name: string;
  email: string;
  posts?: Post[];
}

interface Post {
  id: string;
  title: string;
  content: string;
  author: { name: string; avatar: string };
}

interface CreateResponse {
  id: string;
  success: boolean;
}

interface SearchResult {
  results: User[];
  pagination: { page: number; total: number; hasNext: boolean };
}

// ============================================================================
// Basic fetch() patterns
// ============================================================================

// Basic fetch with string literal URL
async function basicFetch() {
  const response = await fetch('/api/users');
  const data = await response.json();
  return data;
}

// Fetch with static string URL and json()
async function fetchUsers() {
  const users = await fetch('/api/users').then(r => r.json());
  return users;
}

// Fetch with URL variable
async function fetchWithVariable() {
  const API_URL = '/api/users';
  const response = await fetch(API_URL);
  return response.json();
}

// Fetch with POST method
async function createUser() {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'John', email: 'john@example.com' })
  });
  return response.json();
}

// Fetch with PUT method  
async function updateUser(id: string) {
  const response = await fetch(`/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Updated Name' })
  });
  return response.json();
}

// Fetch with DELETE method
async function deleteUser(id: string) {
  const response = await fetch(`/api/users/${id}`, {
    method: 'DELETE'
  });
  return response.ok;
}

// Fetch with PATCH method
async function patchUser(id: string) {
  const response = await fetch(`/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ active: true })
  });
  return response.json();
}

// ============================================================================
// Template literal URL patterns
// ============================================================================

// Simple template literal with single variable
async function fetchUserById(userId: string) {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
}

// Template literal with multiple variables
async function fetchUserPost(userId: string, postId: string) {
  const response = await fetch(`/api/users/${userId}/posts/${postId}`);
  return response.json();
}

// Template literal with expression
async function fetchPagedUsers(page: number, limit: number) {
  const response = await fetch(`/api/users?page=${page}&limit=${limit}`);
  return response.json();
}

// Template literal with object property
async function fetchUserPosts(user: { id: string }) {
  const response = await fetch(`/api/users/${user.id}/posts`);
  return response.json();
}

// ============================================================================
// Type annotation patterns
// ============================================================================

// Variable type annotation
async function fetchTypedUser(id: string) {
  const user: User = await fetch(`/api/users/${id}`).then(r => r.json());
  return user;
}

// Type assertion with 'as'
async function fetchUserWithCast(id: string) {
  const user = await fetch(`/api/users/${id}`).then(r => r.json()) as User;
  return user;
}

// Return type annotation on function
async function getUsers(): Promise<User[]> {
  return fetch('/api/users').then(r => r.json());
}

// Return type with nested Promise
async function getUserById(id: string): Promise<User> {
  return fetch(`/api/users/${id}`).then(r => r.json());
}

// ============================================================================
// Response parsing patterns
// ============================================================================

// .then(r => r.json()) chain
async function fetchWithJsonChain() {
  return fetch('/api/data').then(response => response.json());
}

// .then().then() chain with property access
function fetchWithChainedThen() {
  fetch('/api/posts')
    .then(response => response.json())
    .then(data => {
      console.log(data.posts);
      data.posts.forEach((post: Post) => {
        console.log(post.title);
        console.log(post.author.name);
      });
    });
}

// Await with separate json() call
async function fetchWithSeparateJson() {
  const response = await fetch('/api/users');
  const data = await response.json();
  return data;
}

// Text response parsing
async function fetchText() {
  const response = await fetch('/api/html');
  const html = await response.text();
  return html;
}

// ============================================================================
// Property access patterns
// ============================================================================

// Direct property access
async function fetchAndAccessProperty() {
  const data = await fetch('/api/users').then(r => r.json());
  console.log(data.length);
  console.log(data[0].name);
  console.log(data[0].email);
}

// Nested property access
async function fetchAndAccessNested() {
  const result = await fetch('/api/search').then(r => r.json());
  console.log(result.user.profile.avatar);
  console.log(result.user.settings.theme);
}

// Array index access
async function fetchAndAccessArray() {
  const posts = await fetch('/api/posts').then(r => r.json());
  console.log(posts[0].title);
  console.log(posts[0].author.name);
}

// ============================================================================
// Destructuring patterns
// ============================================================================

// Object destructuring from response
async function fetchWithDestructuring() {
  const { results, pagination } = await fetch('/api/search?q=test')
    .then(r => r.json());
  console.log(results[0].name);
  console.log(pagination.page);
  console.log(pagination.total);
}

// Nested destructuring
async function fetchWithNestedDestructuring() {
  const { user: { name, email }, posts } = await fetch('/api/profile')
    .then(r => r.json());
  console.log(name, email, posts);
}

// Array destructuring
async function fetchWithArrayDestructuring() {
  const [first, second, ...rest] = await fetch('/api/items')
    .then(r => r.json());
  console.log(first.id, second.id, rest.length);
}

// ============================================================================
// Headers and options patterns
// ============================================================================

// Fetch with Authorization header
async function fetchWithAuth(token: string) {
  const response = await fetch('/api/protected', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
}

// Fetch with custom headers
async function fetchWithCustomHeaders() {
  const response = await fetch('/api/data', {
    headers: {
      'X-Custom-Header': 'custom-value',
      'Accept': 'application/json',
      'X-Request-ID': crypto.randomUUID()
    }
  });
  return response.json();
}

// Fetch with credentials
async function fetchWithCredentials() {
  const response = await fetch('/api/session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'user', password: 'pass' })
  });
  return response.json();
}

// ============================================================================
// Request body patterns
// ============================================================================

// JSON.stringify body
async function fetchWithJsonBody() {
  const userData = { name: 'John', email: 'john@example.com' };
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  return response.json();
}

// FormData body
async function fetchWithFormData(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', 'upload');
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  return response.json();
}

// URLSearchParams body
async function fetchWithURLSearchParams() {
  const params = new URLSearchParams();
  params.append('query', 'search term');
  params.append('page', '1');
  
  const response = await fetch('/api/search', {
    method: 'POST',
    body: params
  });
  return response.json();
}

// ============================================================================
// URL construction patterns
// ============================================================================

// URL concatenation
async function fetchWithConcatenation(baseUrl: string) {
  const response = await fetch(baseUrl + '/users');
  return response.json();
}

// URL object construction
async function fetchWithURLObject() {
  const url = new URL('/api/search', window.location.origin);
  url.searchParams.set('q', 'test');
  url.searchParams.set('limit', '10');
  
  const response = await fetch(url.toString());
  return response.json();
}

// Base URL composition
const BASE_URL = '/api/v2';
async function fetchWithBaseUrl() {
  const response = await fetch(`${BASE_URL}/users`);
  return response.json();
}

// ============================================================================
// Error handling patterns (still traceable)
// ============================================================================

// try-catch with fetch
async function fetchWithErrorHandling() {
  try {
    const response = await fetch('/api/users');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

// Catch chain
function fetchWithCatchChain() {
  return fetch('/api/users')
    .then(r => r.json())
    .catch(error => {
      console.error('Error:', error);
      return [];
    });
}

// ============================================================================
// Wrapper function patterns
// ============================================================================

// Custom fetch wrapper
async function apiFetch(endpoint: string, options?: RequestInit) {
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });
  return response.json();
}

// Auth fetch wrapper
async function authFetch(url: string) {
  const token = localStorage.getItem('token');
  return fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
}

// Using wrapper
async function useWrapper() {
  const users = await apiFetch('/users');
  const user = await apiFetch('/users/1');
  return { users, user };
}

export {
  basicFetch,
  fetchUsers,
  fetchWithVariable,
  createUser,
  updateUser,
  deleteUser,
  patchUser,
  fetchUserById,
  fetchUserPost,
  fetchPagedUsers,
  fetchUserPosts,
  fetchTypedUser,
  fetchUserWithCast,
  getUsers,
  getUserById,
  fetchWithJsonChain,
  fetchWithChainedThen,
  fetchWithSeparateJson,
  fetchText,
  fetchAndAccessProperty,
  fetchAndAccessNested,
  fetchAndAccessArray,
  fetchWithDestructuring,
  fetchWithNestedDestructuring,
  fetchWithArrayDestructuring,
  fetchWithAuth,
  fetchWithCustomHeaders,
  fetchWithCredentials,
  fetchWithJsonBody,
  fetchWithFormData,
  fetchWithURLSearchParams,
  fetchWithConcatenation,
  fetchWithURLObject,
  fetchWithBaseUrl,
  fetchWithErrorHandling,
  fetchWithCatchChain,
  apiFetch,
  authFetch,
  useWrapper,
};
