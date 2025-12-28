/**
 * Language Parser Bootstrap
 * Registers all available language parsers
 */

import { registerParser } from './index.js';
import { TypeScriptParser } from './typescript.js';
import { PythonParser } from './python.js';
import { JsonSchemaParser } from './json-schema.js';

/**
 * Register all built-in language parsers
 * Call this once at application startup
 */
export function bootstrapLanguageParsers(): void {
  // Register TypeScript parser
  registerParser('typescript', new TypeScriptParser());

  // Register Python parser
  registerParser('python', new PythonParser());

  // Register JSON Schema parser
  registerParser('json_schema', new JsonSchemaParser());

  // Log only in non-production mode
  if (process.env.DEBUG_TRACE_MCP) {
    console.error('[Languages] Registered parsers: typescript, python, json_schema');
  }
}
