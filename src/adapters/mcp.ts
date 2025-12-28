/**
 * MCP Schema Adapter
 * Converts MCP tool definitions to NormalizedSchema
 */

import { Project, SyntaxKind, Node, CallExpression } from 'ts-morph';
import type {
  SchemaAdapter,
  SchemaRef,
  NormalizedSchema,
  NormalizedType,
  PropertyDef,
  SourceLocation,
} from '../core/types.js';
import type { JSONSchema } from '../types.js';

/**
 * MCP adapter for extracting schemas from MCP server.tool() calls
 */
export class MCPAdapter implements SchemaAdapter {
  readonly kind = 'mcp' as const;

  supports(ref: SchemaRef): boolean {
    return ref.source === 'mcp';
  }

  async extract(ref: SchemaRef): Promise<NormalizedSchema> {
    const { id, options } = ref;

    // Parse ID format: "file:path/to/file.ts" or "dir:path/to/dir" or "tool:toolName@path"
    // Use indexOf to handle Windows paths with colons (e.g., C:\path\to\file.ts)
    const colonIndex = id.indexOf(':');
    if (colonIndex === -1) {
      throw new Error(`Invalid ID format (missing type prefix): ${id}`);
    }
    
    const type = id.slice(0, colonIndex);
    const pathPart = id.slice(colonIndex + 1);

    if (type === 'file') {
      return this.extractFromFile(pathPart, ref);
    } else if (type === 'dir') {
      // Extract first tool from directory (or could return all)
      const schemas = await this.extractFromDirectory(pathPart, options);
      if (schemas.length === 0) {
        throw new Error(`No MCP tools found in directory: ${pathPart}`);
      }
      return schemas[0];
    } else if (type === 'tool') {
      // Format: "tool:toolName@path"
      const atIndex = pathPart.indexOf('@');
      if (atIndex === -1) {
        throw new Error(`Invalid tool ID format (missing @): ${id}`);
      }
      const toolName = pathPart.slice(0, atIndex);
      const filePath = pathPart.slice(atIndex + 1);
      return this.extractToolByName(toolName, filePath, ref);
    } else {
      throw new Error(`Unsupported MCP schema reference format: ${id}`);
    }
  }

  async list(basePath: string): Promise<SchemaRef[]> {
    const project = new Project({
      tsConfigFilePath: undefined,
      skipAddingFilesFromTsConfig: true,
    });

    project.addSourceFilesAtPaths([`${basePath}/**/*.ts`]);

    const refs: SchemaRef[] = [];

    for (const sourceFile of project.getSourceFiles()) {
      const filePath = sourceFile.getFilePath();

      // Skip node_modules and dist
      if (filePath.includes('node_modules') || filePath.includes('dist')) {
        continue;
      }

      const toolCalls = this.findToolCalls(sourceFile);

      for (const toolCall of toolCalls) {
        const toolName = this.extractToolName(toolCall);
        if (toolName) {
          refs.push({
            source: 'mcp',
            id: `tool:${toolName}@${filePath}`,
          });
        }
      }
    }

    return refs;
  }

  // ============================================================================
  // Private extraction methods
  // ============================================================================

  private async extractFromFile(
    filePath: string,
    ref: SchemaRef
  ): Promise<NormalizedSchema> {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
    });

    const sourceFile = project.addSourceFileAtPath(filePath);
    const toolCalls = this.findToolCalls(sourceFile);

    if (toolCalls.length === 0) {
      throw new Error(`No MCP tools found in file: ${filePath}`);
    }

    // Extract first tool (or specific tool if specified in options)
    const toolCall = toolCalls[0];
    return this.parseToolCallToNormalized(toolCall, filePath, ref);
  }

  private async extractFromDirectory(
    dirPath: string,
    options?: Record<string, unknown>
  ): Promise<NormalizedSchema[]> {
    const project = new Project({
      tsConfigFilePath: undefined,
      skipAddingFilesFromTsConfig: true,
    });

    const patterns = (options?.include as string[]) || ['**/*.ts'];
    const excludePatterns = (options?.exclude as string[]) || [
      '**/node_modules/**',
      '**/dist/**',
    ];

    project.addSourceFilesAtPaths(patterns.map((p) => `${dirPath}/${p}`));

    const schemas: NormalizedSchema[] = [];

    for (const sourceFile of project.getSourceFiles()) {
      const filePath = sourceFile.getFilePath();

      // Skip excluded patterns
      if (
        excludePatterns.some((pattern) =>
          filePath.includes(pattern.replace('**/', ''))
        )
      ) {
        continue;
      }

      const toolCalls = this.findToolCalls(sourceFile);

      for (const toolCall of toolCalls) {
        const ref: SchemaRef = { source: 'mcp', id: `file:${filePath}` };
        const schema = this.parseToolCallToNormalized(toolCall, filePath, ref);
        schemas.push(schema);
      }
    }

    return schemas;
  }

  private async extractToolByName(
    toolName: string,
    filePath: string,
    ref: SchemaRef
  ): Promise<NormalizedSchema> {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
    });

    const sourceFile = project.addSourceFileAtPath(filePath);
    const toolCalls = this.findToolCalls(sourceFile);

    for (const toolCall of toolCalls) {
      const name = this.extractToolName(toolCall);
      if (name === toolName) {
        return this.parseToolCallToNormalized(toolCall, filePath, ref);
      }
    }

    throw new Error(`Tool "${toolName}" not found in ${filePath}`);
  }

  // ============================================================================
  // Parsing utilities
  // ============================================================================

  private findToolCalls(sourceFile: Node): CallExpression[] {
    const toolCalls: CallExpression[] = [];

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expression = node.getExpression();

        // Check for pattern: server.tool() or *.tool()
        if (Node.isPropertyAccessExpression(expression)) {
          const methodName = expression.getName();
          if (methodName === 'tool') {
            toolCalls.push(node);
          }
        }
      }
    });

    return toolCalls;
  }

  private extractToolName(callExpr: CallExpression): string | null {
    const args = callExpr.getArguments();
    if (args.length === 0) return null;

    const nameArg = args[0];
    if (Node.isStringLiteral(nameArg)) {
      return nameArg.getLiteralValue();
    }

    return null;
  }

  private parseToolCallToNormalized(
    callExpr: CallExpression,
    filePath: string,
    ref: SchemaRef
  ): NormalizedSchema {
    const args = callExpr.getArguments();

    if (args.length < 3) {
      throw new Error(
        `Invalid tool call at ${filePath}:${callExpr.getStartLineNumber()}`
      );
    }

    // Extract tool name
    const nameArg = args[0];
    let toolName = 'unknown';
    if (Node.isStringLiteral(nameArg)) {
      toolName = nameArg.getLiteralValue();
    }

    // Extract description (second argument if string, otherwise schema is second)
    let description: string | undefined;
    let schemaArg: Node;

    const secondArg = args[1];
    if (Node.isStringLiteral(secondArg)) {
      description = secondArg.getLiteralValue();
      schemaArg = args[2];
    } else {
      schemaArg = secondArg;
    }

    // Parse the Zod schema object to NormalizedSchema
    const normalized = this.parseZodSchemaToNormalized(schemaArg);

    const location: SourceLocation = {
      file: filePath,
      line: callExpr.getStartLineNumber(),
      column: callExpr.getStartLinePos(),
    };

    return {
      ...normalized,
      name: toolName,
      source: ref,
      location,
    };
  }

  private parseZodSchemaToNormalized(node: Node): NormalizedSchema {
    const properties: Record<string, PropertyDef> = {};
    const required: string[] = [];

    if (!Node.isObjectLiteralExpression(node)) {
      return { properties, required, source: { source: 'mcp', id: '' } };
    }

    for (const prop of node.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) continue;

      const propName = prop.getName();
      const initializer = prop.getInitializer();

      if (!initializer) continue;

      // Parse the Zod type chain
      const type = this.parseZodType(initializer);
      const initText = initializer.getText();
      const isOptional = initText.includes('.optional()');
      const isNullable = initText.includes('.nullable()');
      const isDeprecated = initText.includes('.deprecated()');

      properties[propName] = {
        type,
        optional: isOptional,
        nullable: isNullable,
        readonly: false,
        deprecated: isDeprecated,
      };

      if (!isOptional) {
        required.push(propName);
      }
    }

    return {
      properties,
      required,
      source: { source: 'mcp', id: '' },
    };
  }

  private parseZodType(node: Node): NormalizedType {
    const text = node.getText();

    // z.string()
    if (text.includes('z.string()')) {
      return { kind: 'primitive', value: 'string' };
    }

    // z.number()
    if (text.includes('z.number()')) {
      return { kind: 'primitive', value: 'number' };
    }

    // z.boolean()
    if (text.includes('z.boolean()')) {
      return { kind: 'primitive', value: 'boolean' };
    }

    // z.literal(...)
    if (text.includes('z.literal(')) {
      const literalMatch = text.match(/z\.literal\((.*?)\)/);
      if (literalMatch) {
        const value = literalMatch[1].replace(/['"]/g, '');
        return { kind: 'literal', value };
      }
    }

    // z.enum([...])
    if (text.includes('z.enum(')) {
      const enumMatch = text.match(/z\.enum\(\[(.*?)\]\)/);
      if (enumMatch) {
        const values = enumMatch[1]
          .split(',')
          .map((v) => v.trim().replace(/['"]/g, ''));
        // Convert enum to union of literals
        return {
          kind: 'union',
          variants: values.map((v) => ({ kind: 'literal' as const, value: v })),
        };
      }
    }

    // z.array(...)
    if (text.includes('z.array(')) {
      // For now, return array of unknown
      // TODO: Parse element type
      return { kind: 'array', element: { kind: 'unknown' } };
    }

    // z.object(...)
    if (text.includes('z.object(')) {
      // For now, return object with empty schema
      // TODO: Parse nested object
      return {
        kind: 'object',
        schema: { properties: {}, required: [], source: { source: 'mcp', id: '' } },
      };
    }

    // z.union([...])
    if (text.includes('z.union(')) {
      // For now, return generic union
      return { kind: 'union', variants: [{ kind: 'unknown' }] };
    }

    // Default
    return { kind: 'unknown' };
  }
}
