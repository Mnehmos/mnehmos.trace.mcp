/**
 * TypeScript Language Parser - Enhanced
 * 
 * Extracts MCP schemas from TypeScript source files using ts-morph.
 * 
 * Supports multiple tool definition patterns:
 * 1. server.tool() - FastMCP / MCP SDK pattern
 * 2. Registry Pattern - Object literal with ToolDefinition entries (ChatRPG)
 * 3. Exported Zod Schemas - Named *Schema exports for tracing
 */

import { Project, SyntaxKind, Node, CallExpression, SourceFile, ObjectLiteralExpression, PropertyAssignment } from 'ts-morph';
import type { LanguageParser, ExtractOptions, TraceOptions } from './base.js';
import type { ProducerSchema, ConsumerSchema, JSONSchema, SourceLocation } from '../types.js';

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
}
