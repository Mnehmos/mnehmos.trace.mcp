#!/usr/bin/env node
/**
 * Trace MCP Server
 *
 * MCP server for detecting producer/consumer schema mismatches
 * between MCP tool definitions and client code that uses them.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { extractProducerSchemas, extractFromFile } from './extract/index.js';
import { traceConsumerUsage, traceFromFile } from './trace/index.js';
import { compareSchemas, compareDirectories } from './compare/index.js';
import { formatResult, type OutputFormat } from './report/index.js';
import {
  previewContractComments,
  addContractComments,
  scaffoldConsumerFromProducer,
  scaffoldProducerFromConsumer,
} from './tools/index.js';
import {
  TraceProject,
  loadProject,
  findProject,
  getWatcher,
  stopWatcher,
  listActiveWatchers,
  type WatchEvent,
} from './watch/index.js';
import { bootstrapLanguageParsers } from './languages/bootstrap.js';

// Bootstrap language parsers at startup
bootstrapLanguageParsers();

// Helper: log to stderr (MCP protocol requires stdout for JSON-RPC only)
const log = (...args: unknown[]) => console.error('[trace-mcp]', ...args);

// Tool input schemas
const ExtractSchemasInput = z.object({
  rootDir: z.string().describe('Root directory of MCP server source code'),
  include: z.array(z.string()).optional().describe('Glob patterns to include (default: **/*.ts)'),
  exclude: z.array(z.string()).optional().describe('Glob patterns to exclude (default: node_modules, dist)'),
});

const TraceUsageInput = z.object({
  rootDir: z.string().describe('Root directory of consumer/client source code'),
  include: z.array(z.string()).optional().describe('Glob patterns to include'),
  exclude: z.array(z.string()).optional().describe('Glob patterns to exclude'),
});

const CompareInput = z.object({
  producerDir: z.string().describe('Path to MCP server source directory'),
  consumerDir: z.string().describe('Path to consumer/client source directory'),
  format: z.enum(['json', 'markdown', 'summary']).optional().describe('Output format (default: json)'),
  strict: z.boolean().optional().describe('Strict mode: treat missing optional properties as warnings'),
  direction: z.enum(['producer_to_consumer', 'consumer_to_producer', 'bidirectional']).optional().describe('Data flow direction for compatibility checking (default: producer_to_consumer)'),
});

const ExtractFileInput = z.object({
  filePath: z.string().describe('Path to a single TypeScript file to extract schemas from'),
});

const TraceFileInput = z.object({
  filePath: z.string().describe('Path to a single TypeScript file to trace tool usage in'),
});

const ScaffoldConsumerInput = z.object({
  producerDir: z.string().describe('Path to MCP server source directory'),
  toolName: z.string().describe('Name of the tool to scaffold consumer for'),
  target: z.enum(['typescript', 'javascript', 'react-hook', 'zustand-action']).optional().describe('Output target format (default: typescript)'),
  includeErrorHandling: z.boolean().optional().describe('Include try/catch error handling (default: true)'),
  includeTypes: z.boolean().optional().describe('Include TypeScript type definitions (default: true)'),
});

const ScaffoldProducerInput = z.object({
  consumerDir: z.string().describe('Path to consumer source directory'),
  toolName: z.string().describe('Name of the tool to scaffold producer for'),
  includeHandler: z.boolean().optional().describe('Include handler stub (default: true)'),
});

const CommentContractInput = z.object({
  producerDir: z.string().describe('Path to MCP server source directory'),
  consumerDir: z.string().describe('Path to consumer source directory'),
  toolName: z.string().describe('Name of the validated tool'),
  dryRun: z.boolean().optional().describe('Preview comments without writing to files (default: true)'),
  style: z.enum(['jsdoc', 'inline', 'block']).optional().describe('Comment style (default: block)'),
});

// Watch mode input schemas
const InitProjectInput = z.object({
  projectDir: z.string().describe('Root directory for the trace project'),
  producerPath: z.string().describe('Relative path to producer/server code'),
  consumerPath: z.string().describe('Relative path to consumer/client code'),
  producerLanguage: z.enum(['typescript', 'python', 'go', 'rust', 'json_schema']).optional().default('typescript'),
  consumerLanguage: z.enum(['typescript', 'python', 'go', 'rust', 'json_schema']).optional().default('typescript'),
});

const WatchInput = z.object({
  projectDir: z.string().describe('Root directory with .trace-mcp config'),
  action: z.enum(['start', 'stop', 'status', 'poll']).default('start').describe('Watch action to perform'),
});

const GetProjectStatusInput = z.object({
  projectDir: z.string().describe('Root directory with .trace-mcp config'),
});

// Create server
const server = new Server(
  {
    name: 'trace-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'extract_schemas',
        description: 'Extract API schemas from source code. Supports: MCP tools (Zod), OpenAPI/Swagger specs, GraphQL SDL, tRPC routers, REST endpoints (Express/Fastify), gRPC/Protobuf services, Python (FastAPI/Flask decorators), Go (Gin/Chi handlers), and SQL DDL (CREATE TABLE, CREATE TYPE). Auto-detects format from file contents.',
        inputSchema: {
          type: 'object',
          properties: {
            rootDir: { type: 'string', description: 'Root directory of server/API source code' },
            include: { type: 'array', items: { type: 'string' }, description: 'Glob patterns to include (e.g., **/*.ts, **/*.py, **/*.go, **/*.proto, **/*.sql)' },
            exclude: { type: 'array', items: { type: 'string' }, description: 'Glob patterns to exclude' },
          },
          required: ['rootDir'],
        },
      },
      {
        name: 'extract_file',
        description: 'Extract API schemas from a single file. Supports TypeScript, Python, Go, Protobuf, GraphQL SDL, OpenAPI JSON/YAML, and SQL DDL.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path to source file (any supported language)' },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'trace_usage',
        description: 'Trace how client code calls APIs. Detects: MCP callTool(), fetch/axios HTTP calls, Apollo Client hooks (useQuery/useMutation), Python requests/aiohttp/httpx, and tracks property access patterns on responses.',
        inputSchema: {
          type: 'object',
          properties: {
            rootDir: { type: 'string', description: 'Root directory of client/consumer source code' },
            include: { type: 'array', items: { type: 'string' }, description: 'Glob patterns to include' },
            exclude: { type: 'array', items: { type: 'string' }, description: 'Glob patterns to exclude' },
          },
          required: ['rootDir'],
        },
      },
      {
        name: 'trace_file',
        description: 'Trace API usage in a single file. Detects HTTP calls, GraphQL queries, MCP tool calls, and response property access.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path to client source file' },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'compare',
        description: 'Full contract validation: extract producer schemas, trace consumer usage, compare for mismatches. Works across languages (TS↔Python, Go↔TS, etc.) and protocols (REST, GraphQL, gRPC, MCP).',
        inputSchema: {
          type: 'object',
          properties: {
            producerDir: { type: 'string', description: 'Path to API/server source directory' },
            consumerDir: { type: 'string', description: 'Path to client source directory' },
            format: { type: 'string', enum: ['json', 'markdown', 'summary'], description: 'Output format' },
            strict: { type: 'boolean', description: 'Strict mode for comparison' },
            direction: { type: 'string', enum: ['producer_to_consumer', 'consumer_to_producer', 'bidirectional'], description: 'Data flow direction (default: producer_to_consumer)' },
          },
          required: ['producerDir', 'consumerDir'],
        },
      },
      {
        name: 'scaffold_consumer',
        description: 'Generate type-safe client code from API schemas. Creates TypeScript functions, React hooks, or Zustand actions with full type inference.',
        inputSchema: {
          type: 'object',
          properties: {
            producerDir: { type: 'string', description: 'Path to API source directory' },
            toolName: { type: 'string', description: 'Name of the endpoint/tool to scaffold' },
            target: { type: 'string', enum: ['typescript', 'javascript', 'react-hook', 'zustand-action'], description: 'Output target format' },
            includeErrorHandling: { type: 'boolean', description: 'Include try/catch error handling' },
            includeTypes: { type: 'boolean', description: 'Include TypeScript type definitions' },
          },
          required: ['producerDir', 'toolName'],
        },
      },
      {
        name: 'scaffold_producer',
        description: 'Generate API stubs from client usage patterns. Infers schema from how client code calls the API.',
        inputSchema: {
          type: 'object',
          properties: {
            consumerDir: { type: 'string', description: 'Path to client source directory' },
            toolName: { type: 'string', description: 'Name of the endpoint/tool to scaffold' },
            includeHandler: { type: 'boolean', description: 'Include handler stub' },
          },
          required: ['consumerDir', 'toolName'],
        },
      },
      {
        name: 'comment_contract',
        description: 'Add cross-reference comments to validated producer/consumer pairs. Documents the contract relationship in both files.',
        inputSchema: {
          type: 'object',
          properties: {
            producerDir: { type: 'string', description: 'Path to MCP server source directory' },
            consumerDir: { type: 'string', description: 'Path to consumer source directory' },
            toolName: { type: 'string', description: 'Name of the validated tool' },
            dryRun: { type: 'boolean', description: 'Preview comments without writing to files (default: true)' },
            style: { type: 'string', enum: ['jsdoc', 'inline', 'block'], description: 'Comment style' },
          },
          required: ['producerDir', 'consumerDir', 'toolName'],
        },
      },
      // Watch mode tools
      {
        name: 'init_project',
        description: 'Initialize a trace project with .trace-mcp config directory. Creates project structure for watch mode and caching.',
        inputSchema: {
          type: 'object',
          properties: {
            projectDir: { type: 'string', description: 'Root directory for the trace project' },
            producerPath: { type: 'string', description: 'Relative path to producer/server code' },
            consumerPath: { type: 'string', description: 'Relative path to consumer/client code' },
            producerLanguage: { type: 'string', enum: ['typescript', 'python', 'go', 'rust', 'json_schema'], description: 'Producer language (default: typescript)' },
            consumerLanguage: { type: 'string', enum: ['typescript', 'python', 'go', 'rust', 'json_schema'], description: 'Consumer language (default: typescript)' },
          },
          required: ['projectDir', 'producerPath', 'consumerPath'],
        },
      },
      {
        name: 'watch',
        description: 'Watch project files for changes and auto-revalidate contracts. Actions: start (begin watching), stop (end watching), status (check state), poll (get pending events).',
        inputSchema: {
          type: 'object',
          properties: {
            projectDir: { type: 'string', description: 'Root directory with .trace-mcp config' },
            action: { type: 'string', enum: ['start', 'stop', 'status', 'poll'], description: 'Watch action (default: start)' },
          },
          required: ['projectDir'],
        },
      },
      {
        name: 'get_project_status',
        description: 'Get the status of a trace project including config, cache state, and last validation result.',
        inputSchema: {
          type: 'object',
          properties: {
            projectDir: { type: 'string', description: 'Root directory with .trace-mcp config' },
          },
          required: ['projectDir'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'extract_schemas': {
        const input = ExtractSchemasInput.parse(args);
        log(`Extracting schemas from: ${input.rootDir}`);
        
        const schemas = await extractProducerSchemas({
          rootDir: input.rootDir,
          include: input.include,
          exclude: input.exclude,
        });
        
        log(`Found ${schemas.length} tool definitions`);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: schemas.length,
                schemas,
              }, null, 2),
            },
          ],
        };
      }

      case 'extract_file': {
        const input = ExtractFileInput.parse(args);
        log(`Extracting from file: ${input.filePath}`);
        
        const schemas = await extractFromFile(input.filePath);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: schemas.length,
                schemas,
              }, null, 2),
            },
          ],
        };
      }

      case 'trace_usage': {
        const input = TraceUsageInput.parse(args);
        log(`Tracing usage in: ${input.rootDir}`);
        
        const usage = await traceConsumerUsage({
          rootDir: input.rootDir,
          include: input.include,
          exclude: input.exclude,
        });
        
        log(`Found ${usage.length} tool calls`);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: usage.length,
                usage,
              }, null, 2),
            },
          ],
        };
      }

      case 'trace_file': {
        const input = TraceFileInput.parse(args);
        log(`Tracing file: ${input.filePath}`);
        
        const usage = await traceFromFile(input.filePath);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: usage.length,
                usage,
              }, null, 2),
            },
          ],
        };
      }

      case 'compare': {
        const input = CompareInput.parse(args);
        log(`Comparing: ${input.producerDir} vs ${input.consumerDir}`);

        const result = await compareDirectories(
          input.producerDir,
          input.consumerDir,
          {
            strict: input.strict,
            direction: input.direction
          }
        );

        const format = (input.format || 'json') as OutputFormat;
        const output = formatResult(result, format);

        log(`Analysis complete: ${result.summary.matchCount} matches, ${result.summary.mismatchCount} mismatches`);

        return {
          content: [
            {
              type: 'text',
              text: output,
            },
          ],
        };
      }

      case 'scaffold_consumer': {
        const input = ScaffoldConsumerInput.parse(args);
        log(`Scaffolding consumer for tool: ${input.toolName}`);
        
        // Extract producer schemas to find the requested tool
        const producers = await extractProducerSchemas({ rootDir: input.producerDir });
        const producer = producers.find(p => p.toolName === input.toolName);
        
        if (!producer) {
          throw new Error(`Tool "${input.toolName}" not found in ${input.producerDir}`);
        }
        
        const result = scaffoldConsumerFromProducer(producer, {
          target: input.target || 'typescript',
          includeErrorHandling: input.includeErrorHandling ?? true,
          includeTypes: input.includeTypes ?? true,
          includeJSDoc: true,
        });
        
        log(`Generated ${input.target || 'typescript'} consumer code`);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                toolName: input.toolName,
                target: input.target || 'typescript',
                suggestedFilename: result.suggestedFilename,
                code: result.code,
                types: result.types,
                example: result.example,
              }, null, 2),
            },
          ],
        };
      }

      case 'scaffold_producer': {
        const input = ScaffoldProducerInput.parse(args);
        log(`Scaffolding producer for tool: ${input.toolName}`);
        
        // Trace consumer usage to find the requested tool
        const consumers = await traceConsumerUsage({ rootDir: input.consumerDir });
        const consumer = consumers.find(c => c.toolName === input.toolName);
        
        if (!consumer) {
          throw new Error(`Tool "${input.toolName}" not found in consumer code at ${input.consumerDir}`);
        }
        
        const result = scaffoldProducerFromConsumer(consumer, {
          includeHandler: input.includeHandler ?? true,
        });
        
        log(`Generated producer schema stub`);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                toolName: input.toolName,
                suggestedFilename: result.suggestedFilename,
                code: result.code,
                example: result.example,
              }, null, 2),
            },
          ],
        };
      }

      case 'comment_contract': {
        const input = CommentContractInput.parse(args);
        log(`Commenting contract for tool: ${input.toolName}`);
        
        // Get both producer and consumer
        const producers = await extractProducerSchemas({ rootDir: input.producerDir });
        const consumers = await traceConsumerUsage({ rootDir: input.consumerDir });
        
        const producer = producers.find(p => p.toolName === input.toolName);
        const consumer = consumers.find(c => c.toolName === input.toolName);
        
        if (!producer) {
          throw new Error(`Tool "${input.toolName}" not found in producer at ${input.producerDir}`);
        }
        if (!consumer) {
          throw new Error(`Tool "${input.toolName}" not found in consumer at ${input.consumerDir}`);
        }
        
        const match = {
          toolName: input.toolName,
          producerLocation: producer.location,
          consumerLocation: consumer.callSite,
        };
        
        const commentOptions = {
          match,
          producer,
          consumer,
          style: input.style || 'block' as const,
          includeTimestamp: true,
        };
        
        if (input.dryRun !== false) {
          // Preview mode (default)
          const preview = previewContractComments(commentOptions);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  mode: 'preview',
                  toolName: input.toolName,
                  producerPreview: preview.producerPreview,
                  consumerPreview: preview.consumerPreview,
                  note: 'Set dryRun: false to actually add these comments to files',
                }, null, 2),
              },
            ],
          };
        } else {
          // Actually add comments
          const result = await addContractComments(commentOptions);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: result.success,
                  mode: 'applied',
                  toolName: input.toolName,
                  producerFile: result.producerFile,
                  consumerFile: result.consumerFile,
                  producerComment: result.producerComment,
                  consumerComment: result.consumerComment,
                  error: result.error,
                }, null, 2),
              },
            ],
          };
        }
      }

      // Watch mode tools
      case 'init_project': {
        const input = InitProjectInput.parse(args);
        log(`Initializing trace project at: ${input.projectDir}`);
        
        const project = loadProject(input.projectDir);
        
        if (project.exists()) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Project already exists at ${input.projectDir}. Use get_project_status to view it.`,
              }, null, 2),
            }],
          };
        }
        
        const config = project.init({
          producer: {
            path: input.producerPath,
            language: input.producerLanguage || 'typescript',
            include: ['**/*.ts'],
            exclude: ['**/*.test.ts', '**/node_modules/**', '**/dist/**'],
          },
          consumer: {
            path: input.consumerPath,
            language: input.consumerLanguage || 'typescript',
            include: ['**/*.ts', '**/*.tsx'],
            exclude: ['**/*.test.ts', '**/node_modules/**', '**/dist/**'],
          },
        });
        
        log(`Project initialized with config:`, config);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              projectDir: input.projectDir,
              traceDir: project.traceDir,
              config,
            }, null, 2),
          }],
        };
      }

      case 'watch': {
        const input = WatchInput.parse(args);
        const action = input.action || 'start';
        log(`Watch action: ${action} for ${input.projectDir}`);
        
        const project = loadProject(input.projectDir);
        
        if (!project.exists()) {
          throw new Error(`No trace project found at ${input.projectDir}. Run init_project first.`);
        }
        
        const watcher = getWatcher(project);
        
        switch (action) {
          case 'start': {
            // Collect events during startup
            const events: WatchEvent[] = [];
            const eventHandler = (event: WatchEvent) => events.push(event);
            watcher.on('watch-event', eventHandler);
            
            await watcher.start();
            
            // Wait a moment for initial validation
            await new Promise(resolve => setTimeout(resolve, 100));
            watcher.off('watch-event', eventHandler);
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  action: 'started',
                  projectDir: input.projectDir,
                  status: watcher.getStatus(),
                  events,
                }, null, 2),
              }],
            };
          }
          
          case 'stop': {
            await stopWatcher(project);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  action: 'stopped',
                  projectDir: input.projectDir,
                }, null, 2),
              }],
            };
          }
          
          case 'status': {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  action: 'status',
                  projectDir: input.projectDir,
                  status: watcher.getStatus(),
                  activeWatchers: listActiveWatchers(),
                }, null, 2),
              }],
            };
          }
          
          case 'poll': {
            // For polling, collect recent events
            const status = watcher.getStatus();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  action: 'poll',
                  projectDir: input.projectDir,
                  status,
                  lastResult: status.lastResult,
                }, null, 2),
              }],
            };
          }
          
          default:
            throw new Error(`Unknown watch action: ${action}`);
        }
      }

      case 'get_project_status': {
        const input = GetProjectStatusInput.parse(args);
        log(`Getting project status for: ${input.projectDir}`);
        
        const project = loadProject(input.projectDir);
        
        if (!project.exists()) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                exists: false,
                error: `No trace project found at ${input.projectDir}`,
              }, null, 2),
            }],
          };
        }
        
        const config = project.config;
        const activeWatchers = listActiveWatchers();
        const isWatching = activeWatchers.includes(project.rootDir);
        
        let watcherStatus = null;
        if (isWatching) {
          const watcher = getWatcher(project);
          watcherStatus = watcher.getStatus();
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              exists: true,
              projectDir: project.rootDir,
              traceDir: project.traceDir,
              config,
              isWatching,
              watcherStatus,
              paths: {
                producer: project.producerPath,
                consumer: project.consumerPath,
              },
            }, null, 2),
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Error in ${name}:`, message);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: message,
          }),
        },
      ],
      isError: true,
    };
  }
});

// Also fix console.log in submodules - redirect to stderr
const originalLog = console.log;
console.log = (...args: unknown[]) => {
  console.error(...args);
};

// Start server
async function main() {
  log('Starting trace-mcp server v1.0.0');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log('Server connected and ready');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
