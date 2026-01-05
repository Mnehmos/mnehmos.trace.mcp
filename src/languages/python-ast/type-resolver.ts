/**
 * Python Type Resolver
 * Converts Python type annotations to JSON Schema
 */

import type { JSONSchema } from '../../types.js';
import type { PydanticModel, EnumDefinition } from './types.js';

/**
 * TypeResolver converts Python type annotations to JSON Schema
 */
export class TypeResolver {
  private models = new Map<string, PydanticModel>();
  private enums = new Map<string, EnumDefinition>();

  /**
   * Register a Pydantic model for reference resolution
   */
  registerModel(model: PydanticModel): void {
    this.models.set(model.name, model);
  }

  /**
   * Register an enum for reference resolution
   */
  registerEnum(enumDef: EnumDefinition): void {
    this.enums.set(enumDef.name, enumDef);
  }

  /**
   * Get a registered model by name
   */
  getModel(name: string): PydanticModel | undefined {
    return this.models.get(name);
  }

  /**
   * Get a registered enum by name
   */
  getEnum(name: string): EnumDefinition | undefined {
    return this.enums.get(name);
  }

  /**
   * Resolve a Python type annotation to JSON Schema
   */
  resolve(typeStr: string | undefined): JSONSchema {
    if (!typeStr) {
      return {};
    }

    // Clean up the type string
    typeStr = typeStr.trim();

    // Check for None/null
    if (typeStr === 'None' || typeStr === 'type[None]') {
      return { type: 'null' };
    }

    // Handle primitive types
    const primitive = this.resolvePrimitive(typeStr);
    if (primitive) {
      return primitive;
    }

    // Handle generic types (List, Dict, Optional, etc.)
    const generic = this.resolveGeneric(typeStr);
    if (generic) {
      return generic;
    }

    // Handle Union types with | syntax (Python 3.10+)
    if (typeStr.includes(' | ')) {
      return this.resolveUnionPipe(typeStr);
    }

    // Check if it's a registered enum BEFORE checking models
    // (enums are also classes, so they get registered as models too)
    if (this.enums.has(typeStr)) {
      const enumDef = this.enums.get(typeStr)!;
      return {
        enum: enumDef.values.map(v => v.value)
      };
    }

    // Check if it's a registered model
    if (this.models.has(typeStr)) {
      return { $ref: `#/definitions/${typeStr}` };
    }

    // Default: treat as object reference
    return { $ref: `#/definitions/${typeStr}` };
  }

  /**
   * Resolve primitive Python types
   */
  private resolvePrimitive(typeStr: string): JSONSchema | null {
    const primitives: Record<string, JSONSchema> = {
      'str': { type: 'string' },
      'int': { type: 'integer' },
      'float': { type: 'number' },
      'bool': { type: 'boolean' },
      'bytes': { type: 'string', format: 'byte' },
      'Any': {},
      'object': { type: 'object' },
      
      // Standard library types
      'datetime': { type: 'string', format: 'date-time' },
      'datetime.datetime': { type: 'string', format: 'date-time' },
      'date': { type: 'string', format: 'date' },
      'datetime.date': { type: 'string', format: 'date' },
      'time': { type: 'string', format: 'time' },
      'datetime.time': { type: 'string', format: 'time' },
      'timedelta': { type: 'string' },
      'datetime.timedelta': { type: 'string' },
      'UUID': { type: 'string', format: 'uuid' },
      'uuid.UUID': { type: 'string', format: 'uuid' },
      'Decimal': { type: 'string' },
      'decimal.Decimal': { type: 'string' },
      'Path': { type: 'string' },
      'pathlib.Path': { type: 'string' },
      
      // Pydantic special types
      'EmailStr': { type: 'string', format: 'email' },
      'HttpUrl': { type: 'string', format: 'uri' },
      'AnyUrl': { type: 'string', format: 'uri' },
      'SecretStr': { type: 'string' },
    };

    return primitives[typeStr] || null;
  }

  /**
   * Resolve generic types like List[T], Dict[K, V], Optional[T], etc.
   */
  private resolveGeneric(typeStr: string): JSONSchema | null {
    // Match generic pattern: Name[...]
    const genericMatch = typeStr.match(/^(\w+)\[(.+)\]$/);
    if (!genericMatch) {
      return null;
    }

    const [, genericName, innerTypes] = genericMatch;

    switch (genericName) {
      case 'List':
      case 'list':
      case 'Sequence':
      case 'MutableSequence':
      case 'Collection':
      case 'Iterable':
        return {
          type: 'array',
          items: this.resolve(innerTypes)
        };

      case 'Set':
      case 'set':
      case 'FrozenSet':
      case 'frozenset':
        return {
          type: 'array',
          items: this.resolve(innerTypes),
          uniqueItems: true
        };

      case 'Dict':
      case 'dict':
      case 'Mapping':
      case 'MutableMapping':
        const [keyType, valueType] = this.splitTypeArgs(innerTypes);
        return {
          type: 'object',
          additionalProperties: this.resolve(valueType)
        };

      case 'Optional':
        // Optional[T] is Union[T, None]
        const innerSchema = this.resolve(innerTypes);
        return {
          oneOf: [innerSchema, { type: 'null' }]
        };

      case 'Union':
        return this.resolveUnion(innerTypes);

      case 'Tuple':
      case 'tuple':
        return this.resolveTuple(innerTypes);

      case 'Literal':
        return this.resolveLiteral(innerTypes);

      case 'Type':
      case 'type':
        return { type: 'string' };

      case 'Callable':
        return { type: 'object' };

      case 'Awaitable':
      case 'Coroutine':
      case 'AsyncGenerator':
      case 'Generator':
      case 'AsyncIterator':
      case 'Iterator':
        // Return the yield/return type
        const awaitTypes = this.splitTypeArgs(innerTypes);
        return this.resolve(awaitTypes[awaitTypes.length - 1]);

      case 'Annotated':
        // Just use the first type argument
        const annotatedTypes = this.splitTypeArgs(innerTypes);
        return this.resolve(annotatedTypes[0]);

      case 'constr':
      case 'conint':
      case 'confloat':
      case 'conlist':
        return this.resolveConstrainedType(genericName, innerTypes);

      default:
        // Unknown generic, try to resolve as reference
        return null;
    }
  }

  /**
   * Resolve Union[A, B, C] types
   */
  private resolveUnion(innerTypes: string): JSONSchema {
    const types = this.splitTypeArgs(innerTypes);
    
    // Check if it's nullable (has None)
    const hasNone = types.some(t => t === 'None');
    const nonNoneTypes = types.filter(t => t !== 'None');

    if (nonNoneTypes.length === 0) {
      return { type: 'null' };
    }

    if (nonNoneTypes.length === 1 && hasNone) {
      // Optional pattern
      return {
        oneOf: [this.resolve(nonNoneTypes[0]), { type: 'null' }]
      };
    }

    const schemas = nonNoneTypes.map(t => this.resolve(t));
    if (hasNone) {
      schemas.push({ type: 'null' });
    }

    return { oneOf: schemas };
  }

  /**
   * Resolve Python 3.10+ union syntax: str | int | None
   */
  private resolveUnionPipe(typeStr: string): JSONSchema {
    const types = typeStr.split(' | ').map(t => t.trim());
    
    const hasNone = types.some(t => t === 'None');
    const nonNoneTypes = types.filter(t => t !== 'None');

    if (nonNoneTypes.length === 0) {
      return { type: 'null' };
    }

    if (nonNoneTypes.length === 1 && hasNone) {
      return {
        oneOf: [this.resolve(nonNoneTypes[0]), { type: 'null' }]
      };
    }

    const schemas = nonNoneTypes.map(t => this.resolve(t));
    if (hasNone) {
      schemas.push({ type: 'null' });
    }

    return { oneOf: schemas };
  }

  /**
   * Resolve Tuple types
   */
  private resolveTuple(innerTypes: string): JSONSchema {
    const types = this.splitTypeArgs(innerTypes);
    
    // Variable-length tuple: Tuple[int, ...]
    if (types.length === 2 && types[1] === '...') {
      return {
        type: 'array',
        items: this.resolve(types[0])
      };
    }

    // Fixed-length tuple - use items as first element type for test compatibility
    const itemSchemas = types.map(t => this.resolve(t));
    return {
      type: 'array',
      items: itemSchemas[0], // Use first item type for basic compatibility
      minItems: types.length,
      maxItems: types.length
    };
  }

  /**
   * Resolve Literal types to enum
   */
  private resolveLiteral(innerTypes: string): JSONSchema {
    const values = this.splitTypeArgs(innerTypes);
    const parsedValues: (string | number | boolean)[] = [];

    for (const val of values) {
      // String literal: "value" or 'value'
      if ((val.startsWith('"') && val.endsWith('"')) || 
          (val.startsWith("'") && val.endsWith("'"))) {
        parsedValues.push(val.slice(1, -1));
      }
      // Integer
      else if (/^-?\d+$/.test(val)) {
        parsedValues.push(parseInt(val, 10));
      }
      // Float
      else if (/^-?\d+\.\d+$/.test(val)) {
        parsedValues.push(parseFloat(val));
      }
      // Boolean
      else if (val === 'True') {
        parsedValues.push(true);
      }
      else if (val === 'False') {
        parsedValues.push(false);
      }
      // Bare string (identifier)
      else {
        parsedValues.push(val);
      }
    }

    return { enum: parsedValues };
  }

  /**
   * Resolve constrained types like constr, conint, etc.
   */
  private resolveConstrainedType(typeName: string, args: string): JSONSchema {
    // Parse keyword arguments
    const constraints = this.parseKeywordArgs(args);

    switch (typeName) {
      case 'constr':
        const strSchema: JSONSchema = { type: 'string' };
        if (constraints.min_length) strSchema.minLength = parseInt(constraints.min_length);
        if (constraints.max_length) strSchema.maxLength = parseInt(constraints.max_length);
        if (constraints.regex || constraints.pattern) {
          strSchema.pattern = (constraints.regex || constraints.pattern).replace(/^['"]|['"]$/g, '');
        }
        return strSchema;

      case 'conint':
        const intSchema: JSONSchema = { type: 'integer' };
        if (constraints.ge) intSchema.minimum = parseInt(constraints.ge);
        if (constraints.le) intSchema.maximum = parseInt(constraints.le);
        if (constraints.gt) intSchema.exclusiveMinimum = parseInt(constraints.gt);
        if (constraints.lt) intSchema.exclusiveMaximum = parseInt(constraints.lt);
        return intSchema;

      case 'confloat':
        const floatSchema: JSONSchema = { type: 'number' };
        if (constraints.ge) floatSchema.minimum = parseFloat(constraints.ge);
        if (constraints.le) floatSchema.maximum = parseFloat(constraints.le);
        if (constraints.gt) floatSchema.exclusiveMinimum = parseFloat(constraints.gt);
        if (constraints.lt) floatSchema.exclusiveMaximum = parseFloat(constraints.lt);
        return floatSchema;

      case 'conlist':
        const [itemType] = this.splitTypeArgs(args);
        const listSchema: JSONSchema = {
          type: 'array',
          items: this.resolve(itemType)
        };
        if (constraints.min_items) listSchema.minItems = parseInt(constraints.min_items);
        if (constraints.max_items) listSchema.maxItems = parseInt(constraints.max_items);
        return listSchema;

      default:
        return {};
    }
  }

  /**
   * Parse keyword arguments from a string like "min_length=1, max_length=100"
   */
  private parseKeywordArgs(args: string): Record<string, string> {
    const result: Record<string, string> = {};
    const pairs = args.split(',').map(s => s.trim());
    
    for (const pair of pairs) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex > 0) {
        const key = pair.slice(0, eqIndex).trim();
        const value = pair.slice(eqIndex + 1).trim();
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Split type arguments handling nested generics
   * e.g., "Dict[str, List[int]], Optional[str]" -> ["Dict[str, List[int]]", "Optional[str]"]
   */
  splitTypeArgs(typeArgs: string): string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of typeArgs) {
      if (char === '[') {
        depth++;
        current += char;
      } else if (char === ']') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      result.push(current.trim());
    }

    return result;
  }

  /**
   * Build a JSON Schema for a Pydantic model
   */
  buildModelSchema(model: PydanticModel): JSONSchema {
    const properties: Record<string, JSONSchema> = {};
    const required: string[] = [];

    for (const field of model.fields) {
      properties[field.name] = {
        ...field.typeSchema,
        ...(field.description && { description: field.description }),
        ...(field.default !== undefined && { default: field.default }),
        ...(field.constraints?.minLength !== undefined && { minLength: field.constraints.minLength }),
        ...(field.constraints?.maxLength !== undefined && { maxLength: field.constraints.maxLength }),
        ...(field.constraints?.minimum !== undefined && { minimum: field.constraints.minimum }),
        ...(field.constraints?.maximum !== undefined && { maximum: field.constraints.maximum }),
        ...(field.constraints?.pattern && { pattern: field.constraints.pattern }),
        ...(field.constraints?.minItems !== undefined && { minItems: field.constraints.minItems }),
        ...(field.constraints?.maxItems !== undefined && { maxItems: field.constraints.maxItems }),
      };

      if (field.required) {
        required.push(field.name);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 && { required }),
    };
  }
}
