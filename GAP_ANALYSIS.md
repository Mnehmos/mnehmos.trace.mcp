# Trace MCP - Gap Analysis

> **Document Version**: 1.0  
> **Date**: 2025-12-28  
> **Status**: For Review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Assessment](#2-current-state-assessment)
3. [Gap Analysis Matrix](#3-gap-analysis-matrix)
4. [Prioritized Recommendations](#4-prioritized-recommendations)
5. [Architectural Changes Required](#5-architectural-changes-required)
6. [Risk Assessment](#6-risk-assessment)
7. [Appendix](#7-appendix)

---

## 1. Executive Summary

### Purpose

This document provides a comprehensive gap analysis of the `mnehmos.trace.mcp` project—a static analysis engine for detecting schema mismatches between data producers and consumers. The analysis identifies critical gaps that limit the tool's applicability beyond MCP-specific use cases.

### Key Findings

| Finding | Severity | Description |
|---------|----------|-------------|
| **MCP-Coupled Extraction** | Critical | Producer extraction only supports `server.tool()` and `@mcp.tool()` patterns |
| **Limited Language Support** | High | Only TypeScript (full) and Python (partial) are implemented |
| **No Generic API Support** | High | No REST, GraphQL, or gRPC endpoint detection |
| **Consumer Tracing Gaps** | Medium | Only traces MCP-specific call patterns; no HTTP client tracing |
| **Single Adapter** | Medium | `MCPAdapter` is the only implementation despite extensible interface |

### Strategic Recommendation

The codebase has **sound architectural foundations** for extensibility. The existing pipeline (Extract → Trace → Compare → Report), the `SchemaAdapter` interface, and the `LanguageParser` abstraction are well-designed. However, the **implementation is heavily MCP-coupled**, limiting adoption for general-purpose schema mismatch detection.

**Recommended Path Forward**:
1. **Phase 1** (2-4 weeks): Quick wins—TypeScript interface extraction, OpenAPI adapter
2. **Phase 2** (4-8 weeks): Core extensions—HTTP client tracing, GraphQL support
3. **Phase 3** (8-16 weeks): Full generalization—Multi-language parity, plugin system

---

## 2. Current State Assessment

### 2.1 Architecture Overview

The system follows a clean **four-stage pipeline**:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Extractor  │ → │   Tracer    │ → │  Comparator │ → │  Reporter   │
├─────────────┤    ├─────────────┤    ├─────────────┤    ├─────────────┤
│ ProducerSchema[] │ ConsumerSchema[] │ TraceResult │ JSON/Markdown │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

**Key Source Files**:
- [`src/languages/base.ts`](src/languages/base.ts) - Language abstraction interface
- [`src/adapters/mcp.ts`](src/adapters/mcp.ts) - Schema adapter implementation
- [`src/core/types.ts`](src/core/types.ts) - Core type definitions (NormalizedSchema IR)

### 2.2 What Works Well

| Component | Status | Details |
|-----------|--------|---------|
| **Pipeline Architecture** | ✅ Solid | Clean separation of concerns; stateless, composable stages |
| **TypeScript Extraction** | ✅ Full | Zod schemas, registry patterns, exported schemas (933 lines) |
| **Normalized IR** | ✅ Extensible | `NormalizedSchema` supports complex types (unions, intersections, refs) |
| **Adapter Interface** | ✅ Future-Ready | `SchemaAdapter` interface defined in [`src/core/types.ts:226-243`](src/core/types.ts:226) |
| **Schema Source Types** | ✅ Comprehensive | 18 source kinds defined (openapi, graphql, grpc, prisma, etc.) |
| **Comparison Engine** | ✅ Robust | Direction-aware comparison with semantic matching support |

### 2.3 Language Coverage Matrix

| Language | Producer Extraction | Consumer Tracing | Implementation Quality |
|----------|---------------------|------------------|------------------------|
| **TypeScript** | ✅ Full | ⚠️ Partial | 933 lines, AST-based (ts-morph) |
| **Python** | ⚠️ Partial | ⚠️ Partial | 352 lines, regex-based |
| **Go** | ❌ None | ❌ None | Mentioned in roadmap |
| **Rust** | ❌ None | ❌ None | Mentioned in roadmap |
| **Java/C#** | ❌ None | ❌ None | Not planned |
| **JSON Schema** | ⚠️ Static | N/A | Read-only adapter |

### 2.4 MCP-Specific Coupling Points

#### 2.4.1 Producer Extraction ([`src/languages/typescript.ts:143-160`](src/languages/typescript.ts:143))

```typescript
// Only detects server.tool() patterns
private findToolCalls(sourceFile: Node): CallExpression[] {
  if (methodName === 'tool') {  // ← Hardcoded MCP pattern
    toolCalls.push(node);
  }
}
```

**Missing Patterns**:
- REST API endpoint handlers (`app.get()`, `router.post()`)
- GraphQL resolvers (`Query: { user: () => ... }`)
- tRPC procedures (`router.query()`, `router.mutation()`)
- Express/Fastify/Koa route definitions

#### 2.4.2 Consumer Tracing ([`src/languages/typescript.ts:823-872`](src/languages/typescript.ts:823))

```typescript
// Only traces MCP call patterns
const callPatterns = ['callTool', 'call', 'invoke', 'execute'];
```

**Missing Patterns**:
- HTTP clients: `fetch()`, `axios.*`, `ky.*`, `got()`
- GraphQL clients: `useQuery()`, `useMutation()`, `client.query()`
- tRPC clients: `trpc.*.useQuery()`, `trpc.*.mutate()`

#### 2.4.3 Output Schema Hardcoding ([`src/languages/typescript.ts:744-760`](src/languages/typescript.ts:744))

```typescript
private getMcpOutputSchema(): JSONSchema {
  return {
    type: 'object',
    properties: {
      content: { /* MCP response structure */ }
    }
  };
}
```

All extracted tools assume MCP response format, ignoring actual return types.

#### 2.4.4 Single Adapter Implementation ([`src/adapters/mcp.ts`](src/adapters/mcp.ts))

Only `MCPAdapter` exists despite [`SchemaSourceKind`](src/core/types.ts:16-41) defining:
- API Layer: `openapi`, `graphql`, `grpc`, `trpc`, `asyncapi`
- Validation Layer: `zod`, `yup`, `joi`, `json_schema`, `typebox`
- Database Layer: `prisma`, `drizzle`, `typeorm`

---

## 3. Gap Analysis Matrix

### 3.1 Language Support Gaps

| Gap ID | Current State | Desired State | Impact | Priority | Effort |
|--------|---------------|---------------|--------|----------|--------|
| **L-01** | TypeScript: AST-based, full Zod support | Add TS interface extraction (non-Zod) | High - Many APIs don't use Zod | P1 | Medium |
| **L-02** | Python: Regex-based, `@mcp.tool()` only | AST-based (tree-sitter), FastAPI/Flask support | High - Major ecosystem | P2 | High |
| **L-03** | Go: None | Basic extraction (struct tags, handlers) | Medium - Growing ecosystem | P3 | High |
| **L-04** | Rust: None | Basic extraction (serde, actix) | Low - Niche | P4 | High |
| **L-05** | Java/C#: None | Spring Boot, ASP.NET support | Low - Enterprise, separate tools | P5 | Very High |

### 3.2 API Pattern Support Gaps

| Gap ID | Current State | Desired State | Impact | Priority | Effort |
|--------|---------------|---------------|--------|----------|--------|
| **A-01** | MCP `server.tool()` only | REST endpoint detection (Express, Fastify, Koa) | Critical - REST is dominant | P1 | Medium |
| **A-02** | No GraphQL support | Resolver extraction, schema introspection | High - Common in modern stacks | P2 | Medium |
| **A-03** | No gRPC support | Protobuf parsing, service definitions | Medium - Microservices | P3 | High |
| **A-04** | No tRPC support | Procedure extraction | Medium - Growing in TS ecosystem | P2 | Low |
| **A-05** | No OpenAPI ingestion | Parse OpenAPI specs as producer schemas | High - Standard documentation | P1 | Low |

### 3.3 Schema Source Support Gaps

| Gap ID | Current State | Desired State | Impact | Priority | Effort |
|--------|---------------|---------------|--------|----------|--------|
| **S-01** | Zod-only extraction | TypeScript interface/type extraction | Critical - Most TS doesn't use Zod | P1 | Medium |
| **S-02** | No OpenAPI adapter | OpenAPI 3.x → NormalizedSchema | High - Industry standard | P1 | Low |
| **S-03** | No Protobuf adapter | .proto → NormalizedSchema | Medium - gRPC prerequisite | P3 | Medium |
| **S-04** | No JSON Schema adapter | JSON Schema → NormalizedSchema | Low - Types defined but unused | P2 | Low |
| **S-05** | No Prisma/Drizzle adapter | ORM schema → NormalizedSchema | Low - Data layer | P4 | Medium |

### 3.4 Consumer Pattern Support Gaps

| Gap ID | Current State | Desired State | Impact | Priority | Effort |
|--------|---------------|---------------|--------|----------|--------|
| **C-01** | `callTool()` patterns only | `fetch()` / `axios` tracing | Critical - Universal HTTP | P1 | High |
| **C-02** | No React Query tracing | `useQuery()` / `useMutation()` | High - Popular data layer | P2 | Medium |
| **C-03** | No GraphQL client tracing | Apollo, URQL, graphql-request | High - If A-02 implemented | P2 | Medium |
| **C-04** | No type-only consumers | Interface imports as expectations | Medium - Contract-first | P3 | Medium |

### 3.5 Data Flow Tracking Gaps

| Gap ID | Current State | Desired State | Impact | Priority | Effort |
|--------|---------------|---------------|--------|----------|--------|
| **D-01** | Property access tracing limited | Full data flow analysis (SSA-style) | Medium - Better accuracy | P3 | Very High |
| **D-02** | No cross-file tracing | Follow imports/exports | High - Real apps are modular | P2 | High |
| **D-03** | No transformation tracking | Track maps, spreads, renames | Medium - Common patterns | P3 | High |
| **D-04** | No type narrowing awareness | Understand conditionals | Low - Advanced feature | P4 | Very High |

---

## 4. Prioritized Recommendations

### Phase 1: Quick Wins (2-4 weeks)

**Goal**: Maximize value with minimal effort; keep MCP support, add generalization.

| Item | Gap ID(s) | Description | Effort | Value |
|------|-----------|-------------|--------|-------|
| **1.1** | S-02 | OpenAPI Adapter - Parse OpenAPI 3.x specs | 1 week | High |
| **1.2** | S-01 | TS Interface Extraction - Extract `interface` and `type` definitions | 1 week | Critical |
| **1.3** | A-04 | tRPC Support - Similar to MCP, reuse patterns | 1 week | Medium |
| **1.4** | S-04 | JSON Schema Adapter - Already partially typed | 3 days | Low |

**Deliverables**:
- `src/adapters/openapi.ts` - OpenAPI adapter
- `src/languages/typescript.ts` - Extended interface extraction
- `src/adapters/json-schema.ts` - JSON Schema adapter (refactor existing)

### Phase 2: Core Extensions (4-8 weeks)

**Goal**: Support mainstream API patterns and HTTP consumer tracing.

| Item | Gap ID(s) | Description | Effort | Value |
|------|-----------|-------------|--------|-------|
| **2.1** | A-01 | REST Endpoint Detection - Express, Fastify, Koa handlers | 2 weeks | Critical |
| **2.2** | C-01 | HTTP Client Tracing - fetch, axios, ky | 2 weeks | Critical |
| **2.3** | A-02, C-03 | GraphQL Support - Schema + client tracing | 2 weeks | High |
| **2.4** | D-02 | Cross-File Resolution - Import/export following | 2 weeks | High |

**Deliverables**:
- `src/patterns/rest.ts` - REST endpoint matchers
- `src/patterns/http-clients.ts` - HTTP client call patterns
- `src/adapters/graphql.ts` - GraphQL adapter
- Enhanced import resolution in language parsers

### Phase 3: Full Generalization (8-16 weeks)

**Goal**: Multi-language parity and plugin architecture for community extensions.

| Item | Gap ID(s) | Description | Effort | Value |
|------|-----------|-------------|--------|-------|
| **3.1** | L-02 | Python AST - tree-sitter based, FastAPI/Flask | 4 weeks | High |
| **3.2** | A-03, S-03 | gRPC/Protobuf - Full support | 3 weeks | Medium |
| **3.3** | L-03 | Go Support - struct tags, handlers | 3 weeks | Medium |
| **3.4** | - | Plugin System - External adapters/parsers | 3 weeks | High |
| **3.5** | D-01 | Advanced Data Flow - SSA-style analysis | 4 weeks | Medium |

**Deliverables**:
- `src/languages/python-ast.ts` - tree-sitter Python parser
- `src/adapters/grpc.ts` - Protobuf/gRPC adapter
- `src/languages/go.ts` - Go parser
- `src/plugins/` - Plugin loader and registry
- Enhanced `src/trace/` with data flow graph

---

## 5. Architectural Changes Required

### 5.1 Adapter Pattern Improvements

**Current**: Monolithic `MCPAdapter` handling all extraction.

**Proposed**: Pattern-specific adapters with unified registration.

```typescript
// src/adapters/registry.ts
export class AdapterRegistry {
  private adapters: Map<SchemaSourceKind, SchemaAdapter> = new Map();
  
  register(adapter: SchemaAdapter): void {
    this.adapters.set(adapter.kind, adapter);
  }
  
  resolve(ref: SchemaRef): SchemaAdapter | undefined {
    return this.adapters.get(ref.source);
  }
}
```

**Required Adapters**:
| Adapter | Source Kind | Priority |
|---------|-------------|----------|
| `OpenAPIAdapter` | `openapi` | P1 |
| `GraphQLAdapter` | `graphql` | P2 |
| `JSONSchemaAdapter` | `json_schema` | P1 |
| `ProtobufAdapter` | `grpc` | P3 |
| `tRPCAdapter` | `trpc` | P2 |

### 5.2 Pattern Matcher Abstraction

**Purpose**: Decouple endpoint detection from language parsing.

```typescript
// src/patterns/base.ts
export interface PatternMatcher {
  readonly name: string;
  readonly patterns: PatternDef[];
  
  match(node: ASTNode): MatchResult | null;
  extract(match: MatchResult): ProducerSchema;
}

// Pattern definitions
interface PatternDef {
  type: 'call' | 'decorator' | 'object' | 'export';
  signature: string | RegExp;
  schemaLocation: 'arg:1' | 'arg:2' | 'return' | 'type-param';
}
```

**Benefits**:
- New patterns added without modifying parsers
- Testable in isolation
- Community-contributed patterns

### 5.3 Consumer Call Registry

**Purpose**: Configurable client call detection beyond MCP.

```typescript
// src/trace/call-registry.ts
export interface ClientCallPattern {
  name: string;
  methods: string[];
  toolNameExtractor: (call: CallExpression) => string | null;
  argsExtractor: (call: CallExpression) => Record<string, unknown>;
}

// Built-in patterns
const MCP_PATTERN: ClientCallPattern = {
  name: 'mcp',
  methods: ['callTool', 'call', 'invoke', 'execute'],
  // ...
};

const FETCH_PATTERN: ClientCallPattern = {
  name: 'fetch',
  methods: ['fetch', 'get', 'post', 'put', 'delete'],
  // ...
};
```

### 5.4 Language Parser Enhancements

**Current [`LanguageParser`](src/languages/base.ts:41-63) interface** is sufficient, but implementations need:

| Enhancement | Files Affected | Description |
|-------------|----------------|-------------|
| Interface extraction | `typescript.ts` | Parse `interface Foo {}` and `type Bar = {}` |
| Import resolution | `typescript.ts`, `python.ts` | Follow imports to resolve refs |
| Pattern injection | All parsers | Accept `PatternMatcher[]` config |
| AST migration (Python) | `python.ts` | Replace regex with tree-sitter |

### 5.5 Plugin Architecture (Phase 3)

```typescript
// src/plugins/loader.ts
export interface TracePlugin {
  readonly name: string;
  readonly version: string;
  
  adapters?: SchemaAdapter[];
  patterns?: PatternMatcher[];
  parsers?: LanguageParser[];
}

export class PluginLoader {
  async load(path: string): Promise<TracePlugin>;
  register(plugin: TracePlugin): void;
}
```

**Plugin Manifest** (`trace-plugin.json`):
```json
{
  "name": "trace-mcp-spring",
  "version": "1.0.0",
  "adapters": ["./adapters/spring-boot.js"],
  "patterns": ["./patterns/spring-annotations.js"]
}
```

---

## 6. Risk Assessment

### 6.1 Breaking Changes

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **API surface changes** | Medium | High | Version bump (0.x → 1.x); deprecation warnings |
| **Normalized IR evolution** | Low | High | Additive-only changes; `unknown` type as fallback |
| **Tool output format changes** | Low | Medium | Schema versioning in output |

### 6.2 Scope Creep Concerns

| Concern | Risk Level | Boundary |
|---------|------------|----------|
| **Full type checker** | High | Do NOT implement type inference; use heuristics |
| **Runtime analysis** | Medium | Stay static; no execution tracing |
| **Auto-repair/codemods** | Low | Explicitly forbidden in [CORE_TRUTH.md](CORE_TRUTH.md) |
| **CI/CD integration** | Low | Out of scope per CORE_TRUTH; caller's responsibility |

### 6.3 Complexity vs. Value Tradeoffs

| Feature | Complexity | Value | Recommendation |
|---------|------------|-------|----------------|
| Full SSA data flow | Very High | Medium | Defer; simple heuristics first |
| Go/Rust support | High | Medium | Community contribution path |
| Python AST | High | High | Worth investment; tree-sitter |
| REST detection | Medium | Critical | Prioritize |
| GraphQL | Medium | High | Prioritize |
| Plugin system | Medium | High | Phase 3; enables scaling |

### 6.4 Dependency Risks

| Dependency | Risk | Mitigation |
|------------|------|------------|
| `ts-morph` | Low | Stable, well-maintained |
| `zod-to-json-schema` | Low | Only for Zod parsing |
| `tree-sitter` (proposed) | Medium | Battle-tested; WASM builds available |
| Community adapters | Medium | Strict plugin API; version pinning |

---

## 7. Appendix

### 7.1 Source File Reference

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| [`src/languages/typescript.ts`](src/languages/typescript.ts) | 933 | TS producer/consumer extraction | Full, MCP-coupled |
| [`src/languages/python.ts`](src/languages/python.ts) | 352 | Python extraction | Partial, regex-based |
| [`src/languages/base.ts`](src/languages/base.ts) | 63 | Parser interface | Good abstraction |
| [`src/adapters/mcp.ts`](src/adapters/mcp.ts) | 382 | MCP adapter | Only implementation |
| [`src/core/types.ts`](src/core/types.ts) | 243 | Core IR types | Well-designed |
| [`src/compare/index.ts`](src/compare/index.ts) | - | Comparison engine | Robust |
| [`src/report/index.ts`](src/report/index.ts) | - | Report generation | Complete |

### 7.2 Schema Source Kinds (Defined vs. Implemented)

```typescript
// From src/core/types.ts:16-41
export type SchemaSourceKind =
  // API Layer
  | "openapi"     // ❌ Not implemented
  | "graphql"     // ❌ Not implemented
  | "grpc"        // ❌ Not implemented
  | "trpc"        // ❌ Not implemented
  | "asyncapi"    // ❌ Not implemented
  // Validation Layer
  | "zod"         // ✅ Via TypeScript parser
  | "yup"         // ❌ Not implemented
  | "joi"         // ❌ Not implemented
  | "json_schema" // ⚠️ Static only
  | "typebox"     // ❌ Not implemented
  // Database Layer
  | "prisma"      // ❌ Not implemented
  | "drizzle"     // ❌ Not implemented
  | "typeorm"     // ❌ Not implemented
  // Language Types
  | "typescript"  // ✅ Full support
  | "python"      // ⚠️ Partial support
  // Runtime
  | "mcp"         // ✅ Primary focus
  | "json_sample" // ❌ Not implemented
  // Escape hatch
  | "custom";     // Available
```

### 7.3 Design Principles Alignment

From [CORE_TRUTH.md](CORE_TRUTH.md):

| Principle | Gap Analysis Impact |
|-----------|---------------------|
| **Pure Analysis** | ✅ All recommendations maintain input→output purity |
| **Stateless** | ✅ No persistence proposed |
| **Composable** | ✅ Adapter/pattern registries enhance composability |
| **Minimal Dependencies** | ⚠️ tree-sitter adds dependency; justified for accuracy |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-28 | Architect Agent | Initial gap analysis |

---

*End of Gap Analysis Document*
