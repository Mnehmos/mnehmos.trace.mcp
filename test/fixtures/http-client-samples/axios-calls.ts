/**
 * Test fixtures for Axios HTTP client pattern detection
 * 
 * These fixtures cover various axios call patterns for HTTP client tracing.
 * Used by test/http-client-tracing.test.ts
 */

import axios, { AxiosResponse } from 'axios';

// Types for testing type inference
interface User {
  id: string;
  name: string;
  email: string;
  profile?: { avatar: string; bio: string };
}

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
}

interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
}

interface CreateUserResponse {
  id: string;
  success: boolean;
  user: User;
}

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  total: number;
  hasNext: boolean;
}

interface Order {
  id: string;
  total: number;
  items: { productId: string; quantity: number }[];
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface Profile {
  userId: string;
  displayName: string;
  preferences: { theme: string; notifications: boolean };
}

// ============================================================================
// Basic axios shorthand methods
// ============================================================================

// Basic axios.get()
async function basicGet() {
  const response = await axios.get('/api/users');
  return response.data;
}

// axios.get() with destructured data
async function getWithDestructure() {
  const { data } = await axios.get('/api/users');
  return data;
}

// axios.post()
async function basicPost() {
  const response = await axios.post('/api/users', {
    name: 'John',
    email: 'john@example.com'
  });
  return response.data;
}

// axios.put()
async function basicPut(id: string) {
  const response = await axios.put(`/api/users/${id}`, {
    name: 'Updated Name'
  });
  return response.data;
}

// axios.delete()
async function basicDelete(id: string) {
  const response = await axios.delete(`/api/users/${id}`);
  return response.data;
}

// axios.patch()
async function basicPatch(id: string) {
  const response = await axios.patch(`/api/users/${id}`, {
    active: true
  });
  return response.data;
}

// axios.head()
async function basicHead() {
  const response = await axios.head('/api/health');
  return response.headers;
}

// axios.options()
async function basicOptions() {
  const response = await axios.options('/api/cors-test');
  return response.headers;
}

// axios.request()
async function basicRequest() {
  const response = await axios.request({
    method: 'get',
    url: '/api/data'
  });
  return response.data;
}

// ============================================================================
// Type parameter patterns (Primary type inference source)
// ============================================================================

// axios.get<T>() - Single type parameter
async function getWithType() {
  const { data: user } = await axios.get<User>('/api/users/1');
  return user;
}

// axios.get<T>() with response destructure
async function getTypedUsers() {
  const { data: users } = await axios.get<User[]>('/api/users');
  return users;
}

// axios.post<T, R>() - Response and Request types
async function postWithTypes() {
  const { data } = await axios.post<CreateUserResponse, AxiosResponse<CreateUserResponse>, CreateUserRequest>(
    '/api/users',
    { name: 'John', email: 'john@example.com', password: 'secret123' }
  );
  return data;
}

// axios.put<T>() with type
async function putWithType(id: string) {
  const { data } = await axios.put<User>(`/api/users/${id}`, {
    name: 'Updated'
  });
  return data;
}

// axios.delete<T>()
async function deleteWithType(id: string) {
  const { data } = await axios.delete<{ success: boolean }>(`/api/users/${id}`);
  return data.success;
}

// Generic response type
async function getPaginated<T>(endpoint: string, page: number) {
  const { data } = await axios.get<PaginatedResponse<T>>(`${endpoint}?page=${page}`);
  return data;
}

// ============================================================================
// Template literal URL patterns
// ============================================================================

// Simple template literal
async function getUserById(userId: string) {
  const { data } = await axios.get<User>(`/api/users/${userId}`);
  return data;
}

// Multiple template variables
async function getUserPost(userId: string, postId: string) {
  const { data } = await axios.get<Post>(`/api/users/${userId}/posts/${postId}`);
  return data;
}

// Template with query params
async function searchUsers(query: string, page: number) {
  const { data } = await axios.get<User[]>(`/api/users/search?q=${query}&page=${page}`);
  return data;
}

// Template with object property
async function fetchUserPosts(user: User) {
  const { data } = await axios.get<Post[]>(`/api/users/${user.id}/posts`);
  return data;
}

// ============================================================================
// Direct axios() call with config object
// ============================================================================

// axios() with method and url in config
async function axiosDirectCall() {
  const response = await axios({
    method: 'get',
    url: '/api/users'
  });
  return response.data;
}

// axios() with POST and data
async function axiosDirectPost() {
  const response = await axios({
    method: 'post',
    url: '/api/users',
    data: { name: 'John', email: 'john@example.com' }
  });
  return response.data;
}

// axios() with baseURL in config
async function axiosWithBaseURL() {
  const response = await axios({
    baseURL: 'https://api.example.com',
    url: '/users',
    method: 'get'
  });
  return response.data;
}

// axios() with type parameter
async function axiosDirectWithType() {
  const response = await axios<User>({
    method: 'get',
    url: '/api/users/1'
  });
  return response.data;
}

// axios() with full config
async function axiosFullConfig() {
  const response = await axios({
    method: 'post',
    url: '/api/data',
    data: { key: 'value' },
    headers: {
      'Content-Type': 'application/json',
      'X-Custom-Header': 'custom'
    },
    timeout: 5000,
    params: { filter: 'active' }
  });
  return response.data;
}

// ============================================================================
// Property access patterns on response.data
// ============================================================================

// Direct property access on data
async function accessDataProperty() {
  const { data } = await axios.get<User>('/api/users/1');
  console.log(data.name);
  console.log(data.email);
  return data;
}

// Nested property access
async function accessNestedProperty() {
  const { data } = await axios.get<User>('/api/users/1');
  console.log(data.profile?.avatar);
  console.log(data.profile?.bio);
  return data;
}

// Array property access
async function accessArrayProperty() {
  const { data: orders } = await axios.get<Order[]>('/api/orders');
  console.log(orders[0].total);
  console.log(orders[0].items.length);
  console.log(orders[0].items[0].productId);
  return orders;
}

// Chained access from response
async function accessFromResponse() {
  const response = await axios.get<User>('/api/users/1');
  console.log(response.data.name);
  console.log(response.data.profile?.avatar);
  console.log(response.status);
  return response.data;
}

// ============================================================================
// Headers and config patterns
// ============================================================================

// With Authorization header
async function getWithAuth(token: string) {
  const { data } = await axios.get<User>('/api/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return data;
}

// With custom headers
async function getWithCustomHeaders() {
  const { data } = await axios.get('/api/data', {
    headers: {
      'X-Custom-Header': 'value',
      'Accept': 'application/json',
      'X-Request-ID': '12345'
    }
  });
  return data;
}

// With timeout
async function getWithTimeout() {
  const { data } = await axios.get('/api/slow', {
    timeout: 10000
  });
  return data;
}

// With params
async function getWithParams() {
  const { data } = await axios.get<User[]>('/api/users', {
    params: {
      page: 1,
      limit: 10,
      sort: 'name'
    }
  });
  return data;
}

// ============================================================================
// Variable type annotation patterns
// ============================================================================

// Variable annotation with AxiosResponse
async function getWithVariableAnnotation() {
  const response: AxiosResponse<User> = await axios.get('/api/users/1');
  return response.data;
}

// Variable annotation with User type
async function getWithDataAnnotation() {
  const { data }: { data: User[] } = await axios.get('/api/users');
  return data;
}

// Type assertion
async function getWithTypeAssertion() {
  const response = await axios.get('/api/users/1');
  const user = response.data as User;
  return user;
}

// Return type annotation
async function getUsersWithReturnType(): Promise<User[]> {
  const { data } = await axios.get('/api/users');
  return data;
}

// ============================================================================
// Destructuring patterns
// ============================================================================

// Basic data destructuring
async function basicDestructure() {
  const { data } = await axios.get<User>('/api/users/1');
  return data;
}

// Multiple destructuring from response
async function multipleDestructure() {
  const { data, status, headers } = await axios.get<User>('/api/users/1');
  console.log(status, headers['content-type']);
  return data;
}

// Nested destructuring from data
async function nestedDataDestructure() {
  const { data: { items, page, total } } = await axios.get<PaginatedResponse<User>>('/api/users');
  console.log(page, total);
  return items;
}

// Renamed destructuring
async function renamedDestructure() {
  const { data: users } = await axios.get<User[]>('/api/users');
  return users;
}

// ============================================================================
// Error handling patterns
// ============================================================================

// Try-catch error handling
async function getWithErrorHandling() {
  try {
    const { data } = await axios.get<User>('/api/users/1');
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Axios error:', error.response?.status);
    }
    throw error;
  }
}

// Catch chain
function getWithCatchChain() {
  return axios.get<User>('/api/users/1')
    .then(response => response.data)
    .catch(error => {
      console.error('Error:', error);
      return null;
    });
}

// ============================================================================
// Exports
// ============================================================================

export {
  basicGet,
  getWithDestructure,
  basicPost,
  basicPut,
  basicDelete,
  basicPatch,
  basicHead,
  basicOptions,
  basicRequest,
  getWithType,
  getTypedUsers,
  postWithTypes,
  putWithType,
  deleteWithType,
  getPaginated,
  getUserById,
  getUserPost,
  searchUsers,
  fetchUserPosts,
  axiosDirectCall,
  axiosDirectPost,
  axiosWithBaseURL,
  axiosDirectWithType,
  axiosFullConfig,
  accessDataProperty,
  accessNestedProperty,
  accessArrayProperty,
  accessFromResponse,
  getWithAuth,
  getWithCustomHeaders,
  getWithTimeout,
  getWithParams,
  getWithVariableAnnotation,
  getWithDataAnnotation,
  getWithTypeAssertion,
  getUsersWithReturnType,
  basicDestructure,
  multipleDestructure,
  nestedDataDestructure,
  renamedDestructure,
  getWithErrorHandling,
  getWithCatchChain,
};
