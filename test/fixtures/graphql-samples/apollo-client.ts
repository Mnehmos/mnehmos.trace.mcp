/**
 * Apollo Client Hook Usage Fixture
 * 
 * Contains various Apollo Client hook patterns for testing detection.
 * @see .context/ADR-P2-4-GRAPHQL-SUPPORT.md
 */

// Mock React types
type ReactNode = unknown;
declare function useState<T>(initial: T): [T, (value: T) => void];

// Mock Apollo Client types
interface DocumentNode {
  kind: 'Document';
  definitions: unknown[];
}

interface QueryResult<TData = unknown> {
  data?: TData;
  loading: boolean;
  error?: Error;
  refetch: () => Promise<QueryResult<TData>>;
}

interface MutationResult<TData = unknown> {
  data?: TData;
  loading: boolean;
  error?: Error;
}

interface LazyQueryResult<TData = unknown> extends QueryResult<TData> {
  called: boolean;
}

interface SubscriptionResult<TData = unknown> {
  data?: TData;
  loading: boolean;
  error?: Error;
}

type MutationFunction<TData = unknown, TVariables = unknown> = (
  options?: { variables?: TVariables }
) => Promise<{ data?: TData }>;

type LazyQueryFunction<TData = unknown, TVariables = unknown> = (
  options?: { variables?: TVariables }
) => Promise<LazyQueryResult<TData>>;

// Mock Apollo Client hooks
declare function useQuery<TData = unknown, TVariables = unknown>(
  query: DocumentNode,
  options?: { variables?: TVariables; skip?: boolean; pollInterval?: number }
): QueryResult<TData>;

declare function useMutation<TData = unknown, TVariables = unknown>(
  mutation: DocumentNode,
  options?: { variables?: TVariables; onCompleted?: (data: TData) => void }
): [MutationFunction<TData, TVariables>, MutationResult<TData>];

declare function useLazyQuery<TData = unknown, TVariables = unknown>(
  query: DocumentNode,
  options?: { variables?: TVariables }
): [LazyQueryFunction<TData, TVariables>, LazyQueryResult<TData>];

declare function useSubscription<TData = unknown, TVariables = unknown>(
  subscription: DocumentNode,
  options?: { variables?: TVariables; skip?: boolean }
): SubscriptionResult<TData>;

// Mock gql tag function
declare function gql(strings: TemplateStringsArray, ...values: unknown[]): DocumentNode;

// =============================================================================
// Type Definitions for Queries
// =============================================================================

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  posts: Post[];
}

interface Post {
  id: string;
  title: string;
  content?: string;
  author: User;
  published: boolean;
}

interface Comment {
  id: string;
  body: string;
  author: User;
}

// Query response types
interface GetUserQuery {
  user: User | null;
}

interface GetUsersQuery {
  users: User[];
}

interface GetPostsQuery {
  posts: Post[];
}

interface SearchQuery {
  search: (User | Post | Comment)[];
}

// Mutation response types
interface CreateUserMutation {
  createUser: User;
}

interface UpdateUserMutation {
  updateUser: User | null;
}

interface DeleteUserMutation {
  deleteUser: boolean;
}

interface CreatePostMutation {
  createPost: Post;
}

// Subscription response types
interface UserCreatedSubscription {
  userCreated: User;
}

interface PostAddedSubscription {
  postAdded: Post;
}

// =============================================================================
// Query Definitions (gql tagged templates)
// =============================================================================

/**
 * Simple query with single variable
 */
const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
      avatar
    }
  }
`;

/**
 * Query with nested selections
 */
const GET_USER_WITH_POSTS = gql`
  query GetUserWithPosts($id: ID!) {
    user(id: $id) {
      id
      name
      email
      posts {
        id
        title
        published
      }
    }
  }
`;

/**
 * Query with multiple arguments
 */
const GET_USERS = gql`
  query GetUsers($limit: Int, $offset: Int) {
    users(limit: $limit, offset: $offset) {
      id
      name
      email
    }
  }
`;

/**
 * Query without variables
 */
const GET_ALL_POSTS = gql`
  query GetAllPosts {
    posts {
      id
      title
      content
      author {
        id
        name
      }
    }
  }
`;

/**
 * Query with aliased fields
 */
const GET_USER_WITH_ALIASES = gql`
  query GetUserWithAliases($id: ID!) {
    user(id: $id) {
      userId: id
      displayName: name
      contactEmail: email
    }
  }
`;

/**
 * Query with fragment (future support)
 */
const USER_FRAGMENT = gql`
  fragment UserFields on User {
    id
    name
    email
  }
`;

// =============================================================================
// Mutation Definitions
// =============================================================================

/**
 * Simple mutation with input type
 */
const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      name
      email
    }
  }
`;

/**
 * Mutation with multiple arguments
 */
const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      id
      name
      email
      avatar
    }
  }
`;

/**
 * Mutation returning boolean
 */
const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id)
  }
`;

/**
 * Mutation with nested return type
 */
const CREATE_POST = gql`
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      id
      title
      content
      author {
        id
        name
      }
    }
  }
`;

// =============================================================================
// Subscription Definitions
// =============================================================================

/**
 * Simple subscription
 */
const USER_CREATED = gql`
  subscription OnUserCreated {
    userCreated {
      id
      name
      email
    }
  }
`;

/**
 * Subscription with argument
 */
const POST_ADDED = gql`
  subscription OnPostAdded($authorId: ID) {
    postAdded(authorId: $authorId) {
      id
      title
      author {
        id
        name
      }
    }
  }
`;

// =============================================================================
// Pattern 1: Basic useQuery Hook
// =============================================================================

/**
 * Basic useQuery with variables
 */
function UserProfile({ userId }: { userId: string }): ReactNode {
  const { data, loading, error } = useQuery<GetUserQuery>(GET_USER, {
    variables: { id: userId },
  });
  
  if (loading) return 'Loading...';
  if (error) return `Error: ${error.message}`;
  
  // Property accesses to track
  return (
    `<div>
      <h1>${data?.user?.name}</h1>
      <p>${data?.user?.email}</p>
      <img src="${data?.user?.avatar}" />
    </div>`
  );
}

/**
 * useQuery with nested data access
 */
function UserWithPosts({ userId }: { userId: string }): ReactNode {
  const { data, loading } = useQuery<GetUserQuery>(GET_USER_WITH_POSTS, {
    variables: { id: userId },
  });
  
  if (loading) return 'Loading...';
  
  // Nested property accesses
  const userName = data?.user?.name;
  const userPosts = data?.user?.posts;
  
  return (
    `<div>
      <h1>${userName}</h1>
      <ul>
        ${userPosts?.map(post => `<li>${post.title}</li>`).join('')}
      </ul>
    </div>`
  );
}

/**
 * useQuery with destructured data
 */
function UsersList(): ReactNode {
  const { data: { users } = { users: [] }, loading } = useQuery<GetUsersQuery>(GET_USERS, {
    variables: { limit: 10 },
  });
  
  if (loading) return 'Loading...';
  
  return (
    `<ul>
      ${users.map(user => `<li>${user.name} - ${user.email}</li>`).join('')}
    </ul>`
  );
}

// =============================================================================
// Pattern 2: Basic useMutation Hook
// =============================================================================

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
}

/**
 * Basic useMutation
 */
function CreateUserForm(): ReactNode {
  const [createUser, { data, loading, error }] = useMutation<CreateUserMutation>(CREATE_USER);
  
  const handleSubmit = async (input: CreateUserInput) => {
    const result = await createUser({ variables: { input } });
    console.log('Created user:', result.data?.createUser);
  };
  
  if (loading) return 'Creating...';
  if (error) return `Error: ${error.message}`;
  if (data) return `Created: ${data.createUser.name}`;
  
  return '<form>...</form>';
}

/**
 * useMutation with onCompleted callback
 */
function UpdateUserForm({ userId }: { userId: string }): ReactNode {
  const [updateUser] = useMutation<UpdateUserMutation>(UPDATE_USER, {
    onCompleted: (data) => {
      console.log('Updated user:', data.updateUser?.name);
    },
  });
  
  const handleSubmit = async (input: { name?: string; email?: string }) => {
    await updateUser({ variables: { id: userId, input } });
  };
  
  return '<form>...</form>';
}

/**
 * useMutation with result data access
 */
function DeleteUserButton({ userId }: { userId: string }): ReactNode {
  const [deleteUser, { data, loading }] = useMutation<DeleteUserMutation>(DELETE_USER);
  
  const handleClick = async () => {
    const result = await deleteUser({ variables: { id: userId } });
    if (result.data?.deleteUser) {
      console.log('User deleted successfully');
    }
  };
  
  return `<button disabled={${loading}}>Delete</button>`;
}

// =============================================================================
// Pattern 3: useLazyQuery Hook
// =============================================================================

/**
 * Basic useLazyQuery
 */
function UserSearch(): ReactNode {
  const [searchId, setSearchId] = useState('');
  const [getUser, { data, loading, called }] = useLazyQuery<GetUserQuery>(GET_USER);
  
  const handleSearch = () => {
    getUser({ variables: { id: searchId } });
  };
  
  if (loading) return 'Searching...';
  if (called && !data?.user) return 'User not found';
  if (data?.user) {
    return `Found: ${data.user.name}`;
  }
  
  return '<input>...</input>';
}

/**
 * useLazyQuery with await
 */
function UserLookup(): ReactNode {
  const [getUser] = useLazyQuery<GetUserQuery>(GET_USER);
  
  const handleLookup = async (id: string) => {
    const result = await getUser({ variables: { id } });
    if (result.data?.user) {
      console.log('Found user:', result.data.user.email);
    }
  };
  
  return '<div>...</div>';
}

// =============================================================================
// Pattern 4: useSubscription Hook
// =============================================================================

/**
 * Basic useSubscription
 */
function NewUserNotifications(): ReactNode {
  const { data, loading } = useSubscription<UserCreatedSubscription>(USER_CREATED);
  
  if (loading) return 'Connecting...';
  if (data?.userCreated) {
    return `New user: ${data.userCreated.name}`;
  }
  
  return 'Waiting for new users...';
}

/**
 * useSubscription with variables
 */
function AuthorPostNotifications({ authorId }: { authorId: string }): ReactNode {
  const { data, loading, error } = useSubscription<PostAddedSubscription>(POST_ADDED, {
    variables: { authorId },
  });
  
  if (loading) return 'Connecting...';
  if (error) return `Error: ${error.message}`;
  if (data?.postAdded) {
    return `New post by ${data.postAdded.author.name}: ${data.postAdded.title}`;
  }
  
  return 'Waiting for posts...';
}

// =============================================================================
// Pattern 5: Inline Query (not using constant)
// =============================================================================

/**
 * Inline gql query in hook call
 */
function InlineQueryComponent({ id }: { id: string }): ReactNode {
  const { data } = useQuery<{ user: { id: string; name: string } | null }>(
    gql`
      query InlineQuery($id: ID!) {
        user(id: $id) {
          id
          name
        }
      }
    `,
    { variables: { id } }
  );
  
  return data?.user?.name ?? 'Loading...';
}

/**
 * Inline gql mutation in hook call
 */
function InlineMutationComponent(): ReactNode {
  const [createUser] = useMutation(
    gql`
      mutation InlineCreateUser($input: CreateUserInput!) {
        createUser(input: $input) {
          id
          name
        }
      }
    `
  );
  
  return '<button>Create</button>';
}

// =============================================================================
// Pattern 6: Query Options
// =============================================================================

/**
 * useQuery with skip option
 */
function ConditionalQuery({ userId, enabled }: { userId: string; enabled: boolean }): ReactNode {
  const { data } = useQuery<GetUserQuery>(GET_USER, {
    variables: { id: userId },
    skip: !enabled,
  });
  
  return data?.user?.name ?? 'Disabled';
}

/**
 * useQuery with polling
 */
function PollingQuery(): ReactNode {
  const { data } = useQuery<GetUsersQuery>(GET_USERS, {
    pollInterval: 5000,
    variables: { limit: 5 },
  });
  
  return `${data?.users?.length ?? 0} users`;
}

/**
 * useQuery with spread variables
 */
function SpreadVariablesQuery({ userVars }: { userVars: { id: string; includeEmail?: boolean } }): ReactNode {
  const { data } = useQuery<GetUserQuery>(GET_USER, {
    variables: { ...userVars },
  });
  
  return data?.user?.name ?? 'Loading...';
}

// =============================================================================
// Pattern 7: Mismatch Scenario (accessing non-existent field)
// =============================================================================

/**
 * Component accessing field not in schema (avatar vs avatarUrl)
 * This should be detected as a mismatch
 */
function MismatchComponent({ userId }: { userId: string }): ReactNode {
  const { data } = useQuery<GetUserQuery>(GET_USER, {
    variables: { id: userId },
  });
  
  // MISMATCH: 'avatarUrl' is not in the query (uses 'avatar')
  // This should be caught by consumer tracing
  const avatarUrl = (data?.user as unknown as { avatarUrl?: string })?.avatarUrl;
  
  return `<img src="${avatarUrl}" />`;
}

/**
 * Component accessing deeply nested non-existent field
 */
function DeepMismatchComponent({ userId }: { userId: string }): ReactNode {
  const { data } = useQuery(GET_USER_WITH_POSTS, {
    variables: { id: userId },
  });
  
  // MISMATCH: 'author' is not selected in GET_USER_WITH_POSTS query
  const posts = (data as unknown as { user?: { posts?: Array<{ author?: { name: string } }> } })?.user?.posts;
  const firstAuthor = posts?.[0]?.author?.name;
  
  return `First post by: ${firstAuthor}`;
}

// =============================================================================
// Exports for Testing
// =============================================================================

export {
  // Queries
  GET_USER,
  GET_USER_WITH_POSTS,
  GET_USERS,
  GET_ALL_POSTS,
  GET_USER_WITH_ALIASES,
  USER_FRAGMENT,
  
  // Mutations
  CREATE_USER,
  UPDATE_USER,
  DELETE_USER,
  CREATE_POST,
  
  // Subscriptions
  USER_CREATED,
  POST_ADDED,
  
  // Components
  UserProfile,
  UserWithPosts,
  UsersList,
  CreateUserForm,
  UpdateUserForm,
  DeleteUserButton,
  UserSearch,
  UserLookup,
  NewUserNotifications,
  AuthorPostNotifications,
  InlineQueryComponent,
  InlineMutationComponent,
  ConditionalQuery,
  PollingQuery,
  MismatchComponent,
  DeepMismatchComponent,
};

export type {
  User,
  Post,
  Comment,
  GetUserQuery,
  GetUsersQuery,
  GetPostsQuery,
  CreateUserMutation,
  UpdateUserMutation,
  DeleteUserMutation,
  CreatePostMutation,
  UserCreatedSubscription,
  PostAddedSubscription,
};
