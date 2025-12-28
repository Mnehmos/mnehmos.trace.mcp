# Trace MCP - Technical Design

## 1. Domain Entities

### 1.1 Producer Schema (The Source)

Represents what an MCP Server Tool _provides_.

```typescript
type ProducerSchema = {
  toolName: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  sourceFile: string;
  sourceLine: number;
};
```

### 1.2 Consumer Schema (The Usage)

Represents what client code _expects_.

```typescript
type ConsumerSchema = {
  callSite: string;
  toolName: string;
  argumentsProvided: Record<string, any>;
  expectedProperties: string[];
};
```

### 1.3 Analysis Result (The Report)

```typescript
type TraceResult = {
  matches: Match[];
  mismatches: Mismatch[];
};

type Mismatch = {
  toolName: string;
  issueType: "MISSING_PROPERTY" | "TYPE_MISMATCH" | "ARGUMENT_ERROR";
  description: string;
  producerDefinition: Location;
  consumerUsage: Location;
};
```

## 2. Architecture

### 2.1 The Pipeline

1.  **Extractor**: `source -> ProducerSchema[]`
2.  **Tracer**: `usage -> ConsumerSchema[]`
3.  **Comparator**: `(Producer[], Consumer[]) -> TraceResult`
4.  **Reporter**: `TraceResult -> JSON/Markdown`

### 2.2 Extraction Strategy

- **Tools**: Use `ts-morph` to find `server.tool()` calls. Extract Zod schemas to JSON Schema.
- **Usage**: Use `ts-morph` to find `client.callTool()` calls.

## 3. Technology Choices

- **Language**: TypeScript (strict)
- **Parser**: `ts-morph`
- **Validation**: `zod`, `zod-to-json-schema`
