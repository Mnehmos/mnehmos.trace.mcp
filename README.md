# mnehmos.trace.mcp

> Static analysis engine for detecting schema mismatches between data producers and consumers.

## What It Does

Trace MCP finds mismatches between:

- Backend API responses and frontend expectations
- MCP tool outputs and client code that uses them
- Service A's events and Service B's handlers

```
Producer returns:    { characterClass: "Fighter", hitPoints: 45 }
Consumer expects:    { class: "Fighter", hp: 45 }
Result:              ❌ Mismatch detected before runtime
```

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

Extract MCP tool definitions (ProducerSchemas) from server source code. Scans for `server.tool()` calls and parses their Zod schemas.

**Parameters:**

- `rootDir` (required): Root directory of MCP server source code
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

Trace how client code uses MCP tools. Finds `callTool()` invocations and tracks which properties are accessed on results.

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

---

## Roadmap

- [x] MCP tool schema extraction
- [x] Consumer usage tracing
- [x] Basic mismatch detection
- [x] Code scaffolding (consumer & producer)
- [x] Contract comments
- [x] Watch mode with auto-revalidation
- [ ] Enhanced TypeScript interface extraction (beyond Zod)
- [ ] OpenAPI/GraphQL adapter support
- [ ] Python/Go/Rust language support (partial)

## License

MIT
