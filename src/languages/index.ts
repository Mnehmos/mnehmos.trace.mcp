/**
 * Language Parser Registry
 * Central dispatcher for language-specific parsing
 */

import type { LanguageParser, ExtractOptions, TraceOptions } from './base.js';
import type { ProducerSchema, ConsumerSchema } from '../types.js';

/**
 * Registry of available language parsers
 */
class LanguageParserRegistry {
  private parsers = new Map<string, LanguageParser>();

  /**
   * Register a language parser
   */
  register(language: string, parser: LanguageParser): void {
    if (this.parsers.has(language) && process.env.DEBUG_TRACE_MCP) {
      console.error(`[LanguageRegistry] Overwriting parser for language: ${language}`);
    }
    this.parsers.set(language, parser);
    if (process.env.DEBUG_TRACE_MCP) {
      console.error(`[LanguageRegistry] Registered parser: ${language} (patterns: ${parser.filePatterns.join(', ')})`);
    }
  }

  /**
   * Get a parser by language name
   */
  get(language: string): LanguageParser {
    const parser = this.parsers.get(language);
    if (!parser) {
      throw new Error(
        `No parser registered for language: ${language}. Available: ${Array.from(this.parsers.keys()).join(', ')}`
      );
    }
    return parser;
  }

  /**
   * Check if a parser exists for a language
   */
  has(language: string): boolean {
    return this.parsers.has(language);
  }

  /**
   * Get all registered language names
   */
  languages(): string[] {
    return Array.from(this.parsers.keys());
  }
}

// Singleton instance
const registry = new LanguageParserRegistry();

/**
 * Register a language parser
 */
export function registerParser(language: string, parser: LanguageParser): void {
  registry.register(language, parser);
}

/**
 * Get a parser by language name
 */
export function getParser(language: string): LanguageParser {
  return registry.get(language);
}

/**
 * Check if a parser exists
 */
export function hasParser(language: string): boolean {
  return registry.has(language);
}

/**
 * Get all registered languages
 */
export function getRegisteredLanguages(): string[] {
  return registry.languages();
}

/**
 * Extract producer schemas using the appropriate language parser
 */
export async function extractProducerSchemas(
  language: string,
  options: ExtractOptions
): Promise<ProducerSchema[]> {
  const parser = getParser(language);
  if (process.env.DEBUG_TRACE_MCP) {
    console.error(`[LanguageRegistry] Using ${language} parser for extraction`);
  }
  return parser.extractSchemas(options);
}

/**
 * Trace consumer usage using the appropriate language parser
 */
export async function traceConsumerUsage(
  language: string,
  options: TraceOptions
): Promise<ConsumerSchema[]> {
  const parser = getParser(language);
  if (process.env.DEBUG_TRACE_MCP) {
    console.error(`[LanguageRegistry] Using ${language} parser for tracing`);
  }
  return parser.traceUsage(options);
}

// Re-export types
export type { LanguageParser, ExtractOptions, TraceOptions } from './base.js';

// Re-export import resolution (P2-5)
export {
  ImportResolverImpl,
  FileCache,
} from './import-resolver.js';

export type {
  ImportResolver,
  ImportResolverConfig,
  ResolvedImport,
  ResolvedTypeRef,
  ImportGraphNode,
  CacheStats,
} from './import-resolver.js';
