/**
 * Python AST Parser
 * Parses Python source code to extract endpoints, tools, and models
 *
 * Uses regex-based parsing as a fallback when tree-sitter is not available.
 * The parser detects:
 * - FastAPI endpoints (@app.get, @app.post, @router.get, etc.)
 * - Flask routes (@app.route, @blueprint.route)
 * - MCP tools (@mcp.tool, @server.tool)
 * - Pydantic BaseModel classes
 * - Typed functions (for type annotation testing)
 */

import type { ProducerSchema, JSONSchema, SourceLocation, ConsumerSchema } from '../../types.js';
import type { LanguageParser, ExtractOptions, TraceOptions } from '../base.js';
import type {
  PythonSchema,
  PythonParseOptions,
  RouterDefinition,
  PydanticModel,
  PydanticField,
  EnumDefinition,
  EndpointParameter,
  DecoratorInfo,
  FunctionInfo,
  ClassInfo,
} from './types.js';
import { TypeResolver } from './type-resolver.js';
import { detectAllHttpCalls, type PythonHttpCallResult } from '../../patterns/python/index.js';

/**
 * Python AST Parser implementation
 */
export class PythonASTParser implements LanguageParser {
  readonly name = 'python';
  readonly filePatterns = ['**/*.py', '**/*.pyi'];

  private typeResolver: TypeResolver;
  private routers = new Map<string, RouterDefinition>();
  private blueprints = new Map<string, RouterDefinition>();
  private servers = new Map<string, string>(); // variable name -> server name
  private enums = new Map<string, EnumDefinition>();
  private initialized = false;

  constructor() {
    this.typeResolver = new TypeResolver();
  }

  /**
   * Initialize the parser
   */
  async initialize(): Promise<boolean> {
    this.initialized = true;
    return true;
  }

  /**
   * Extract producer schemas from Python source
   */
  async extractSchemas(options: ExtractOptions | PythonParseOptions): Promise<ProducerSchema[]> {
    const content = (options as PythonParseOptions).content;
    if (!content) {
      return [];
    }

    // Reset state for new parsing
    this.routers.clear();
    this.blueprints.clear();
    this.servers.clear();
    this.enums.clear();
    this.typeResolver = new TypeResolver();

    const schemas: PythonSchema[] = [];
    const lines = content.split('\n');
    
    try {
      // First pass: collect routers, blueprints, servers, enums, and models
      this.collectDefinitions(content, lines);

      // Second pass: extract endpoints and tools
      const endpoints = this.extractEndpoints(content, lines);
      schemas.push(...endpoints);

      // Extract Pydantic models
      const models = this.extractPydanticModels(content, lines);
      schemas.push(...models);

      // Extract typed functions (for type annotation testing)
      // These are functions with type annotations but without decorators
      const typedFunctions = this.extractTypedFunctions(content, lines);
      schemas.push(...typedFunctions);

    } catch (error) {
      // Silently handle parse errors - return what we have
      if (process.env.DEBUG_TRACE_MCP) {
        console.error('[PythonASTParser] Parse error:', error);
      }
    }

    return schemas;
  }

  /**
   * Trace consumer usage - detects HTTP client calls (requests, httpx, aiohttp)
   *
   * @param options - TraceOptions containing content to analyze
   * @returns ConsumerSchema[] representing HTTP client calls found
   */
  async traceUsage(options: TraceOptions): Promise<ConsumerSchema[]> {
    const content = (options as PythonParseOptions).content;
    if (!content) {
      return [];
    }

    // Detect HTTP client calls from all supported libraries
    const httpCalls = detectAllHttpCalls(content);
    
    // Convert HTTP calls to ConsumerSchema format
    return httpCalls.map(call => this.httpCallToConsumerSchema(call));
  }

  /**
   * Convert a Python HTTP call to ConsumerSchema format
   */
  private httpCallToConsumerSchema(call: PythonHttpCallResult): ConsumerSchema {
    // Build toolName as "METHOD URL" format
    const url = call.url || '<dynamic>';
    const toolName = `${call.method} ${url}`;
    
    // Build arguments provided
    const argumentsProvided: Record<string, unknown> = {
      library: call.library,
      method: call.method,
      url: call.url,
      isAsync: call.isAsync
    };

    // Add session/client flags
    if (call.isSession) {
      argumentsProvided.isSession = true;
    }
    if (call.isClient) {
      argumentsProvided.isClient = true;
    }
    if (call.isAsyncClient) {
      argumentsProvided.isAsyncClient = true;
    }

    // Add URL-related flags
    if (call.isDynamicUrl) {
      argumentsProvided.isDynamicUrl = true;
    }
    if (call.hasQueryParams) {
      argumentsProvided.hasQueryParams = true;
    }

    // Add additional info if available
    if (call.hasHeaders) {
      argumentsProvided.hasHeaders = true;
    }
    if (call.hasBody) {
      argumentsProvided.hasBody = true;
    }
    if (call.responseVariable) {
      argumentsProvided.responseVariable = call.responseVariable;
    }
    if (call.pathParams && call.pathParams.length > 0) {
      argumentsProvided.pathParams = call.pathParams;
    }

    // Build expected properties from response property access
    const expectedProperties: string[] = call.responseProperties || [];

    return {
      toolName,
      argumentsProvided,
      expectedProperties,
      callSite: {
        file: '',
        line: call.line,
        column: 0
      }
    };
  }

  /**
   * Collect router, blueprint, server, enum, and model definitions
   */
  private collectDefinitions(content: string, lines: string[]): void {
    // Find APIRouter definitions: router = APIRouter(prefix="/api/v1")
    const routerPattern = /(\w+)\s*=\s*APIRouter\s*\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    
    while ((match = routerPattern.exec(content)) !== null) {
      const varName = match[1];
      const args = match[2];
      const prefixMatch = args.match(/prefix\s*=\s*["']([^"']+)["']/);
      const prefix = prefixMatch ? prefixMatch[1] : '';
      this.routers.set(varName, { variableName: varName, prefix });
    }

    // Find Blueprint definitions: bp = Blueprint("name", __name__, url_prefix="/api")
    const blueprintPattern = /(\w+)\s*=\s*Blueprint\s*\(\s*["'][^"']+["']\s*,\s*[^,]+(?:,\s*url_prefix\s*=\s*["']([^"']+)["'])?\s*\)/g;
    while ((match = blueprintPattern.exec(content)) !== null) {
      const varName = match[1];
      const prefix = match[2] || '';
      this.blueprints.set(varName, { variableName: varName, prefix });
    }

    // Find Server definitions: mcp = Server("name") or server = Server("name")
    const serverPattern = /(\w+)\s*=\s*Server\s*\(\s*["']([^"']+)["']\s*\)/g;
    while ((match = serverPattern.exec(content)) !== null) {
      const varName = match[1];
      const serverName = match[2];
      this.servers.set(varName, serverName);
    }

    // Find include_router patterns: router.include_router(sub_router)
    const includePattern = /(\w+)\.include_router\s*\(\s*(\w+)\s*\)/g;
    while ((match = includePattern.exec(content)) !== null) {
      const parentRouter = match[1];
      const childRouter = match[2];
      const parentDef = this.routers.get(parentRouter);
      const childDef = this.routers.get(childRouter);
      if (parentDef && childDef) {
        // Update child router's prefix to include parent's prefix
        childDef.prefix = parentDef.prefix + childDef.prefix;
      }
    }

    // Find Enum definitions
    this.extractEnums(content, lines);

    // Pre-register Pydantic models for type resolution
    this.preRegisterModels(content, lines);
  }

  /**
   * Extract enum definitions
   */
  private extractEnums(content: string, _lines: string[]): void {
    // Match class Name(Enum): or class Name(IntEnum): or class Name(str, Enum):
    // Use non-greedy [^)]*? so (?:Enum|IntEnum) can actually match
    // Use \r?\n to handle both Unix and Windows line endings
    // Use [ \t]+ instead of \s+ to avoid matching across blank lines
    const enumPattern = /class\s+(\w+)\s*\([^)]*?(?:Enum|IntEnum)[^)]*\)\s*:((?:\r?\n[ \t]+.+)+)/g;
    let match: RegExpExecArray | null;

    while ((match = enumPattern.exec(content)) !== null) {
      const enumName = match[1];
      const body = match[2];
      const isIntEnum = match[0].includes('IntEnum');
      
      const values: Array<{ name: string; value: string | number }> = [];
      // Pattern for enum values: NAME = "value" or NAME = 123
      // Capture quoted strings or integers, skip method definitions
      const valuePattern = /^\s+([A-Z_][A-Z0-9_]*)\s*=\s*(?:["']([^"']+)["']|(\d+))/gm;
      let valueMatch: RegExpExecArray | null;
      
      while ((valueMatch = valuePattern.exec(body)) !== null) {
        const name = valueMatch[1];
        
        // Parse value - use captured string or integer
        let value: string | number;
        if (valueMatch[3] !== undefined) {
          // Integer value
          value = parseInt(valueMatch[3], 10);
        } else if (valueMatch[2] !== undefined) {
          // String value
          value = valueMatch[2];
        } else {
          continue; // Skip if neither matched
        }
        
        values.push({ name, value });
      }

      if (values.length > 0) {
        this.enums.set(enumName, { name: enumName, values, isIntEnum });
        this.typeResolver.registerEnum({ name: enumName, values, isIntEnum });
      }
    }
  }

  /**
   * Pre-register Pydantic models for type resolution
   */
  private preRegisterModels(content: string, lines: string[]): void {
    const modelPattern = /class\s+(\w+)\s*\(\s*(?:.*?BaseModel.*?|(\w+))\s*\)\s*:/g;
    let match: RegExpExecArray | null;

    while ((match = modelPattern.exec(content)) !== null) {
      const className = match[1];
      const lineNum = this.getLineNumber(content, match.index);
      
      // Check if it extends BaseModel (directly or indirectly)
      const bases = this.extractBases(match[0]);
      
      // Simple check - register all classes for now, we'll filter later
      this.typeResolver.registerModel({
        name: className,
        fields: [],
        bases,
        location: { file: '', line: lineNum, column: 0 }
      });
    }
  }

  /**
   * Extract base classes from class definition
   */
  private extractBases(classLine: string): string[] {
    const match = classLine.match(/class\s+\w+\s*\(([^)]+)\)/);
    if (!match) return [];
    
    return match[1].split(',').map(b => b.trim()).filter(b => b && !b.includes('='));
  }

  /**
   * Extract FastAPI and Flask endpoints
   */
  private extractEndpoints(content: string, lines: string[]): PythonSchema[] {
    const schemas: PythonSchema[] = [];

    // Pattern for decorated functions
    // Matches: @something.method("/path") or @something.method("/path", ...)
    // followed by async def or def
    const decoratedFuncPattern = /@(\w+)\.(\w+)\s*\(([^)]*)\)[\s\S]*?(?=@\w+\.|class\s|def\s|async\s+def\s)/g;
    
    // More specific approach: find all decorators and their associated functions
    const funcBlocks = this.extractDecoratedFunctions(content, lines);

    for (const block of funcBlocks) {
      const endpoints = this.processDecoratedFunction(block, lines);
      if (endpoints) {
        // Handle both single schema and array of schemas (for multi-method Flask routes)
        if (Array.isArray(endpoints)) {
          schemas.push(...endpoints);
        } else {
          schemas.push(endpoints);
        }
      }
    }

    return schemas;
  }

  /**
   * Extract all decorated function blocks
   */
  private extractDecoratedFunctions(content: string, lines: string[]): Array<{
    decorators: string[];
    funcDef: string;
    funcBody: string;
    startLine: number;
    endLine: number;
  }> {
    const blocks: Array<{
      decorators: string[];
      funcDef: string;
      funcBody: string;
      startLine: number;
      endLine: number;
    }> = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      
      // Check if this line starts a decorator
      if (line.trim().startsWith('@')) {
        const decorators: string[] = [];
        const startLine = i + 1;
        
        // Collect all decorators
        while (i < lines.length && lines[i].trim().startsWith('@')) {
          // Handle multi-line decorators
          let decorator = lines[i].trim();
          while (!decorator.includes(')') && !decorator.endsWith(':')) {
            i++;
            if (i < lines.length) {
              decorator += ' ' + lines[i].trim();
            }
          }
          decorators.push(decorator);
          i++;
        }

        // Now we should be at the function definition
        if (i < lines.length) {
          const funcLine = lines[i];
          if (funcLine.trim().startsWith('def ') || funcLine.trim().startsWith('async def ')) {
            // Collect function definition (may span multiple lines)
            let funcDef = funcLine;
            while (!funcDef.includes(':') || (funcDef.split('(').length > funcDef.split(')').length)) {
              i++;
              if (i < lines.length) {
                funcDef += '\n' + lines[i];
              }
            }

            // Get the function body (for docstring)
            const bodyStart = i + 1;
            let bodyEnd = bodyStart;
            const baseIndent = this.getIndent(funcLine);
            
            while (bodyEnd < lines.length) {
              const bodyLine = lines[bodyEnd];
              // Empty lines are ok
              if (bodyLine.trim() === '') {
                bodyEnd++;
                continue;
              }
              // Check indentation
              const lineIndent = this.getIndent(bodyLine);
              if (lineIndent <= baseIndent && bodyLine.trim() !== '') {
                break;
              }
              bodyEnd++;
            }

            // Capture more lines for detailed docstrings (up to 30 lines)
            const funcBody = lines.slice(bodyStart, Math.min(bodyStart + 30, bodyEnd)).join('\n');

            blocks.push({
              decorators,
              funcDef,
              funcBody,
              startLine,
              endLine: bodyEnd
            });
          }
        }
      }
      i++;
    }

    return blocks;
  }

  /**
   * Get indentation level of a line
   */
  private getIndent(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  /**
   * Process a decorated function block into a schema (or array of schemas for multi-method routes)
   */
  private processDecoratedFunction(
    block: { decorators: string[]; funcDef: string; funcBody: string; startLine: number },
    _lines: string[]
  ): PythonSchema | PythonSchema[] | null {
    // Parse decorators
    for (const decorator of block.decorators) {
      // FastAPI pattern: @app.get("/path") or @router.post("/path")
      const fastapiMatch = decorator.match(/@(\w+)\.(get|post|put|patch|delete|options|head)\s*\(([^)]*)\)/i);
      if (fastapiMatch) {
        return this.processFastAPIEndpoint(fastapiMatch, block, decorator);
      }

      // Flask pattern: @app.route("/path") or @bp.route("/path", methods=["GET"])
      const flaskMatch = decorator.match(/@(\w+)\.route\s*\(([^)]*)\)/);
      if (flaskMatch) {
        return this.processFlaskRoute(flaskMatch, block, decorator);
      }

      // MCP pattern: @mcp.tool() or @server.tool()
      const mcpMatch = decorator.match(/@(\w+)\.tool\s*\(\s*\)/);
      if (mcpMatch) {
        return this.processMCPTool(mcpMatch, block);
      }
    }

    return null;
  }

  /**
   * Process FastAPI endpoint
   */
  private processFastAPIEndpoint(
    match: RegExpMatchArray,
    block: { decorators: string[]; funcDef: string; funcBody: string; startLine: number },
    decorator: string
  ): PythonSchema {
    const routerVar = match[1];
    const method = match[2].toUpperCase() as PythonSchema['method'];
    const args = match[3];


    // Extract path from first argument - handle empty string paths
    const pathMatch = args.match(/["']([^"']*)["']/);
    let path = pathMatch !== null ? pathMatch[1] : '/';

    // Add router prefix if applicable
    const routerDef = this.routers.get(routerVar);
    if (routerDef && routerDef.prefix) {
      // Normalize prefix first
      let prefix = routerDef.prefix.replace(/\/+$/, '');
      // When path is empty, just use the prefix
      if (path === '' || path === '/') {
        path = prefix;
      } else {
        // Ensure path starts with / if not empty
        if (!path.startsWith('/')) {
          path = '/' + path;
        }
        path = prefix + path;
      }
    }

    // Normalize path - remove trailing slashes aggressively
    path = path.trim().replace(/[\r\n\t]/g, '');
    if (!path.startsWith('/')) path = '/' + path;
    // Remove ALL trailing slashes
    path = path.replace(/\/+$/g, '') || '/';

    // Parse function definition
    const funcInfo = this.parseFunctionDef(block.funcDef);
    
    // Extract status_code from decorator
    const statusMatch = decorator.match(/status_code\s*=\s*(\d+)/);
    const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : undefined;

    // Extract response_model
    const responseModelMatch = decorator.match(/response_model\s*=\s*(\w+)/);
    const responseModel = responseModelMatch ? responseModelMatch[1] : undefined;

    // Extract parameters
    const parameters = this.extractParameters(funcInfo.params, path);

    // Build input schema
    const inputSchema = this.buildInputSchema(parameters);

    // Build output schema
    const outputSchema = responseModel 
      ? this.typeResolver.resolve(responseModel)
      : funcInfo.returnType 
        ? this.typeResolver.resolve(funcInfo.returnType)
        : {};

    // Extract docstring
    const docstring = this.extractDocstring(block.funcBody);

    // Final path normalization to ensure no trailing slashes
    // Apply double normalization for extra safety
    let normalizedPath = this.normalizePath(path);
    // One more explicit check
    if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
      normalizedPath = normalizedPath.slice(0, -1);
    }

    // Final aggressive trailing slash removal
    const finalPath = normalizedPath.replace(/\/+$/, '') || '/';
    
    return {
      id: funcInfo.name,
      toolName: funcInfo.name,
      method,
      path: finalPath,
      async: funcInfo.isAsync,
      statusCode,
      type: 'endpoint',
      inputSchema,
      outputSchema,
      description: docstring,
      location: { file: '', line: block.startLine, column: 0 }
    };
  }

  /**
   * Process Flask route - returns array of schemas for multi-method routes
   */
  private processFlaskRoute(
    match: RegExpMatchArray,
    block: { decorators: string[]; funcDef: string; funcBody: string; startLine: number },
    decorator: string
  ): PythonSchema | PythonSchema[] | null {
    const routerVar = match[1];
    const args = match[2];

    // Extract path
    const pathMatch = args.match(/["']([^"']+)["']/);
    let path = pathMatch ? pathMatch[1] : '/';

    // Add blueprint prefix if applicable
    const blueprintDef = this.blueprints.get(routerVar);
    if (blueprintDef) {
      path = blueprintDef.prefix + path;
    }

    // Convert Flask path parameters to OpenAPI style
    // <int:user_id> -> {user_id}
    const pathParams = this.extractFlaskPathParams(path);
    path = path.replace(/<(\w+:)?(\w+)>/g, '{$2}');

    // Extract methods
    const methodsMatch = args.match(/methods\s*=\s*\[([^\]]+)\]/);
    let methods = ['GET'];
    if (methodsMatch) {
      methods = methodsMatch[1]
        .split(',')
        .map(m => m.trim().replace(/["']/g, '').toUpperCase());
    }

    // Parse function definition
    const funcInfo = this.parseFunctionDef(block.funcDef);

    // Extract parameters
    const parameters = this.extractParameters(funcInfo.params, path, pathParams);

    // Build input schema
    const inputSchema = this.buildInputSchema(parameters);

    // Extract docstring
    const docstring = this.extractDocstring(block.funcBody);

    // For multiple methods, create separate schemas for each
    if (methods.length > 1) {
      return methods.map(method => ({
        id: `${funcInfo.name}_${method}`,
        toolName: funcInfo.name,
        method: method as PythonSchema['method'],
        path,
        async: funcInfo.isAsync,
        type: 'endpoint' as const,
        inputSchema,
        outputSchema: {},
        description: docstring,
        location: { file: '', line: block.startLine, column: 0 }
      }));
    }

    // Single method
    const method = methods[0] as PythonSchema['method'];

    return {
      id: `${funcInfo.name}_${method}`,
      toolName: funcInfo.name,
      method,
      path,
      async: funcInfo.isAsync,
      type: 'endpoint',
      inputSchema,
      outputSchema: {},
      description: docstring,
      location: { file: '', line: block.startLine, column: 0 }
    };
  }

  /**
   * Extract Flask path parameters with their types
   */
  private extractFlaskPathParams(path: string): Map<string, string> {
    const params = new Map<string, string>();
    const pattern = /<(\w+):(\w+)>/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(path)) !== null) {
      const converter = match[1];
      const paramName = match[2];
      params.set(paramName, converter);
    }

    // Also match simple <param> without converter
    const simplePattern = /<(\w+)>/g;
    while ((match = simplePattern.exec(path)) !== null) {
      if (!match[0].includes(':')) {
        params.set(match[1], 'string');
      }
    }

    return params;
  }

  /**
   * Process MCP tool
   */
  private processMCPTool(
    match: RegExpMatchArray,
    block: { decorators: string[]; funcDef: string; funcBody: string; startLine: number }
  ): PythonSchema {
    const serverVar = match[1];
    const serverName = this.servers.get(serverVar);

    // Parse function definition
    const funcInfo = this.parseFunctionDef(block.funcDef);

    // Extract parameters
    const parameters = this.extractParameters(funcInfo.params, '');

    // Build input schema
    const inputSchema = this.buildInputSchema(parameters);

    // Build output schema
    const outputSchema = funcInfo.returnType 
      ? this.typeResolver.resolve(funcInfo.returnType)
      : {};

    // Extract docstring
    const docstring = this.extractDocstring(block.funcBody);

    // Extract parameter descriptions from docstring
    const paramDescriptions = this.extractParamDescriptions(block.funcBody);
    for (const [paramName, description] of paramDescriptions) {
      if (inputSchema.properties?.[paramName]) {
        (inputSchema.properties[paramName] as JSONSchema).description = description;
      }
    }

    return {
      id: funcInfo.name,
      toolName: funcInfo.name,
      async: funcInfo.isAsync,
      type: 'tool',
      inputSchema,
      outputSchema,
      description: docstring,
      location: { file: '', line: block.startLine, column: 0 }
    };
  }

  /**
   * Parse function definition
   */
  private parseFunctionDef(funcDef: string): {
    name: string;
    isAsync: boolean;
    params: Array<{ name: string; type?: string; default?: string }>;
    returnType?: string;
  } {
    const isAsync = funcDef.trim().startsWith('async ');
    
    // Extract function name
    const nameMatch = funcDef.match(/def\s+(\w+)\s*\(/);
    const name = nameMatch ? nameMatch[1] : 'unknown';

    // Extract parameters - handle nested parentheses
    const paramsStr = this.extractParamsFromFuncDef(funcDef);
    const params = this.parseParams(paramsStr);

    // Extract return type
    const returnMatch = funcDef.match(/->\s*([^:]+):/);
    const returnType = returnMatch ? returnMatch[1].trim() : undefined;

    return { name, isAsync, params, returnType };
  }

  /**
   * Extract parameters from function definition, handling nested parentheses
   */
  private extractParamsFromFuncDef(funcDef: string): string {
    const startIdx = funcDef.indexOf('(');
    if (startIdx === -1) return '';

    let depth = 0;
    let endIdx = -1;
    
    for (let i = startIdx; i < funcDef.length; i++) {
      const char = funcDef[i];
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    
    if (endIdx === -1) return '';
    return funcDef.slice(startIdx + 1, endIdx);
  }

  /**
   * Parse function parameters
   */
  private parseParams(paramsStr: string): Array<{ name: string; type?: string; default?: string }> {
    const params: Array<{ name: string; type?: string; default?: string }> = [];
    
    if (!paramsStr.trim()) return params;

    // Split by comma, but respect nested brackets
    const parts = this.splitParams(paramsStr);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed || trimmed === 'self' || trimmed === 'cls') continue;

      // Parse parameter: name: Type = default
      const param = this.parseParam(trimmed);
      if (param) {
        params.push(param);
      }
    }

    return params;
  }

  /**
   * Split parameters respecting nested brackets
   */
  private splitParams(paramsStr: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of paramsStr) {
      if (char === '[' || char === '(' || char === '{') {
        depth++;
        current += char;
      } else if (char === ']' || char === ')' || char === '}') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Parse a single parameter
   */
  private parseParam(paramStr: string): { name: string; type?: string; default?: string } | null {
    // Handle *args, **kwargs
    if (paramStr.startsWith('*')) return null;

    // Split by = for default value
    const eqIndex = paramStr.indexOf('=');
    let nameType = paramStr;
    let defaultValue: string | undefined;

    if (eqIndex > 0) {
      nameType = paramStr.slice(0, eqIndex).trim();
      defaultValue = paramStr.slice(eqIndex + 1).trim();
    }

    // Split by : for type annotation
    const colonIndex = nameType.indexOf(':');
    let name = nameType;
    let type: string | undefined;

    if (colonIndex > 0) {
      name = nameType.slice(0, colonIndex).trim();
      type = nameType.slice(colonIndex + 1).trim();
    }

    return { name, type, default: defaultValue };
  }

  /**
   * Extract parameters with source detection
   */
  private extractParameters(
    params: Array<{ name: string; type?: string; default?: string }>,
    path: string,
    flaskPathParams?: Map<string, string>
  ): EndpointParameter[] {
    const result: EndpointParameter[] = [];

    // Extract path parameters from path
    const pathParams = new Set<string>();
    const pathParamPattern = /\{(\w+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = pathParamPattern.exec(path)) !== null) {
      pathParams.add(match[1]);
    }

    for (const param of params) {
      let source: EndpointParameter['source'] = 'unknown';
      let typeSchema = this.typeResolver.resolve(param.type);
      let converter: string | undefined;

      // Check if it's a path parameter
      if (pathParams.has(param.name)) {
        source = 'path';
        
        // For Flask, check if there's a converter
        if (flaskPathParams?.has(param.name)) {
          converter = flaskPathParams.get(param.name);
          typeSchema = this.flaskConverterToSchema(converter);
        }
      }
      // Check if it's a FastAPI dependency pattern
      else if (param.default?.includes('Query(')) {
        source = 'query';
      } else if (param.default?.includes('Body(')) {
        source = 'body';
      } else if (param.default?.includes('Header(')) {
        source = 'header';
        // Convert parameter name from snake_case to header format
      } else if (param.default?.includes('Depends(')) {
        source = 'depends';
      } else if (param.default?.includes('Path(')) {
        source = 'path';
      }
      // Default to query for primitive types, body for complex
      else if (!pathParams.has(param.name)) {
        const isPrimitive = ['str', 'int', 'float', 'bool'].some(t => 
          param.type?.includes(t) || !param.type
        );
        source = isPrimitive ? 'query' : 'body';
      }

      // Extract default value
      let defaultValue: unknown;
      if (param.default) {
        defaultValue = this.parseDefaultValue(param.default);
      }

      result.push({
        name: param.name,
        type: param.type,
        typeSchema,
        required: param.default === undefined,
        default: defaultValue,
        source,
        converter
      });
    }

    return result;
  }

  /**
   * Convert Flask URL converter to JSON Schema
   */
  private flaskConverterToSchema(converter?: string): JSONSchema {
    switch (converter) {
      case 'int':
        return { type: 'integer' };
      case 'float':
        return { type: 'number' };
      case 'path':
        return { type: 'string' };
      case 'uuid':
        return { type: 'string', format: 'uuid' };
      case 'string':
      default:
        return { type: 'string' };
    }
  }

  /**
   * Parse default value
   */
  private parseDefaultValue(defaultStr: string): unknown {
    const trimmed = defaultStr.trim();

    // None
    if (trimmed === 'None') return undefined;

    // Boolean
    if (trimmed === 'True') return true;
    if (trimmed === 'False') return false;

    // Number
    if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);

    // String
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    // Empty list/dict
    if (trimmed === '[]') return [];
    if (trimmed === '{}') return {};

    // FastAPI Query/Body/etc - extract default from inside
    const fastapiMatch = trimmed.match(/(?:Query|Body|Path|Header)\s*\(([^)]*)\)/);
    if (fastapiMatch) {
      const inner = fastapiMatch[1];
      // First positional arg is the default
      if (inner.startsWith('...')) return undefined; // Required
      const firstArg = inner.split(',')[0].trim();
      return this.parseDefaultValue(firstArg);
    }

    return undefined;
  }

  /**
   * Build input schema from parameters
   */
  private buildInputSchema(params: EndpointParameter[]): JSONSchema {
    const properties: Record<string, JSONSchema> = {};
    const required: string[] = [];

    for (const param of params) {
      if (param.source === 'depends') continue; // Skip dependencies

      properties[param.name] = {
        ...param.typeSchema,
        ...(param.default !== undefined && { default: param.default }),
        ...(param.description && { description: param.description })
      };

      if (param.required) {
        required.push(param.name);
      }
    }

    return {
      type: 'object',
      properties,
      required // Always include required array (empty or with values)
    };
  }

  /**
   * Extract docstring from function body
   */
  private extractDocstring(body: string): string | undefined {
    const match = body.match(/^\s*(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')/);
    if (match) {
      const docstring = (match[1] || match[2]).trim();
      // Return first line or first sentence for short description
      const firstLine = docstring.split('\n')[0].trim();
      if (firstLine.includes('.')) {
        return firstLine.split('.')[0].trim() + '.';
      }
      return firstLine;
    }
    return undefined;
  }

  /**
   * Extract parameter descriptions from docstring Args section
   */
  private extractParamDescriptions(body: string): Map<string, string> {
    const descriptions = new Map<string, string>();
    
    const match = body.match(/Args:\s*([\s\S]*?)(?:Returns:|Raises:|Example:|$)/);
    if (match) {
      const argsSection = match[1];
      const paramPattern = /(\w+):\s*(.+?)(?=\n\s+\w+:|$)/gs;
      let paramMatch: RegExpExecArray | null;
      
      while ((paramMatch = paramPattern.exec(argsSection)) !== null) {
        const paramName = paramMatch[1];
        const description = paramMatch[2].replace(/\n\s+/g, ' ').trim();
        descriptions.set(paramName, description);
      }
    }

    return descriptions;
  }

  /**
   * Extract Pydantic models - uses two-pass approach for proper inheritance
   */
  private extractPydanticModels(content: string, lines: string[]): PythonSchema[] {
    // First pass: collect all model info with their own fields (but not inherited)
    const modelInfos: Array<{
      className: string;
      bases: string[];
      fields: PydanticField[];
      docstring?: string;
      lineNum: number;
    }> = [];
    
    // Find class definitions that extend BaseModel
    const classPattern = /class\s+(\w+)\s*\(([^)]+)\)\s*:/g;
    let match: RegExpExecArray | null;

    while ((match = classPattern.exec(content)) !== null) {
      const className = match[1];
      const bases = match[2].split(',').map(b => b.trim());
      
      // Check if it extends BaseModel (directly or indirectly)
      const isBaseModel = bases.some(b =>
        b === 'BaseModel' ||
        b.includes('BaseModel') ||
        this.isSubclassOfBaseModel(b)
      );

      if (!isBaseModel) continue;

      const lineNum = this.getLineNumber(content, match.index);
      const classBody = this.extractClassBody(content, match.index + match[0].length, lines, lineNum);
      
      // Parse fields (own fields only, not inherited)
      const fields = this.extractPydanticFields(classBody, bases);
      
      // Extract docstring
      const docstring = this.extractDocstring(classBody);

      // Register model with its own fields for type resolution and inheritance
      // Keep full bases list (including 'BaseModel') for isSubclassOfBaseModel to work
      const model: PydanticModel = {
        name: className,
        fields,
        bases,  // Keep all bases for inheritance checking
        docstring,
        location: { file: '', line: lineNum, column: 0 }
      };
      this.typeResolver.registerModel(model);

      modelInfos.push({ className, bases, fields, docstring, lineNum });
    }

    // Second pass: build schemas with inheritance resolved
    const schemas: PythonSchema[] = [];
    
    for (const info of modelInfos) {
      const properties: Record<string, JSONSchema> = {};
      const required: string[] = [];

      // Collect inherited fields recursively
      const collectInheritedFields = (bases: string[]) => {
        for (const base of bases) {
          if (base === 'BaseModel') continue;
          
          const baseModel = this.typeResolver.getModel(base);
          if (baseModel) {
            // First collect from parent's bases (grandparents)
            collectInheritedFields(baseModel.bases);
            
            // Then add parent's own fields
            for (const field of baseModel.fields) {
              properties[field.name] = field.typeSchema;
              if (field.required && !required.includes(field.name)) {
                required.push(field.name);
              }
            }
          }
        }
      };

      // Collect inherited fields
      collectInheritedFields(info.bases);

      // Add own fields (may override inherited)
      for (const field of info.fields) {
        properties[field.name] = {
          ...field.typeSchema,
          ...(field.default !== undefined && { default: field.default }),
          ...(field.description && { description: field.description }),
          ...(field.constraints?.minLength !== undefined && { minLength: field.constraints.minLength }),
          ...(field.constraints?.maxLength !== undefined && { maxLength: field.constraints.maxLength }),
          ...(field.constraints?.minimum !== undefined && { minimum: field.constraints.minimum }),
          ...(field.constraints?.maximum !== undefined && { maximum: field.constraints.maximum }),
          ...(field.constraints?.pattern && { pattern: field.constraints.pattern }),
        };
        
        if (field.required && !required.includes(field.name)) {
          required.push(field.name);
        }
      }

      schemas.push({
        id: info.className,
        toolName: info.className,
        type: 'model',
        properties,
        required,
        inputSchema: { type: 'object', properties, required: required.length > 0 ? required : undefined },
        outputSchema: {},
        description: info.docstring,
        location: { file: '', line: info.lineNum, column: 0 }
      });
    }

    return schemas;
  }

  /**
   * Check if a class is a subclass of BaseModel
   */
  private isSubclassOfBaseModel(className: string): boolean {
    const model = this.typeResolver.getModel(className);
    if (!model) return false;
    
    return model.bases.some(b => 
      b === 'BaseModel' || this.isSubclassOfBaseModel(b)
    );
  }

  /**
   * Extract class body
   */
  private extractClassBody(content: string, startOffset: number, lines: string[], startLineNum: number): string {
    // Find the indentation of the class body
    const contentAfter = content.slice(startOffset);
    const bodyMatch = contentAfter.match(/^[^\n]*\n([\s\S]*?)(?=\nclass\s|\n[^\s]|$)/);
    
    if (bodyMatch) {
      return bodyMatch[1];
    }

    return '';
  }

  /**
   * Extract Pydantic field definitions
   */
  private extractPydanticFields(classBody: string, bases: string[]): PydanticField[] {
    const fields: PydanticField[] = [];
    
    // Pattern for field definitions: name: Type = default
    const fieldPattern = /^\s+(\w+)\s*:\s*([^=\n]+)(?:\s*=\s*(.+))?$/gm;
    let match: RegExpExecArray | null;

    while ((match = fieldPattern.exec(classBody)) !== null) {
      const name = match[1];
      const typeStr = match[2].trim();
      const defaultStr = match[3]?.trim();

      // Skip methods and private fields
      if (name.startsWith('_') || name === 'Config') continue;

      // Parse type
      const typeSchema = this.typeResolver.resolve(typeStr);

      // Determine if required
      let required = true;
      let defaultValue: unknown;
      let constraints: PydanticField['constraints'];
      let description: string | undefined;

      if (defaultStr) {
        required = false;
        
        // Check for Field() with constraints
        if (defaultStr.startsWith('Field(')) {
          const fieldInfo = this.parseFieldCall(defaultStr);
          required = fieldInfo.required;
          defaultValue = fieldInfo.default;
          constraints = fieldInfo.constraints;
          description = fieldInfo.description;
        } else {
          defaultValue = this.parseDefaultValue(defaultStr);
          // If default is None and type is Optional, it's not required
          if (defaultStr === 'None') {
            required = false;
          }
        }
      }

      // Check if type is Optional - then not required
      if (typeStr.startsWith('Optional[') || typeStr.includes(' | None')) {
        required = false;
      }

      fields.push({
        name,
        type: typeStr,
        typeSchema,
        required,
        default: defaultValue,
        description,
        constraints
      });
    }

    return fields;
  }

  /**
   * Parse Field() call for constraints
   */
  private parseFieldCall(fieldStr: string): {
    required: boolean;
    default?: unknown;
    constraints?: PydanticField['constraints'];
    description?: string;
  } {
    const result: {
      required: boolean;
      default?: unknown;
      constraints?: PydanticField['constraints'];
      description?: string;
    } = { required: true };

    // Extract arguments
    const argsMatch = fieldStr.match(/Field\s*\(([^)]*)\)/s);
    if (!argsMatch) return result;

    const args = argsMatch[1];

    // Check for ... (required marker)
    if (args.trim().startsWith('...')) {
      result.required = true;
    } else {
      // First positional arg is default
      const firstArg = args.split(',')[0].trim();
      if (firstArg && firstArg !== '...' && !firstArg.includes('=')) {
        result.default = this.parseDefaultValue(firstArg);
        result.required = false;
      }
    }

    // Parse keyword arguments
    const constraints: PydanticField['constraints'] = {};

    const minLengthMatch = args.match(/min_length\s*=\s*(\d+)/);
    if (minLengthMatch) constraints.minLength = parseInt(minLengthMatch[1]);

    const maxLengthMatch = args.match(/max_length\s*=\s*(\d+)/);
    if (maxLengthMatch) constraints.maxLength = parseInt(maxLengthMatch[1]);

    const geMatch = args.match(/ge\s*=\s*(-?\d+(?:\.\d+)?)/);
    if (geMatch) constraints.minimum = parseFloat(geMatch[1]);

    const leMatch = args.match(/le\s*=\s*(-?\d+(?:\.\d+)?)/);
    if (leMatch) constraints.maximum = parseFloat(leMatch[1]);

    const patternMatch = args.match(/pattern\s*=\s*["']([^"']+)["']/);
    if (patternMatch) constraints.pattern = patternMatch[1];

    const minItemsMatch = args.match(/min_items\s*=\s*(\d+)/);
    if (minItemsMatch) constraints.minItems = parseInt(minItemsMatch[1]);

    const maxItemsMatch = args.match(/max_items\s*=\s*(\d+)/);
    if (maxItemsMatch) constraints.maxItems = parseInt(maxItemsMatch[1]);

    if (Object.keys(constraints).length > 0) {
      result.constraints = constraints;
    }

    // Description
    const descMatch = args.match(/description\s*=\s*["']([^"']+)["']/);
    if (descMatch) {
      result.description = descMatch[1];
    }

    return result;
  }

  /**
   * Get line number for a character offset
   */
  private getLineNumber(content: string, offset: number): number {
    const beforeOffset = content.slice(0, offset);
    return (beforeOffset.match(/\n/g) || []).length + 1;
  }

  /**
   * Extract typed functions (for type annotation testing)
   * This extracts functions that have type annotations but are NOT decorated
   */
  private extractTypedFunctions(content: string, lines: string[]): PythonSchema[] {
    const schemas: PythonSchema[] = [];
    
    // Pattern to match undecorated function definitions with type hints
    // def func_name(param: type, ...) -> return_type:
    const funcPattern = /^(async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?\s*:/gm;
    let match: RegExpExecArray | null;

    while ((match = funcPattern.exec(content)) !== null) {
      const isAsync = !!match[1];
      const funcName = match[2];
      const paramsStr = match[3];
      const returnType = match[4]?.trim();
      const lineNum = this.getLineNumber(content, match.index);

      // Check if this function is decorated (look at previous line)
      const prevLineIdx = lineNum - 2;
      if (prevLineIdx >= 0 && lines[prevLineIdx]?.trim().startsWith('@')) {
        // Skip decorated functions - they're handled elsewhere
        continue;
      }

      // Skip dunder methods
      if (funcName.startsWith('__') && funcName.endsWith('__')) {
        continue;
      }

      // Skip methods inside classes (check indentation)
      const funcLine = lines[lineNum - 1];
      if (funcLine && this.getIndent(funcLine) > 0) {
        continue;
      }

      // Parse parameters
      const params = this.parseParams(paramsStr);
      
      // Skip functions without type hints
      const hasTypeHints = params.some(p => p.type) || returnType;
      if (!hasTypeHints) continue;

      // Build input schema from parameters
      const properties: Record<string, JSONSchema> = {};
      const required: string[] = [];

      for (const param of params) {
        if (param.type) {
          const typeSchema = this.typeResolver.resolve(param.type);
          properties[param.name] = typeSchema;
          
          if (param.default === undefined) {
            required.push(param.name);
          }
        }
      }

      // Build output schema from return type
      const outputSchema = returnType ? this.typeResolver.resolve(returnType) : {};

      schemas.push({
        id: funcName,
        toolName: funcName,
        async: isAsync,
        type: 'function',
        inputSchema: {
          type: 'object',
          properties,
          ...(required.length > 0 && { required })
        },
        outputSchema,
        location: { file: '', line: lineNum, column: 0 }
      });
    }

    return schemas;
  }

  /**
   * Normalize a path by ensuring leading slash and removing trailing slashes
   */
  private normalizePath(path: string): string {
    // Handle empty/falsy path
    if (!path || path.trim() === '') {
      return '/';
    }
    
    // Trim whitespace, CRLF, and any hidden characters
    path = path.trim().replace(/[\r\n\t]/g, '');
    
    // Ensure leading slash
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Remove ALL trailing slashes and whitespace (but keep root "/" as is)
    // Use a more aggressive approach
    while (path.length > 1 && (path.endsWith('/') || path.endsWith(' ') || path.charCodeAt(path.length - 1) < 32)) {
      path = path.slice(0, -1);
    }
    
    return path || '/';
  }
}
