# Trace MCP - Core Truth

> "Immutable scope boundaries. Reference before adding features."

## 1. Purpose

Trace MCP analyzes codebases to detect mismatches between data producers (MCP Tools) and consumers (Frontend/Client Code).

## 2. What It Does (The Yes List)

- **Extract Schemas**: From MCP tools, TypeScript types, API responses.
- **Trace Flow**: Follow properties through transformations (renames, destructuring).
- **Detect Mismatches**: Where producer output `!=` consumer expectation.
- **Report Only**: Structured data (JSON) or human summaries (Markdown).

## 3. What It Does NOT Do (The No List)

- ❌ **State**: No database, no memory between runs.
- ❌ **Fixing**: No codemods, no auto-repairs.
- ❌ **Decisions**: No logic to "decide" what to do with findings.
- ❌ **Integration**: No direct Slack/GitHub/CI API calls (that is the caller's job).

## 4. Design Principles

1.  **Pure Analysis**: `Codebase -> [Trace MCP] -> Structured Findings`
2.  **Stateless**: Every run is fresh.
3.  **Composable**: Can run just extraction, or just comparison.
4.  **Minimal Dependencies**: Do not bind to specific frameworks unless strictly for parsing.

## 5. Success Criteria

An agent can call Trace MCP tools and receive actionable data about schema mismatches without Trace MCP needing to know _what_ the agent will do with that information.
