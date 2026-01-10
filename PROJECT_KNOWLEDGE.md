# mnehmos.trace.mcp - Knowledge Base Document

## Quick Reference

| Property | Value |
|----------|-------|
| **Repository** | https://github.com/Mnehmos/mnehmos.trace.mcp |
| **Primary Language** | TypeScript |
| **Project Type** | MCP Server |
| **Version** | 1.0.0 |
| **Status** | Production Ready |
| **Last Updated** | 2025-01-10 |

## Overview

Trace MCP is a static analysis engine for detecting schema mismatches between data producers and consumers. It extracts schemas from MCP tools, REST endpoints, GraphQL schemas, TypeScript interfaces, Python decorators, Go interfaces, and gRPC/Protobuf services, then traces how client code uses them to identify incompatibilities before runtime. The tool supports multiple languages (TypeScript, Python, Go) and frameworks (Express, Fastify, tRPC, Apollo, fetch, axios, FastAPI, Flask, Gin, Chi) with 1050 passing tests across 16 test suites.

## Architecture

### System Design

Trace MCP follows a pure analysis pipeline architecture with four distinct stages: extraction, tracing, comparison, and reporting. The system is stateless and runs as an MCP server, exposing 11 tools for schema analysis, code generation, and project management. It uses ts-morph for AST parsing, a pluggable adapter registry for multi-framework support, and an extensible pattern matcher system for detecting code patterns across different libraries.

The server integrates with external services only for schema extraction (parsing OpenAPI specs, GraphQL SDL) and does not maintain state between runs. All analysis is performed in-memory and results are returned as structured JSON or formatted Markdown.

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| Main Entry | MCP server initialization and tool registration | `src/index.ts` |
| Extractor | Extract producer schemas from source files | `src/extract/index.ts` |
| Tracer | Trace consumer usage patterns | `src/trace/index.ts` |
| Comparator | Compare schemas and detect mismatches | `src/compare/index.ts` |
| Reporter | Format results as JSON/Markdown | `src/report/index.ts` |
| Adapter Registry | Pluggable schema extractors | `src/adapters/registry.ts` |
| Pattern Matcher | Extensible code pattern detection | `src/patterns/base.ts` |
| Import Resolver | Cross-file type resolution | `src/languages/import-resolver.ts` |
| Watch System | File watching and auto-revalidation | `src/watch/watcher.ts` |
| Tools | Code generation and scaffolding | `src/tools/index.ts` |
| Type Definitions | Core domain types | `src/types.ts` |
| MCP Adapter | MCP tool schema extraction | `src/adapters/mcp.ts` |
| OpenAPI Adapter | OpenAPI/Swagger schema extraction | `src/adapters/openapi/adapter.ts` |
| tRPC Adapter | tRPC router schema extraction | `src/adapters/trpc/adapter.ts` |
| GraphQL Adapter | GraphQL SDL schema extraction | `src/adapters/graphql/index.ts` |
| REST Patterns | Express/Fastify endpoint detection | `src/patterns/rest/index.ts` |
| HTTP Client Patterns | fetch/axios call detection | `src/patterns/http-clients/index.ts` |
| GraphQL Patterns | Apollo Server/Client detection | `src/patterns/graphql/index.ts` |

### Data Flow

```
Source Files → Extractor → ProducerSchema[]
                              ↓
Client Code → Tracer → ConsumerSchema[]
                              ↓
            Comparator → TraceResult (matches + mismatches)
                              ↓
            Reporter → JSON/Markdown output
```

Watch mode flow:
```
File Change → Watcher → Cache Check → Re-analyze → Update Results
```

## API Surface

### Public Interfaces

#### Tool: `extract_schemas`
- **Purpose**: Extract producer schemas from MCP servers, OpenAPI specs, TypeScript interfaces, tRPC routers, REST endpoints, or GraphQL schemas
- **Parameters**:
  - `rootDir` (string): Root directory of server source code
  - `include` (string[]): Glob patterns to include (default: **/*.ts)
  - `exclude` (string[]): Glob patterns to exclude (default: node_modules, dist)
- **Returns**: Object with success status, count of schemas found, and array of ProducerSchema objects

#### Tool: `extract_file`
- **Purpose**: Extract schemas from a single file
- **Parameters**:
  - `filePath` (string): Path to a TypeScript file
- **Returns**: Object with success status and extracted schemas

#### Tool: `trace_usage`
- **Purpose**: Trace how client code uses tools by detecting callTool invocations, HTTP requests, and property access patterns
- **Parameters**:
  - `rootDir` (string): Root directory of consumer/client source code
  - `include` (string[]): Glob patterns to include
  - `exclude` (string[]): Glob patterns to exclude
- **Returns**: Object with success status, count of usage sites, and array of ConsumerSchema objects

#### Tool: `trace_file`
- **Purpose**: Trace tool usage in a single file
- **Parameters**:
  - `filePath` (string): Path to a TypeScript file
- **Returns**: Object with success status and traced consumer schemas

#### Tool: `compare`
- **Purpose**: Full pipeline - extract producer schemas, trace consumer usage, compare, and generate report
- **Parameters**:
  - `producerDir` (string): Path to MCP server source directory
  - `consumerDir` (string): Path to consumer/client source directory
  - `format` (enum): Output format - json, markdown, or summary (default: json)
  - `strict` (boolean): Treat missing optional properties as warnings
  - `direction` (enum): Data flow direction - producer_to_consumer, consumer_to_producer, or bidirectional (default: producer_to_consumer)
- **Returns**: TraceResult object with matches, mismatches, and summary statistics

#### Tool: `scaffold_consumer`
- **Purpose**: Generate client code from producer schema (TypeScript function, React hook, or Zustand action)
- **Parameters**:
  - `producerDir` (string): Path to MCP server source directory
  - `toolName` (string): Name of the tool to scaffold
  - `target` (enum): Output format - typescript, javascript, react-hook, or zustand-action (default: typescript)
  - `includeErrorHandling` (boolean): Include try/catch blocks (default: true)
  - `includeTypes` (boolean): Include TypeScript type definitions (default: true)
- **Returns**: Generated code as string

#### Tool: `scaffold_producer`
- **Purpose**: Generate server stub from client usage patterns
- **Parameters**:
  - `consumerDir` (string): Path to consumer source directory
  - `toolName` (string): Name of the tool to scaffold
  - `includeHandler` (boolean): Include handler stub (default: true)
- **Returns**: Generated MCP tool definition as string

#### Tool: `comment_contract`
- **Purpose**: Add cross-reference comments to validated producer/consumer pairs for documentation
- **Parameters**:
  - `producerDir` (string): Path to MCP server source directory
  - `consumerDir` (string): Path to consumer source directory
  - `toolName` (string): Name of the validated tool
  - `dryRun` (boolean): Preview without writing (default: true)
  - `style` (enum): Comment style - jsdoc, inline, or block (default: block)
- **Returns**: Preview or confirmation of added comments

#### Tool: `init_project`
- **Purpose**: Initialize a trace project with .trace-mcp config directory
- **Parameters**:
  - `projectDir` (string): Root directory for the trace project
  - `producerPath` (string): Relative path to producer/server code
  - `consumerPath` (string): Relative path to consumer/client code
  - `producerLanguage` (enum): typescript, python, go, rust, or json_schema (default: typescript)
  - `consumerLanguage` (enum): typescript, python, go, rust, or json_schema (default: typescript)
- **Returns**: Success status and path to created config

#### Tool: `watch`
- **Purpose**: Watch files for changes and auto-revalidate contracts
- **Parameters**:
  - `projectDir` (string): Root directory with .trace-mcp config
  - `action` (enum): start, stop, status, or poll
- **Returns**: Watcher status, pending changes count, or validation results

#### Tool: `get_project_status`
- **Purpose**: Get project configuration, cache state, and last validation result
- **Parameters**:
  - `projectDir` (string): Root directory with .trace-mcp config
- **Returns**: Object with config, watcher status, and last validation results

### Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| No environment variables required | - | - | Trace MCP operates stateless without external configuration |

Configuration is managed through `.trace-mcp/config.json` when using watch mode, which stores producer/consumer paths and language settings.

## Usage Examples

### Basic Usage

```typescript
// Extract schemas from MCP server
const result = await client.callTool("extract_schemas", {
  rootDir: "./backend/src",
  include: ["**/*.ts"],
  exclude: ["node_modules", "dist"]
});
// Returns: { success: true, count: 12, schemas: [...] }

// Trace usage in client code
const usage = await client.callTool("trace_usage", {
  rootDir: "./frontend/src",
  include: ["**/*.ts", "**/*.tsx"]
});
// Returns: { success: true, count: 34, consumers: [...] }

// Full comparison
const report = await client.callTool("compare", {
  producerDir: "./backend/src",
  consumerDir: "./frontend/src",
  format: "markdown"
});
// Returns formatted markdown report with matches and mismatches
```

### Advanced Patterns

```typescript
// Initialize watch mode project
await client.callTool("init_project", {
  projectDir: "./my-app",
  producerPath: "./server",
  consumerPath: "./client"
});

// Start watching for changes
await client.callTool("watch", {
  projectDir: "./my-app",
  action: "start"
});

// Generate React hook from MCP tool schema
const hook = await client.callTool("scaffold_consumer", {
  producerDir: "./server",
  toolName: "get_character",
  target: "react-hook",
  includeErrorHandling: true
});

// Extract GraphQL schemas and trace Apollo Client usage
const graphql = await client.callTool("extract_schemas", {
  rootDir: "./backend/graphql",
  include: ["**/*.graphql", "**/resolvers.ts"]
});

const apolloUsage = await client.callTool("trace_usage", {
  rootDir: "./frontend/src",
  include: ["**/*.tsx"]
});

// Compare for schema drift
const drift = await client.callTool("compare", {
  producerDir: "./backend/graphql",
  consumerDir: "./frontend/src",
  format: "markdown",
  strict: true
});
```

## Dependencies

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @modelcontextprotocol/sdk | ^1.0.0 | MCP protocol implementation |
| ts-morph | ^21.0.0 | TypeScript AST parsing and traversal |
| zod | ^3.22.0 | Schema validation and runtime type checking |
| zod-to-json-schema | ^3.22.0 | Convert Zod schemas to JSON Schema format |
| @apidevtools/swagger-parser | ^10.1.0 | Parse and validate OpenAPI/Swagger specifications |
| chokidar | ^4.0.3 | File system watching for watch mode |
| graphql | ^16.8.1 | GraphQL SDL parsing and schema handling |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ^5.3.0 | TypeScript compiler |
| tsx | ^4.7.0 | TypeScript execution for development |
| vitest | ^1.6.0 | Testing framework |
| @types/node | ^20.10.0 | Node.js type definitions |
| @types/glob | ^8.1.0 | Glob pattern matching type definitions |
| @types/swagger-schema-official | ^2.0.25 | Swagger schema type definitions |
| glob | ^13.0.0 | File pattern matching |
| openapi-types | ^12.1.3 | OpenAPI type definitions |

## Integration Points

### Works With

| Project | Integration Type | Description |
|---------|-----------------|-------------|
| MCP Servers | Analysis Target | Extracts tool schemas from any MCP server implementation using Zod |
| OpenAPI/Swagger APIs | Analysis Target | Extracts schemas from OpenAPI 3.0+ specifications |
| tRPC Routers | Analysis Target | Extracts procedure schemas from tRPC applications |
| Express Applications | Analysis Target | Detects REST endpoints and request/response schemas |
| Fastify Applications | Analysis Target | Detects REST endpoints with JSON Schema validation |
| GraphQL Servers | Analysis Target | Parses SDL schemas and Apollo Server resolvers |
| Apollo Client | Analysis Target | Traces useQuery, useMutation, and useSubscription hooks |
| TypeScript Projects | Analysis Target | Extracts interface and type definitions |

### External Services

| Service | Purpose | Required |
|---------|---------|----------|
| No external services required | - | - |

Trace MCP operates entirely locally with no external API dependencies. All parsing and analysis is performed using local libraries.

## Development Guide

### Prerequisites

- Node.js 20.10.0 or higher
- npm or compatible package manager
- TypeScript 5.3.0 or higher

### Setup

```bash
# Clone the repository
git clone https://github.com/Mnehmos/mnehmos.trace.mcp.git
cd mnehmos.trace.mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Running Locally

```bash
# Development mode with auto-reload
npm run dev

# Production build
npm run build

# Start production server
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- src/patterns/rest/express.test.ts
```

### Building

```bash
# Build for production
npm run build

# Output location
# Compiled JavaScript in dist/
# Type definitions in dist/*.d.ts
# Source maps in dist/*.js.map
```

## Maintenance Notes

### Known Issues

1. Rust language parser is not yet implemented - TypeScript, Python, and Go are fully supported
2. WebSocket message tracing is planned for future releases
3. Some inline GraphQL queries may not be fully traced (operation name extraction)

### Future Considerations

1. Implement Rust language parser for Actix and Rocket
2. Add WebSocket message pattern tracing
3. Integrate OpenTelemetry for distributed tracing correlation
4. Improve performance with parallel processing for large codebases
5. Add support for more Python frameworks (Django REST, Starlette)
6. Expand Go framework support (Echo, Fiber)

### Code Quality

| Metric | Status |
|--------|--------|
| Tests | 1050 tests passing across 16 suites |
| CI/CD | GitHub Actions (Node 18.x, 20.x, 22.x) |
| Type Safety | TypeScript strict mode enabled |
| Documentation | JSDoc comments in source + comprehensive README |
| Source Files | 84 TypeScript files, 26,454 lines |

---

## Appendix: File Structure

```
mnehmos.trace.mcp/
├── src/
│   ├── index.ts                    # MCP server entry point and tool registration
│   ├── types.ts                    # Core domain types (ProducerSchema, ConsumerSchema, TraceResult)
│   ├── extract/
│   │   └── index.ts                # Producer schema extraction orchestration
│   ├── trace/
│   │   └── index.ts                # Consumer usage tracing orchestration
│   ├── compare/
│   │   └── index.ts                # Schema comparison and mismatch detection
│   ├── report/
│   │   └── index.ts                # Result formatting (JSON/Markdown)
│   ├── adapters/
│   │   ├── registry.ts             # Pluggable adapter system
│   │   ├── mcp.ts                  # MCP tool schema adapter
│   │   ├── openapi/
│   │   │   ├── adapter.ts          # OpenAPI schema extraction
│   │   │   ├── parser.ts           # OpenAPI spec parser
│   │   │   └── convert.ts          # OpenAPI to internal schema conversion
│   │   ├── trpc/
│   │   │   ├── adapter.ts          # tRPC procedure extraction
│   │   │   ├── parser.ts           # tRPC router parser
│   │   │   └── extractor.ts        # tRPC Zod schema extractor
│   │   └── graphql/
│   │       ├── index.ts            # GraphQL adapter entry
│   │       └── sdl-parser.ts       # GraphQL SDL parser
│   ├── patterns/
│   │   ├── base.ts                 # BasePattern abstract class
│   │   ├── types.ts                # Pattern match interfaces
│   │   ├── registry.ts             # Pattern registry
│   │   ├── extractors.ts           # AST node extractors
│   │   ├── rest/
│   │   │   ├── express.ts          # Express pattern detection
│   │   │   ├── fastify.ts          # Fastify pattern detection
│   │   │   ├── middleware.ts       # Validation middleware detection
│   │   │   └── response-inference.ts # Response type inference
│   │   ├── http-clients/
│   │   │   ├── fetch.ts            # fetch() pattern detection
│   │   │   ├── axios.ts            # axios pattern detection
│   │   │   ├── url-extractor.ts    # URL extraction from calls
│   │   │   └── type-inference.ts   # Response type inference
│   │   └── graphql/
│   │       ├── apollo-server.ts    # Apollo Server resolver detection
│   │       └── apollo-client.ts    # Apollo Client hook detection
│   ├── languages/
│   │   ├── base.ts                 # Language parser interface
│   │   ├── bootstrap.ts            # Language parser initialization
│   │   ├── typescript.ts           # TypeScript parser implementation
│   │   ├── python.ts               # Python parser (stub)
│   │   ├── json-schema.ts          # JSON Schema parser (stub)
│   │   └── import-resolver.ts      # Cross-file import resolution
│   ├── tools/
│   │   ├── index.ts                # Tool exports
│   │   ├── scaffold.ts             # Code generation tools
│   │   └── contract-comments.ts    # Contract comment generation
│   └── watch/
│       ├── index.ts                # Watch mode exports
│       ├── watcher.ts              # File system watcher
│       ├── project.ts              # Project configuration
│       └── cache.ts                # Validation cache
├── test/                           # Test suites (1050 tests across 16 files)
├── dist/                           # Compiled output
├── package.json                    # Project metadata and dependencies
├── tsconfig.json                   # TypeScript configuration
├── vitest.config.ts                # Test framework configuration
├── README.md                       # User documentation
├── DESIGN.md                       # Technical design documentation
├── CORE_TRUTH.md                   # Project scope and principles
├── VISION.md                       # Project vision and goals
├── GAP_ANALYSIS.md                 # Feature gap analysis
└── PROJECT_KNOWLEDGE.md            # This document
```

---

*Updated for v1.0.0 Production Release | 2025-01-10*
*Source: https://github.com/Mnehmos/mnehmos.trace.mcp*
