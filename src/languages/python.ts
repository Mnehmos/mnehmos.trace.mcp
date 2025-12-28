/**
 * Python Language Parser
 * Extracts MCP schemas from Python source files (FastMCP decorators)
 *
 * NOTE: This is a basic implementation that uses regex parsing.
 * For production use, consider using tree-sitter-python or calling
 * Python's AST module via subprocess.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { LanguageParser, ExtractOptions, TraceOptions } from './base.js';
import type { ProducerSchema, ConsumerSchema, JSONSchema, SourceLocation } from '../types.js';

export class PythonParser implements LanguageParser {
  readonly name = 'python';
  readonly filePatterns = ['**/*.py'];

  // ==========================================================================
  // Producer Schema Extraction
  // ==========================================================================

  async extractSchemas(options: ExtractOptions): Promise<ProducerSchema[]> {
    console.log(`[Python] Scanning: ${options.rootDir}`);

    const patterns = options.include || this.filePatterns;
    const excludePatterns = options.exclude || ['**/node_modules/**', '**/dist/**', '**/__pycache__/**', '**/venv/**', '**/.venv/**'];

    // Find all Python files
    const files = this.findFiles(options.rootDir, patterns, excludePatterns);
    const schemas: ProducerSchema[] = [];

    for (const filePath of files) {
      const fileSchemas = await this.extractFromFile(filePath);
      schemas.push(...fileSchemas);
    }

    console.log(`[Python] Found ${schemas.length} tool definitions`);
    return schemas;
  }

  /**
   * Extract schemas from a single Python file
   */
  private async extractFromFile(filePath: string): Promise<ProducerSchema[]> {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const schemas: ProducerSchema[] = [];

    // Look for @mcp.tool() decorator pattern
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Match: @mcp.tool() or @server.tool() or @app.tool()
      if (line.match(/@\w+\.tool\(\)/)) {
        // Next non-empty line should be the function definition
        let funcLine = i + 1;
        while (funcLine < lines.length && !lines[funcLine].trim()) {
          funcLine++;
        }

        if (funcLine < lines.length) {
          const schema = this.parsePythonFunction(lines, funcLine, filePath);
          if (schema) {
            schemas.push(schema);
          }
        }
      }
    }

    return schemas;
  }

  /**
   * Parse a Python function definition
   * Pattern: def function_name(arg1: type1, arg2: type2 = default) -> ReturnType:
   */
  private parsePythonFunction(lines: string[], lineIndex: number, filePath: string): ProducerSchema | null {
    const funcLine = lines[lineIndex].trim();

    // Extract function signature
    const funcMatch = funcLine.match(/def\s+(\w+)\s*\((.*?)\)(?:\s*->\s*(.+?))?\s*:/);
    if (!funcMatch) {
      return null;
    }

    const [, functionName, argsStr, returnType] = funcMatch;

    // Extract docstring (if present)
    let description: string | undefined;
    if (lineIndex + 1 < lines.length) {
      const nextLine = lines[lineIndex + 1].trim();
      if (nextLine.startsWith('"""') || nextLine.startsWith("'''")) {
        const quote = nextLine.startsWith('"""') ? '"""' : "'''";
        let docstring = nextLine.replace(quote, '');

        // Multi-line docstring
        if (!docstring.endsWith(quote)) {
          let docLine = lineIndex + 2;
          while (docLine < lines.length && !lines[docLine].includes(quote)) {
            docstring += ' ' + lines[docLine].trim();
            docLine++;
          }
          if (docLine < lines.length) {
            docstring += ' ' + lines[docLine].trim().replace(quote, '');
          }
        } else {
          docstring = docstring.replace(quote, '');
        }

        description = docstring.trim();
      }
    }

    // Parse function arguments
    const inputSchema = this.parseArguments(argsStr);

    // Parse return type
    const outputSchema = this.parseReturnType(returnType);

    return {
      toolName: functionName,
      description,
      inputSchema,
      outputSchema,
      location: {
        file: filePath,
        line: lineIndex + 1,
      },
    };
  }

  /**
   * Parse Python function arguments into JSON Schema
   * Pattern: arg1: str, arg2: int = 10, arg3: Optional[bool] = None
   */
  private parseArguments(argsStr: string): JSONSchema {
    const schema: JSONSchema = {
      type: 'object',
      properties: {},
      required: [],
    };

    // Split by comma, but be careful with nested types like Dict[str, int]
    const args = this.splitArguments(argsStr);

    for (const arg of args) {
      const trimmed = arg.trim();
      if (!trimmed || trimmed === 'self') continue;

      // Match: name: type or name: type = default
      const argMatch = trimmed.match(/^(\w+)\s*:\s*([^=]+)(?:\s*=\s*(.+))?$/);
      if (argMatch) {
        const [, name, typeStr, defaultValue] = argMatch;
        const type = typeStr.trim();
        const hasDefault = defaultValue !== undefined;

        // Convert Python type to JSON Schema type
        schema.properties![name] = this.pythonTypeToJsonSchema(type);

        // If no default value, it's required
        if (!hasDefault && !type.includes('Optional')) {
          schema.required!.push(name);
        }
      }
    }

    return schema;
  }

  /**
   * Split arguments by comma, respecting brackets
   */
  private splitArguments(argsStr: string): string[] {
    const args: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of argsStr) {
      if (char === '[' || char === '(') {
        depth++;
        current += char;
      } else if (char === ']' || char === ')') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        args.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      args.push(current);
    }

    return args;
  }

  /**
   * Convert Python type annotation to JSON Schema type
   */
  private pythonTypeToJsonSchema(pythonType: string): JSONSchema {
    const type = pythonType.trim();

    // Basic types
    if (type === 'str') return { type: 'string' };
    if (type === 'int') return { type: 'integer' };
    if (type === 'float') return { type: 'number' };
    if (type === 'bool') return { type: 'boolean' };
    if (type === 'dict' || type.startsWith('Dict[')) return { type: 'object' };
    if (type === 'list' || type.startsWith('List[')) return { type: 'array' };

    // Optional types
    if (type.startsWith('Optional[')) {
      const innerType = type.slice(9, -1);
      return this.pythonTypeToJsonSchema(innerType);
    }

    // Union types (simplified)
    if (type.startsWith('Union[')) {
      return { type: 'unknown' };
    }

    // Default
    return { type: 'unknown' };
  }

  /**
   * Parse Python return type annotation
   */
  private parseReturnType(returnType?: string): JSONSchema {
    if (!returnType) {
      return { type: 'unknown' };
    }

    return this.pythonTypeToJsonSchema(returnType);
  }

  // ==========================================================================
  // Consumer Usage Tracing
  // ==========================================================================

  async traceUsage(options: TraceOptions): Promise<ConsumerSchema[]> {
    console.log(`[Python] Tracing: ${options.rootDir}`);

    const patterns = options.include || this.filePatterns;
    const excludePatterns = options.exclude || ['**/node_modules/**', '**/dist/**', '**/__pycache__/**', '**/venv/**', '**/.venv/**'];

    const files = this.findFiles(options.rootDir, patterns, excludePatterns);
    const schemas: ConsumerSchema[] = [];

    for (const filePath of files) {
      const fileSchemas = await this.traceFile(filePath);
      schemas.push(...fileSchemas);
    }

    console.log(`[Python] Found ${schemas.length} tool calls`);
    return schemas;
  }

  /**
   * Trace a single Python file for MCP client calls
   */
  private async traceFile(filePath: string): Promise<ConsumerSchema[]> {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const schemas: ConsumerSchema[] = [];

    // Look for patterns like: client.call_tool("tool_name", {...})
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match: .call_tool("name", or .call_tool('name',
      const callMatch = line.match(/\.call_tool\s*\(\s*["'](\w+)["']/);
      if (callMatch) {
        const toolName = callMatch[1];

        schemas.push({
          toolName,
          callSite: {
            file: filePath,
            line: i + 1,
          },
          argumentsProvided: {}, // TODO: Parse arguments
          expectedProperties: [], // TODO: Trace property access
        });
      }
    }

    return schemas;
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
