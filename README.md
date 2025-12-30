# mnehmos.trace.mcp

> Static analysis engine for detecting schema mismatches between data producers and consumers.

## What It Does

Trace MCP finds mismatches between:

- Backend API responses and frontend expectations
- MCP tool outputs and client code that uses them
- Service A's events and Service B's handlers
- REST endpoints and HTTP client calls
- GraphQL schemas and Apollo Client hooks

```
Producer returns:    { characterClass: "Fighter", hitPoints: 45 }
Consumer expects:    { class: "Fighter", hp: 45 }
Result:              ❌ Mismatch detected before runtime
```

## Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Schema Extraction** | Extract schemas from MCP tools, OpenAPI, TypeScript, tRPC, REST endpoints, GraphQL |
| **Usage Tracing** | Track how client code consumes schemas via property access patterns |
| **Mismatch Detection** | Compare producer schemas against consumer expectations |
| **Code Generation** | Scaffold consumer code from producer schemas (and vice versa) |
| **Watch Mode** | Continuous validation on file changes |

### Phase 2 Capabilities

| Feature | Description |
|---------|-------------|
| **Pattern Matcher** | Extensible pattern detection supporting call, decorator, property, export, and chain patterns |
| **Import Resolution** | Cross-file type resolution with import graph building and circular dependency handling |
| **REST Detection** | Express and Fastify endpoint extraction with validation middleware support |
| **HTTP Client Tracing** | fetch() and axios call detection with URL extraction and type inference |
| **GraphQL Support** | SDL schema parsing, Apollo Server resolvers, and Apollo Client hook tracing |

### Test Coverage

**661 tests passing** across 12 test suites:

| Test Suite | Tests |
|------------|-------|
| Pattern Matcher | 85 |
| REST Detection | 87 |
| HTTP Client Tracing | 90 |
| GraphQL Support | 109 |
| Import Resolution | 56 |
| Core (adapters, OpenAPI, tRPC) | 234 |

## Installation

```bash
# Clone the repository
git clone https://github.com/Mnehmos/mnehmos.trace.mcp.git

# Navigate to the directory
cd mnehmos.trace.mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

Add to your MCP client configuration (e.g., `claude_desktop_config.json` or Roo-Code settings):

```json
{
  "mcpServers": {
    "trace-mcp": {
      "command": "node",
      "args": ["/path/to/trace-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

## Supported Formats

Trace MCP supports schema extraction and comparison across multiple specification formats through a pluggable adapter registry.

### Summary of Supported Frameworks

| Category | Frameworks |
|----------|------------|
| **API Specs** | OpenAPI 3.0+, Swagger |
| **RPC** | MCP (Zod), tRPC |
| **REST Servers** | Express, Fastify |
| **HTTP Clients** | fetch(), axios |
| **GraphQL** | SDL schemas, Apollo Server, Apollo Client |
| **Type Systems** | TypeScript interfaces, Zod schemas |

---

### MCP Server Schemas (Zod)

Extract MCP tool definitions from server source code using Zod schemas.

```typescript
server.tool(
  "get_character",
  "Fetch character data",
  {
    characterId: z.string().describe("Character ID"),
  },
  async (args) => {
    // implementation
  }
);
```

**Schema ID Format**: `endpoint:GET:/tools/get_character@./server.ts`

---

### OpenAPI / Swagger Specifications

Extract schemas from OpenAPI 3.0+ specifications, supporting endpoints, request bodies, responses, and component schemas.

```yaml
openapi: 3.0.0
info:
  title: Character API
  version: 1.0.0
paths:
  /characters/{id}:
    get:
      parameters:
        - name: id
          in: path
          schema:
            type: string
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Character'
components:
  schemas:
    Character:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        class:
          type: string
      required:
        - id
        - name
        - class
```

**Schema ID Format**: `endpoint:GET:/characters/{id}@./api.yaml`

**Usage Example:**

```typescript
const result = await client.callTool("extract_schemas", {
  rootDir: "./backend",
  include: ["**/*.openapi.yaml", "**/*.swagger.json"],
});
```

---

### TypeScript Interfaces & Types

Extract exported interfaces, type aliases, and enums from TypeScript source files. Supports utility types including `Pick`, `Omit`, `Partial`, `Required`, and `Record`.

```typescript
export interface Character {
  id: string;
  name: string;
  class: "Fighter" | "Wizard" | "Rogue";
  hitPoints: number;
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
  };
}

export type ReadonlyCharacter = Readonly<Character>;

export enum CharacterClass {
  Fighter = "Fighter",
  Wizard = "Wizard",
  Rogue = "Rogue",
}
```

**Schema ID Format**: `interface:Character@./types.ts`

**Supported Utility Types:**
- `Pick<T, K>` - Select properties from interface
- `Omit<T, K>` - Exclude properties from interface
- `Partial<T>` - Make all properties optional
- `Required<T>` - Make all properties required
- `Record<K, T>` - Object with specific keys and value type

**Usage Example:**

```typescript
const result = await client.callTool("extract_schemas", {
  rootDir: "./shared",
  include: ["**/*.ts", "**/*.tsx"],
});
// Returns interfaces with ID format: interface:CharacterClass@./types.ts
```

---

### tRPC Routers

Extract procedure schemas from tRPC routers, including input/output types, query, mutation, and subscription handlers. Handles nested routers and middleware.

```typescript
import { z } from "zod";
import { publicProcedure, router } from "./trpc";

export const appRouter = router({
  users: router({
    getById: publicProcedure
      .input(z.string())
      .output(z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
      }))
      .query(async ({ input }) => {
        // implementation
      }),
    
    create: publicProcedure
      .input(z.object({
        name: z.string(),
        email: z.string().email(),
      }))
      .output(z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      }))
      .mutation(async ({ input }) => {
        // implementation
      }),

    onChange: publicProcedure
      .output(z.object({
        userId: z.string(),
        action: z.enum(["created", "updated", "deleted"]),
      }))
      .subscription(async () => {
        // implementation
      }),
  }),
});
```

**Schema ID Format**: `trpc:users.getById@./router.ts`

**Detected Elements:**
- Router definitions (`router({ ... })`)
- Nested routers (`users: router({ ... })`)
- Procedures (`.query()`, `.mutation()`, `.subscription()`)
- Input schemas (`.input(zod_schema)`)
- Output schemas (`.output(zod_schema)`)

**Usage Example:**

```typescript
const result = await client.callTool("extract_schemas", {
  rootDir: "./backend/trpc",
  include: ["**/*.router.ts"],
});
// Returns procedures with ID format: trpc:users.getById@./router.ts
```

---

### REST Endpoints (Express & Fastify)

Extract endpoint schemas from Express and Fastify applications, including route parameters, request bodies, response types, and validation middleware.

#### Express

```typescript
import express from "express";
import { z } from "zod";

const app = express();

// Basic route with typed response
app.get("/users/:id", (req, res) => {
  const user: User = getUserById(req.params.id);
  res.json(user);
});

// Route with Zod validation middleware
app.post("/users", 
  validate(z.object({
    name: z.string(),
    email: z.string().email(),
  })),
  (req, res) => {
    res.status(201).json({ id: "123", ...req.body });
  }
);

// Router-based routes
const router = express.Router();
router.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api", router);
```

**Schema ID Format**: `rest:GET:/users/:id@./app.ts`

#### Fastify

```typescript
import Fastify from "fastify";

const fastify = Fastify();

// Route with JSON Schema validation
fastify.post("/users", {
  schema: {
    body: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string", format: "email" },
      },
      required: ["name", "email"],
    },
    response: {
      201: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
      },
    },
  },
}, async (request, reply) => {
  return { id: "123", name: request.body.name };
});

// Shorthand methods
fastify.get("/health", async () => ({ status: "ok" }));
```

**Schema ID Format**: `rest:POST:/users@./server.ts`

**Detected Elements:**
- HTTP methods: GET, POST, PUT, PATCH, DELETE
- Path parameters (`:id`, `:userId`)
- Request body schemas (Zod, Joi, celebrate, JSON Schema)
- Response type inference
- Router prefixes and mounting

**Usage Example:**

```typescript
const result = await client.callTool("extract_schemas", {
  rootDir: "./backend",
  include: ["**/*.ts"],
});
// Returns endpoints with ID format: rest:GET:/users/:id@./routes.ts
```

---

### HTTP Clients (fetch & axios)

Trace HTTP client calls to detect consumer expectations for API responses.

#### fetch() API

```typescript
// Basic fetch with type assertion
const response = await fetch("/api/users");
const users: User[] = await response.json();

// fetch with request options
const newUser = await fetch("/api/users", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Alice" }),
}).then(res => res.json()) as CreateUserResponse;

// Template literal URLs
const userId = "123";
const user = await fetch(`/api/users/${userId}`).then(r => r.json());

// Property access tracking
console.log(user.name, user.email, user.profile.avatar);
```

**Detected Elements:**
- URL extraction (static strings, template literals, variables)
- HTTP method detection
- Type assertions and generics
- Property access patterns on response data

#### axios

```typescript
import axios from "axios";

// Basic GET request
const { data: users } = await axios.get<User[]>("/api/users");

// POST with typed response
const response = await axios.post<CreateUserResponse>("/api/users", {
  name: "Bob",
  email: "bob@example.com",
});

// Instance with base URL
const api = axios.create({ baseURL: "https://api.example.com" });
const profile = await api.get<Profile>("/me");

// Destructured property access
const { name, email } = response.data;
```

**Schema ID Format**: `http-client:GET:/api/users@./client.ts`

**Detected Elements:**
- axios methods: `.get()`, `.post()`, `.put()`, `.patch()`, `.delete()`
- Generic type parameters (`axios.get<User>`)
- Instance creation with `axios.create()`
- Base URL resolution
- Response data property access

**Usage Example:**

```typescript
const result = await client.callTool("trace_usage", {
  rootDir: "./frontend/src",
  include: ["**/*.ts", "**/*.tsx"],
});
// Returns HTTP client calls with ID format: http-client:GET:/api/users@./api.ts
```

---

### GraphQL (SDL & Apollo)

Extract schemas from GraphQL SDL files and trace Apollo Server resolvers and Apollo Client hooks.

#### SDL Schema Files

```graphql
# schema.graphql
type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
}

type Query {
  user(id: ID!): User
  users: [User!]!
  post(id: ID!): Post
}

type Mutation {
  createUser(name: String!, email: String!): User!
  createPost(title: String!, content: String!, authorId: ID!): Post!
}
```

**Schema ID Format**: `graphql:Query.user@./schema.graphql`

#### Apollo Server Resolvers

```typescript
import { ApolloServer } from "@apollo/server";

const resolvers = {
  Query: {
    user: async (_, { id }) => {
      return db.users.findById(id);
    },
    users: async () => {
      return db.users.findAll();
    },
  },
  Mutation: {
    createUser: async (_, { name, email }) => {
      return db.users.create({ name, email });
    },
  },
  User: {
    posts: async (parent) => {
      return db.posts.findByAuthor(parent.id);
    },
  },
};

const server = new ApolloServer({ typeDefs, resolvers });
```

**Schema ID Format**: `graphql-resolver:Query.user@./resolvers.ts`

#### Apollo Client Hooks

```typescript
import { useQuery, useMutation, gql } from "@apollo/client";

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }
`;

const CREATE_USER = gql`
  mutation CreateUser($name: String!, $email: String!) {
    createUser(name: $name, email: $email) {
      id
      name
    }
  }
`;

function UserProfile({ userId }: { userId: string }) {
  const { data, loading, error } = useQuery(GET_USER, {
    variables: { id: userId },
  });

  const [createUser] = useMutation(CREATE_USER);

  if (loading) return <Spinner />;
  if (error) return <Error message={error.message} />;

  return <div>{data.user.name}</div>;
}
```

**Schema ID Format**: `graphql-client:GetUser@./UserProfile.tsx`

**Detected Elements:**
- SDL types: scalar, object, input, enum, interface, union
- Query and Mutation definitions
- Field arguments and return types
- Apollo Client hooks: `useQuery`, `useMutation`, `useLazyQuery`, `useSubscription`
- Operation names and variables
- Selected fields in queries

**Usage Example:**

```typescript
// Extract GraphQL schemas
const schemas = await client.callTool("extract_schemas", {
  rootDir: "./backend",
  include: ["**/*.graphql", "**/resolvers.ts"],
});

// Trace Apollo Client usage
const usage = await client.callTool("trace_usage", {
  rootDir: "./frontend/src",
  include: ["**/*.tsx"],
});

// Compare for mismatches
const report = await client.callTool("compare", {
  producerDir: "./backend",
  consumerDir: "./frontend/src",
  format: "markdown",
});
```

---

## Architecture

### Pattern Matcher Framework

The pattern matcher provides an extensible system for detecting code patterns across different frameworks. Located in [`src/patterns/`](src/patterns/):

```
src/patterns/
├── base.ts          # BasePattern abstract class
├── types.ts         # PatternMatch, PatternContext interfaces
├── registry.ts      # PatternRegistry for plugin management
├── extractors.ts    # Node extractors for AST traversal
├── errors.ts        # Pattern-specific error types
├── rest/            # Express, Fastify patterns
├── http-clients/    # fetch, axios patterns
└── graphql/         # Apollo patterns
```

**Supported Pattern Types:**
- **Call patterns**: Function/method calls (`app.get()`, `fetch()`)
- **Decorator patterns**: TypeScript/Python decorators (`@Controller()`)
- **Property patterns**: Object property assignments
- **Export patterns**: Module exports (`export const router = ...`)
- **Chain patterns**: Method chaining (`router.get().post()`)

### Import Resolution

Cross-file type resolution with import graph building. Located in [`src/languages/import-resolver.ts`](src/languages/import-resolver.ts):

- Resolves `import { Type } from "./types"`
- Handles barrel exports (`export * from`)
- Supports path aliases via tsconfig.json
- Detects and handles circular dependencies
- Caches resolved types for performance

---

## Tools Reference

Trace MCP provides 11 tools organized into three categories:

### Core Analysis Tools

| Tool              | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `extract_schemas` | Extract MCP tool definitions from server source code |
| `extract_file`    | Extract schemas from a single file                   |
| `trace_usage`     | Trace how client code uses MCP tools                 |
| `trace_file`      | Trace tool usage in a single file                    |
| `compare`         | Full pipeline: extract → trace → compare → report    |

### Code Generation Tools

| Tool                | Description                                     |
| ------------------- | ----------------------------------------------- |
| `scaffold_consumer` | Generate client code from producer schema       |
| `scaffold_producer` | Generate server stub from client usage          |
| `comment_contract`  | Add cross-reference comments to validated pairs |

### Project Management Tools

| Tool                 | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `init_project`       | Initialize a trace project with `.trace-mcp` config     |
| `watch`              | Watch files for changes and auto-revalidate             |
| `get_project_status` | Get project config, cache state, and validation results |

---

## Tool Details

### `extract_schemas`

Extract MCP tool definitions (ProducerSchemas) from server source code. Scans for `server.tool()` calls and parses their Zod schemas. Also supports OpenAPI, TypeScript interfaces, tRPC routers, REST endpoints, and GraphQL schemas.

**Parameters:**

- `rootDir` (required): Root directory of server source code
- `include`: Glob patterns to include (default: `**/*.ts`)
- `exclude`: Glob patterns to exclude (default: `node_modules`, `dist`)

**Example:**

```typescript
const result = await client.callTool("extract_schemas", {
  rootDir: "./backend/src",
});
// Returns: { success: true, count: 12, schemas: [...] }
```

---

### `extract_file`

Extract MCP tool definitions from a single TypeScript file.

**Parameters:**

- `filePath` (required): Path to a TypeScript file

---

### `trace_usage`

Trace how client code uses MCP tools. Finds `callTool()` invocations, HTTP client calls, and GraphQL hooks, tracking which properties are accessed on results.

**Parameters:**

- `rootDir` (required): Root directory of consumer source code
- `include`: Glob patterns to include
- `exclude`: Glob patterns to exclude

---

### `trace_file`

Trace MCP tool usage in a single TypeScript file.

**Parameters:**

- `filePath` (required): Path to a TypeScript file

---

### `compare`

Full analysis pipeline: extract producer schemas, trace consumer usage, and compare them to find mismatches.

**Parameters:**

- `producerDir` (required): Path to MCP server source directory
- `consumerDir` (required): Path to consumer/client source directory
- `format`: Output format (`json`, `markdown`, `summary`)
- `strict`: Strict mode - treat missing optional properties as warnings
- `direction`: Data flow direction (`producer_to_consumer`, `consumer_to_producer`, `bidirectional`)

**Example Output (Markdown):**

```markdown
# mnehmos.trace.mcp Analysis Report

**Generated**: 2025-12-11T02:11:48.624Z

## Summary

| Metric      | Count |
| ----------- | ----- |
| Total Tools | 12    |
| Total Calls | 34    |
| Matches     | 31    |
| Mismatches  | 3     |

## Mismatches

### get_character

- **Type**: MISSING_PROPERTY
- **Description**: Consumer expects "characterClass" but producer has "class"
- **Consumer**: ./components/CharacterSheet.tsx:45
- **Producer**: ./tools/character.ts:23
```

---

### `scaffold_consumer`

Generate consumer code from a producer schema. Creates TypeScript functions, React hooks, or Zustand actions that correctly call MCP tools.

**Parameters:**

- `producerDir` (required): Path to MCP server source directory
- `toolName` (required): Name of the tool to scaffold
- `target`: Output format (`typescript`, `javascript`, `react-hook`, `zustand-action`)
- `includeErrorHandling`: Include try/catch error handling (default: true)
- `includeTypes`: Include TypeScript type definitions (default: true)

**Example Output:**

```typescript
/**
 * Get character data
 * @trace-contract CONSUMER
 * Producer: ./server/character-tools.ts:23
 */
export async function getCharacter(
  client: McpClient,
  args: GetCharacterArgs
): Promise<GetCharacterResult> {
  try {
    const result = await client.callTool("get_character", args);
    return JSON.parse(result.content[0].text);
  } catch (error) {
    console.error("Error calling get_character:", error);
    throw error;
  }
}
```

---

### `scaffold_producer`

Generate producer schema stub from consumer usage. Creates MCP tool definition based on how client code calls it.

**Parameters:**

- `consumerDir` (required): Path to consumer source directory
- `toolName` (required): Name of the tool to scaffold
- `includeHandler`: Include handler stub (default: true)

**Example Output:**

```typescript
import { z } from "zod";

// Tool: get_character
// Scaffolded from consumer at ./components/CharacterSheet.tsx:14
// @trace-contract PRODUCER (scaffolded)

server.tool(
  "get_character",
  "TODO: Add description",
  {
    characterId: z.string(),
  },
  async (args) => {
    // TODO: Implement handler
    // Consumer expects: name, race, level, stats, characterClass
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            name: null, // TODO
            race: null, // TODO
            level: null, // TODO
          }),
        },
      ],
    };
  }
);
```

---

### `comment_contract`

Add cross-reference comments to validated producer/consumer pairs. Documents the contract relationship in both files.

**Parameters:**

- `producerDir` (required): Path to MCP server source directory
- `consumerDir` (required): Path to consumer source directory
- `toolName` (required): Name of the validated tool
- `dryRun`: Preview without writing (default: true)
- `style`: Comment style (`jsdoc`, `inline`, `block`)

**Example Preview:**

```javascript
// Producer comment:
/*
 * @trace-contract PRODUCER
 * Tool: get_character
 * Consumer: ./components/CharacterSheet.tsx:14
 * Args: characterId
 * Validated: 2025-12-11
 */

// Consumer comment:
/*
 * @trace-contract CONSUMER
 * Tool: get_character
 * Producer: ./server/character-tools.ts:23
 * Required Args: characterId
 * Validated: 2025-12-11
 */
```

---

### `init_project`

Initialize a trace project with `.trace-mcp` config directory for watch mode and caching.

**Parameters:**

- `projectDir` (required): Root directory for the trace project
- `producerPath` (required): Relative path to producer/server code
- `consumerPath` (required): Relative path to consumer/client code
- `producerLanguage`: Language (`typescript`, `python`, `go`, `rust`, `json_schema`)
- `consumerLanguage`: Language (`typescript`, `python`, `go`, `rust`, `json_schema`)

**Example:**

```typescript
const result = await client.callTool("init_project", {
  projectDir: "./my-app",
  producerPath: "./backend/src",
  consumerPath: "./frontend/src",
});
// Creates: ./my-app/.trace-mcp/config.json
```

---

### `watch`

Watch project files for changes and auto-revalidate contracts.

**Parameters:**

- `projectDir` (required): Root directory with `.trace-mcp` config
- `action`: `start`, `stop`, `status`, or `poll`

**Actions:**

- `start`: Begin watching for file changes
- `stop`: Stop watching
- `status`: Check current watcher state
- `poll`: Get pending events and last validation result

---

### `get_project_status`

Get the status of a trace project including config, cache state, and last validation result.

**Parameters:**

- `projectDir` (required): Root directory with `.trace-mcp` config

**Example Output:**

```json
{
  "success": true,
  "exists": true,
  "projectDir": "/path/to/project",
  "config": {
    "producer": { "path": "./server", "language": "typescript" },
    "consumer": { "path": "./client", "language": "typescript" }
  },
  "isWatching": true,
  "watcherStatus": { "running": true, "pendingChanges": 0 }
}
```

---

## Typical Workflow

### 1. Quick One-Off Analysis

```typescript
// Compare backend vs frontend, get markdown report
const result = await client.callTool("compare", {
  producerDir: "./backend/src",
  consumerDir: "./frontend/src",
  format: "markdown",
});
```

### 2. Continuous Validation (Watch Mode)

```typescript
// Initialize project
await client.callTool("init_project", {
  projectDir: ".",
  producerPath: "./server",
  consumerPath: "./client",
});

// Start watching
await client.callTool("watch", {
  projectDir: ".",
  action: "start",
});

// Later: poll for results
const status = await client.callTool("watch", {
  projectDir: ".",
  action: "poll",
});
```

### 3. Generate Missing Code

```typescript
// Generate client code from server schema
const consumer = await client.callTool("scaffold_consumer", {
  producerDir: "./server",
  toolName: "get_character",
  target: "react-hook",
});

// Or generate server stub from client usage
const producer = await client.callTool("scaffold_producer", {
  consumerDir: "./client",
  toolName: "save_settings",
});
```

### 4. Extract Multiple Formats

```typescript
// Extract from MCP server
const mcpSchemas = await client.callTool("extract_schemas", {
  rootDir: "./backend/mcp",
  include: ["**/*.ts"],
});

// Extract from OpenAPI specification
const openApiSchemas = await client.callTool("extract_schemas", {
  rootDir: "./backend",
  include: ["**/*.openapi.yaml"],
});

// Extract from tRPC router
const trpcSchemas = await client.callTool("extract_schemas", {
  rootDir: "./backend/trpc",
  include: ["**/*.router.ts"],
});

// Extract TypeScript interfaces
const interfaceSchemas = await client.callTool("extract_schemas", {
  rootDir: "./shared",
  include: ["**/*.types.ts"],
});

// Extract REST endpoints (Express/Fastify)
const restSchemas = await client.callTool("extract_schemas", {
  rootDir: "./backend/routes",
  include: ["**/*.ts"],
});

// Extract GraphQL schemas
const graphqlSchemas = await client.callTool("extract_schemas", {
  rootDir: "./backend/graphql",
  include: ["**/*.graphql", "**/resolvers.ts"],
});
```

### 5. Full-Stack GraphQL Validation

```typescript
// Extract GraphQL schema and resolvers
const producer = await client.callTool("extract_schemas", {
  rootDir: "./backend",
  include: ["**/*.graphql", "**/resolvers/**/*.ts"],
});

// Trace Apollo Client hooks
const consumer = await client.callTool("trace_usage", {
  rootDir: "./frontend/src",
  include: ["**/*.tsx"],
});

// Compare for schema drift
const report = await client.callTool("compare", {
  producerDir: "./backend",
  consumerDir: "./frontend/src",
  format: "markdown",
});
```

---

## Roadmap

### Completed

- [x] MCP tool schema extraction
- [x] Consumer usage tracing
- [x] Basic mismatch detection
- [x] Code scaffolding (consumer & producer)
- [x] Contract comments
- [x] Watch mode with auto-revalidation
- [x] OpenAPI/Swagger adapter support
- [x] TypeScript interface extraction
- [x] tRPC router support
- [x] Pluggable adapter registry
- [x] Pattern Matcher abstraction (Phase 2)
- [x] Cross-file import resolution (Phase 2)
- [x] REST endpoint detection - Express & Fastify (Phase 2)
- [x] HTTP client tracing - fetch & axios (Phase 2)
- [x] GraphQL support - SDL, Apollo Server, Apollo Client (Phase 2)

### Planned

- [ ] Python language support
- [ ] Go language support
- [ ] JSON Schema adapter
- [ ] gRPC/Protobuf support
- [ ] WebSocket message tracing
- [ ] OpenTelemetry integration

## License

MIT
