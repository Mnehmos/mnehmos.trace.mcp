/**
 * GraphQL Query Constants Fixture
 * 
 * Standalone query definitions for testing query extraction.
 * @see .context/ADR-P2-4-GRAPHQL-SUPPORT.md
 */

// Mock gql tag function
interface DocumentNode {
  kind: 'Document';
  definitions: unknown[];
}

declare function gql(strings: TemplateStringsArray, ...values: unknown[]): DocumentNode;

// =============================================================================
// Simple Queries
// =============================================================================

/**
 * Simple query with single required argument
 */
export const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
      avatar
      status
      createdAt
    }
  }
`;

/**
 * Query with optional arguments
 */
export const GET_USERS = gql`
  query GetUsers($limit: Int = 10, $offset: Int = 0) {
    users(limit: $limit, offset: $offset) {
      id
      name
      email
      status
    }
  }
`;

/**
 * Query without arguments
 */
export const GET_ALL_POSTS = gql`
  query GetAllPosts {
    posts {
      id
      title
      published
      createdAt
    }
  }
`;

// =============================================================================
// Queries with Nested Selections
// =============================================================================

/**
 * Query with single-level nesting
 */
export const GET_USER_WITH_POSTS = gql`
  query GetUserWithPosts($userId: ID!) {
    user(id: $userId) {
      id
      name
      posts {
        id
        title
        content
        published
      }
    }
  }
`;

/**
 * Query with multi-level nesting
 */
export const GET_POST_WITH_COMMENTS = gql`
  query GetPostWithComments($postId: ID!) {
    post(id: $postId) {
      id
      title
      content
      author {
        id
        name
        avatar
      }
      comments(limit: 10) {
        id
        body
        createdAt
        author {
          id
          name
        }
      }
    }
  }
`;

/**
 * Query with deeply nested selection
 */
export const GET_USER_FULL_PROFILE = gql`
  query GetUserFullProfile($id: ID!) {
    user(id: $id) {
      id
      name
      email
      settings {
        emailNotifications
        theme
        language
      }
      posts {
        id
        title
        comments {
          id
          body
          author {
            id
            name
          }
        }
      }
    }
  }
`;

// =============================================================================
// Queries with Arguments at Different Levels
// =============================================================================

/**
 * Query with arguments on nested field
 */
export const GET_USER_RECENT_POSTS = gql`
  query GetUserRecentPosts($userId: ID!, $postsLimit: Int!) {
    user(id: $userId) {
      id
      name
      posts(limit: $postsLimit) {
        id
        title
        createdAt
      }
    }
  }
`;

/**
 * Query with multiple arguments at nested levels
 */
export const GET_POST_COMMENTS_FILTERED = gql`
  query GetPostCommentsFiltered(
    $postId: ID!
    $commentLimit: Int
    $commentOffset: Int
  ) {
    post(id: $postId) {
      id
      title
      comments(limit: $commentLimit, offset: $commentOffset) {
        id
        body
        createdAt
      }
    }
  }
`;

// =============================================================================
// Queries with Aliases
// =============================================================================

/**
 * Query with field aliases
 */
export const GET_USER_WITH_ALIASES = gql`
  query GetUserWithAliases($id: ID!) {
    user(id: $id) {
      userId: id
      displayName: name
      contactEmail: email
      profilePicture: avatar
    }
  }
`;

/**
 * Query with multiple root-level aliases
 */
export const GET_MULTIPLE_USERS = gql`
  query GetMultipleUsers($id1: ID!, $id2: ID!) {
    firstUser: user(id: $id1) {
      id
      name
      email
    }
    secondUser: user(id: $id2) {
      id
      name
      email
    }
  }
`;

// =============================================================================
// Queries with Fragments
// =============================================================================

/**
 * Fragment definition
 */
export const USER_FIELDS_FRAGMENT = gql`
  fragment UserFields on User {
    id
    name
    email
    avatar
    status
  }
`;

/**
 * Fragment for posts
 */
export const POST_FIELDS_FRAGMENT = gql`
  fragment PostFields on Post {
    id
    title
    content
    published
    createdAt
  }
`;

/**
 * Query using fragment spread (for future support)
 */
export const GET_USER_WITH_FRAGMENT = gql`
  query GetUserWithFragment($id: ID!) {
    user(id: $id) {
      ...UserFields
      posts {
        ...PostFields
      }
    }
  }
  ${USER_FIELDS_FRAGMENT}
  ${POST_FIELDS_FRAGMENT}
`;

// =============================================================================
// Mutations
// =============================================================================

/**
 * Simple mutation with input type
 */
export const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      name
      email
      createdAt
    }
  }
`;

/**
 * Mutation with ID and input arguments
 */
export const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      id
      name
      email
      avatar
      status
      updatedAt
    }
  }
`;

/**
 * Mutation returning boolean
 */
export const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id)
  }
`;

/**
 * Mutation with nested return type
 */
export const CREATE_POST = gql`
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      id
      title
      content
      published
      author {
        id
        name
      }
      tags
      createdAt
    }
  }
`;

/**
 * Complex mutation with multiple arguments
 */
export const UPDATE_POST = gql`
  mutation UpdatePost($id: ID!, $input: UpdatePostInput!) {
    updatePost(id: $id, input: $input) {
      id
      title
      content
      published
      tags
      updatedAt
      publishedAt
    }
  }
`;

// =============================================================================
// Subscriptions
// =============================================================================

/**
 * Simple subscription without arguments
 */
export const USER_CREATED_SUBSCRIPTION = gql`
  subscription OnUserCreated {
    userCreated {
      id
      name
      email
      createdAt
    }
  }
`;

/**
 * Subscription with optional argument
 */
export const POST_ADDED_SUBSCRIPTION = gql`
  subscription OnPostAdded($authorId: ID) {
    postAdded(authorId: $authorId) {
      id
      title
      published
      author {
        id
        name
      }
    }
  }
`;

/**
 * Subscription with required argument
 */
export const USER_UPDATED_SUBSCRIPTION = gql`
  subscription OnUserUpdated($id: ID!) {
    userUpdated(id: $id) {
      id
      name
      email
      avatar
      status
      updatedAt
    }
  }
`;

// =============================================================================
// Search and Complex Queries
// =============================================================================

/**
 * Query returning union type
 */
export const SEARCH_CONTENT = gql`
  query SearchContent($query: String!, $type: SearchType) {
    search(query: $query, type: $type) {
      ... on User {
        __typename
        id
        name
        email
      }
      ... on Post {
        __typename
        id
        title
        content
      }
      ... on Comment {
        __typename
        id
        body
      }
    }
  }
`;

/**
 * Query with directives (for future support)
 */
export const GET_USER_CONDITIONAL = gql`
  query GetUserConditional($id: ID!, $includePosts: Boolean!) {
    user(id: $id) {
      id
      name
      email
      posts @include(if: $includePosts) {
        id
        title
      }
    }
  }
`;

// =============================================================================
// Query Name Variations
// =============================================================================

/**
 * Anonymous query (no operation name)
 */
export const ANONYMOUS_QUERY = gql`
  {
    users(limit: 5) {
      id
      name
    }
  }
`;

/**
 * Lowercase operation type
 */
export const LOWERCASE_QUERY = gql`
  query getUserById($id: ID!) {
    user(id: $id) {
      id
      name
    }
  }
`;

// =============================================================================
// Type Definitions for Query Results
// =============================================================================

export interface GetUserQueryResult {
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    status: string;
    createdAt: string;
  } | null;
}

export interface GetUsersQueryResult {
  users: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
  }>;
}

export interface GetPostWithCommentsQueryResult {
  post: {
    id: string;
    title: string;
    content?: string;
    author: {
      id: string;
      name: string;
      avatar?: string;
    };
    comments: Array<{
      id: string;
      body: string;
      createdAt: string;
      author: {
        id: string;
        name: string;
      };
    }>;
  } | null;
}

export interface CreateUserMutationResult {
  createUser: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
  };
}

export interface SearchContentQueryResult {
  search: Array<
    | { __typename: 'User'; id: string; name: string; email: string }
    | { __typename: 'Post'; id: string; title: string; content?: string }
    | { __typename: 'Comment'; id: string; body: string }
  >;
}

// =============================================================================
// Variable Types
// =============================================================================

export interface GetUserVariables {
  id: string;
}

export interface GetUsersVariables {
  limit?: number;
  offset?: number;
}

export interface CreateUserVariables {
  input: {
    name: string;
    email: string;
    password: string;
    avatar?: string;
  };
}

export interface UpdateUserVariables {
  id: string;
  input: {
    name?: string;
    email?: string;
    avatar?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';
  };
}

export interface SearchContentVariables {
  query: string;
  type?: 'USER' | 'POST' | 'COMMENT';
}
