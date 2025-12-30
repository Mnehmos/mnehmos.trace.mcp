/**
 * Test fixtures for property access tracking patterns
 * 
 * These fixtures cover all the ways properties can be accessed on HTTP responses:
 * - Direct property access (result.name)
 * - Nested property access (result.user.email)
 * - Destructuring patterns (const { name } = result)
 * - Array access (result.items[0])
 * - Chained access (result.then(r => r.data))
 * - Optional chaining (result?.user?.name)
 * - Bracket notation (result['name'])
 * 
 * Used by test/http-client-tracing.test.ts
 */

import axios from 'axios';

// ============================================================================
// Type definitions
// ============================================================================

interface User {
  id: string;
  name: string;
  email: string;
  profile: {
    avatar: string;
    bio: string;
    settings: {
      theme: 'light' | 'dark';
      notifications: boolean;
      privacy: {
        showEmail: boolean;
        showProfile: boolean;
      };
    };
  };
  friends: User[];
  posts: Post[];
}

interface Post {
  id: string;
  title: string;
  content: string;
  author: { id: string; name: string };
  comments: Comment[];
  tags: string[];
  metadata: {
    views: number;
    likes: number;
    shares: number;
  };
}

interface Comment {
  id: string;
  text: string;
  author: { id: string; name: string };
  replies: Comment[];
}

interface ApiResponse<T> {
  data: T;
  status: 'success' | 'error';
  message?: string;
  pagination?: {
    page: number;
    total: number;
    hasNext: boolean;
  };
}

// ============================================================================
// Direct Property Access
// ============================================================================

// Single property access
async function directPropertyAccess() {
  const data = await fetch('/api/users/1').then(r => r.json());
  const name = data.name;
  const email = data.email;
  const id = data.id;
  return { name, email, id };
}

// Multiple property access on same variable
async function multipleDirectAccess() {
  const user = await fetch('/api/users/1').then(r => r.json());
  console.log(user.name);
  console.log(user.email);
  console.log(user.id);
  return user;
}

// Property access with assignment
async function propertyAccessAssignment() {
  const response = await fetch('/api/users/1').then(r => r.json());
  const userName = response.name;
  const userEmail = response.email;
  const userId = response.id;
  return { userName, userEmail, userId };
}

// ============================================================================
// Nested Property Access
// ============================================================================

// Two-level nested access
async function twoLevelNested() {
  const user = await fetch('/api/users/1').then(r => r.json());
  const avatar = user.profile.avatar;
  const bio = user.profile.bio;
  return { avatar, bio };
}

// Three-level nested access
async function threeLevelNested() {
  const user = await fetch('/api/users/1').then(r => r.json());
  const theme = user.profile.settings.theme;
  const notifications = user.profile.settings.notifications;
  return { theme, notifications };
}

// Four-level nested access
async function fourLevelNested() {
  const user = await fetch('/api/users/1').then(r => r.json());
  const showEmail = user.profile.settings.privacy.showEmail;
  const showProfile = user.profile.settings.privacy.showProfile;
  return { showEmail, showProfile };
}

// Mixed level access
async function mixedLevelAccess() {
  const data = await fetch('/api/users/1').then(r => r.json());
  console.log(data.name);                           // Level 1
  console.log(data.profile.avatar);                  // Level 2
  console.log(data.profile.settings.theme);          // Level 3
  console.log(data.profile.settings.privacy.showEmail); // Level 4
  return data;
}

// ============================================================================
// Array Access Patterns
// ============================================================================

// Array index access
async function arrayIndexAccess() {
  const users = await fetch('/api/users').then(r => r.json());
  const firstUser = users[0];
  const firstUserName = users[0].name;
  const secondUserEmail = users[1].email;
  return { firstUser, firstUserName, secondUserEmail };
}

// Array length access
async function arrayLengthAccess() {
  const users = await fetch('/api/users').then(r => r.json());
  const count = users.length;
  const hasUsers = users.length > 0;
  return { count, hasUsers };
}

// Nested array access
async function nestedArrayAccess() {
  const user = await fetch('/api/users/1').then(r => r.json());
  const firstFriend = user.friends[0];
  const firstFriendName = user.friends[0].name;
  const firstPost = user.posts[0];
  const firstPostTitle = user.posts[0].title;
  return { firstFriend, firstFriendName, firstPost, firstPostTitle };
}

// Array of nested objects
async function arrayNestedPropertyAccess() {
  const data = await fetch('/api/posts').then(r => r.json());
  const firstPostAuthorName = data[0].author.name;
  const firstCommentText = data[0].comments[0].text;
  const firstReplyAuthor = data[0].comments[0].replies[0].author.name;
  return { firstPostAuthorName, firstCommentText, firstReplyAuthor };
}

// Array methods that reveal structure
async function arrayMethodsAccess() {
  const users = await fetch('/api/users').then(r => r.json());
  
  // Map reveals property structure
  const names = users.map((u: any) => u.name);
  const emails = users.map((u: any) => u.email);
  
  // Filter reveals property structure
  const activeUsers = users.filter((u: any) => u.active);
  const admins = users.filter((u: any) => u.role === 'admin');
  
  // Find reveals property structure
  const john = users.find((u: any) => u.name === 'John');
  
  return { names, emails, activeUsers, admins, john };
}

// ============================================================================
// Destructuring Patterns
// ============================================================================

// Basic object destructuring
async function basicDestructuring() {
  const { name, email, id } = await fetch('/api/users/1').then(r => r.json());
  return { name, email, id };
}

// Nested destructuring
async function nestedDestructuring() {
  const { profile: { avatar, bio } } = await fetch('/api/users/1').then(r => r.json());
  return { avatar, bio };
}

// Deep nested destructuring
async function deepNestedDestructuring() {
  const { profile: { settings: { theme, notifications } } } = 
    await fetch('/api/users/1').then(r => r.json());
  return { theme, notifications };
}

// Mixed destructuring with rest
async function mixedDestructuringWithRest() {
  const { name, email, ...rest } = await fetch('/api/users/1').then(r => r.json());
  return { name, email, profile: rest.profile };
}

// Renamed destructuring
async function renamedDestructuring() {
  const { name: userName, email: userEmail } = await fetch('/api/users/1').then(r => r.json());
  return { userName, userEmail };
}

// Array destructuring
async function arrayDestructuring() {
  const [first, second, ...rest] = await fetch('/api/users').then(r => r.json());
  return { first, second, rest };
}

// Combined array and object destructuring
async function combinedDestructuring() {
  const [{ name: firstName }, { name: secondName }] = 
    await fetch('/api/users').then(r => r.json());
  return { firstName, secondName };
}

// Destructuring in function parameters
async function parameterDestructuring() {
  const users = await fetch('/api/users').then(r => r.json());
  users.forEach(({ name, email }: { name: string; email: string }) => {
    console.log(name, email);
  });
  return users;
}

// ============================================================================
// Optional Chaining Patterns
// ============================================================================

// Optional property access
async function optionalPropertyAccess() {
  const user = await fetch('/api/users/1').then(r => r.json());
  const avatar = user?.profile?.avatar;
  const theme = user?.profile?.settings?.theme;
  const showEmail = user?.profile?.settings?.privacy?.showEmail;
  return { avatar, theme, showEmail };
}

// Optional array access
async function optionalArrayAccess() {
  const user = await fetch('/api/users/1').then(r => r.json());
  const firstFriend = user?.friends?.[0];
  const firstFriendName = user?.friends?.[0]?.name;
  const firstPost = user?.posts?.[0];
  return { firstFriend, firstFriendName, firstPost };
}

// Optional method call
async function optionalMethodAccess() {
  const data = await fetch('/api/data').then(r => r.json());
  const result = data?.items?.map?.((i: any) => i.name);
  return result;
}

// Nullish coalescing with optional chaining
async function optionalWithDefault() {
  const user = await fetch('/api/users/1').then(r => r.json());
  const avatar = user?.profile?.avatar ?? 'default.png';
  const theme = user?.profile?.settings?.theme ?? 'light';
  return { avatar, theme };
}

// ============================================================================
// Bracket Notation Access
// ============================================================================

// Static bracket access
async function staticBracketAccess() {
  const user = await fetch('/api/users/1').then(r => r.json());
  const name = user['name'];
  const email = user['email'];
  return { name, email };
}

// Dynamic bracket access
async function dynamicBracketAccess() {
  const user = await fetch('/api/users/1').then(r => r.json());
  const key = 'email';
  const value = user[key];
  return value;
}

// Mixed notation
async function mixedNotationAccess() {
  const user = await fetch('/api/users/1').then(r => r.json());
  const avatar = user['profile'].avatar;
  const theme = user.profile['settings'].theme;
  return { avatar, theme };
}

// ============================================================================
// Chained Access Patterns (.then chains)
// ============================================================================

// Property access in .then callback
function thenChainAccess() {
  return fetch('/api/users/1')
    .then(r => r.json())
    .then(user => {
      console.log(user.name);
      console.log(user.profile.avatar);
      return user;
    });
}

// Multiple .then chains with property access
function multipleThenAccess() {
  return fetch('/api/users/1')
    .then(r => r.json())
    .then(user => user.profile)
    .then(profile => profile.settings)
    .then(settings => settings.theme);
}

// Destructuring in .then
function destructuringThenAccess() {
  return fetch('/api/users/1')
    .then(r => r.json())
    .then(({ name, email, profile }) => {
      console.log(name, email);
      return profile;
    });
}

// Arrow function implicit return
function implicitReturnAccess() {
  return fetch('/api/users/1')
    .then(r => r.json())
    .then(user => user.name);
}

// ============================================================================
// Axios-specific patterns
// ============================================================================

// Response.data access
async function axiosDataAccess() {
  const response = await axios.get('/api/users/1');
  const name = response.data.name;
  const email = response.data.email;
  return { name, email };
}

// Destructured data access
async function axiosDestructuredDataAccess() {
  const { data } = await axios.get('/api/users/1');
  const name = data.name;
  const profile = data.profile;
  return { name, profile };
}

// Nested axios data access
async function axiosNestedDataAccess() {
  const { data } = await axios.get('/api/users/1');
  const avatar = data.profile.avatar;
  const theme = data.profile.settings.theme;
  return { avatar, theme };
}

// ============================================================================
// API Response Wrapper Patterns
// ============================================================================

// Accessing wrapped data
async function wrappedDataAccess() {
  const response = await fetch('/api/users/1').then(r => r.json());
  const user = response.data;
  const status = response.status;
  const userName = response.data.name;
  return { user, status, userName };
}

// Pagination access
async function paginationAccess() {
  const response = await fetch('/api/users').then(r => r.json());
  const users = response.data;
  const page = response.pagination.page;
  const total = response.pagination.total;
  const hasNext = response.pagination.hasNext;
  return { users, page, total, hasNext };
}

// Generic response access
async function genericResponseAccess<T>(url: string): Promise<T> {
  const response = await fetch(url).then(r => r.json());
  return response.data;
}

// ============================================================================
// Conditional Access Patterns
// ============================================================================

// Conditional property access
async function conditionalAccess() {
  const user = await fetch('/api/users/1').then(r => r.json());
  if (user.active) {
    console.log(user.name);
    console.log(user.email);
  }
  return user;
}

// Ternary access
async function ternaryAccess() {
  const user = await fetch('/api/users/1').then(r => r.json());
  const displayName = user.profile ? user.profile.displayName : user.name;
  return displayName;
}

// Type guard access
async function typeGuardAccess() {
  const response = await fetch('/api/users/1').then(r => r.json());
  if ('error' in response) {
    console.log(response.error.message);
    throw new Error(response.error.message);
  }
  console.log(response.name);
  return response;
}

// ============================================================================
// Exports
// ============================================================================

export {
  // Direct access
  directPropertyAccess,
  multipleDirectAccess,
  propertyAccessAssignment,
  
  // Nested access
  twoLevelNested,
  threeLevelNested,
  fourLevelNested,
  mixedLevelAccess,
  
  // Array access
  arrayIndexAccess,
  arrayLengthAccess,
  nestedArrayAccess,
  arrayNestedPropertyAccess,
  arrayMethodsAccess,
  
  // Destructuring
  basicDestructuring,
  nestedDestructuring,
  deepNestedDestructuring,
  mixedDestructuringWithRest,
  renamedDestructuring,
  arrayDestructuring,
  combinedDestructuring,
  parameterDestructuring,
  
  // Optional chaining
  optionalPropertyAccess,
  optionalArrayAccess,
  optionalMethodAccess,
  optionalWithDefault,
  
  // Bracket notation
  staticBracketAccess,
  dynamicBracketAccess,
  mixedNotationAccess,
  
  // .then chains
  thenChainAccess,
  multipleThenAccess,
  destructuringThenAccess,
  implicitReturnAccess,
  
  // Axios patterns
  axiosDataAccess,
  axiosDestructuredDataAccess,
  axiosNestedDataAccess,
  
  // Wrapped responses
  wrappedDataAccess,
  paginationAccess,
  genericResponseAccess,
  
  // Conditional
  conditionalAccess,
  ternaryAccess,
  typeGuardAccess,
};
