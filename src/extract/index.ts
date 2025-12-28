/**
 * Trace MCP - Schema Extractor
 * Thin wrapper that delegates to language-specific parsers
 */

import type { ProducerSchema } from '../types.js';
import { getParser, hasParser } from '../languages/index.js';

export interface ExtractorOptions {
  /** Root directory of the MCP server source */
  rootDir: string;
  /** Language of the source files */
  language?: string;
  /** Glob patterns to include */
  include?: string[];
  /** Glob patterns to exclude */
  exclude?: string[];
}

/**
 * Extract MCP tool schemas from source files
 * Defaults to TypeScript parser for backward compatibility
 */
export async function extractProducerSchemas(
  options: ExtractorOptions
): Promise<ProducerSchema[]> {
  // For backward compatibility, default to TypeScript
  const language = options.language || 'typescript';

  // Get parser from registry
  if (!hasParser(language)) {
    throw new Error(
      `No parser available for language: ${language}. Make sure to call bootstrapLanguageParsers() at startup.`
    );
  }

  const parser = getParser(language);

  return parser.extractSchemas({
    rootDir: options.rootDir,
    include: options.include,
    exclude: options.exclude,
  });
}

/**
 * Extract schemas from a single file
 * Defaults to TypeScript parser for backward compatibility
 */
export async function extractFromFile(filePath: string, language?: string): Promise<ProducerSchema[]> {
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

  const allSchemas = await parser.extractSchemas({
    rootDir: rootDir || '.',
    include: [fileName],
  });

  return allSchemas.filter(s => s.location.file === filePath);
}
