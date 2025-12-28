/**
 * JSON Schema Language Parser
 * Reads pre-exported JSON Schema files for MCP tool definitions
 *
 * This parser is useful for tools that export their schemas as JSON files
 * rather than requiring source code analysis.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, basename } from 'path';
import type { LanguageParser, ExtractOptions, TraceOptions } from './base.js';
import type { ProducerSchema, ConsumerSchema, JSONSchema } from '../types.js';

/**
 * Expected JSON Schema file format:
 * {
 *   "tools": [
 *     {
 *       "name": "tool_name",
 *       "description": "Tool description",
 *       "inputSchema": { ... },
 *       "outputSchema": { ... }
 *     }
 *   ]
 * }
 */
interface JsonSchemaFile {
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: JSONSchema;
    outputSchema?: JSONSchema;
  }>;
}

export class JsonSchemaParser implements LanguageParser {
  readonly name = 'json_schema';
  readonly filePatterns = ['**/*.json', '**/tools.json', '**/schema.json'];

  // ==========================================================================
  // Producer Schema Extraction
  // ==========================================================================

  async extractSchemas(options: ExtractOptions): Promise<ProducerSchema[]> {
    console.log(`[JSON Schema] Scanning: ${options.rootDir}`);

    const patterns = options.include || this.filePatterns;
    const excludePatterns = options.exclude || ['**/node_modules/**', '**/dist/**', '**/package.json', '**/tsconfig.json'];

    const files = this.findFiles(options.rootDir, patterns, excludePatterns);
    const schemas: ProducerSchema[] = [];

    for (const filePath of files) {
      try {
        const fileSchemas = await this.extractFromFile(filePath);
        schemas.push(...fileSchemas);
      } catch (err) {
        console.warn(`[JSON Schema] Failed to parse ${filePath}: ${err}`);
      }
    }

    console.log(`[JSON Schema] Found ${schemas.length} tool definitions`);
    return schemas;
  }

  /**
   * Extract schemas from a single JSON file
   */
  private async extractFromFile(filePath: string): Promise<ProducerSchema[]> {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as JsonSchemaFile;
    const schemas: ProducerSchema[] = [];

    // Check if this is a tools schema file
    if (!data.tools || !Array.isArray(data.tools)) {
      // Try to parse as a single tool definition
      if (this.isSingleToolSchema(data)) {
        const schema = this.parseSingleTool(data, filePath);
        if (schema) {
          schemas.push(schema);
        }
      }
      return schemas;
    }

    // Parse multiple tools
    for (let i = 0; i < data.tools.length; i++) {
      const tool = data.tools[i];

      if (!tool.name) {
        console.warn(`[JSON Schema] Skipping tool without name in ${filePath}`);
        continue;
      }

      schemas.push({
        toolName: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema || { type: 'object' },
        outputSchema: tool.outputSchema || this.getDefaultOutputSchema(),
        location: {
          file: filePath,
          line: 1, // JSON files don't have line numbers
          column: 0,
        },
      });
    }

    return schemas;
  }

  /**
   * Check if data represents a single tool schema
   */
  private isSingleToolSchema(data: any): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      (data.name || data.inputSchema || data.parameters)
    );
  }

  /**
   * Parse a single tool from a JSON object
   */
  private parseSingleTool(data: any, filePath: string): ProducerSchema | null {
    // Handle MCP-style schema (with "parameters" instead of "inputSchema")
    const inputSchema = data.inputSchema || data.parameters || { type: 'object' };

    return {
      toolName: data.name || basename(filePath, '.json'),
      description: data.description,
      inputSchema,
      outputSchema: data.outputSchema || this.getDefaultOutputSchema(),
      location: {
        file: filePath,
        line: 1,
        column: 0,
      },
    };
  }

  /**
   * Default MCP output schema
   */
  private getDefaultOutputSchema(): JSONSchema {
    return {
      type: 'object',
      properties: {
        content: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              text: { type: 'string' },
            },
          },
        },
      },
    };
  }

  // ==========================================================================
  // Consumer Usage Tracing
  // ==========================================================================

  async traceUsage(options: TraceOptions): Promise<ConsumerSchema[]> {
    console.log(`[JSON Schema] Consumer tracing not supported for JSON files`);
    // JSON Schema files are producer-only (they define tools, not consume them)
    return [];
  }

  // ==========================================================================
  // File System Utilities
  // ==========================================================================

  /**
   * Find files matching patterns
   */
  private findFiles(rootDir: string, include: string[], exclude: string[]): string[] {
    const results: string[] = [];

    const walk = (dir: string) => {
      try {
        const entries = readdirSync(dir);

        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const relativePath = relative(rootDir, fullPath);

          // Check exclusions
          if (exclude.some(pattern => this.matchPattern(relativePath, pattern))) {
            continue;
          }

          const stat = statSync(fullPath);

          if (stat.isDirectory()) {
            walk(fullPath);
          } else if (stat.isFile()) {
            // Check inclusions
            if (include.some(pattern => this.matchPattern(relativePath, pattern))) {
              results.push(fullPath);
            }
          }
        }
      } catch (err) {
        // Ignore permission errors
      }
    };

    walk(rootDir);
    return results;
  }

  /**
   * Simple glob pattern matching
   */
  private matchPattern(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\\/g, '/')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path.replace(/\\/g, '/'));
  }
}
