/**
 * Test fixtures for Axios instance patterns with baseURL
 * 
 * These fixtures cover axios.create() patterns and baseURL resolution.
 * Used by test/http-client-tracing.test.ts
 */

import axios from 'axios';

// Types for testing
interface User {
  id: string;
  name: string;
  email: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface Profile {
  userId: string;
  displayName: string;
  settings: { theme: string; language: string };
}

// ============================================================================
// Basic axios.create() patterns
// ============================================================================

// Simple instance with baseURL
const api = axios.create({
  baseURL: '/api'
});

// Using the instance - should resolve to /api/users
async function getUsers() {
  const { data } = await api.get<User[]>('/users');
  return data;
}

// Instance method with path params - should resolve to /api/users/:id
async function getUserById(id: string) {
  const { data } = await api.get<User>(`/users/${id}`);
  return data;
}

// Instance POST
async function createUser(userData: { name: string; email: string }) {
  const { data } = await api.post<User>('/users', userData);
  return data;
}

// Instance PUT
async function updateUser(id: string, userData: { name: string }) {
  const { data } = await api.put<User>(`/users/${id}`, userData);
  return data;
}

// Instance DELETE
async function deleteUser(id: string) {
  const { data } = await api.delete<{ success: boolean }>(`/users/${id}`);
  return data;
}

// ============================================================================
// Full baseURL with protocol
// ============================================================================

const externalApi = axios.create({
  baseURL: 'https://api.example.com/v1'
});

// Should resolve to https://api.example.com/v1/users
async function getExternalUsers() {
  const { data } = await externalApi.get<User[]>('/users');
  return data;
}

// Should resolve to https://api.example.com/v1/posts/123
async function getExternalPost(postId: string) {
  const { data } = await externalApi.get<Post>(`/posts/${postId}`);
  return data;
}

// ============================================================================
// Multiple instances for different APIs
// ============================================================================

const authApi = axios.create({
  baseURL: '/auth'
});

const dataApi = axios.create({
  baseURL: '/data'
});

const adminApi = axios.create({
  baseURL: '/admin/v2'
});

// Auth API - should resolve to /auth/login
async function login(credentials: { username: string; password: string }) {
  const { data } = await authApi.post<TokenResponse>('/login', credentials);
  return data;
}

// Auth API - should resolve to /auth/refresh
async function refreshToken(token: string) {
  const { data } = await authApi.post<TokenResponse>('/refresh', { token });
  return data;
}

// Data API - should resolve to /data/profile
async function getProfile() {
  const { data } = await dataApi.get<Profile>('/profile');
  return data;
}

// Data API - should resolve to /data/posts
async function getPosts() {
  const { data } = await dataApi.get<Post[]>('/posts');
  return data;
}

// Admin API - should resolve to /admin/v2/users
async function getAdminUsers() {
  const { data } = await adminApi.get<User[]>('/users');
  return data;
}

// ============================================================================
// Instance with default headers
// ============================================================================

const authenticatedApi = axios.create({
  baseURL: '/api/v2',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

async function getAuthenticatedUsers() {
  const { data } = await authenticatedApi.get<User[]>('/users');
  return data;
}

// ============================================================================
// Instance with timeout
// ============================================================================

const slowApi = axios.create({
  baseURL: '/api/slow',
  timeout: 30000
});

async function getSlowData() {
  const { data } = await slowApi.get('/data');
  return data;
}

// ============================================================================
// Instance with interceptors (runtime patterns - harder to trace)
// ============================================================================

const interceptedApi = axios.create({
  baseURL: '/api/intercepted'
});

interceptedApi.interceptors.request.use(config => {
  config.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;
  return config;
});

interceptedApi.interceptors.response.use(
  response => response,
  error => Promise.reject(error)
);

async function getInterceptedData() {
  const { data } = await interceptedApi.get<User>('/me');
  return data;
}

// ============================================================================
// Dynamic instance creation
// ============================================================================

function createApiClient(baseURL: string) {
  return axios.create({ baseURL });
}

// Usage with dynamic instance
const dynamicApi = createApiClient('/api/dynamic');

async function getDynamicUsers() {
  const { data } = await dynamicApi.get<User[]>('/users');
  return data;
}

// ============================================================================
// Instance with named variable patterns
// ============================================================================

// Common naming patterns
const httpClient = axios.create({ baseURL: '/services' });
const client = axios.create({ baseURL: '/client' });
const instance = axios.create({ baseURL: '/instance' });
const axiosInstance = axios.create({ baseURL: '/axios' });
const http = axios.create({ baseURL: '/http' });
const request = axios.create({ baseURL: '/request' });

async function testNamedInstances() {
  await httpClient.get('/test');
  await client.get('/test');
  await instance.get('/test');
  await axiosInstance.get('/test');
  await http.get('/test');
  await request.get('/test');
}

// ============================================================================
// Suffixed API names
// ============================================================================

const userApi = axios.create({ baseURL: '/api/users' });
const postApi = axios.create({ baseURL: '/api/posts' });
const orderApi = axios.create({ baseURL: '/api/orders' });

// Using userApi - should resolve to /api/users/:id
async function getUser(userId: string) {
  const { data } = await userApi.get<User>(`/${userId}`);
  return data;
}

// Using postApi - should resolve to /api/posts/:id
async function getPost(postId: string) {
  const { data } = await postApi.get<Post>(`/${postId}`);
  return data;
}

// ============================================================================
// Instance with overriding config per request
// ============================================================================

const configuredApi = axios.create({
  baseURL: '/api',
  timeout: 5000
});

// Override timeout for specific request
async function getWithOverride() {
  const { data } = await configuredApi.get<User[]>('/users', {
    timeout: 10000,
    headers: { 'X-Custom': 'value' }
  });
  return data;
}

// Override baseURL completely (ignores instance baseURL)
async function getFromDifferentBase() {
  const { data } = await configuredApi.get<User>('/other/endpoint', {
    baseURL: '/different'
  });
  return data;
}

// ============================================================================
// Exports
// ============================================================================

export {
  api,
  externalApi,
  authApi,
  dataApi,
  adminApi,
  authenticatedApi,
  slowApi,
  interceptedApi,
  dynamicApi,
  httpClient,
  client,
  instance,
  axiosInstance,
  http,
  request,
  userApi,
  postApi,
  orderApi,
  configuredApi,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getExternalUsers,
  getExternalPost,
  login,
  refreshToken,
  getProfile,
  getPosts,
  getAdminUsers,
  getAuthenticatedUsers,
  getSlowData,
  getInterceptedData,
  createApiClient,
  getDynamicUsers,
  testNamedInstances,
  getUser,
  getPost,
  getWithOverride,
  getFromDifferentBase,
};
