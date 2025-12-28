/**
 * Contract Scaffold Tool
 * Generate consumer code from producer schema (or vice versa)
 */

import type { ProducerSchema, ConsumerSchema, JSONSchema } from '../types.js';

export interface ScaffoldOptions {
  /** Output language/framework */
  target: 'typescript' | 'javascript' | 'react-hook' | 'zustand-action';
  /** Include error handling */
  includeErrorHandling?: boolean;
  /** Include TypeScript types */
  includeTypes?: boolean;
  /** Function name prefix */
  functionPrefix?: string;
  /** Add JSDoc comments */
  includeJSDoc?: boolean;
}

export interface ScaffoldResult {
  /** Generated code */
  code: string;
  /** Suggested filename */
  suggestedFilename: string;
  /** TypeScript type definitions (if applicable) */
  types?: string;
  /** Usage example */
  example: string;
}

/**
 * Generate consumer code from a producer schema
 */
export function scaffoldConsumerFromProducer(
  producer: ProducerSchema,
  options: ScaffoldOptions = { target: 'typescript' }
): ScaffoldResult {
  const { target, includeErrorHandling = true, includeTypes = true, functionPrefix = '', includeJSDoc = true } = options;
  
  const toolName = producer.toolName;
  const functionName = `${functionPrefix}${toCamelCase(toolName)}`;
  const inputProps = producer.inputSchema.properties || {};
  const requiredArgs = producer.inputSchema.required || [];
  
  // Generate TypeScript interface for args
  const argsInterface = generateArgsInterface(toolName, inputProps, requiredArgs);
  
  // Generate the function based on target
  let code: string;
  let types: string | undefined;
  let example: string;
  
  switch (target) {
    case 'react-hook':
      ({ code, types, example } = generateReactHook(toolName, functionName, inputProps, requiredArgs, { includeErrorHandling, includeTypes, includeJSDoc, producer }));
      break;
    case 'zustand-action':
      ({ code, types, example } = generateZustandAction(toolName, functionName, inputProps, requiredArgs, { includeErrorHandling, includeTypes, includeJSDoc, producer }));
      break;
    case 'javascript':
      const jsResult = generateJavaScript(toolName, functionName, inputProps, requiredArgs, { includeErrorHandling, includeJSDoc, producer });
      code = jsResult.code;
      example = jsResult.example;
      types = undefined;
      break;
    case 'typescript':
    default:
      ({ code, types, example } = generateTypeScript(toolName, functionName, inputProps, requiredArgs, { includeErrorHandling, includeTypes, includeJSDoc, producer }));
      break;
  }
  
  return {
    code,
    suggestedFilename: `use-${toKebabCase(toolName)}.${target === 'javascript' ? 'js' : 'ts'}`,
    types,
    example,
  };
}

/**
 * Generate producer schema stub from consumer usage
 */
export function scaffoldProducerFromConsumer(
  consumer: ConsumerSchema,
  options: { includeHandler?: boolean } = {}
): ScaffoldResult {
  const { includeHandler = true } = options;
  const toolName = consumer.toolName;
  const args = consumer.argumentsProvided;
  
  // Infer types from argument values (basic inference)
  const inferredSchema = inferSchemaFromArgs(args);
  
  const code = `
import { z } from 'zod';

// Tool: ${toolName}
// Scaffolded from consumer at ${consumer.callSite.file}:${consumer.callSite.line}
// @trace-contract PRODUCER (scaffolded)

server.tool(
  '${toolName}',
  'TODO: Add description',
  {
${Object.entries(inferredSchema)
  .map(([key, type]) => `    ${key}: ${type},`)
  .join('\n')}
  },
${includeHandler ? `  async (args) => {
    // TODO: Implement handler
    // Consumer expects these properties: ${consumer.expectedProperties.join(', ')}
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
${consumer.expectedProperties.map(p => `          ${p}: null, // TODO`).join('\n')}
        })
      }]
    };
  }` : '  async (args) => { /* TODO */ }'}
);
`.trim();

  return {
    code,
    suggestedFilename: `${toKebabCase(toolName)}-tool.ts`,
    example: `// This tool is called by:\n// ${consumer.callSite.file}:${consumer.callSite.line}`,
  };
}

// ============================================================================
// Generator Functions
// ============================================================================

function generateTypeScript(
  toolName: string,
  functionName: string,
  inputProps: Record<string, JSONSchema>,
  requiredArgs: string[],
  options: { includeErrorHandling: boolean; includeTypes: boolean; includeJSDoc: boolean; producer: ProducerSchema }
): { code: string; types?: string; example: string } {
  const { includeErrorHandling, includeTypes, includeJSDoc, producer } = options;
  
  const argsType = `${toPascalCase(toolName)}Args`;
  const resultType = `${toPascalCase(toolName)}Result`;
  
  const types = includeTypes ? `
export interface ${argsType} {
${Object.entries(inputProps)
  .map(([key, schema]) => `  ${key}${requiredArgs.includes(key) ? '' : '?'}: ${jsonSchemaToTsType(schema)};`)
  .join('\n')}
}

export interface ${resultType} {
  // TODO: Define based on actual response
  [key: string]: unknown;
}
`.trim() : undefined;

  const jsdoc = includeJSDoc ? `
/**
 * ${producer.description || `Call the ${toolName} tool`}
 * @trace-contract CONSUMER
 * Producer: ${producer.location.file}:${producer.location.line}
 */` : '';

  const code = `
${jsdoc}
export async function ${functionName}(
  client: McpClient,
  args: ${includeTypes ? argsType : `{ ${Object.keys(inputProps).join(', ')} }`}
): Promise<${includeTypes ? resultType : 'unknown'}> {
${includeErrorHandling ? `  try {
    const result = await client.callTool('${toolName}', args);
    return JSON.parse(result.content[0].text);
  } catch (error) {
    console.error('Error calling ${toolName}:', error);
    throw error;
  }` : `  const result = await client.callTool('${toolName}', args);
  return JSON.parse(result.content[0].text);`}
}
`.trim();

  const example = `
// Usage:
const result = await ${functionName}(client, {
${requiredArgs.map(arg => `  ${arg}: /* ${jsonSchemaToTsType(inputProps[arg])} */,`).join('\n')}
});
`.trim();

  return { code, types, example };
}

function generateJavaScript(
  toolName: string,
  functionName: string,
  inputProps: Record<string, JSONSchema>,
  requiredArgs: string[],
  options: { includeErrorHandling: boolean; includeJSDoc: boolean; producer: ProducerSchema }
): { code: string; example: string } {
  const { includeErrorHandling, includeJSDoc, producer } = options;
  
  const jsdoc = includeJSDoc ? `
/**
 * ${producer.description || `Call the ${toolName} tool`}
 * @param {Object} client - MCP client
 * @param {Object} args - Tool arguments
${Object.entries(inputProps)
  .map(([key, schema]) => ` * @param {${jsonSchemaToJsType(schema)}} args.${key}`)
  .join('\n')}
 * @returns {Promise<Object>}
 */` : '';

  const code = `
${jsdoc}
export async function ${functionName}(client, args) {
${includeErrorHandling ? `  try {
    const result = await client.callTool('${toolName}', args);
    return JSON.parse(result.content[0].text);
  } catch (error) {
    console.error('Error calling ${toolName}:', error);
    throw error;
  }` : `  const result = await client.callTool('${toolName}', args);
  return JSON.parse(result.content[0].text);`}
}
`.trim();

  const example = `
// Usage:
const result = await ${functionName}(client, {
${requiredArgs.map(arg => `  ${arg}: /* value */,`).join('\n')}
});
`.trim();

  return { code, example };
}

function generateReactHook(
  toolName: string,
  _functionName: string,
  inputProps: Record<string, JSONSchema>,
  requiredArgs: string[],
  options: { includeErrorHandling: boolean; includeTypes: boolean; includeJSDoc: boolean; producer: ProducerSchema }
): { code: string; types?: string; example: string } {
  const { includeTypes, producer } = options;
  const hookName = `use${toPascalCase(toolName)}`;
  const argsType = `${toPascalCase(toolName)}Args`;
  
  const types = includeTypes ? `
export interface ${argsType} {
${Object.entries(inputProps)
  .map(([key, schema]) => `  ${key}${requiredArgs.includes(key) ? '' : '?'}: ${jsonSchemaToTsType(schema)};`)
  .join('\n')}
}
`.trim() : undefined;

  const code = `
import { useState, useCallback } from 'react';
import { useMcpClient } from './mcp-context'; // Adjust import

/**
 * ${producer.description || `Hook for ${toolName} tool`}
 * @trace-contract CONSUMER (React Hook)
 * Producer: ${producer.location.file}:${producer.location.line}
 */
export function ${hookName}() {
  const client = useMcpClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<unknown>(null);

  const execute = useCallback(async (args: ${includeTypes ? argsType : 'Record<string, unknown>'}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.callTool('${toolName}', args);
      const parsed = JSON.parse(result.content[0].text);
      setData(parsed);
      return parsed;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client]);

  return { execute, loading, error, data };
}
`.trim();

  const example = `
// Usage in React component:
function MyComponent() {
  const { execute, loading, error, data } = ${hookName}();
  
  const handleClick = async () => {
    await execute({
${requiredArgs.map(arg => `      ${arg}: /* value */,`).join('\n')}
    });
  };
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>{JSON.stringify(data)}</div>;
}
`.trim();

  return { code, types, example };
}

function generateZustandAction(
  toolName: string,
  _functionName: string,
  inputProps: Record<string, JSONSchema>,
  requiredArgs: string[],
  options: { includeErrorHandling: boolean; includeTypes: boolean; includeJSDoc: boolean; producer: ProducerSchema }
): { code: string; types?: string; example: string } {
  const { includeTypes, producer } = options;
  const actionName = toCamelCase(toolName);
  const argsType = `${toPascalCase(toolName)}Args`;
  
  const types = includeTypes ? `
export interface ${argsType} {
${Object.entries(inputProps)
  .map(([key, schema]) => `  ${key}${requiredArgs.includes(key) ? '' : '?'}: ${jsonSchemaToTsType(schema)};`)
  .join('\n')}
}
`.trim() : undefined;

  const code = `
/**
 * Zustand action for ${toolName}
 * @trace-contract CONSUMER (Zustand)
 * Producer: ${producer.location.file}:${producer.location.line}
 */
export const create${toPascalCase(toolName)}Slice = (set: any, get: any) => ({
  ${actionName}Loading: false,
  ${actionName}Error: null as Error | null,
  ${actionName}Data: null as unknown,
  
  ${actionName}: async (args: ${includeTypes ? argsType : 'Record<string, unknown>'}) => {
    const { mcpClient } = get();
    set({ ${actionName}Loading: true, ${actionName}Error: null });
    
    try {
      const result = await mcpClient.callTool('${toolName}', args);
      const data = JSON.parse(result.content[0].text);
      set({ ${actionName}Data: data, ${actionName}Loading: false });
      return data;
    } catch (error) {
      set({ 
        ${actionName}Error: error instanceof Error ? error : new Error(String(error)),
        ${actionName}Loading: false 
      });
      throw error;
    }
  },
});
`.trim();

  const example = `
// Add to your Zustand store:
import { create } from 'zustand';

const useStore = create((set, get) => ({
  mcpClient: null,
  setMcpClient: (client) => set({ mcpClient: client }),
  ...create${toPascalCase(toolName)}Slice(set, get),
}));

// Usage:
const { ${actionName}, ${actionName}Loading, ${actionName}Data } = useStore();
await ${actionName}({
${requiredArgs.map(arg => `  ${arg}: /* value */,`).join('\n')}
});
`.trim();

  return { code, types, example };
}

// ============================================================================
// Utilities
// ============================================================================

function generateArgsInterface(toolName: string, props: Record<string, JSONSchema>, required: string[]): string {
  const lines = Object.entries(props).map(([key, schema]) => {
    const optional = required.includes(key) ? '' : '?';
    const type = jsonSchemaToTsType(schema);
    return `  ${key}${optional}: ${type};`;
  });
  
  return `interface ${toPascalCase(toolName)}Args {\n${lines.join('\n')}\n}`;
}

function jsonSchemaToTsType(schema: JSONSchema): string {
  if (!schema.type) return 'unknown';
  
  switch (schema.type) {
    case 'string':
      if (schema.enum && Array.isArray(schema.enum)) {
        return (schema.enum as unknown[]).map((v: unknown) => `'${v}'`).join(' | ');
      }
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return `${jsonSchemaToTsType(schema.items || {})}[]`;
    case 'object':
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

function jsonSchemaToJsType(schema: JSONSchema): string {
  if (!schema.type) return '*';
  
  switch (schema.type) {
    case 'string': return 'string';
    case 'number':
    case 'integer': return 'number';
    case 'boolean': return 'boolean';
    case 'array': return 'Array';
    case 'object': return 'Object';
    default: return '*';
  }
}

function inferSchemaFromArgs(args: Record<string, unknown>): Record<string, string> {
  const schema: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' || value === '<value>') {
      schema[key] = 'z.string()';
    } else if (typeof value === 'number') {
      schema[key] = 'z.number()';
    } else if (typeof value === 'boolean') {
      schema[key] = 'z.boolean()';
    } else if (Array.isArray(value)) {
      schema[key] = 'z.array(z.unknown())';
    } else if (typeof value === 'object') {
      schema[key] = 'z.object({})';
    } else {
      schema[key] = 'z.unknown()';
    }
  }
  
  return schema;
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function toKebabCase(str: string): string {
  return str.replace(/_/g, '-').toLowerCase();
}
