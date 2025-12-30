/**
 * 🔄 OpenAPI Type Converter
 * Converts OpenAPI schemas to NormalizedSchema/NormalizedType
 * 
 * This module handles the transformation of OpenAPI 3.x schema objects
 * into the trace-mcp normalized schema format. It supports:
 * - Primitive types (string, number, boolean, integer)
 * - Complex types (object, array)
 * - Composition keywords (allOf, anyOf, oneOf)
 * - Enums and const values
 * - Constraint extraction (min/max, patterns, formats)
 * 
 * @module adapters/openapi/convert
 */

import type { OpenAPIV3 } from 'openapi-types';
import type {
  NormalizedSchema,
  NormalizedType,
  PropertyDef,
  Constraints,
  SchemaRef,
} from '../../core/types.js';

/** Union type for OpenAPI schemas (either concrete or reference) */
type OpenAPISchema = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;

/**
 * Type guard to check if a schema is a $ref reference object.
 * 
 * @param schema - The schema to check
 * @returns True if the schema is a reference object
 */
function isRefObject(schema: OpenAPISchema): schema is OpenAPIV3.ReferenceObject {
  return '$ref' in schema;
}

/**
 * Convert an OpenAPI schema to a NormalizedType.
 * 
 * Handles all OpenAPI type constructs:
 * - `$ref` → ref kind
 * - `oneOf`/`anyOf` → union kind
 * - `allOf` → intersection kind
 * - `enum` → union of literals
 * - `const` → literal kind
 * - Primitives → primitive kind
 * - `array` → array kind
 * - `object` → object kind
 * 
 * @param schema - The OpenAPI schema to convert
 * @returns The normalized type representation
 * 
 * @example
 * ```typescript
 * // Convert a string type
 * const type = convertToNormalizedType({ type: 'string' });
 * // { kind: 'primitive', value: 'string' }
 * 
 * // Convert an enum
 * const type = convertToNormalizedType({ enum: ['active', 'inactive'] });
 * // { kind: 'union', variants: [{ kind: 'literal', value: 'active' }, ...] }
 * 
 * // Convert an array
 * const type = convertToNormalizedType({ type: 'array', items: { type: 'string' } });
 * // { kind: 'array', element: { kind: 'primitive', value: 'string' } }
 * ```
 */
export function convertToNormalizedType(schema: OpenAPISchema): NormalizedType {
  // Handle $ref (circular references that weren't dereferenced)
  if (isRefObject(schema)) {
    const name = schema.$ref.split('/').pop() || 'Unknown';
    return { kind: 'ref', name };
  }

  // Handle composition keywords first (oneOf, anyOf, allOf)
  if (schema.oneOf) {
    const variants = schema.oneOf.map(s => convertToNormalizedType(s));
    return { kind: 'union', variants };
  }

  if (schema.anyOf) {
    const variants = schema.anyOf.map(s => convertToNormalizedType(s));
    return { kind: 'union', variants };
  }

  if (schema.allOf) {
    const members = schema.allOf.map(s => convertToNormalizedType(s));
    return { kind: 'intersection', members };
  }

  // Handle enum (before primitive types)
  if (schema.enum && Array.isArray(schema.enum)) {
    return {
      kind: 'union',
      variants: schema.enum.map(v => ({
        kind: 'literal' as const,
        value: v as string | number | boolean,
      })),
    };
  }

  // Handle const
  if ('const' in schema && schema.const !== undefined) {
    return { kind: 'literal', value: schema.const as string | number | boolean };
  }

  // Handle by OpenAPI type keyword
  switch (schema.type) {
    case 'string':
      return { kind: 'primitive', value: 'string' };

    case 'boolean':
      return { kind: 'primitive', value: 'boolean' };

    case 'integer':
    case 'number':
      return { kind: 'primitive', value: 'number' };

    case 'array': {
      const element = schema.items
        ? convertToNormalizedType(schema.items as OpenAPISchema)
        : { kind: 'unknown' as const };
      return { kind: 'array', element };
    }

    case 'object': {
      const nestedSchema = convertToNormalizedSchema(schema, { source: 'openapi', id: '' });
      return { kind: 'object', schema: nestedSchema };
    }

    default:
      // No type specified - check if has properties (implicit object)
      if (schema.properties) {
        const nestedSchema = convertToNormalizedSchema(schema, { source: 'openapi', id: '' });
        return { kind: 'object', schema: nestedSchema };
      }
      return { kind: 'any' };
  }
}

/**
 * Extract validation constraints from an OpenAPI schema.
 * 
 * Supports the following constraint types:
 * - String: minLength, maxLength, pattern, format
 * - Number: minimum, maximum
 * - Enum: allowed values
 * 
 * @param schema - The OpenAPI schema object to extract constraints from
 * @returns Constraints object if any constraints found, undefined otherwise
 * 
 * @example
 * ```typescript
 * const constraints = extractConstraints({
 *   type: 'string',
 *   minLength: 1,
 *   maxLength: 100,
 *   pattern: '^[a-z]+$'
 * });
 * // { minLength: 1, maxLength: 100, pattern: '^[a-z]+$' }
 * ```
 */
export function extractConstraints(schema: OpenAPIV3.SchemaObject): Constraints | undefined {
  const constraints: Constraints = {};
  let hasConstraints = false;

  // String constraints
  if (schema.minLength !== undefined) {
    constraints.minLength = schema.minLength;
    hasConstraints = true;
  }

  if (schema.maxLength !== undefined) {
    constraints.maxLength = schema.maxLength;
    hasConstraints = true;
  }

  if (schema.pattern !== undefined) {
    constraints.pattern = schema.pattern;
    hasConstraints = true;
  }

  if (schema.format !== undefined) {
    constraints.format = schema.format;
    hasConstraints = true;
  }

  // Number constraints
  if (schema.minimum !== undefined) {
    constraints.minimum = schema.minimum;
    hasConstraints = true;
  }

  if (schema.maximum !== undefined) {
    constraints.maximum = schema.maximum;
    hasConstraints = true;
  }

  // Enum constraint
  if (schema.enum !== undefined) {
    constraints.enum = schema.enum;
    hasConstraints = true;
  }

  return hasConstraints ? constraints : undefined;
}

/**
 * Convert an OpenAPI schema object to a NormalizedSchema.
 * 
 * This is the main conversion function for object-like schemas.
 * It extracts properties, required fields, and handles allOf merging.
 * 
 * @param schema - The OpenAPI schema object to convert
 * @param source - The SchemaRef identifying the source
 * @param name - Optional name for the schema
 * @returns The normalized schema representation
 * 
 * @example
 * ```typescript
 * const schema = convertToNormalizedSchema({
 *   type: 'object',
 *   required: ['id', 'name'],
 *   properties: {
 *     id: { type: 'integer' },
 *     name: { type: 'string' },
 *     email: { type: 'string', format: 'email' }
 *   }
 * }, { source: 'openapi', id: 'schema:User@./api.yaml' }, 'User');
 * ```
 */
export function convertToNormalizedSchema(
  schema: OpenAPIV3.SchemaObject,
  source: SchemaRef,
  name?: string
): NormalizedSchema {
  const properties: Record<string, PropertyDef> = {};
  const required: string[] = schema.required || [];

  // Handle allOf by merging all constituent schemas
  if (schema.allOf) {
    const merged = mergeAllOfSchemas(schema.allOf);
    return convertToNormalizedSchema(merged, source, name);
  }

  // Extract and convert properties
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const prop = propSchema as OpenAPISchema;
      const isRequired = required.includes(propName);
      
      if (isRefObject(prop)) {
        // Handle $ref properties
        const refName = prop.$ref.split('/').pop() || 'Unknown';
        properties[propName] = {
          type: { kind: 'ref', name: refName },
          optional: !isRequired,
          nullable: false,
          readonly: false,
          deprecated: false,
        };
      } else {
        // Handle concrete schema properties
        const isNullable = prop.nullable === true;
        const isDeprecated = prop.deprecated === true;
        const isReadonly = prop.readOnly === true;
        const description = prop.description;
        const constraints = extractConstraints(prop);

        properties[propName] = {
          type: convertToNormalizedType(prop),
          optional: !isRequired,
          nullable: isNullable,
          readonly: isReadonly,
          deprecated: isDeprecated,
          description,
          constraints,
        };
      }
    }
  }

  const result: NormalizedSchema = {
    properties,
    required,
    source,
  };

  if (name) {
    result.name = name;
  }

  // Handle additionalProperties
  if (schema.additionalProperties !== undefined) {
    if (typeof schema.additionalProperties === 'boolean') {
      result.additionalProperties = schema.additionalProperties;
    } else {
      result.additionalProperties = convertToNormalizedType(schema.additionalProperties);
    }
  }

  return result;
}

/**
 * Merge allOf schemas into a single combined schema object.
 * 
 * This function flattens allOf arrays by combining properties
 * and required arrays from all constituent schemas.
 * 
 * @param allOf - Array of schemas to merge
 * @returns A single merged schema object
 * 
 * @internal
 */
function mergeAllOfSchemas(allOf: OpenAPISchema[]): OpenAPIV3.SchemaObject {
  const merged: OpenAPIV3.SchemaObject = {
    type: 'object',
    properties: {},
    required: [],
  };

  for (const schema of allOf) {
    if (isRefObject(schema)) {
      // Skip refs in merge - they should be dereferenced already
      continue;
    }

    // Merge properties
    if (schema.properties) {
      merged.properties = { ...merged.properties, ...schema.properties };
    }

    // Merge required arrays
    if (schema.required) {
      merged.required = [...(merged.required || []), ...schema.required];
    }
  }

  return merged;
}

/**
 * Convert an array of OpenAPI parameters to a NormalizedSchema.
 * 
 * This handles path, query, and header parameters, converting
 * each to a property in the resulting schema.
 * 
 * @param parameters - Array of OpenAPI parameter objects
 * @param source - The SchemaRef identifying the source
 * @returns A normalized schema with parameters as properties
 * 
 * @example
 * ```typescript
 * const schema = convertParametersToSchema([
 *   { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
 *   { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } }
 * ], ref);
 * // Properties: { id: { type: number, optional: false }, limit: { type: number, optional: true } }
 * ```
 */
export function convertParametersToSchema(
  parameters: OpenAPIV3.ParameterObject[],
  source: SchemaRef
): NormalizedSchema {
  const properties: Record<string, PropertyDef> = {};
  const required: string[] = [];

  for (const param of parameters) {
    const paramSchema = param.schema as OpenAPISchema | undefined;
    
    if (!paramSchema) {
      // Parameter without schema - treat as any
      properties[param.name] = {
        type: { kind: 'any' },
        optional: !param.required,
        nullable: false,
        readonly: false,
        deprecated: param.deprecated || false,
        description: param.description,
      };
      continue;
    }

    if (isRefObject(paramSchema)) {
      // Handle $ref parameters
      const refName = paramSchema.$ref.split('/').pop() || 'Unknown';
      properties[param.name] = {
        type: { kind: 'ref', name: refName },
        optional: !param.required,
        nullable: false,
        readonly: false,
        deprecated: param.deprecated || false,
        description: param.description,
      };
    } else {
      // Handle concrete schema parameters
      properties[param.name] = {
        type: convertToNormalizedType(paramSchema),
        optional: !param.required,
        nullable: paramSchema.nullable || false,
        readonly: paramSchema.readOnly || false,
        deprecated: param.deprecated || false,
        description: param.description,
        constraints: extractConstraints(paramSchema),
      };
    }

    if (param.required) {
      required.push(param.name);
    }
  }

  return {
    properties,
    required,
    source,
  };
}
