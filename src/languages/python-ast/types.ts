/**
 * Python AST Parser Types
 * Type definitions for Python endpoint detection and schema extraction
 */

import type { JSONSchema, ProducerSchema, SourceLocation } from '../../types.js';

/**
 * Extended schema for Python HTTP endpoints, tools, and models
 */
export interface PythonSchema extends ProducerSchema {
  /** Unique identifier for the schema (function or class name) */
  id: string;
  /** HTTP method for endpoints */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
  /** URL path for endpoints */
  path?: string;
  /** Whether the function is async */
  async?: boolean;
  /** HTTP status code from decorator */
  statusCode?: number;
  /** Schema type: 'endpoint', 'tool', 'model', 'function' */
  type?: 'endpoint' | 'tool' | 'model' | 'function';
  /** Properties for models (alias for inputSchema.properties) */
  properties?: Record<string, JSONSchema>;
  /** Required fields for models */
  required?: string[];
}

/**
 * Options for parsing Python source code
 */
export interface PythonParseOptions {
  /** Direct source code content to parse */
  content?: string;
  /** Root directory for file-based parsing */
  rootDir?: string;
  /** File patterns to include */
  include?: string[];
  /** File patterns to exclude */
  exclude?: string[];
}

/**
 * Pydantic field information
 */
export interface PydanticField {
  name: string;
  type: string;
  typeSchema: JSONSchema;
  required: boolean;
  default?: unknown;
  description?: string;
  constraints?: {
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    pattern?: string;
    minItems?: number;
    maxItems?: number;
  };
}

/**
 * Pydantic model information
 */
export interface PydanticModel {
  name: string;
  fields: PydanticField[];
  bases: string[];
  docstring?: string;
  location: SourceLocation;
}

/**
 * FastAPI endpoint information
 */
export interface FastAPIEndpoint {
  functionName: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
  routerName?: string;
  routerPrefix?: string;
  parameters: EndpointParameter[];
  returnType?: string;
  responseModel?: string;
  statusCode?: number;
  isAsync: boolean;
  docstring?: string;
  location: SourceLocation;
}

/**
 * Flask route information
 */
export interface FlaskRoute {
  functionName: string;
  path: string;
  methods: string[];
  blueprintName?: string;
  blueprintPrefix?: string;
  parameters: EndpointParameter[];
  isAsync: boolean;
  docstring?: string;
  location: SourceLocation;
}

/**
 * MCP tool information
 */
export interface MCPTool {
  functionName: string;
  serverName?: string;
  parameters: EndpointParameter[];
  returnType?: string;
  isAsync: boolean;
  docstring?: string;
  location: SourceLocation;
}

/**
 * Endpoint parameter information
 */
export interface EndpointParameter {
  name: string;
  type?: string;
  typeSchema: JSONSchema;
  required: boolean;
  default?: unknown;
  description?: string;
  source: 'path' | 'query' | 'body' | 'header' | 'depends' | 'unknown';
  /** For Flask URL converters like <int:id> */
  converter?: string;
}

/**
 * Router/Blueprint definition for tracking prefixes
 */
export interface RouterDefinition {
  variableName: string;
  prefix: string;
  tags?: string[];
}

/**
 * Enum definition from Python source
 */
export interface EnumDefinition {
  name: string;
  values: Array<{ name: string; value: string | number }>;
  isIntEnum: boolean;
}

/**
 * Decorator information extracted from AST
 */
export interface DecoratorInfo {
  name: string;
  fullName: string;  // e.g., "app.get", "router.post"
  arguments: DecoratorArgument[];
  location: SourceLocation;
}

/**
 * Decorator argument
 */
export interface DecoratorArgument {
  name?: string;      // Named argument (e.g., 'response_model')
  value: unknown;     // The value (parsed)
  rawValue: string;   // Raw string representation
}

/**
 * Function definition from AST
 */
export interface FunctionInfo {
  name: string;
  isAsync: boolean;
  parameters: ParameterInfo[];
  returnType?: string;
  decorators: DecoratorInfo[];
  docstring?: string;
  location: SourceLocation;
}

/**
 * Function parameter info
 */
export interface ParameterInfo {
  name: string;
  type?: string;
  default?: string;
  hasDefault: boolean;
}

/**
 * Class definition from AST
 */
export interface ClassInfo {
  name: string;
  bases: string[];
  body: ClassBodyItem[];
  decorators: DecoratorInfo[];
  docstring?: string;
  location: SourceLocation;
}

/**
 * Class body items (fields, methods, etc.)
 */
export interface ClassBodyItem {
  type: 'field' | 'method' | 'assignment';
  name: string;
  typeAnnotation?: string;
  value?: string;
  location: SourceLocation;
}

/**
 * Import statement info
 */
export interface ImportInfo {
  module?: string;
  names: Array<{ name: string; alias?: string }>;
  isFromImport: boolean;
}
