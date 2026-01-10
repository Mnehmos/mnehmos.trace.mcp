# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-10

### Added

- **Multi-language support**: TypeScript, Python, JSON Schema, GraphQL, Go, gRPC/Protobuf
- **Adapter system**: Extensible architecture for MCP, OpenAPI, and tRPC schema sources
- **Pattern matching**: Framework-aware detection for Express, Fastify, Next.js, and more
- **Import resolution**: Cross-file type tracking with caching for performance
- **Direction-aware comparison**: Producer-to-consumer, consumer-to-producer, and bidirectional flows
- **Watch mode**: Real-time file monitoring with automatic revalidation
- **Consumer scaffolding**: Generate TypeScript, React hooks, and Zustand actions from schemas
- **Contract comments**: Auto-generate cross-reference documentation between producer/consumer

### Fixed

- Stack overflow in TypeScript type conversion for self-referential types (cycle detection)
- MCP protocol compliance: all logging now uses stderr (stdout reserved for JSON-RPC)

### Changed

- All debug logging is now conditional via `DEBUG_TRACE_MCP` environment variable
- Console output uses `console.error` instead of `console.log` for MCP compliance

### MCP Tools

The following tools are exposed via the Model Context Protocol:

| Tool | Description |
|------|-------------|
| `extract_schemas` | Extract producer schemas from MCP server source code |
| `extract_file` | Extract schemas from a single TypeScript file |
| `trace_usage` | Trace how client code uses MCP tools |
| `trace_file` | Trace usage in a single file |
| `compare` | Full analysis: extract, trace, and compare schemas |
| `scaffold_consumer` | Generate consumer code from producer schema |
| `scaffold_producer` | Generate producer stub from consumer usage |
| `comment_contract` | Add cross-reference comments to validated pairs |
| `init_project` | Initialize a trace project with config |
| `watch` | Watch files for changes and auto-revalidate |
| `get_project_status` | Get project status including cache and validation |

### Supported Languages

| Language | Producer Extraction | Consumer Tracing |
|----------|---------------------|------------------|
| TypeScript | Full support (ts-morph) | Full support |
| Python | Decorator-based (@mcp.tool) | call_tool() patterns |
| JSON Schema | File-based tool definitions | N/A |
| GraphQL | Schema + operations | Hook usage tracing |
| Go | Interface-based (basic) | Client call patterns |
| gRPC/Protobuf | Service definitions | Client call patterns |

### Adapters

| Adapter | Description |
|---------|-------------|
| MCP | Model Context Protocol tool schemas |
| OpenAPI | OpenAPI 3.x specification parsing |
| tRPC | tRPC router procedure extraction |

## [0.5.0] - Previous

- Initial development release
- Basic TypeScript extraction and comparison
- MCP server integration
