/**
 * Trace MCP - Consumer Tracer
 * Thin wrapper that delegates to language-specific parsers
 */

import type { ConsumerSchema } from '../types.js';
import { getParser, hasParser } from '../languages/index.js';

export interface TracerOptions {
  /** Root directory of the consumer source */
  rootDir: string;
  /** Language of the source files */
  language?: string;
  /** Patterns to identify MCP client calls */
  callPatterns?: string[];
  /** Glob patterns to include */
  include?: string[];
  /** Glob patterns to exclude */
  exclude?: string[];
}

/**
 * Trace MCP tool usage in consumer code
 * Defaults to TypeScript parser for backward compatibility
 */
export async function traceConsumerUsage(
  options: TracerOptions
): Promise<ConsumerSchema[]> {
  // For backward compatibility, default to TypeScript
  const language = options.language || 'typescript';

  // Get parser from registry
  if (!hasParser(language)) {
    throw new Error(
      `No parser available for language: ${language}. Make sure to call bootstrapLanguageParsers() at startup.`
    );
  }

  const parser = getParser(language);

  return parser.traceUsage({
    rootDir: options.rootDir,
    callPatterns: options.callPatterns,
    include: options.include,
    exclude: options.exclude,
  });
}

/**
 * Trace usage from a single file
 * Defaults to TypeScript parser for backward compatibility
 */
export async function traceFromFile(filePath: string, language?: string): Promise<ConsumerSchema[]> {
  // For backward compatibility, default to TypeScript
  const lang = language || 'typescript';

  if (!hasParser(lang)) {
    throw new Error(
      `No parser available for language: ${lang}. Make sure to call bootstrapLanguageParsers() at startup.`
    );
  }

  const parser = getParser(lang);

  // Extract from the directory containing the file
  const rootDir = filePath.substring(0, filePath.lastIndexOf('/') || filePath.lastIndexOf('\\'));
  const fileName = filePath.substring((filePath.lastIndexOf('/') || filePath.lastIndexOf('\\')) + 1);

  const allSchemas = await parser.traceUsage({
    rootDir: rootDir || '.',
    include: [fileName],
  });

  return allSchemas.filter(s => s.callSite.file === filePath);
}
