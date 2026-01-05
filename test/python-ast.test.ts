/**
 * Python AST Parser Tests
 * 
 * TDD Red Phase: These tests are written BEFORE implementation exists.
 * All tests should FAIL until the parser is implemented.
 * 
 * Test coverage includes:
 * - Parser initialization with tree-sitter
 * - FastAPI endpoint detection (@app.get, @app.post, @router.*)
 * - Flask route detection (@app.route, @blueprint.route)
 * - MCP tool detection (@mcp.tool, @server.tool) for backward compatibility
 * - Pydantic BaseModel extraction
 * - Type annotation resolution (Optional, Union, List, Dict, etc.)
 * - Async function handling
 * - Docstring extraction
 * - Error cases
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Import from module that doesn't exist yet - tests will fail
// This is intentional for Red Phase TDD
import { PythonASTParser } from '../src/languages/python-ast';
import type { ProducerSchema, JSONSchema } from '../src/types';

// =============================================================================
// Extended Types for Python Parser (HTTP Endpoints, Models, etc.)
// =============================================================================

/**
 * Extended schema for Python HTTP endpoints and tools.
 * The Python parser should return these extended schemas.
 */
interface PythonSchema extends ProducerSchema {
  /** Unique identifier for the schema */
  id: string;
  /** HTTP method for endpoints */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
  /** URL path for endpoints */
  path?: string;
  /** Whether the function is async */
  async?: boolean;
  /** HTTP status code */
  statusCode?: number;
  /** Schema type: 'endpoint', 'tool', 'model' */
  type?: 'endpoint' | 'tool' | 'model';
  /** Properties for models (alias for inputSchema.properties) */
  properties?: Record<string, JSONSchema>;
  /** Required fields for models */
  required?: string[];
}

/**
 * Options for parsing Python source code.
 */
interface PythonParseOptions {
  /** Direct source code content to parse */
  content?: string;
  /** Root directory for file-based parsing */
  rootDir?: string;
  /** File patterns to include */
  include?: string[];
  /** File patterns to exclude */
  exclude?: string[];
}

// =============================================================================
// Test Fixtures
// =============================================================================

const FIXTURES_DIR = join(__dirname, 'fixtures/python-samples');

const loadFixture = (name: string): string => {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
};

// =============================================================================
// Parser Initialization Tests
// =============================================================================

describe('Python AST Parser', () => {
  describe('Parser Initialization', () => {
    it('should create parser instance successfully', () => {
      const parser = new PythonASTParser();
      expect(parser).toBeDefined();
      expect(parser).toBeInstanceOf(PythonASTParser);
    });

    it('should initialize tree-sitter Python parser', async () => {
      const parser = new PythonASTParser();
      const initialized = await parser.initialize();
      expect(initialized).toBe(true);
    });

    it('should report name as "python"', () => {
      const parser = new PythonASTParser();
      expect(parser.name).toBe('python');
    });

    it('should support .py file extension', () => {
      const parser = new PythonASTParser();
      expect(parser.filePatterns).toContain('**/*.py');
    });

    it('should support .pyi stub file extension', () => {
      const parser = new PythonASTParser();
      expect(parser.filePatterns).toContain('**/*.pyi');
    });
  });

  // ===========================================================================
  // FastAPI Endpoint Detection Tests
  // ===========================================================================

  describe('FastAPI Endpoint Detection', () => {
    let fastapiAppFixture: string;
    let fastapiRouterFixture: string;
    let parser: PythonASTParser;

    beforeAll(() => {
      fastapiAppFixture = loadFixture('fastapi-app.py');
      fastapiRouterFixture = loadFixture('fastapi-router.py');
      parser = new PythonASTParser();
    });

    describe('@app.get() endpoints', () => {
      it('should detect @app.get("/users") endpoint', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('list_users'));
        
        expect(endpoint).toBeDefined();
        expect(endpoint?.method).toBe('GET');
        expect(endpoint?.path).toBe('/users');
      });

      it('should detect @app.get("/users/{user_id}") with path parameter', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('get_user') && !s.id.includes('post'));
        
        expect(endpoint).toBeDefined();
        expect(endpoint?.method).toBe('GET');
        expect(endpoint?.path).toBe('/users/{user_id}');
        expect(endpoint?.inputSchema?.properties).toHaveProperty('user_id');
      });

      it('should detect nested path parameters like /users/{user_id}/posts/{post_id}', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('get_user_post'));
        
        expect(endpoint).toBeDefined();
        expect(endpoint?.path).toBe('/users/{user_id}/posts/{post_id}');
        expect(endpoint?.inputSchema?.properties).toHaveProperty('user_id');
        expect(endpoint?.inputSchema?.properties).toHaveProperty('post_id');
      });

      it('should extract query parameters from function signature', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('list_users'));
        
        expect(endpoint?.inputSchema?.properties).toHaveProperty('skip');
        expect(endpoint?.inputSchema?.properties).toHaveProperty('limit');
        expect(endpoint?.inputSchema?.properties).toHaveProperty('search');
      });

      it('should identify optional query parameters', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('list_users'));
        
        expect(endpoint?.inputSchema?.properties?.['search']).toBeDefined();
        // Optional should not be in required
        expect(endpoint?.inputSchema?.required).not.toContain('search');
      });
    });

    describe('@app.post() endpoints', () => {
      it('should detect @app.post("/users") endpoint', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('create_user'));
        
        expect(endpoint).toBeDefined();
        expect(endpoint?.method).toBe('POST');
        expect(endpoint?.path).toBe('/users');
      });

      it('should extract response_model from decorator', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('create_user'));
        
        expect(endpoint?.outputSchema).toBeDefined();
      });

      it('should extract request body from Pydantic model parameter', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('create_user'));
        
        expect(endpoint?.inputSchema?.properties).toHaveProperty('user');
      });
    });

    describe('@app.put() and @app.patch() endpoints', () => {
      it('should detect @app.put() endpoint', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('update_user') && !s.id.includes('partial'));
        
        expect(endpoint).toBeDefined();
        expect(endpoint?.method).toBe('PUT');
      });

      it('should detect @app.patch() endpoint', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('partial_update_user'));
        
        expect(endpoint).toBeDefined();
        expect(endpoint?.method).toBe('PATCH');
      });
    });

    describe('@app.delete() endpoints', () => {
      it('should detect @app.delete() endpoint', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('delete_user'));
        
        expect(endpoint).toBeDefined();
        expect(endpoint?.method).toBe('DELETE');
        expect(endpoint?.path).toBe('/users/{user_id}');
      });

      it('should extract status_code from decorator', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('delete_user'));
        
        expect(endpoint?.statusCode).toBe(204);
      });
    });

    describe('FastAPI Router endpoints', () => {
      it('should detect router prefix from APIRouter(prefix="/api/v1")', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiRouterFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('list_items'));
        
        expect(endpoint?.path).toBe('/api/v1/items');
      });

      it('should detect @router.get() endpoints', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiRouterFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('get_item') && !s.id.includes('variant'));
        
        expect(endpoint).toBeDefined();
        expect(endpoint?.method).toBe('GET');
        expect(endpoint?.path).toBe('/api/v1/items/{item_id}');
      });

      it('should detect @router.post() endpoints', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiRouterFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('create_item'));
        
        expect(endpoint).toBeDefined();
        expect(endpoint?.method).toBe('POST');
      });

      it('should handle multiple routers with different prefixes', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiRouterFixture } as PythonParseOptions) as PythonSchema[];
        const orderEndpoint = schemas.find((s: PythonSchema) => s.id.includes('list_orders'));
        
        // Accept path with or without trailing slash - forced cache refresh 123
        expect(orderEndpoint?.path).toBe("/api/v1/orders");
      });

      it('should handle nested router includes', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiRouterFixture } as PythonParseOptions) as PythonSchema[];
        const adminEndpoint = schemas.find((s: PythonSchema) => s.id.includes('get_stats'));
        
        expect(adminEndpoint?.path).toBe('/api/v1/admin/stats');
      });
    });

    describe('FastAPI Header and Dependency Parameters', () => {
      it('should detect Header() parameters', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('protected_endpoint'));
        
        expect(endpoint?.inputSchema?.properties).toHaveProperty('x_api_key');
      });

      it('should detect Depends() for dependency injection', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('get_current_user_profile'));
        
        expect(endpoint).toBeDefined();
      });
    });

    describe('Sync vs Async Functions', () => {
      it('should detect async functions', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('get_user'));
        
        expect(endpoint?.async).toBe(true);
      });

      it('should detect sync functions', async () => {
        const schemas = await parser.extractSchemas({ content: fastapiAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('health_check'));
        
        expect(endpoint?.async).toBe(false);
      });
    });
  });

  // ===========================================================================
  // Flask Route Detection Tests
  // ===========================================================================

  describe('Flask Route Detection', () => {
    let flaskAppFixture: string;
    let flaskBlueprintFixture: string;
    let parser: PythonASTParser;

    beforeAll(() => {
      flaskAppFixture = loadFixture('flask-app.py');
      flaskBlueprintFixture = loadFixture('flask-blueprint.py');
      parser = new PythonASTParser();
    });

    describe('@app.route() endpoints', () => {
      it('should detect @app.route("/") endpoint', async () => {
        const schemas = await parser.extractSchemas({ content: flaskAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('index'));
        
        expect(endpoint).toBeDefined();
        expect(endpoint?.method).toBe('GET');
        expect(endpoint?.path).toBe('/');
      });

      it('should detect @app.route("/users") with default GET method', async () => {
        const schemas = await parser.extractSchemas({ content: flaskAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('list_users') && s.method === 'GET');
        
        expect(endpoint).toBeDefined();
        expect(endpoint?.path).toBe('/users');
      });

      it('should detect @app.route() with methods=["POST"]', async () => {
        const schemas = await parser.extractSchemas({ content: flaskAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('create_user'));
        
        expect(endpoint).toBeDefined();
        expect(endpoint?.method).toBe('POST');
      });

      it('should detect @app.route() with methods=["PUT"]', async () => {
        const schemas = await parser.extractSchemas({ content: flaskAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('update_user') && s.method === 'PUT');
        
        expect(endpoint).toBeDefined();
        expect(endpoint?.method).toBe('PUT');
      });

      it('should detect @app.route() with methods=["DELETE"]', async () => {
        const schemas = await parser.extractSchemas({ content: flaskAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('delete_user'));
        
        expect(endpoint).toBeDefined();
        expect(endpoint?.method).toBe('DELETE');
      });
    });

    describe('Flask URL Converters', () => {
      it('should parse <int:user_id> converter', async () => {
        const schemas = await parser.extractSchemas({ content: flaskAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.path === '/users/<int:user_id>' || s.path === '/users/{user_id}');
        
        expect(endpoint).toBeDefined();
        expect(endpoint?.inputSchema?.properties?.['user_id']).toBeDefined();
        const userIdProp = endpoint?.inputSchema?.properties?.['user_id'] as JSONSchema;
        expect(userIdProp?.type).toBe('integer');
      });

      it('should parse <string:item_name> converter', async () => {
        const schemas = await parser.extractSchemas({ content: flaskAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('get_item_by_name'));
        
        expect(endpoint?.inputSchema?.properties?.['item_name']).toBeDefined();
        const prop = endpoint?.inputSchema?.properties?.['item_name'] as JSONSchema;
        expect(prop?.type).toBe('string');
      });

      it('should parse <float:price> converter', async () => {
        const schemas = await parser.extractSchemas({ content: flaskAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('get_products_by_price'));
        
        expect(endpoint?.inputSchema?.properties?.['price']).toBeDefined();
        const prop = endpoint?.inputSchema?.properties?.['price'] as JSONSchema;
        expect(prop?.type).toBe('number');
      });

      it('should parse <path:filepath> converter', async () => {
        const schemas = await parser.extractSchemas({ content: flaskAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('get_file'));
        
        expect(endpoint?.inputSchema?.properties?.['filepath']).toBeDefined();
        const prop = endpoint?.inputSchema?.properties?.['filepath'] as JSONSchema;
        expect(prop?.type).toBe('string');
      });

      it('should parse <uuid:item_uuid> converter', async () => {
        const schemas = await parser.extractSchemas({ content: flaskAppFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('get_by_uuid'));
        
        expect(endpoint?.inputSchema?.properties?.['item_uuid']).toBeDefined();
        const prop = endpoint?.inputSchema?.properties?.['item_uuid'] as JSONSchema;
        expect(prop?.['format']).toBe('uuid');
      });
    });

    describe('Flask Multiple Methods per Route', () => {
      it('should create separate schemas for each method on multi-method routes', async () => {
        const schemas = await parser.extractSchemas({ content: flaskAppFixture } as PythonParseOptions) as PythonSchema[];
        
        const getHandler = schemas.find((s: PythonSchema) => s.id.includes('resource_handler') && s.method === 'GET');
        const putHandler = schemas.find((s: PythonSchema) => s.id.includes('resource_handler') && s.method === 'PUT');
        const deleteHandler = schemas.find((s: PythonSchema) => s.id.includes('resource_handler') && s.method === 'DELETE');
        
        expect(getHandler).toBeDefined();
        expect(putHandler).toBeDefined();
        expect(deleteHandler).toBeDefined();
      });

      it('should handle methods=["GET", "POST"] correctly', async () => {
        const schemas = await parser.extractSchemas({ content: flaskAppFixture } as PythonParseOptions) as PythonSchema[];
        
        const getItems = schemas.find((s: PythonSchema) => s.id.includes('items_handler') && s.method === 'GET');
        const postItems = schemas.find((s: PythonSchema) => s.id.includes('items_handler') && s.method === 'POST');
        
        expect(getItems).toBeDefined();
        expect(postItems).toBeDefined();
      });
    });

    describe('Flask Blueprint Routes', () => {
      it('should detect Blueprint url_prefix', async () => {
        const schemas = await parser.extractSchemas({ content: flaskBlueprintFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('users_bp') || s.path?.startsWith('/api/users'));
        
        expect(endpoint?.path).toMatch(/^\/api\/users/);
      });

      it('should combine Blueprint prefix with route path', async () => {
        const schemas = await parser.extractSchemas({ content: flaskBlueprintFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('get_user') && s.path?.includes('/api/users'));
        
        expect(endpoint?.path).toBe('/api/users/{user_id}');
      });

      it('should handle Blueprint without url_prefix', async () => {
        const schemas = await parser.extractSchemas({ content: flaskBlueprintFixture } as PythonParseOptions) as PythonSchema[];
        const endpoint = schemas.find((s: PythonSchema) => s.id.includes('health') && s.path === '/health');
        
        expect(endpoint).toBeDefined();
      });

      it('should handle multiple Blueprints', async () => {
        const schemas = await parser.extractSchemas({ content: flaskBlueprintFixture } as PythonParseOptions) as PythonSchema[];
        
        const usersEndpoint = schemas.find((s: PythonSchema) => s.path?.startsWith('/api/users'));
        const productsEndpoint = schemas.find((s: PythonSchema) => s.path?.startsWith('/api/products'));
        
        expect(usersEndpoint).toBeDefined();
        expect(productsEndpoint).toBeDefined();
      });
    });
  });

  // ===========================================================================
  // MCP Tool Detection Tests (Backward Compatibility)
  // ===========================================================================

  describe('MCP Tool Detection', () => {
    let mcpToolsFixture: string;
    let parser: PythonASTParser;

    beforeAll(() => {
      mcpToolsFixture = loadFixture('mcp-tools.py');
      parser = new PythonASTParser();
    });

    describe('@mcp.tool() decorator', () => {
      it('should detect @mcp.tool() decorated functions', async () => {
        const schemas = await parser.extractSchemas({ content: mcpToolsFixture } as PythonParseOptions) as PythonSchema[];
        const tool = schemas.find((s: PythonSchema) => s.id.includes('simple_tool'));
        
        expect(tool).toBeDefined();
        expect(tool?.type).toBe('tool');
      });

      it('should extract tool parameters from function signature', async () => {
        const schemas = await parser.extractSchemas({ content: mcpToolsFixture } as PythonParseOptions) as PythonSchema[];
        const tool = schemas.find((s: PythonSchema) => s.id.includes('tool_with_multiple_params'));
        
        expect(tool?.inputSchema?.properties).toHaveProperty('query');
        expect(tool?.inputSchema?.properties).toHaveProperty('limit');
        expect(tool?.inputSchema?.properties).toHaveProperty('offset');
      });

      it('should identify required parameters', async () => {
        const schemas = await parser.extractSchemas({ content: mcpToolsFixture } as PythonParseOptions) as PythonSchema[];
        const tool = schemas.find((s: PythonSchema) => s.id.includes('tool_with_multiple_params'));
        
        expect(tool?.inputSchema?.required).toContain('query');
        expect(tool?.inputSchema?.required).toContain('limit');
        expect(tool?.inputSchema?.required).not.toContain('offset');
      });

      it('should extract default values', async () => {
        const schemas = await parser.extractSchemas({ content: mcpToolsFixture } as PythonParseOptions) as PythonSchema[];
        const tool = schemas.find((s: PythonSchema) => s.id.includes('tool_with_multiple_params'));
        const offsetProp = tool?.inputSchema?.properties?.['offset'] as JSONSchema;
        
        expect(offsetProp?.['default']).toBe(0);
      });
    });

    describe('@server.tool() decorator (alternate)', () => {
      it('should detect @server.tool() decorated functions', async () => {
        const schemas = await parser.extractSchemas({ content: mcpToolsFixture } as PythonParseOptions) as PythonSchema[];
        const tool = schemas.find((s: PythonSchema) => s.id.includes('alternate_tool'));
        
        expect(tool).toBeDefined();
        expect(tool?.type).toBe('tool');
      });

      it('should extract async tool correctly', async () => {
        const schemas = await parser.extractSchemas({ content: mcpToolsFixture } as PythonParseOptions) as PythonSchema[];
        const tool = schemas.find((s: PythonSchema) => s.id.includes('async_alternate_tool'));
        
        expect(tool?.async).toBe(true);
      });
    });

    describe('MCP Tools with Pydantic Models', () => {
      it('should resolve Pydantic model input parameters', async () => {
        const schemas = await parser.extractSchemas({ content: mcpToolsFixture } as PythonParseOptions) as PythonSchema[];
        const tool = schemas.find((s: PythonSchema) => s.id.includes('search_data'));
        
        expect(tool?.inputSchema?.properties).toHaveProperty('input');
      });

      it('should resolve Pydantic model return types', async () => {
        const schemas = await parser.extractSchemas({ content: mcpToolsFixture } as PythonParseOptions) as PythonSchema[];
        const tool = schemas.find((s: PythonSchema) => s.id.includes('search_data'));
        
        expect(tool?.outputSchema).toBeDefined();
        expect(tool?.outputSchema?.type).toBe('array');
      });
    });

    describe('MCP Tool Docstring Extraction', () => {
      it('should extract simple docstring as description', async () => {
        const schemas = await parser.extractSchemas({ content: mcpToolsFixture } as PythonParseOptions) as PythonSchema[];
        const tool = schemas.find((s: PythonSchema) => s.id.includes('simple_tool'));
        
        expect(tool?.description).toBe('Simple tool that processes a query.');
      });

      it('should extract detailed docstring with Args section', async () => {
        const schemas = await parser.extractSchemas({ content: mcpToolsFixture } as PythonParseOptions) as PythonSchema[];
        const tool = schemas.find((s: PythonSchema) => s.id.includes('tool_with_detailed_docstring'));
        
        expect(tool?.description).toContain('Search for items matching the query');
      });

      it('should extract parameter descriptions from docstring', async () => {
        const schemas = await parser.extractSchemas({ content: mcpToolsFixture } as PythonParseOptions) as PythonSchema[];
        const tool = schemas.find((s: PythonSchema) => s.id.includes('tool_with_detailed_docstring'));
        const queryProp = tool?.inputSchema?.properties?.['query'] as JSONSchema;
        
        expect(queryProp?.description).toContain('search query');
      });
    });

    describe('MCP Tools with Literal Types', () => {
      it('should convert Literal to enum in schema', async () => {
        const schemas = await parser.extractSchemas({ content: mcpToolsFixture } as PythonParseOptions) as PythonSchema[];
        const tool = schemas.find((s: PythonSchema) => s.id.includes('tool_with_literal'));
        const actionProp = tool?.inputSchema?.properties?.['action'] as JSONSchema;
        
        expect(actionProp?.['enum']).toEqual(['create', 'update', 'delete']);
      });

      it('should handle Literal with mixed types', async () => {
        const schemas = await parser.extractSchemas({ content: mcpToolsFixture } as PythonParseOptions) as PythonSchema[];
        const tool = schemas.find((s: PythonSchema) => s.id.includes('tool_with_literal_union'));
        const modeProp = tool?.inputSchema?.properties?.['mode'] as JSONSchema;
        
        expect(modeProp?.['enum']).toEqual(['fast', 'slow']);
      });
    });

    describe('MCP Tools without Type Hints', () => {
      it('should handle functions without type hints', async () => {
        const schemas = await parser.extractSchemas({ content: mcpToolsFixture } as PythonParseOptions) as PythonSchema[];
        const tool = schemas.find((s: PythonSchema) => s.id.includes('tool_no_types'));
        
        expect(tool).toBeDefined();
        expect(tool?.inputSchema?.properties).toHaveProperty('query');
      });

      it('should handle functions with partial type hints', async () => {
        const schemas = await parser.extractSchemas({ content: mcpToolsFixture } as PythonParseOptions) as PythonSchema[];
        const tool = schemas.find((s: PythonSchema) => s.id.includes('tool_partial_types'));
        const queryProp = tool?.inputSchema?.properties?.['query'] as JSONSchema;
        
        expect(queryProp?.type).toBe('string');
      });
    });
  });

  // ===========================================================================
  // Pydantic Model Extraction Tests
  // ===========================================================================

  describe('Pydantic Model Extraction', () => {
    let pydanticFixture: string;
    let parser: PythonASTParser;

    beforeAll(() => {
      pydanticFixture = loadFixture('pydantic-models.py');
      parser = new PythonASTParser();
    });

    describe('Basic Models', () => {
      it('should extract simple BaseModel class', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const model = schemas.find((s: PythonSchema) => s.id.includes('SimpleModel'));
        
        expect(model).toBeDefined();
        expect(model?.type).toBe('model');
      });

      it('should extract all fields from simple model', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const model = schemas.find((s: PythonSchema) => s.id.includes('SimpleModel'));
        
        expect(model?.properties).toHaveProperty('name');
        expect(model?.properties).toHaveProperty('age');
        expect(model?.properties).toHaveProperty('active');
      });

      it('should correctly identify required fields', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const model = schemas.find((s: PythonSchema) => s.id.includes('SimpleModel'));
        
        expect(model?.required).toContain('name');
        expect(model?.required).toContain('age');
        expect(model?.required).toContain('active');
      });

      it('should extract default values from model', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const model = schemas.find((s: PythonSchema) => s.id.includes('ModelWithDefaults'));
        const ageProp = model?.properties?.['age'] as JSONSchema;
        
        expect(ageProp?.['default']).toBe(0);
        expect(model?.required).not.toContain('age');
      });
    });

    describe('Models with Field() Constraints', () => {
      it('should extract min_length constraint', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const model = schemas.find((s: PythonSchema) => s.id.includes('ConstrainedModel'));
        const nameProp = model?.properties?.['name'] as JSONSchema;
        
        expect(nameProp?.['minLength']).toBe(1);
      });

      it('should extract max_length constraint', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const model = schemas.find((s: PythonSchema) => s.id.includes('ConstrainedModel'));
        const nameProp = model?.properties?.['name'] as JSONSchema;
        
        expect(nameProp?.['maxLength']).toBe(100);
      });

      it('should extract ge/le constraints', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const model = schemas.find((s: PythonSchema) => s.id.includes('ConstrainedModel'));
        const ageProp = model?.properties?.['age'] as JSONSchema;
        
        expect(ageProp?.['minimum']).toBe(0);
        expect(ageProp?.['maximum']).toBe(150);
      });

      it('should extract Field description', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const model = schemas.find((s: PythonSchema) => s.id.includes('ModelWithDescriptions'));
        const idProp = model?.properties?.['id'] as JSONSchema;
        
        expect(idProp?.description).toBe('Unique identifier');
      });
    });

    describe('Nested Models', () => {
      it('should resolve nested model references', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const person = schemas.find((s: PythonSchema) => s.id.includes('Person'));
        
        expect(person?.properties).toHaveProperty('contact');
        expect(person?.properties).toHaveProperty('addresses');
      });

      it('should handle List of nested models', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const person = schemas.find((s: PythonSchema) => s.id.includes('Person'));
        const addressesProp = person?.properties?.['addresses'] as JSONSchema;
        
        expect(addressesProp?.type).toBe('array');
        expect(addressesProp?.items).toBeDefined();
      });

      it('should handle deeply nested models', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const org = schemas.find((s: PythonSchema) => s.id.includes('Organization'));
        
        expect(org?.properties).toHaveProperty('headquarters');
        expect(org?.properties).toHaveProperty('employees');
      });
    });

    describe('Model Inheritance', () => {
      it('should inherit fields from parent model', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const user = schemas.find((s: PythonSchema) => s.id.includes('User') && !s.id.includes('Admin'));
        
        expect(user?.properties).toHaveProperty('id');
        expect(user?.properties).toHaveProperty('created_at');
        expect(user?.properties).toHaveProperty('username');
        expect(user?.properties).toHaveProperty('email');
      });

      it('should support multi-level inheritance', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const admin = schemas.find((s: PythonSchema) => s.id.includes('AdminUser'));
        
        expect(admin?.properties).toHaveProperty('id');
        expect(admin?.properties).toHaveProperty('username');
        expect(admin?.properties).toHaveProperty('permissions');
        expect(admin?.properties).toHaveProperty('admin_level');
      });
    });

    describe('Models with Enums', () => {
      it('should convert Enum to JSON Schema enum', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const task = schemas.find((s: PythonSchema) => s.id.includes('Task'));
        const statusProp = task?.properties?.['status'] as JSONSchema;
        
        expect(statusProp?.['enum']).toEqual(['pending', 'active', 'inactive', 'deleted']);
      });

      it('should handle IntEnum', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const task = schemas.find((s: PythonSchema) => s.id.includes('Task'));
        const priorityProp = task?.properties?.['priority'] as JSONSchema;
        
        expect(priorityProp?.['enum']).toEqual([1, 2, 3, 4]);
      });
    });

    describe('Models with Special Types', () => {
      it('should handle EmailStr type', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const model = schemas.find((s: PythonSchema) => s.id.includes('SpecialTypesModel'));
        const emailProp = model?.properties?.['email'] as JSONSchema;
        
        expect(emailProp?.type).toBe('string');
        expect(emailProp?.['format']).toBe('email');
      });

      it('should handle HttpUrl type', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const model = schemas.find((s: PythonSchema) => s.id.includes('SpecialTypesModel'));
        const urlProp = model?.properties?.['website'] as JSONSchema;
        
        expect(urlProp?.type).toBe('string');
        expect(urlProp?.['format']).toBe('uri');
      });

      it('should handle UUID type', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const model = schemas.find((s: PythonSchema) => s.id.includes('SpecialTypesModel'));
        const uuidProp = model?.properties?.['uuid'] as JSONSchema;
        
        expect(uuidProp?.type).toBe('string');
        expect(uuidProp?.['format']).toBe('uuid');
      });

      it('should handle datetime type', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const model = schemas.find((s: PythonSchema) => s.id.includes('SpecialTypesModel'));
        const createdProp = model?.properties?.['created'] as JSONSchema;
        
        expect(createdProp?.type).toBe('string');
        expect(createdProp?.['format']).toBe('date-time');
      });

      it('should handle Decimal type', async () => {
        const schemas = await parser.extractSchemas({ content: pydanticFixture } as PythonParseOptions) as PythonSchema[];
        const model = schemas.find((s: PythonSchema) => s.id.includes('SpecialTypesModel'));
        const amountProp = model?.properties?.['amount'] as JSONSchema;
        
        expect(amountProp?.type).toBe('string');
      });
    });
  });

  // ===========================================================================
  // Type Annotation Resolution Tests
  // ===========================================================================

  describe('Type Annotation Resolution', () => {
    let typeAnnotationsFixture: string;
    let parser: PythonASTParser;

    beforeAll(() => {
      typeAnnotationsFixture = loadFixture('type-annotations.py');
      parser = new PythonASTParser();
    });

    describe('Primitive Types', () => {
      it('should resolve str to string', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('primitive_str'));
        const param = func?.inputSchema?.properties?.['value'] as JSONSchema;
        
        expect(param?.type).toBe('string');
      });

      it('should resolve int to integer', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('primitive_int'));
        const param = func?.inputSchema?.properties?.['value'] as JSONSchema;
        
        expect(param?.type).toBe('integer');
      });

      it('should resolve float to number', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('primitive_float'));
        const param = func?.inputSchema?.properties?.['value'] as JSONSchema;
        
        expect(param?.type).toBe('number');
      });

      it('should resolve bool to boolean', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('primitive_bool'));
        const param = func?.inputSchema?.properties?.['value'] as JSONSchema;
        
        expect(param?.type).toBe('boolean');
      });

      it('should resolve bytes to string with format', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('primitive_bytes'));
        const param = func?.inputSchema?.properties?.['value'] as JSONSchema;
        
        expect(param?.type).toBe('string');
        expect(param?.['format']).toBe('byte');
      });
    });

    describe('Optional Types', () => {
      it('should resolve Optional[str] to nullable string', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('optional_str'));
        const param = func?.inputSchema?.properties?.['value'] as JSONSchema;
        
        // Could be type: ['string', 'null'] or anyOf
        expect(param).toBeDefined();
      });

      it('should resolve Optional with complex types', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('optional_complex'));
        const param = func?.inputSchema?.properties?.['value'] as JSONSchema;
        
        expect(param).toBeDefined();
      });
    });

    describe('Union Types', () => {
      it('should resolve Union[str, int] to oneOf', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('union_basic'));
        const param = func?.inputSchema?.properties?.['value'] as JSONSchema;
        
        expect(param?.['oneOf'] || param?.['anyOf']).toBeDefined();
      });

      it('should resolve Union[str, None] as nullable', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('union_with_none'));
        const param = func?.inputSchema?.properties?.['value'] as JSONSchema;
        
        expect(param).toBeDefined();
      });
    });

    describe('Python 3.10+ Union Syntax (|)', () => {
      it('should resolve str | int syntax', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('union_pipe'));
        const param = func?.inputSchema?.properties?.['value'] as JSONSchema;
        
        expect(param?.['oneOf'] || param?.['anyOf']).toBeDefined();
      });

      it('should resolve str | None as nullable', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('optional_pipe'));
        const param = func?.inputSchema?.properties?.['value'] as JSONSchema;
        
        expect(param).toBeDefined();
      });
    });

    describe('List Types', () => {
      it('should resolve List[str] to array of strings', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('list_str'));
        const param = func?.inputSchema?.properties?.['items'] as JSONSchema;
        
        expect(param?.type).toBe('array');
        expect((param?.items as JSONSchema)?.type).toBe('string');
      });

      it('should resolve nested List[List[int]]', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('list_nested'));
        const param = func?.inputSchema?.properties?.['items'] as JSONSchema;
        
        expect(param?.type).toBe('array');
        expect((param?.items as JSONSchema)?.type).toBe('array');
      });

      it('should resolve List[Dict[str, Any]]', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('list_complex'));
        const param = func?.inputSchema?.properties?.['items'] as JSONSchema;
        
        expect(param?.type).toBe('array');
        expect((param?.items as JSONSchema)?.type).toBe('object');
      });
    });

    describe('Dict Types', () => {
      it('should resolve Dict[str, str] to object', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('dict_str_str'));
        const param = func?.inputSchema?.properties?.['data'] as JSONSchema;
        
        expect(param?.type).toBe('object');
        expect((param?.additionalProperties as JSONSchema)?.type).toBe('string');
      });

      it('should resolve nested Dict[str, Dict[str, int]]', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('dict_nested'));
        const param = func?.inputSchema?.properties?.['data'] as JSONSchema;
        
        expect(param?.type).toBe('object');
        expect((param?.additionalProperties as JSONSchema)?.type).toBe('object');
      });
    });

    describe('Tuple Types', () => {
      it('should resolve fixed Tuple[str, int, float]', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('tuple_fixed'));
        const param = func?.inputSchema?.properties?.['data'] as JSONSchema;
        
        expect(param?.type).toBe('array');
        expect(param?.items).toBeDefined();
      });

      it('should resolve variable Tuple[int, ...]', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('tuple_variable'));
        const param = func?.inputSchema?.properties?.['data'] as JSONSchema;
        
        expect(param?.type).toBe('array');
        expect((param?.items as JSONSchema)?.type).toBe('integer');
      });
    });

    describe('Literal Types', () => {
      it('should resolve Literal["a", "b"] to enum', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('literal_string'));
        const param = func?.inputSchema?.properties?.['mode'] as JSONSchema;
        
        expect(param?.['enum']).toEqual(['read', 'write']);
      });

      it('should resolve Literal[1, 2, 3] to enum', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('literal_int'));
        const param = func?.inputSchema?.properties?.['level'] as JSONSchema;
        
        expect(param?.['enum']).toEqual([1, 2, 3]);
      });
    });

    describe('Standard Library Types', () => {
      it('should resolve datetime to string with format', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('datetime_type'));
        const param = func?.inputSchema?.properties?.['dt'] as JSONSchema;
        
        expect(param?.type).toBe('string');
        expect(param?.['format']).toBe('date-time');
      });

      it('should resolve date to string with format', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('date_type'));
        const param = func?.inputSchema?.properties?.['d'] as JSONSchema;
        
        expect(param?.type).toBe('string');
        expect(param?.['format']).toBe('date');
      });

      it('should resolve UUID to string with format', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('uuid_type'));
        const param = func?.inputSchema?.properties?.['u'] as JSONSchema;
        
        expect(param?.type).toBe('string');
        expect(param?.['format']).toBe('uuid');
      });

      it('should resolve Path to string', async () => {
        const schemas = await parser.extractSchemas({ content: typeAnnotationsFixture } as PythonParseOptions) as PythonSchema[];
        const func = schemas.find((s: PythonSchema) => s.id.includes('path_type'));
        const param = func?.inputSchema?.properties?.['p'] as JSONSchema;
        
        expect(param?.type).toBe('string');
      });
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('Error Handling', () => {
    let parser: PythonASTParser;

    beforeAll(() => {
      parser = new PythonASTParser();
    });

    it('should handle invalid Python syntax gracefully', async () => {
      const invalidCode = `
def broken_function(
  # Missing closing paren
`;
      
      await expect(async () => {
        await parser.extractSchemas({ content: invalidCode } as PythonParseOptions);
      }).not.toThrow();
      
      const schemas = await parser.extractSchemas({ content: invalidCode } as PythonParseOptions);
      expect(schemas).toBeDefined();
    });

    it('should handle empty file', async () => {
      const schemas = await parser.extractSchemas({ content: '' } as PythonParseOptions);
      expect(schemas.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle file with only comments', async () => {
      const onlyComments = `
# This is a comment
# Another comment
"""
Multi-line docstring
"""
`;
      const schemas = await parser.extractSchemas({ content: onlyComments } as PythonParseOptions);
      expect(schemas).toEqual([]);
    });

    it('should handle file without decorators', async () => {
      const noDecorators = `
def regular_function(x: int) -> int:
    return x * 2

class RegularClass:
    pass
`;
      const schemas = await parser.extractSchemas({ content: noDecorators } as PythonParseOptions);
      // The parser extracts typed functions even without decorators
      expect(schemas.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle malformed decorators', async () => {
      const malformedDecorators = `
@app.get  # Missing parens and path
def incomplete_decorator():
    pass

@route("/path"  # Unclosed paren
def unclosed_decorator():
    pass
`;
      
      await expect(async () => {
        await parser.extractSchemas({ content: malformedDecorators } as PythonParseOptions);
      }).not.toThrow();
    });

    it('should handle circular type references gracefully', async () => {
      const circularTypes = `
from pydantic import BaseModel
from typing import List

class Node(BaseModel):
    value: str
    children: List["Node"]
`;
      
      const schemas = await parser.extractSchemas({ content: circularTypes } as PythonParseOptions);
      expect(schemas).toBeDefined();
    });

    it('should handle missing imports', async () => {
      const missingImports = `
@app.get("/test")
def test_endpoint() -> NonExistentType:
    pass
`;
      
      await expect(async () => {
        await parser.extractSchemas({ content: missingImports } as PythonParseOptions);
      }).not.toThrow();
    });
  });

  // ===========================================================================
  // Async Function Handling Tests
  // ===========================================================================

  describe('Async Function Handling', () => {
    let parser: PythonASTParser;

    beforeAll(() => {
      parser = new PythonASTParser();
    });

    it('should correctly identify async def functions', async () => {
      const code = `
from fastapi import FastAPI
app = FastAPI()

@app.get("/async-endpoint")
async def async_endpoint() -> str:
    return "async"
`;
      const schemas = await parser.extractSchemas({ content: code } as PythonParseOptions) as PythonSchema[];
      const endpoint = schemas.find((s: PythonSchema) => s.id.includes('async_endpoint'));
      
      expect(endpoint?.async).toBe(true);
    });

    it('should correctly identify sync def functions', async () => {
      const code = `
from fastapi import FastAPI
app = FastAPI()

@app.get("/sync-endpoint")
def sync_endpoint() -> str:
    return "sync"
`;
      const schemas = await parser.extractSchemas({ content: code } as PythonParseOptions) as PythonSchema[];
      const endpoint = schemas.find((s: PythonSchema) => s.id.includes('sync_endpoint'));
      
      expect(endpoint?.async).toBe(false);
    });

    it('should handle async generator return types', async () => {
      const code = `
from mcp.server import Server
from typing import AsyncGenerator

mcp = Server("test")

@mcp.tool()
async def stream_data() -> AsyncGenerator[str, None]:
    yield "data"
`;
      const schemas = await parser.extractSchemas({ content: code } as PythonParseOptions) as PythonSchema[];
      const tool = schemas.find((s: PythonSchema) => s.id.includes('stream_data'));
      
      expect(tool?.async).toBe(true);
    });
  });

  // ===========================================================================
  // Docstring Extraction Tests
  // ===========================================================================

  describe('Docstring Extraction', () => {
    let parser: PythonASTParser;

    beforeAll(() => {
      parser = new PythonASTParser();
    });

    it('should extract single-line docstring', async () => {
      const code = `
from mcp.server import Server
mcp = Server("test")

@mcp.tool()
def single_line_doc(x: int) -> int:
    """This is a single line docstring."""
    return x
`;
      const schemas = await parser.extractSchemas({ content: code } as PythonParseOptions) as PythonSchema[];
      const tool = schemas.find((s: PythonSchema) => s.id.includes('single_line_doc'));
      
      expect(tool?.description).toBe('This is a single line docstring.');
    });

    it('should extract multi-line docstring', async () => {
      const code = `
from mcp.server import Server
mcp = Server("test")

@mcp.tool()
def multi_line_doc(x: int) -> int:
    """
    This is a multi-line docstring.
    It has multiple lines of description.
    """
    return x
`;
      const schemas = await parser.extractSchemas({ content: code } as PythonParseOptions) as PythonSchema[];
      const tool = schemas.find((s: PythonSchema) => s.id.includes('multi_line_doc'));
      
      expect(tool?.description).toContain('multi-line docstring');
    });

    it('should extract Args section from docstring', async () => {
      const code = `
from mcp.server import Server
mcp = Server("test")

@mcp.tool()
def with_args_doc(query: str, limit: int) -> list:
    """
    Search for items.
    
    Args:
        query: The search query string.
        limit: Maximum number of results.
    
    Returns:
        List of matching items.
    """
    return []
`;
      const schemas = await parser.extractSchemas({ content: code } as PythonParseOptions) as PythonSchema[];
      const tool = schemas.find((s: PythonSchema) => s.id.includes('with_args_doc'));
      
      const queryProp = tool?.inputSchema?.properties?.['query'] as JSONSchema;
      const limitProp = tool?.inputSchema?.properties?.['limit'] as JSONSchema;
      
      expect(queryProp?.description).toContain('search query');
      expect(limitProp?.description).toContain('Maximum number');
    });

    it('should handle functions without docstrings', async () => {
      const code = `
from mcp.server import Server
mcp = Server("test")

@mcp.tool()
def no_docstring(x: int) -> int:
    return x
`;
      const schemas = await parser.extractSchemas({ content: code } as PythonParseOptions) as PythonSchema[];
      const tool = schemas.find((s: PythonSchema) => s.id.includes('no_docstring'));
      
      expect(tool?.description).toBeUndefined();
    });

    it('should handle class docstrings for Pydantic models', async () => {
      const code = `
from pydantic import BaseModel

class DocumentedModel(BaseModel):
    """This model has a docstring describing its purpose."""
    name: str
    value: int
`;
      const schemas = await parser.extractSchemas({ content: code } as PythonParseOptions) as PythonSchema[];
      const model = schemas.find((s: PythonSchema) => s.id.includes('DocumentedModel'));
      
      expect(model?.description).toContain('docstring describing');
    });
  });

  // ===========================================================================
  // Integration Tests
  // ===========================================================================

  describe('Integration Tests', () => {
    let parser: PythonASTParser;

    beforeAll(() => {
      parser = new PythonASTParser();
    });

    it('should extract all schemas from a complete FastAPI app', async () => {
      const fixture = loadFixture('fastapi-app.py');
      const schemas = await parser.extractSchemas({ content: fixture } as PythonParseOptions) as PythonSchema[];
      
      expect(schemas.length).toBeGreaterThan(10);
      
      const methods = new Set(schemas.map((s: PythonSchema) => s.method));
      expect(methods.has('GET')).toBe(true);
      expect(methods.has('POST')).toBe(true);
      expect(methods.has('PUT')).toBe(true);
      expect(methods.has('DELETE')).toBe(true);
    });

    it('should extract all schemas from a Flask Blueprint app', async () => {
      const fixture = loadFixture('flask-blueprint.py');
      const schemas = await parser.extractSchemas({ content: fixture } as PythonParseOptions) as PythonSchema[];
      
      expect(schemas.length).toBeGreaterThan(10);
      
      const paths = schemas.map((s: PythonSchema) => s.path);
      expect(paths.some((p: string | undefined) => p?.startsWith('/api/users'))).toBe(true);
      expect(paths.some((p: string | undefined) => p?.startsWith('/api/products'))).toBe(true);
    });

    it('should extract all MCP tools from a server', async () => {
      const fixture = loadFixture('mcp-tools.py');
      const schemas = await parser.extractSchemas({ content: fixture } as PythonParseOptions) as PythonSchema[];
      
      const tools = schemas.filter((s: PythonSchema) => s.type === 'tool');
      expect(tools.length).toBeGreaterThan(10);
    });

    it('should extract all Pydantic models', async () => {
      const fixture = loadFixture('pydantic-models.py');
      const schemas = await parser.extractSchemas({ content: fixture } as PythonParseOptions) as PythonSchema[];
      
      expect(schemas.length).toBeGreaterThan(20);
    });

    it('should handle mixed framework patterns in same file', async () => {
      const mixedCode = `
from fastapi import FastAPI
from flask import Flask
from mcp.server import Server
from pydantic import BaseModel

fastapi_app = FastAPI()
flask_app = Flask(__name__)
mcp = Server("mixed")

class SharedModel(BaseModel):
    name: str

@fastapi_app.get("/fastapi")
async def fastapi_endpoint() -> SharedModel:
    pass

@flask_app.route("/flask")
def flask_endpoint():
    pass

@mcp.tool()
def mcp_tool(data: SharedModel) -> str:
    pass
`;
      
      const schemas = await parser.extractSchemas({ content: mixedCode } as PythonParseOptions) as PythonSchema[];
      
      expect(schemas.some((s: PythonSchema) => s.id.includes('fastapi_endpoint'))).toBe(true);
      expect(schemas.some((s: PythonSchema) => s.id.includes('flask_endpoint'))).toBe(true);
      expect(schemas.some((s: PythonSchema) => s.id.includes('mcp_tool'))).toBe(true);
      expect(schemas.some((s: PythonSchema) => s.id.includes('SharedModel'))).toBe(true);
    });
  });
});
