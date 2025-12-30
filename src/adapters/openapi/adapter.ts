/**
 * 📋 OpenAPI Schema Adapter
 * Extracts and converts OpenAPI/Swagger specifications to NormalizedSchema
 * 
 * This adapter implements the SchemaAdapter interface for OpenAPI 3.x
 * specifications. It supports extraction of:
 * - Full endpoints (request + all responses)
 * - Request body schemas
 * - Response schemas by status code
 * - Component schemas
 * - File-level extraction (first endpoint)
 * 
 * @module adapters/openapi/adapter
 */

import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPIV3 } from 'openapi-types';
import type {
  SchemaAdapter,
  SchemaRef,
  NormalizedSchema,
  PropertyDef,
  SourceLocation,
} from '../../core/types.js';
import { parseOpenAPIRef, type OpenAPIRef } from './parser.js';
import {
  convertToNormalizedSchema,
  convertToNormalizedType,
  convertParametersToSchema,
} from './convert.js';

/** Type alias for OpenAPI 3.x document */
type OpenAPIDocument = OpenAPIV3.Document;

/**
 * Schema adapter for OpenAPI 3.x specifications.
 * 
 * Implements the SchemaAdapter interface to extract schemas from
 * OpenAPI/Swagger specifications. Uses `@apidevtools/swagger-parser`
 * for parsing and validation.
 * 
 * @implements {SchemaAdapter}
 * 
 * @example
 * ```typescript
 * import { OpenAPIAdapter } from './adapter.js';
 * import { registerAdapter } from '../registry.js';
 * 
 * // Register the adapter
 * registerAdapter(new OpenAPIAdapter());
 * 
 * // Extract an endpoint schema
 * const adapter = new OpenAPIAdapter();
 * const schema = await adapter.extract({
 *   source: 'openapi',
 *   id: 'endpoint:GET:/users/{id}@./api.yaml'
 * });
 * ```
 */
export class OpenAPIAdapter implements SchemaAdapter {
  /** Adapter kind identifier */
  readonly kind = 'openapi' as const;

  /**
   * Check if this adapter supports the given schema reference.
   * 
   * @param ref - The schema reference to check
   * @returns True if the ref source is 'openapi'
   */
  supports(ref: SchemaRef): boolean {
    return ref.source === 'openapi';
  }

  /**
   * Extract a schema from an OpenAPI specification.
   * 
   * Parses the ref ID to determine what to extract:
   * - `file:` - Extract first endpoint from spec
   * - `endpoint:` - Full endpoint schema (request + responses)
   * - `request:` - Request body schema only
   * - `response:` - Specific response by status code
   * - `schema:` - Named component schema
   * 
   * @param ref - The schema reference specifying what to extract
   * @returns Promise resolving to the normalized schema
   * @throws {Error} If the ref ID is invalid or extraction fails
   * 
   * @example
   * ```typescript
   * // Extract a full endpoint
   * const schema = await adapter.extract({
   *   source: 'openapi',
   *   id: 'endpoint:GET:/users/{id}@./api.yaml'
   * });
   * 
   * // Extract a component schema
   * const schema = await adapter.extract({
   *   source: 'openapi',
   *   id: 'schema:User@./api.yaml'
   * });
   * ```
   */
  async extract(ref: SchemaRef): Promise<NormalizedSchema> {
    const parsed = parseOpenAPIRef(ref.id);
    if (!parsed) {
      throw new Error(`Invalid OpenAPI ref ID: ${ref.id}`);
    }

    const api = await this.loadSpec(parsed.specPath);

    switch (parsed.type) {
      case 'file':
        return this.extractFirstEndpoint(api, parsed.specPath, ref);

      case 'endpoint':
        return this.extractEndpoint(api, parsed.method!, parsed.path!, ref, parsed.specPath);

      case 'request':
        return this.extractRequest(api, parsed.method!, parsed.path!, ref);

      case 'response':
        return this.extractResponse(api, parsed.method!, parsed.path!, parsed.statusCode!, ref);

      case 'schema':
        return this.extractComponentSchema(api, parsed.schemaName!, ref, parsed.specPath);

      default:
        throw new Error(`Unknown OpenAPI ref type: ${(parsed as OpenAPIRef).type}`);
    }
  }

  /**
   * List all endpoints in an OpenAPI specification.
   * 
   * Scans the paths object and returns a SchemaRef for each
   * method/path combination found. Handles errors gracefully
   * by returning an empty array per ADR guidelines.
   * 
   * @param basePath - Path to the OpenAPI specification file
   * @returns Promise resolving to array of endpoint SchemaRefs
   * 
   * @example
   * ```typescript
   * const refs = await adapter.list('./api.yaml');
   * // [
   * //   { source: 'openapi', id: 'endpoint:GET:/users@./api.yaml' },
   * //   { source: 'openapi', id: 'endpoint:POST:/users@./api.yaml' },
   * //   ...
   * // ]
   * ```
   */
  async list(basePath: string): Promise<SchemaRef[]> {
    try {
      const api = await this.loadSpec(basePath);
      const refs: SchemaRef[] = [];

      const paths = api.paths || {};
      for (const [path, pathItem] of Object.entries(paths)) {
        if (!pathItem) continue;

        const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const;
        for (const method of methods) {
          if (pathItem[method]) {
            refs.push({
              source: 'openapi',
              id: `endpoint:${method.toUpperCase()}:${path}@${basePath}`,
            });
          }
        }
      }

      return refs;
    } catch {
      // Per ADR, list() should handle errors gracefully
      return [];
    }
  }

  // ============================================================================
  // Private: Spec Loading
  // ============================================================================

  /**
   * Load and validate an OpenAPI specification.
   * 
   * Uses swagger-parser to validate the spec and resolve references.
   * 
   * @param specPath - Path to the specification file
   * @returns Promise resolving to the parsed OpenAPI document
   * @throws {Error} If the spec cannot be loaded or is invalid
   */
  private async loadSpec(specPath: string): Promise<OpenAPIDocument> {
    try {
      const api = await SwaggerParser.validate(specPath);
      return api as OpenAPIDocument;
    } catch (error) {
      throw new Error(`Failed to load OpenAPI spec: ${specPath} - ${error}`);
    }
  }

  // ============================================================================
  // Private: Extraction Methods
  // ============================================================================

  /**
   * Extract the first endpoint from a spec.
   * 
   * Used for `file:` refs that don't specify a specific endpoint.
   * 
   * @param api - The parsed OpenAPI document
   * @param specPath - Path to the spec file
   * @param ref - The original schema reference
   * @returns The normalized schema for the first endpoint
   * @throws {Error} If no endpoints are found
   */
  private extractFirstEndpoint(
    api: OpenAPIDocument,
    specPath: string,
    ref: SchemaRef
  ): NormalizedSchema {
    const paths = api.paths || {};
    for (const [path, pathItem] of Object.entries(paths)) {
      if (!pathItem) continue;

      const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;
      for (const method of methods) {
        if (pathItem[method]) {
          return this.extractEndpoint(api, method.toUpperCase(), path, ref, specPath);
        }
      }
    }

    throw new Error(`No endpoints found in spec: ${specPath}`);
  }

  /**
   * Extract a full endpoint schema (request + responses).
   * 
   * Creates a normalized schema with two top-level properties:
   * - `request`: Path params, query params, headers, and body
   * - `responses`: All response schemas keyed by status code
   * 
   * @param api - The parsed OpenAPI document
   * @param method - HTTP method (GET, POST, etc.)
   * @param path - API path (/users/{id})
   * @param ref - The original schema reference
   * @param specPath - Path to the spec file
   * @returns The normalized endpoint schema
   * @throws {Error} If path or method not found
   */
  private extractEndpoint(
    api: OpenAPIDocument,
    method: string,
    path: string,
    ref: SchemaRef,
    specPath: string
  ): NormalizedSchema {
    const pathItem = api.paths?.[path];
    if (!pathItem) {
      throw new Error(`Path not found: ${path}`);
    }

    const operation = pathItem[method.toLowerCase() as keyof typeof pathItem] as OpenAPIV3.OperationObject | undefined;
    if (!operation) {
      throw new Error(`Method ${method} not found for path ${path}`);
    }

    const operationName = operation.operationId || `${method.toLowerCase()} ${path}`;

    // Build request schema (path, query, headers, body)
    const requestSchema = this.buildRequestSchema(api, operation, pathItem, ref);

    // Build responses schema (keyed by status code)
    const responsesSchema = this.buildResponsesSchema(operation, ref);

    // Location info for source mapping
    const location: SourceLocation = {
      file: specPath,
      line: 1, // OpenAPI doesn't preserve line info
    };

    return {
      name: operationName,
      properties: {
        request: {
          type: { kind: 'object', schema: requestSchema },
          optional: false,
          nullable: false,
          readonly: false,
          deprecated: operation.deprecated || false,
        },
        responses: {
          type: { kind: 'object', schema: responsesSchema },
          optional: false,
          nullable: false,
          readonly: false,
          deprecated: false,
        },
      },
      required: ['request', 'responses'],
      source: ref,
      location,
    };
  }

  /**
   * Build the request schema for an endpoint.
   * 
   * Combines path-level and operation-level parameters into
   * a structured schema with path, query, headers, and body sections.
   * 
   * @param api - The parsed OpenAPI document
   * @param operation - The operation object
   * @param pathItem - The path item object
   * @param ref - The original schema reference
   * @returns The request schema
   */
  private buildRequestSchema(
    api: OpenAPIDocument,
    operation: OpenAPIV3.OperationObject,
    pathItem: OpenAPIV3.PathItemObject,
    ref: SchemaRef
  ): NormalizedSchema {
    const properties: Record<string, PropertyDef> = {};
    const required: string[] = [];

    // Combine path-level and operation-level parameters
    const allParams = [
      ...(pathItem.parameters || []),
      ...(operation.parameters || []),
    ] as OpenAPIV3.ParameterObject[];

    // Path parameters (always required)
    const pathParams = allParams.filter(p => p.in === 'path');
    if (pathParams.length > 0) {
      const pathSchema = convertParametersToSchema(pathParams, ref);
      properties['path'] = {
        type: { kind: 'object', schema: pathSchema },
        optional: false,
        nullable: false,
        readonly: false,
        deprecated: false,
      };
      required.push('path');
    }

    // Query parameters (optional section)
    const queryParams = allParams.filter(p => p.in === 'query');
    if (queryParams.length > 0) {
      const querySchema = convertParametersToSchema(queryParams, ref);
      properties['query'] = {
        type: { kind: 'object', schema: querySchema },
        optional: true,
        nullable: false,
        readonly: false,
        deprecated: false,
      };
    }

    // Header parameters (optional section)
    const headerParams = allParams.filter(p => p.in === 'header');
    if (headerParams.length > 0) {
      const headerSchema = convertParametersToSchema(headerParams, ref);
      properties['headers'] = {
        type: { kind: 'object', schema: headerSchema },
        optional: true,
        nullable: false,
        readonly: false,
        deprecated: false,
      };
    }

    // Request body (if present)
    if (operation.requestBody) {
      const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject;
      const content = requestBody.content;
      const jsonContent = content?.['application/json'];

      if (jsonContent?.schema) {
        const bodySchema = this.dereferenceSchema(api, jsonContent.schema);
        properties['body'] = {
          type: convertToNormalizedType(bodySchema),
          optional: !requestBody.required,
          nullable: false,
          readonly: false,
          deprecated: false,
        };
        if (requestBody.required) {
          required.push('body');
        }
      }
    }

    return {
      properties,
      required,
      source: ref,
    };
  }

  /**
   * Build the responses schema for an endpoint.
   * 
   * Creates a schema with status codes as property keys,
   * each containing the response body schema.
   * 
   * @param operation - The operation object
   * @param ref - The original schema reference
   * @returns The responses schema
   */
  private buildResponsesSchema(
    operation: OpenAPIV3.OperationObject,
    ref: SchemaRef
  ): NormalizedSchema {
    const properties: Record<string, PropertyDef> = {};
    const required: string[] = [];

    if (operation.responses) {
      for (const [status, response] of Object.entries(operation.responses)) {
        const resp = response as OpenAPIV3.ResponseObject;
        const content = resp.content;
        const jsonContent = content?.['application/json'];

        if (jsonContent?.schema) {
          properties[status] = {
            type: convertToNormalizedType(jsonContent.schema),
            optional: false,
            nullable: false,
            readonly: false,
            deprecated: false,
            description: resp.description,
          };
          required.push(status);
        } else {
          // Response without body (like 204 No Content)
          properties[status] = {
            type: { kind: 'primitive', value: 'null' },
            optional: false,
            nullable: true,
            readonly: false,
            deprecated: false,
            description: resp.description,
          };
        }
      }
    }

    return {
      properties,
      required,
      source: ref,
    };
  }

  /**
   * Extract just the request body schema for an endpoint.
   * 
   * @param api - The parsed OpenAPI document
   * @param method - HTTP method
   * @param path - API path
   * @param ref - The original schema reference
   * @returns The request body schema
   * @throws {Error} If no request body is defined
   */
  private extractRequest(
    api: OpenAPIDocument,
    method: string,
    path: string,
    ref: SchemaRef
  ): NormalizedSchema {
    const pathItem = api.paths?.[path];
    if (!pathItem) {
      throw new Error(`Path not found: ${path}`);
    }

    const operation = pathItem[method.toLowerCase() as keyof typeof pathItem] as OpenAPIV3.OperationObject | undefined;
    if (!operation) {
      throw new Error(`Method ${method} not found for path ${path}`);
    }

    if (!operation.requestBody) {
      throw new Error(`No request body for ${method} ${path}`);
    }

    const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject;
    const content = requestBody.content;
    const jsonContent = content?.['application/json'];

    if (!jsonContent?.schema) {
      throw new Error(`No JSON schema in request body for ${method} ${path}`);
    }

    const bodySchema = this.dereferenceSchema(api, jsonContent.schema);
    return convertToNormalizedSchema(bodySchema, ref);
  }

  /**
   * Extract a response schema by status code.
   * 
   * @param api - The parsed OpenAPI document
   * @param method - HTTP method
   * @param path - API path
   * @param statusCode - Response status code (e.g., '200')
   * @param ref - The original schema reference
   * @returns The response body schema
   * @throws {Error} If response not found
   */
  private extractResponse(
    api: OpenAPIDocument,
    method: string,
    path: string,
    statusCode: string,
    ref: SchemaRef
  ): NormalizedSchema {
    const pathItem = api.paths?.[path];
    if (!pathItem) {
      throw new Error(`Path not found: ${path}`);
    }

    const operation = pathItem[method.toLowerCase() as keyof typeof pathItem] as OpenAPIV3.OperationObject | undefined;
    if (!operation) {
      throw new Error(`Method ${method} not found for path ${path}`);
    }

    const response = operation.responses?.[statusCode] as OpenAPIV3.ResponseObject | undefined;
    if (!response) {
      throw new Error(`Response ${statusCode} not found for ${method} ${path}`);
    }

    const content = response.content;
    const jsonContent = content?.['application/json'];

    if (!jsonContent?.schema) {
      // Response without body - return empty schema
      return {
        properties: {},
        required: [],
        source: ref,
      };
    }

    const responseSchema = this.dereferenceSchema(api, jsonContent.schema);
    return convertToNormalizedSchema(responseSchema, ref);
  }

  /**
   * Extract a component schema by name.
   * 
   * @param api - The parsed OpenAPI document
   * @param schemaName - Name of the component schema
   * @param ref - The original schema reference
   * @param specPath - Path to the spec file
   * @returns The component schema
   * @throws {Error} If schema not found
   */
  private extractComponentSchema(
    api: OpenAPIDocument,
    schemaName: string,
    ref: SchemaRef,
    specPath: string
  ): NormalizedSchema {
    const schemas = api.components?.schemas;
    if (!schemas) {
      throw new Error(`No component schemas in spec: ${specPath}`);
    }

    const schema = schemas[schemaName];
    if (!schema) {
      throw new Error(`Schema not found: ${schemaName}`);
    }

    const dereferenced = this.dereferenceSchema(api, schema);
    const normalized = convertToNormalizedSchema(dereferenced, ref, schemaName);

    normalized.location = {
      file: specPath,
      line: 1,
    };

    return normalized;
  }

  // ============================================================================
  // Private: Reference Resolution
  // ============================================================================

  /**
   * Dereference a schema by resolving $ref if present.
   * 
   * Recursively resolves references in the schema tree, including:
   * - Top-level $ref
   * - allOf, oneOf, anyOf members
   * - Array items
   * - Object properties
   * 
   * @param api - The parsed OpenAPI document
   * @param schema - The schema to dereference
   * @returns The dereferenced schema object
   */
  private dereferenceSchema(
    api: OpenAPIDocument,
    schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  ): OpenAPIV3.SchemaObject {
    // Handle direct $ref
    if ('$ref' in schema) {
      const refPath = schema.$ref;
      const parts = refPath.split('/');
      
      if (parts[0] === '#' && parts[1] === 'components' && parts[2] === 'schemas') {
        const schemaName = parts[3];
        const resolved = api.components?.schemas?.[schemaName];
        if (resolved) {
          return this.dereferenceSchema(api, resolved);
        }
      }
      
      // Return empty object if ref can't be resolved
      return { type: 'object' };
    }

    // Handle allOf by dereferencing each member
    if (schema.allOf) {
      const dereferencedAllOf = schema.allOf.map(s => this.dereferenceSchema(api, s));
      return {
        ...schema,
        allOf: dereferencedAllOf,
      };
    }

    // Handle oneOf
    if (schema.oneOf) {
      const dereferencedOneOf = schema.oneOf.map(s => this.dereferenceSchema(api, s));
      return {
        ...schema,
        oneOf: dereferencedOneOf,
      };
    }

    // Handle anyOf
    if (schema.anyOf) {
      const dereferencedAnyOf = schema.anyOf.map(s => this.dereferenceSchema(api, s));
      return {
        ...schema,
        anyOf: dereferencedAnyOf,
      };
    }

    // Handle array items
    if (schema.type === 'array' && schema.items) {
      return {
        ...schema,
        items: this.dereferenceSchema(api, schema.items),
      };
    }

    // Handle object properties
    if (schema.properties) {
      const dereferencedProps: Record<string, OpenAPIV3.SchemaObject> = {};
      for (const [name, prop] of Object.entries(schema.properties)) {
        dereferencedProps[name] = this.dereferenceSchema(api, prop);
      }
      return {
        ...schema,
        properties: dereferencedProps,
      };
    }

    return schema;
  }
}
