/**
 * 🔷 TypeScript Language Parser
 *
 * Extracts MCP schemas from TypeScript source files using ts-morph.
 * This is an enhanced parser that supports multiple extraction patterns
 * for both producer schemas (tool definitions) and type definitions.
 *
 * Supported extraction patterns:
 * 1. **server.tool()** - FastMCP / MCP SDK pattern
 * 2. **Registry Pattern** - Object literal with ToolDefinition entries (ChatRPG)
 * 3. **Exported Zod Schemas** - Named *Schema exports for tracing
 * 4. **TypeScript Interfaces** - Exported interface declarations
 * 5. **Type Aliases** - Exported type definitions
 * 6. **Enums** - Exported enum declarations
 *
 * @module languages/typescript
 *
 * @example
 * ```typescript
 * import { TypeScriptParser } from './languages/typescript.js';
 *
 * const parser = new TypeScriptParser();
 *
 * // Extract tool definitions (Zod schemas)
 * const producers = await parser.extractSchemas({ rootDir: './src' });
 *
 * // Extract interfaces and types
 * const interfaces = await parser.extractInterfaces({ rootDir: './src' });
 *
 * // Extract all schemas
 * const all = await parser.extractAll({ rootDir: './src' });
 * ```
 */

import { Project, SyntaxKind, Node, CallExpression, SourceFile, ObjectLiteralExpression, PropertyAssignment, Type, InterfaceDeclaration, TypeAliasDeclaration, EnumDeclaration, Symbol as TsSymbol, ts } from 'ts-morph';
import type { LanguageParser, ExtractOptions, TraceOptions } from './base.js';
import type { ProducerSchema, ConsumerSchema, JSONSchema, SourceLocation } from '../types.js';
import type { NormalizedSchema, NormalizedType, PropertyDef, SchemaRef } from '../core/types.js';

// ============================================================================
// Types for Registry Pattern Detection
// ============================================================================

interface RegistryPattern {
  /** Variable name (e.g., 'toolRegistry') */
  name: string;
  /** Pattern type */
  type: 'record' | 'array' | 'object';
  /** Expected shape of entries */
  entryShape: {
    nameField: string;       // 'name' or 'toolName'
    descriptionField: string; // 'description'
    schemaField: string;      // 'inputSchema' or 'schema'
    handlerField: string;     // 'handler' or 'execute'
  };
}

// Common registry patterns found in MCP servers
const REGISTRY_PATTERNS: RegistryPattern[] = [
  {
    name: 'toolRegistry',
    type: 'record',
    entryShape: {
      nameField: 'name',
      descriptionField: 'description',
      schemaField: 'inputSchema',
      handlerField: 'handler',
    },
  },
  {
    name: 'tools',
    type: 'array',
    entryShape: {
      nameField: 'name',
      descriptionField: 'description',
      schemaField: 'schema',
      handlerField: 'handler',
    },
  },
  {
    name: 'TOOLS',
    type: 'record',
    entryShape: {
      nameField: 'name',
      descriptionField: 'description',
      schemaField: 'inputSchema',
      handlerField: 'handler',
    },
  },
];

// ============================================================================
// Parser Implementation
// ============================================================================

export class TypeScriptParser implements LanguageParser {
  readonly name = 'typescript';
  readonly filePatterns = ['**/*.ts', '**/*.tsx'];

  // Track found Zod schemas for cross-file resolution
  private zodSchemaCache: Map<string, { schema: JSONSchema; location: SourceLocation }> = new Map();

  // ==========================================================================
  // Producer Schema Extraction
  // ==========================================================================

  async extractSchemas(options: ExtractOptions): Promise<ProducerSchema[]> {
    console.log(`[TypeScript] Scanning: ${options.rootDir}`);

    const project = new Project({
      tsConfigFilePath: undefined,
      skipAddingFilesFromTsConfig: true,
    });

    const patterns = options.include || this.filePatterns;
    const excludePatterns = options.exclude || ['**/node_modules/**', '**/dist/**'];

    project.addSourceFilesAtPaths(
      patterns.map(p => `${options.rootDir}/${p}`)
    );

    const schemas: ProducerSchema[] = [];

    // First pass: collect all exported Zod schemas for cross-reference
    for (const sourceFile of project.getSourceFiles()) {
      const filePath = sourceFile.getFilePath();
      if (excludePatterns.some(pattern => filePath.includes(pattern.replace('**/', '')))) {
        continue;
      }
      this.collectZodSchemas(sourceFile, filePath);
    }

    // Second pass: extract tool definitions
    for (const sourceFile of project.getSourceFiles()) {
      const filePath = sourceFile.getFilePath();

      if (excludePatterns.some(pattern => filePath.includes(pattern.replace('**/', '')))) {
        continue;
      }

      // Method 1: server.tool() calls (FastMCP pattern)
      const toolCalls = this.findToolCalls(sourceFile);
      for (const toolCall of toolCalls) {
        const schema = this.parseToolCall(toolCall, filePath);
        if (schema) {
          schemas.push(schema);
        }
      }

      // Method 2: Registry pattern (ChatRPG pattern)
      const registrySchemas = this.extractFromRegistry(sourceFile, filePath);
      schemas.push(...registrySchemas);

      // Method 3: Direct exports with tool-like shape
      const exportedSchemas = this.extractFromExports(sourceFile, filePath);
      schemas.push(...exportedSchemas);
    }

    console.log(`[TypeScript] Found ${schemas.length} tool definitions`);
    return schemas;
  }

  // ==========================================================================
  // Method 1: server.tool() Pattern (Original)
  // ==========================================================================

  private findToolCalls(sourceFile: Node): CallExpression[] {
    const toolCalls: CallExpression[] = [];

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expression = node.getExpression();

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

  private parseToolCall(callExpr: CallExpression, filePath: string): ProducerSchema | null {
    const args = callExpr.getArguments();

    if (args.length < 3) {
      console.warn(`[TypeScript] Skipping tool call with insufficient args at ${filePath}:${callExpr.getStartLineNumber()}`);
      return null;
    }

    const nameArg = args[0];
    let toolName = 'unknown';
    if (Node.isStringLiteral(nameArg)) {
      toolName = nameArg.getLiteralValue();
    }

    let description: string | undefined;
    let schemaArg: Node;

    const secondArg = args[1];
    if (Node.isStringLiteral(secondArg)) {
      description = secondArg.getLiteralValue();
      schemaArg = args[2];
    } else {
      schemaArg = secondArg;
    }

    const inputSchema = this.parseZodSchema(schemaArg);

    const location: SourceLocation = {
      file: filePath,
      line: callExpr.getStartLineNumber(),
      column: callExpr.getStartLinePos(),
    };

    return {
      toolName,
      description,
      inputSchema,
      outputSchema: this.getMcpOutputSchema(),
      location,
    };
  }

  // ==========================================================================
  // Method 2: Registry Pattern (ChatRPG)
  // ==========================================================================

  private extractFromRegistry(sourceFile: SourceFile, filePath: string): ProducerSchema[] {
    const schemas: ProducerSchema[] = [];

    // Look for exported object literals that match registry patterns
    sourceFile.forEachDescendant((node) => {
      if (Node.isVariableDeclaration(node)) {
        const varName = node.getName();
        const initializer = node.getInitializer();

        // Check if this matches a known registry pattern
        const pattern = REGISTRY_PATTERNS.find(p => p.name === varName);
        if (pattern && initializer && Node.isObjectLiteralExpression(initializer)) {
          console.log(`[TypeScript] Found registry pattern: ${varName}`);
          const registrySchemas = this.parseRegistryObject(initializer, pattern, filePath);
          schemas.push(...registrySchemas);
          return; // Found, skip to next
        }

        // Also check for objects with tool-like entries even if not matching named patterns
        if (initializer && Node.isObjectLiteralExpression(initializer)) {
          const inferredSchemas = this.inferRegistryFromShape(initializer, varName, filePath);
          if (inferredSchemas.length > 0) {
            console.log(`[TypeScript] Inferred registry from shape: ${varName} (${inferredSchemas.length} tools)`);
            schemas.push(...inferredSchemas);
          }
        }
      }
    });

    return schemas;
  }

  private parseRegistryObject(
    obj: ObjectLiteralExpression,
    pattern: RegistryPattern,
    filePath: string
  ): ProducerSchema[] {
    const schemas: ProducerSchema[] = [];

    for (const prop of obj.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) continue;

      const entryName = prop.getName();
      const entryValue = prop.getInitializer();

      if (!entryValue || !Node.isObjectLiteralExpression(entryValue)) continue;

      const toolDef = this.parseToolDefinition(entryValue, pattern.entryShape, filePath, prop.getStartLineNumber());
      if (toolDef) {
        // Use the property key as fallback name
        if (toolDef.toolName === 'unknown') {
          toolDef.toolName = entryName;
        }
        schemas.push(toolDef);
      }
    }

    return schemas;
  }

  private parseToolDefinition(
    obj: ObjectLiteralExpression,
    shape: RegistryPattern['entryShape'],
    filePath: string,
    lineNumber: number
  ): ProducerSchema | null {
    let toolName = 'unknown';
    let description: string | undefined;
    let inputSchema: JSONSchema = { type: 'object' };

    for (const prop of obj.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) continue;

      const propName = prop.getName();
      const init = prop.getInitializer();
      if (!init) continue;

      // Extract name
      if (propName === shape.nameField && Node.isStringLiteral(init)) {
        toolName = init.getLiteralValue();
      }

      // Extract description
      if (propName === shape.descriptionField && Node.isStringLiteral(init)) {
        description = init.getLiteralValue();
      }

      // Extract schema
      if (propName === shape.schemaField) {
        inputSchema = this.extractInputSchema(init);
      }
    }

    // Skip if we couldn't find a name or schema
    if (toolName === 'unknown' && Object.keys(inputSchema.properties || {}).length === 0) {
      return null;
    }

    return {
      toolName,
      description,
      inputSchema,
      outputSchema: this.getMcpOutputSchema(),
      location: {
        file: filePath,
        line: lineNumber,
      },
    };
  }

  /**
   * Infer registry pattern from object shape
   * Checks if object entries look like tool definitions
   */
  private inferRegistryFromShape(
    obj: ObjectLiteralExpression,
    varName: string,
    filePath: string
  ): ProducerSchema[] {
    const schemas: ProducerSchema[] = [];
    const props = obj.getProperties();

    // Must have at least one property
    if (props.length === 0) return schemas;

    // Check first entry to see if it looks like a tool definition
    const firstProp = props[0];
    if (!Node.isPropertyAssignment(firstProp)) return schemas;

    const firstInit = firstProp.getInitializer();
    if (!firstInit || !Node.isObjectLiteralExpression(firstInit)) return schemas;

    // Check if this looks like a ToolDefinition
    const firstShape = this.detectToolDefinitionShape(firstInit);
    if (!firstShape) return schemas;

    console.log(`[TypeScript] Detected tool definition shape in ${varName}: ${JSON.stringify(firstShape)}`);

    // Parse all entries using detected shape
    for (const prop of props) {
      if (!Node.isPropertyAssignment(prop)) continue;

      const entryName = prop.getName();
      const entryValue = prop.getInitializer();

      if (!entryValue || !Node.isObjectLiteralExpression(entryValue)) continue;

      const toolDef = this.parseToolDefinition(entryValue, firstShape, filePath, prop.getStartLineNumber());
      if (toolDef) {
        if (toolDef.toolName === 'unknown') {
          toolDef.toolName = entryName;
        }
        schemas.push(toolDef);
      }
    }

    return schemas;
  }

  /**
   * Detect the shape of a tool definition from an object literal
   */
  private detectToolDefinitionShape(obj: ObjectLiteralExpression): RegistryPattern['entryShape'] | null {
    const propNames = new Set<string>();

    for (const prop of obj.getProperties()) {
      if (Node.isPropertyAssignment(prop)) {
        propNames.add(prop.getName());
      }
    }

    // Must have name, description, and some kind of schema/handler
    const hasName = propNames.has('name') || propNames.has('toolName');
    const hasDescription = propNames.has('description');
    const hasSchema = propNames.has('inputSchema') || propNames.has('schema') || propNames.has('parameters');
    const hasHandler = propNames.has('handler') || propNames.has('execute') || propNames.has('run');

    // Need at least name and (schema or handler)
    if (!hasName && !(hasSchema || hasHandler)) {
      return null;
    }

    return {
      nameField: propNames.has('name') ? 'name' : 'toolName',
      descriptionField: 'description',
      schemaField: propNames.has('inputSchema') ? 'inputSchema' : (propNames.has('schema') ? 'schema' : 'parameters'),
      handlerField: propNames.has('handler') ? 'handler' : (propNames.has('execute') ? 'execute' : 'run'),
    };
  }

  /**
   * Extract input schema from various formats
   */
  private extractInputSchema(node: Node): JSONSchema {
    const text = node.getText();

    // Case 1: Direct object literal (already JSON Schema)
    if (Node.isObjectLiteralExpression(node)) {
      return this.parseJsonSchemaLiteral(node);
    }

    // Case 2: toJsonSchema(zodSchema) call
    if (Node.isCallExpression(node)) {
      const expr = node.getExpression();
      const exprText = expr.getText();

      // toJsonSchema(createCharacterSchema) pattern
      if (exprText === 'toJsonSchema' || exprText.endsWith('.toJsonSchema')) {
        const args = node.getArguments();
        if (args.length > 0) {
          const schemaRef = args[0].getText();
          // Look up in cache
          const cached = this.zodSchemaCache.get(schemaRef);
          if (cached) {
            return cached.schema;
          }
          // Return reference for later resolution
          return { $ref: `#/definitions/${schemaRef}` };
        }
      }
    }

    // Case 3: Identifier referencing a Zod schema
    if (Node.isIdentifier(node)) {
      const schemaName = node.getText();
      const cached = this.zodSchemaCache.get(schemaName);
      if (cached) {
        return cached.schema;
      }
      // Check if it's a *Schema naming convention
      if (schemaName.endsWith('Schema')) {
        return { $ref: `#/definitions/${schemaName}` };
      }
    }

    // Case 4: Inline Zod schema (z.object(...))
    if (text.startsWith('z.object(') || text.includes('z.object(')) {
      return this.parseZodSchema(node);
    }

    return { type: 'object' };
  }

  /**
   * Parse a JSON Schema object literal
   */
  private parseJsonSchemaLiteral(obj: ObjectLiteralExpression): JSONSchema {
    const schema: JSONSchema = {};

    for (const prop of obj.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) continue;

      const propName = prop.getName();
      const init = prop.getInitializer();
      if (!init) continue;

      switch (propName) {
        case 'type':
          if (Node.isStringLiteral(init)) {
            schema.type = init.getLiteralValue();
          }
          break;
        case 'properties':
          if (Node.isObjectLiteralExpression(init)) {
            schema.properties = {};
            for (const subProp of init.getProperties()) {
              if (Node.isPropertyAssignment(subProp)) {
                const subName = subProp.getName();
                const subInit = subProp.getInitializer();
                if (subInit && Node.isObjectLiteralExpression(subInit)) {
                  schema.properties[subName] = this.parseJsonSchemaLiteral(subInit);
                }
              }
            }
          }
          break;
        case 'required':
          if (Node.isArrayLiteralExpression(init)) {
            schema.required = init.getElements()
              .filter(e => Node.isStringLiteral(e))
              .map(e => (e as any).getLiteralValue());
          }
          break;
        case 'description':
          if (Node.isStringLiteral(init)) {
            schema.description = init.getLiteralValue();
          }
          break;
      }
    }

    return schema;
  }

  // ==========================================================================
  // Method 3: Exported Zod Schemas
  // ==========================================================================

  /**
   * Collect all exported Zod schemas for cross-reference
   */
  private collectZodSchemas(sourceFile: SourceFile, filePath: string): void {
    sourceFile.forEachDescendant((node) => {
      if (Node.isVariableDeclaration(node)) {
        const varName = node.getName();

        // Look for *Schema naming convention
        if (varName.endsWith('Schema')) {
          const init = node.getInitializer();
          if (init) {
            const text = init.getText();

            // Check if it's a Zod schema definition
            if (text.includes('z.object(') || text.includes('z.union(') ||
                text.includes('z.string()') || text.includes('z.number()')) {
              const parsedSchema = this.parseZodSchema(init);
              this.zodSchemaCache.set(varName, {
                schema: parsedSchema,
                location: {
                  file: filePath,
                  line: node.getStartLineNumber(),
                },
              });
            }
          }
        }
      }
    });
  }

  /**
   * Extract tool definitions from exports
   */
  private extractFromExports(sourceFile: SourceFile, filePath: string): ProducerSchema[] {
    const schemas: ProducerSchema[] = [];

    // Look for exported functions that match tool handler signatures
    for (const exportDecl of sourceFile.getExportedDeclarations()) {
      const [name, declarations] = exportDecl;

      for (const decl of declarations) {
        // Check for exported async functions with matching schema
        if (Node.isFunctionDeclaration(decl) && decl.isAsync()) {
          const schemaName = `${name}Schema`;
          const cached = this.zodSchemaCache.get(schemaName);

          if (cached) {
            // Get JSDoc description if available
            const jsDocs = decl.getJsDocs();
            const description = jsDocs.length > 0
              ? jsDocs[0].getDescription().trim()
              : undefined;

            schemas.push({
              toolName: name,
              description,
              inputSchema: cached.schema,
              outputSchema: this.getMcpOutputSchema(),
              location: {
                file: filePath,
                line: decl.getStartLineNumber(),
              },
            });
          }
        }
      }
    }

    return schemas;
  }

  // ==========================================================================
  // Zod Schema Parsing (Enhanced)
  // ==========================================================================

  private parseZodSchema(node: Node): JSONSchema {
    const schema: JSONSchema = {
      type: 'object',
      properties: {},
      required: [],
    };

    // Handle z.object({...})
    if (Node.isCallExpression(node)) {
      const expr = node.getExpression();
      const exprText = expr.getText();

      if (exprText === 'z.object' || exprText.endsWith('.object')) {
        const args = node.getArguments();
        if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
          return this.parseZodObjectContent(args[0]);
        }
      }

      // Handle z.union([...])
      if (exprText === 'z.union' || exprText.endsWith('.union')) {
        return this.parseZodUnion(node);
      }
    }

    // Handle direct object literal (for older Zod style)
    if (Node.isObjectLiteralExpression(node)) {
      return this.parseZodObjectContent(node);
    }

    return schema;
  }

  private parseZodObjectContent(obj: ObjectLiteralExpression): JSONSchema {
    const schema: JSONSchema = {
      type: 'object',
      properties: {},
      required: [],
    };

    for (const prop of obj.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) continue;

      const propName = prop.getName();
      const initializer = prop.getInitializer();

      if (!initializer) continue;

      const propSchema = this.parseZodType(initializer);
      schema.properties![propName] = propSchema;

      const initText = initializer.getText();
      if (!initText.includes('.optional()') && !initText.includes('.nullish()')) {
        schema.required!.push(propName);
      }
    }

    return schema;
  }

  private parseZodUnion(node: CallExpression): JSONSchema {
    const args = node.getArguments();
    if (args.length === 0) return { type: 'object' };

    const firstArg = args[0];
    if (!Node.isArrayLiteralExpression(firstArg)) return { type: 'object' };

    const variants: JSONSchema[] = [];
    for (const element of firstArg.getElements()) {
      variants.push(this.parseZodType(element));
    }

    if (variants.length === 1) {
      return variants[0];
    }

    return { anyOf: variants };
  }

  private parseZodType(node: Node): JSONSchema {
    const text = node.getText();

    // z.string()
    if (text.startsWith('z.string()') || text.match(/^z\.string\(\)/)) {
      const schema: JSONSchema = { type: 'string' };
      // Extract description
      const descMatch = text.match(/\.describe\(['"](.+?)['"]\)/);
      if (descMatch) {
        schema.description = descMatch[1];
      }
      // Extract min/max
      const minMatch = text.match(/\.min\((\d+)\)/);
      const maxMatch = text.match(/\.max\((\d+)\)/);
      if (minMatch) schema.minLength = parseInt(minMatch[1]);
      if (maxMatch) schema.maxLength = parseInt(maxMatch[1]);
      return schema;
    }

    // z.number()
    if (text.startsWith('z.number()') || text.match(/^z\.number\(\)/)) {
      const schema: JSONSchema = { type: 'number' };
      const minMatch = text.match(/\.min\((-?\d+)\)/);
      const maxMatch = text.match(/\.max\((-?\d+)\)/);
      if (minMatch) schema.minimum = parseInt(minMatch[1]);
      if (maxMatch) schema.maximum = parseInt(maxMatch[1]);
      return schema;
    }

    // z.boolean()
    if (text.startsWith('z.boolean()')) {
      return { type: 'boolean' };
    }

    // z.enum([...])
    if (text.includes('z.enum(')) {
      const enumMatch = text.match(/z\.enum\(\[(.*?)\]\)/s);
      if (enumMatch) {
        const values = enumMatch[1]
          .split(',')
          .map(v => v.trim().replace(/['"]/g, ''))
          .filter(v => v.length > 0);
        return { type: 'string', enum: values };
      }
    }

    // z.array(...)
    if (text.startsWith('z.array(')) {
      return { type: 'array' };
    }

    // z.object(...)
    if (text.startsWith('z.object(')) {
      if (Node.isCallExpression(node)) {
        return this.parseZodSchema(node);
      }
      return { type: 'object' };
    }

    // z.literal(...)
    if (text.includes('z.literal(')) {
      const match = text.match(/z\.literal\(['"](.+?)['"]\)/);
      if (match) {
        return { type: 'string', const: match[1] };
      }
    }

    // Reference to another schema
    if (text.endsWith('Schema') || this.zodSchemaCache.has(text)) {
      const cached = this.zodSchemaCache.get(text);
      if (cached) {
        return cached.schema;
      }
      return { $ref: `#/definitions/${text}` };
    }

    return { type: 'unknown' };
  }

  /**
   * Standard MCP tool output schema
   */
  private getMcpOutputSchema(): JSONSchema {
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
    console.log(`[TypeScript] Tracing: ${options.rootDir}`);

    const project = new Project({
      skipAddingFilesFromTsConfig: true,
    });

    const patterns = options.include || this.filePatterns;
    const excludePatterns = options.exclude || ['**/node_modules/**', '**/dist/**'];

    project.addSourceFilesAtPaths(
      patterns.map(p => `${options.rootDir}/${p}`)
    );

    const schemas: ConsumerSchema[] = [];

    for (const sourceFile of project.getSourceFiles()) {
      const filePath = sourceFile.getFilePath();

      if (excludePatterns.some(pattern => filePath.includes(pattern.replace('**/', '')))) {
        continue;
      }

      const fileSchemas = this.traceFile(sourceFile, filePath);
      schemas.push(...fileSchemas);
    }

    console.log(`[TypeScript] Found ${schemas.length} tool calls`);
    return schemas;
  }

  private traceFile(sourceFile: SourceFile, filePath: string): ConsumerSchema[] {
    const schemas: ConsumerSchema[] = [];

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const callInfo = this.parseCallToolExpression(node);
        if (callInfo) {
          const expectedProps = this.traceResultUsage(node);

          schemas.push({
            toolName: callInfo.toolName,
            callSite: {
              file: filePath,
              line: node.getStartLineNumber(),
              column: node.getStartLinePos(),
            },
            argumentsProvided: callInfo.arguments,
            expectedProperties: expectedProps,
          });
        }
      }
    });

    return schemas;
  }

  private parseCallToolExpression(node: CallExpression): { toolName: string; arguments: Record<string, unknown> } | null {
    const expression = node.getExpression();

    if (!Node.isPropertyAccessExpression(expression)) {
      return null;
    }

    const methodName = expression.getName();
    
    // Support multiple call patterns
    const callPatterns = ['callTool', 'call', 'invoke', 'execute'];
    if (!callPatterns.includes(methodName)) {
      return null;
    }

    const args = node.getArguments();
    if (args.length < 1) {
      return null;
    }

    // Tool name could be first arg or in an options object
    let toolName = 'unknown';
    let providedArgs: Record<string, unknown> = {};

    const firstArg = args[0];
    
    // Pattern 1: callTool('toolName', { args })
    if (Node.isStringLiteral(firstArg)) {
      toolName = firstArg.getLiteralValue();
      if (args.length > 1) {
        providedArgs = this.parseObjectLiteral(args[1]);
      }
    }
    // Pattern 2: callTool({ name: 'toolName', arguments: {...} })
    else if (Node.isObjectLiteralExpression(firstArg)) {
      for (const prop of firstArg.getProperties()) {
        if (!Node.isPropertyAssignment(prop)) continue;
        const propName = prop.getName();
        const init = prop.getInitializer();
        
        if (propName === 'name' && init && Node.isStringLiteral(init)) {
          toolName = init.getLiteralValue();
        }
        if ((propName === 'arguments' || propName === 'args') && init) {
          providedArgs = this.parseObjectLiteral(init);
        }
      }
    }

    return { toolName, arguments: providedArgs };
  }

  private parseObjectLiteral(node: Node): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (!Node.isObjectLiteralExpression(node)) {
      return result;
    }

    for (const prop of node.getProperties()) {
      if (Node.isPropertyAssignment(prop)) {
        const name = prop.getName();
        result[name] = '<value>';
      } else if (Node.isShorthandPropertyAssignment(prop)) {
        const name = prop.getName();
        result[name] = '<value>';
      }
    }

    return result;
  }

  private traceResultUsage(callNode: CallExpression): string[] {
    const properties: Set<string> = new Set();

    const containingFunction = callNode.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration)
      || callNode.getFirstAncestorByKind(SyntaxKind.ArrowFunction)
      || callNode.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);

    if (!containingFunction) {
      return [];
    }

    containingFunction.forEachDescendant((node) => {
      if (Node.isPropertyAccessExpression(node)) {
        const propChain = this.getPropertyChain(node);

        const mcpBoilerplate = ['content', 'text', 'type', 'length'];
        const meaningfulProps = propChain.filter(p => !mcpBoilerplate.includes(p));

        for (const prop of meaningfulProps) {
          properties.add(prop);
        }
      }
    });

    return Array.from(properties);
  }

  private getPropertyChain(node: Node): string[] {
    const chain: string[] = [];

    let current: Node | undefined = node;
    while (current && Node.isPropertyAccessExpression(current)) {
      chain.unshift(current.getName());
      current = current.getExpression();
    }

    return chain;
  }

  // ==========================================================================
  // 📋 Interface, Type Alias, and Enum Extraction
  // ==========================================================================

  /**
   * Extract interfaces, type aliases, and enums from TypeScript files.
   *
   * Scans TypeScript source files and extracts all exported type definitions,
   * converting them to NormalizedSchema format for schema comparison.
   *
   * Supports extraction of:
   * - **Interfaces** - Including inherited properties from extends
   * - **Type Aliases** - Object types, unions, intersections, Records
   * - **Enums** - Both const and regular enums
   *
   * @param options - Extraction options specifying root directory and file patterns
   * @param options.rootDir - Root directory to search for TypeScript files
   * @param options.include - Optional glob patterns to include (default: `['*.ts', '*.tsx']`)
   * @param options.exclude - Optional glob patterns to exclude (default: excludes node_modules and dist)
   * @returns Promise resolving to array of NormalizedSchema for all exported declarations
   *
   * @example
   * ```typescript
   * const parser = new TypeScriptParser();
   * const schemas = await parser.extractInterfaces({
   *   rootDir: './src/types',
   *   include: ['*.ts'],
   *   exclude: ['*.test.ts']
   * });
   *
   * // schemas[0] = {
   * //   name: 'UserProfile',
   * //   properties: { id: {...}, name: {...} },
   * //   required: ['id', 'name'],
   * //   source: { source: 'typescript', id: 'interface:UserProfile@...' },
   * //   location: { file: '...', line: 10 }
   * // }
   * ```
   */
  async extractInterfaces(options: ExtractOptions): Promise<NormalizedSchema[]> {
    const project = new Project({
      tsConfigFilePath: undefined,
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        strict: true,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
      },
    });

    const patterns = options.include || this.filePatterns;
    const excludePatterns = options.exclude || ['**/node_modules/**', '**/dist/**'];

    project.addSourceFilesAtPaths(
      patterns.map(p => `${options.rootDir}/${p}`)
    );

    const schemas: NormalizedSchema[] = [];

    for (const sourceFile of project.getSourceFiles()) {
      const filePath = sourceFile.getFilePath();

      if (excludePatterns.some(pattern => filePath.includes(pattern.replace('**/', '')))) {
        continue;
      }

      // Extract interfaces
      for (const iface of sourceFile.getInterfaces()) {
        if (!iface.isExported()) continue;

        const schema = this.convertInterfaceToSchema(iface, filePath);
        schemas.push(schema);
      }

      // Extract type aliases
      for (const typeAlias of sourceFile.getTypeAliases()) {
        if (!typeAlias.isExported()) continue;

        const schema = this.convertTypeAliasToSchema(typeAlias, filePath);
        schemas.push(schema);
      }

      // Extract enums
      for (const enumDecl of sourceFile.getEnums()) {
        if (!enumDecl.isExported()) continue;

        const schema = this.convertEnumToSchema(enumDecl, filePath);
        schemas.push(schema);
      }
    }

    return schemas;
  }

  /**
   * Extract all schemas from TypeScript files.
   *
   * Comprehensive extraction that combines interface/type extraction.
   * This is the recommended entry point for extracting TypeScript type
   * definitions for schema comparison workflows.
   *
   * @param options - Extraction options specifying root directory and file patterns
   * @param options.rootDir - Root directory to search for TypeScript files
   * @param options.include - Optional glob patterns to include
   * @param options.exclude - Optional glob patterns to exclude
   * @returns Promise resolving to array of NormalizedSchema
   *
   * @remarks
   * Currently returns interface/type/enum schemas only.
   * Future enhancement: Convert ProducerSchema to NormalizedSchema
   * for Zod schema inclusion.
   *
   * @example
   * ```typescript
   * const parser = new TypeScriptParser();
   * const schemas = await parser.extractAll({ rootDir: './src' });
   *
   * // Returns all exported interfaces, type aliases, and enums
   * console.log(`Found ${schemas.length} type definitions`);
   * ```
   */
  async extractAll(options: ExtractOptions): Promise<NormalizedSchema[]> {
    // Extract interfaces, type aliases, and enums
    const interfaceSchemas = await this.extractInterfaces(options);
    
    // Note: extractSchemas returns ProducerSchema[], not NormalizedSchema[]
    // For now, we return only interface schemas.
    // A future enhancement could convert ProducerSchema to NormalizedSchema.
    
    return interfaceSchemas;
  }

  // --------------------------------------------------------------------------
  // Private: Interface Conversion
  // --------------------------------------------------------------------------

  /**
   * Convert a TypeScript interface declaration to NormalizedSchema.
   *
   * Handles all interface features:
   * - Direct properties with type annotations
   * - Inherited properties from extends clauses
   * - Optional properties (marked with ?)
   * - Readonly properties
   * - Nullable types (T | null)
   * - JSDoc descriptions and @deprecated tags
   *
   * @param iface - The ts-morph InterfaceDeclaration to convert
   * @param filePath - Path to the source file for location tracking
   * @returns NormalizedSchema representation of the interface
   */
  private convertInterfaceToSchema(iface: InterfaceDeclaration, filePath: string): NormalizedSchema {
    const name = iface.getName();
    const properties: Record<string, PropertyDef> = {};
    const required: string[] = [];

    // Get all properties including inherited ones
    const allProperties = this.getInterfaceProperties(iface);

    for (const prop of allProperties) {
      const propName = prop.getName();
      const propDecl = prop.getDeclarations()[0];
      // Get the type from the value declaration or the declared type
      const propType = prop.getValueDeclaration()
        ? prop.getValueDeclarationOrThrow().getType()
        : prop.getDeclaredType();
      
      const isOptional = prop.isOptional();
      const isReadonly = propDecl ? this.isPropertyReadonly(propDecl) : false;
      const jsDocInfo = propDecl ? this.getJSDocInfo(propDecl) : { description: undefined, deprecated: false };
      
      // Check for nullable types
      const { baseType, isNullable, hasUndefined } = this.analyzeNullability(propType);
      
      const normalizedType = this.convertTypeToNormalized(baseType, propType);
      
      properties[propName] = {
        type: normalizedType,
        optional: isOptional || hasUndefined,
        nullable: isNullable,
        readonly: isReadonly,
        deprecated: jsDocInfo.deprecated,
        description: jsDocInfo.description,
      };

      if (!isOptional && !hasUndefined) {
        required.push(propName);
      }
    }

    const schemaRef: SchemaRef = {
      source: 'typescript',
      id: `interface:${name}@${filePath}`,
    };

    return {
      name,
      properties,
      required,
      source: schemaRef,
      location: {
        file: filePath,
        line: iface.getStartLineNumber(),
      },
    };
  }

  /**
   * Get all properties from an interface, including inherited ones.
   *
   * Uses ts-morph's type resolution to flatten the property list,
   * ensuring all properties from extended interfaces are included.
   *
   * @param iface - The interface declaration
   * @returns Array of ts-morph Symbol objects representing all properties
   */
  private getInterfaceProperties(iface: InterfaceDeclaration): TsSymbol[] {
    const type = iface.getType();
    return type.getProperties();
  }

  // --------------------------------------------------------------------------
  // Private: Type Alias Conversion
  // --------------------------------------------------------------------------

  /**
   * Convert a TypeScript type alias to NormalizedSchema.
   *
   * Handles various type alias patterns:
   * - Object types: `type Foo = { bar: string }`
   * - Intersection types: `type Foo = A & B`
   * - Record types: `type Dict = Record<string, T>`
   * - Union types: `type Status = 'active' | 'inactive'`
   *
   * @param typeAlias - The ts-morph TypeAliasDeclaration to convert
   * @param filePath - Path to the source file for location tracking
   * @returns NormalizedSchema representation of the type alias
   */
  private convertTypeAliasToSchema(typeAlias: TypeAliasDeclaration, filePath: string): NormalizedSchema {
    const name = typeAlias.getName();
    const aliasType = typeAlias.getType();
    
    // Handle object-like type aliases (type Foo = { ... })
    const properties: Record<string, PropertyDef> = {};
    const required: string[] = [];
    let additionalProperties: boolean | NormalizedType | undefined;

    // Check if it's a Record type (has index signature)
    const stringIndexType = aliasType.getStringIndexType();
    if (stringIndexType) {
      // This is a Record<string, T> or similar
      additionalProperties = this.convertTypeToNormalized(stringIndexType);
    }

    // Check if it's an intersection type and flatten it
    if (aliasType.isIntersection()) {
      const intersectionTypes = aliasType.getIntersectionTypes();
      for (const t of intersectionTypes) {
        this.extractPropertiesFromType(t, properties, required);
      }
    } else if (aliasType.isObject()) {
      this.extractPropertiesFromType(aliasType, properties, required);
    }
    // For union types (like string literals), still return a schema

    const schemaRef: SchemaRef = {
      source: 'typescript',
      id: `type:${name}@${filePath}`,
    };

    const result: NormalizedSchema = {
      name,
      properties,
      required,
      source: schemaRef,
      location: {
        file: filePath,
        line: typeAlias.getStartLineNumber(),
      },
    };

    if (additionalProperties !== undefined) {
      result.additionalProperties = additionalProperties;
    }

    return result;
  }

  /**
   * Extract properties from a ts-morph Type object.
   *
   * Helper method for extracting property definitions from resolved types.
   * Used by both interface and type alias conversion to handle object types.
   *
   * @param type - The ts-morph Type to extract properties from
   * @param properties - Output record to populate with PropertyDef entries
   * @param required - Output array to populate with required property names
   */
  private extractPropertiesFromType(
    type: Type,
    properties: Record<string, PropertyDef>,
    required: string[]
  ): void {
    for (const prop of type.getProperties()) {
      const propName = prop.getName();
      const propDecl = prop.getDeclarations()[0];
      const propType = prop.getValueDeclaration()
        ? prop.getValueDeclarationOrThrow().getType()
        : prop.getDeclaredType();
      
      const isOptional = prop.isOptional();
      const isReadonly = propDecl ? this.isPropertyReadonly(propDecl) : false;
      const jsDocInfo = propDecl ? this.getJSDocInfo(propDecl) : { description: undefined, deprecated: false };
      
      const { baseType, isNullable, hasUndefined } = this.analyzeNullability(propType);
      const normalizedType = this.convertTypeToNormalized(baseType, propType);
      
      properties[propName] = {
        type: normalizedType,
        optional: isOptional || hasUndefined,
        nullable: isNullable,
        readonly: isReadonly,
        deprecated: jsDocInfo.deprecated,
        description: jsDocInfo.description,
      };

      if (!isOptional && !hasUndefined && !properties[propName]) {
        required.push(propName);
      } else if (!isOptional && !hasUndefined && !required.includes(propName)) {
        required.push(propName);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Private: Enum Conversion
  // --------------------------------------------------------------------------

  /**
   * Convert a TypeScript enum to NormalizedSchema.
   *
   * Enums are represented as schemas with empty properties,
   * since they don't have traditional object properties.
   * The enum values are not currently extracted to the schema.
   *
   * @param enumDecl - The ts-morph EnumDeclaration to convert
   * @param filePath - Path to the source file for location tracking
   * @returns NormalizedSchema representation of the enum
   *
   * @remarks
   * Future enhancement: Include enum members as values or properties.
   */
  private convertEnumToSchema(enumDecl: EnumDeclaration, filePath: string): NormalizedSchema {
    const name = enumDecl.getName();
    
    const schemaRef: SchemaRef = {
      source: 'typescript',
      id: `enum:${name}@${filePath}`,
    };

    // Enums don't have traditional properties, but we can represent them
    return {
      name,
      properties: {},
      required: [],
      source: schemaRef,
      location: {
        file: filePath,
        line: enumDecl.getStartLineNumber(),
      },
    };
  }

  // --------------------------------------------------------------------------
  // Private: Type Analysis Utilities
  // --------------------------------------------------------------------------

  /**
   * Analyze nullability of a TypeScript type.
   *
   * Examines union types to determine if they include null or undefined,
   * and extracts the "base" type after removing null/undefined.
   *
   * @param type - The ts-morph Type to analyze
   * @returns Object containing:
   *   - `baseType`: The type with null/undefined removed
   *   - `isNullable`: True if type includes `| null`
   *   - `hasUndefined`: True if type includes `| undefined`
   *
   * @example
   * ```typescript
   * // For type: string | null | undefined
   * // Returns: { baseType: string, isNullable: true, hasUndefined: true }
   * ```
   */
  private analyzeNullability(type: Type): { baseType: Type; isNullable: boolean; hasUndefined: boolean } {
    let isNullable = false;
    let hasUndefined = false;
    let baseType = type;

    if (type.isUnion()) {
      const unionTypes = type.getUnionTypes();
      const nonNullTypes: Type[] = [];

      for (const t of unionTypes) {
        if (t.isNull()) {
          isNullable = true;
        } else if (t.isUndefined()) {
          hasUndefined = true;
        } else {
          nonNullTypes.push(t);
        }
      }

      // If there's only one non-null type, use it as the base
      if (nonNullTypes.length === 1) {
        baseType = nonNullTypes[0];
      }
    }

    return { baseType, isNullable, hasUndefined };
  }

  /**
   * Convert a ts-morph Type to NormalizedType.
   *
   * Recursively converts TypeScript types to the normalized type system:
   * - Primitives: string, number, boolean, null
   * - Literals: 'active', 42, true
   * - Arrays: `string[]`, `Array<T>`
   * - Tuples: `[string, number]`
   * - Unions: `string | number`
   * - Intersections: `A & B`
   * - Objects: `{ foo: string }`
   * - References: named interfaces
   *
   * @param type - The ts-morph Type to convert
   * @param originalType - Optional original type before nullability analysis
   * @returns NormalizedType representation
   */
  private convertTypeToNormalized(type: Type, originalType?: Type): NormalizedType {
    const typeToUse = type;
    
    // Check for primitives
    if (typeToUse.isString()) {
      return { kind: 'primitive', value: 'string' };
    }
    if (typeToUse.isNumber()) {
      return { kind: 'primitive', value: 'number' };
    }
    if (typeToUse.isBoolean()) {
      return { kind: 'primitive', value: 'boolean' };
    }
    if (typeToUse.isNull()) {
      return { kind: 'primitive', value: 'null' };
    }
    
    // Check for literal types
    if (typeToUse.isStringLiteral()) {
      return { kind: 'literal', value: typeToUse.getLiteralValue() as string };
    }
    if (typeToUse.isNumberLiteral()) {
      return { kind: 'literal', value: typeToUse.getLiteralValue() as number };
    }
    if (typeToUse.isBooleanLiteral()) {
      const text = typeToUse.getText();
      return { kind: 'literal', value: text === 'true' };
    }
    
    // Check for array types
    if (typeToUse.isArray()) {
      const elementType = typeToUse.getArrayElementType();
      if (elementType) {
        return {
          kind: 'array',
          element: this.convertTypeToNormalized(elementType),
        };
      }
      return { kind: 'array', element: { kind: 'unknown' } };
    }

    // Check for tuple types (convert to array for simplicity)
    if (typeToUse.isTuple()) {
      const tupleTypes = typeToUse.getTupleElements();
      if (tupleTypes.length > 0) {
        // For tuples, we lose type information - just use array
        return { kind: 'array', element: { kind: 'unknown' } };
      }
      return { kind: 'array', element: { kind: 'unknown' } };
    }
    
    // Check for union types
    if (typeToUse.isUnion()) {
      const variants = typeToUse.getUnionTypes()
        .filter(t => !t.isNull() && !t.isUndefined())
        .map(t => this.convertTypeToNormalized(t));
      
      if (variants.length === 0) {
        return { kind: 'unknown' };
      }
      if (variants.length === 1) {
        return variants[0];
      }
      return { kind: 'union', variants };
    }
    
    // Check for intersection types
    if (typeToUse.isIntersection()) {
      const members = typeToUse.getIntersectionTypes()
        .map(t => this.convertTypeToNormalized(t));
      return { kind: 'intersection', members };
    }
    
    // Check for object types (inline or interface references)
    if (typeToUse.isObject()) {
      // Check if it's a named interface reference
      const symbol = typeToUse.getSymbol();
      if (symbol) {
        const name = symbol.getName();
        // Skip built-in types
        if (name !== '__type' && name !== 'Array' && name !== 'Date') {
          // For now, inline the properties for object types
        }
      }
      
      // Extract properties for inline object type
      const properties: Record<string, PropertyDef> = {};
      const required: string[] = [];
      
      for (const prop of typeToUse.getProperties()) {
        const propName = prop.getName();
        const propDecl = prop.getDeclarations()[0];
        const propType = prop.getValueDeclaration()
          ? prop.getValueDeclarationOrThrow().getType()
          : prop.getDeclaredType();
        
        const isOptional = prop.isOptional();
        const isReadonly = propDecl ? this.isPropertyReadonly(propDecl) : false;
        const jsDocInfo = propDecl ? this.getJSDocInfo(propDecl) : { description: undefined, deprecated: false };
        
        const { baseType, isNullable, hasUndefined } = this.analyzeNullability(propType);
        const normalizedPropType = this.convertTypeToNormalized(baseType, propType);
        
        properties[propName] = {
          type: normalizedPropType,
          optional: isOptional || hasUndefined,
          nullable: isNullable,
          readonly: isReadonly,
          deprecated: jsDocInfo.deprecated,
          description: jsDocInfo.description,
        };
        
        if (!isOptional && !hasUndefined) {
          required.push(propName);
        }
      }
      
      return {
        kind: 'object',
        schema: {
          properties,
          required,
          source: { source: 'typescript', id: 'inline' },
        },
      };
    }
    
    // Check for any/unknown
    if (typeToUse.getText() === 'any') {
      return { kind: 'any' };
    }
    
    return { kind: 'unknown' };
  }

  // --------------------------------------------------------------------------
  // Private: Property Metadata Extraction
  // --------------------------------------------------------------------------

  /**
   * Check if a property declaration is readonly.
   *
   * @param decl - The property declaration node
   * @returns True if the property has the readonly modifier
   */
  private isPropertyReadonly(decl: Node): boolean {
    if (Node.isPropertySignature(decl)) {
      return decl.isReadonly();
    }
    if (Node.isPropertyDeclaration(decl)) {
      return decl.isReadonly();
    }
    return false;
  }

  /**
   * Extract JSDoc information from a declaration.
   *
   * Parses JSDoc comments to extract:
   * - Description text
   * - @deprecated tag presence
   *
   * @param decl - The declaration node to extract JSDoc from
   * @returns Object with description and deprecated flag
   */
  private getJSDocInfo(decl: Node): { description?: string; deprecated: boolean } {
    let description: string | undefined;
    let deprecated = false;

    // Get JSDoc from property signature or declaration
    if (Node.isPropertySignature(decl) || Node.isPropertyDeclaration(decl)) {
      const jsDocs = decl.getJsDocs();
      if (jsDocs.length > 0) {
        const jsDoc = jsDocs[0];
        const descText = jsDoc.getDescription().trim();
        if (descText) {
          description = descText;
        }
        
        // Check for @deprecated tag
        for (const tag of jsDoc.getTags()) {
          if (tag.getTagName() === 'deprecated') {
            deprecated = true;
            break;
          }
        }
      }
    }

    return { description, deprecated };
  }
}
