/**
 * Language Abstraction Layer - Base Interfaces
 * Defines the contract that all language parsers must implement
 */

import type { ProducerSchema, ConsumerSchema } from '../types.js';

/**
 * Options for extracting producer schemas
 */
export interface ExtractOptions {
  /** Root directory of the source code */
  rootDir: string;
  /** Glob patterns to include */
  include?: string[];
  /** Glob patterns to exclude */
  exclude?: string[];
}

/**
 * Options for tracing consumer usage
 */
export interface TraceOptions {
  /** Root directory of the source code */
  rootDir: string;
  /** Patterns to identify MCP client calls */
  callPatterns?: string[];
  /** Glob patterns to include */
  include?: string[];
  /** Glob patterns to exclude */
  exclude?: string[];
}

/**
 * Abstract interface that all language parsers must implement
 *
 * Each language parser is responsible for:
 * 1. Extracting producer schemas (MCP tool definitions) from source files
 * 2. Tracing consumer usage (how client code calls MCP tools)
 */
export interface LanguageParser {
  /** Name of the language (e.g., 'typescript', 'python') */
  readonly name: string;

  /** File patterns this parser handles (e.g., ['**\/*.py', '**\/*.pyi']) */
  readonly filePatterns: string[];

  /**
   * Extract producer schemas from source files
   *
   * @param options - Extraction configuration
   * @returns Array of discovered tool definitions
   */
  extractSchemas(options: ExtractOptions): Promise<ProducerSchema[]>;

  /**
   * Trace how consumer code uses MCP tools
   *
   * @param options - Tracing configuration
   * @returns Array of discovered tool calls
   */
  traceUsage(options: TraceOptions): Promise<ConsumerSchema[]>;
}
