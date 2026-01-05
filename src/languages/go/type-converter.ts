/**
 * Go Type Converter
 * Converts Go types to JSON Schema / NormalizedSchema types
 */

import type { GoProperty, GoStruct, GoSchema, GoTypeAlias } from './types.js';

/**
 * Map of known type aliases found in the source
 */
const builtinAliases: Record<string, string> = {
  // Standard aliases
  byte: 'uint8',
  rune: 'int32',
  any: 'interface{}',
};

/**
 * Convert a Go type string to a JSON Schema property
 */
export function convertGoType(
  goType: string,
  typeAliases: Map<string, string> = new Map()
): GoProperty {
  // Remove leading/trailing whitespace
  goType = goType.trim();

  // Check for pointer type
  if (goType.startsWith('*')) {
    const innerType = goType.slice(1);
    const inner = convertGoType(innerType, typeAliases);
    return {
      ...inner,
      nullable: true,
    };
  }

  // Check for double pointer (treat same as pointer)
  if (goType.startsWith('**')) {
    const innerType = goType.slice(2);
    const inner = convertGoType(innerType, typeAliases);
    return {
      ...inner,
      nullable: true,
    };
  }

  // Check for slice type
  if (goType.startsWith('[]')) {
    const elementType = goType.slice(2);

    // Special case: []byte is typically base64 encoded string
    if (elementType === 'byte') {
      return { type: 'string', format: 'byte' };
    }

    return {
      type: 'array',
      items: convertGoType(elementType, typeAliases),
    };
  }

  // Check for fixed-size array type [n]T
  const arrayMatch = goType.match(/^\[(\d+)\](.+)$/);
  if (arrayMatch) {
    const elementType = arrayMatch[2];
    // Treat as regular array in JSON Schema
    return {
      type: 'array',
      items: convertGoType(elementType, typeAliases),
    };
  }

  // Check for map type
  const mapMatch = goType.match(/^map\[([^\]]+)\](.+)$/);
  if (mapMatch) {
    const valueType = mapMatch[2];
    return {
      type: 'object',
      additionalProperties: convertGoType(valueType, typeAliases),
    };
  }

  // Check for type alias
  const resolvedType = typeAliases.get(goType) || builtinAliases[goType];
  if (resolvedType) {
    return convertGoType(resolvedType, typeAliases);
  }

  // Check for interface{} / any
  if (goType === 'interface{}' || goType === 'any') {
    return {}; // Any type - no constraints
  }

  // Check for time.Time
  if (goType === 'time.Time') {
    return { type: 'string', format: 'date-time' };
  }

  // Check for time.Duration
  if (goType === 'time.Duration') {
    return { type: 'integer' };
  }

  // Check for json.RawMessage
  if (goType === 'json.RawMessage') {
    return {}; // Any JSON value
  }

  // Check for json.Number
  if (goType === 'json.Number') {
    return { type: 'string' }; // json.Number is a string that can be parsed as number
  }

  // Primitive types
  switch (goType) {
    // String types
    case 'string':
      return { type: 'string' };

    // Boolean
    case 'bool':
      return { type: 'boolean' };

    // Integer types (signed)
    case 'int':
    case 'int8':
    case 'int16':
    case 'int32':
    case 'int64':
      return { type: 'integer' };

    // Integer types (unsigned)
    case 'uint':
    case 'uint8':
    case 'uint16':
    case 'uint32':
    case 'uint64':
    case 'uintptr':
      return { type: 'integer' };

    // Floating point
    case 'float32':
    case 'float64':
      return { type: 'number' };

    // Complex types (not typically JSON serializable)
    case 'complex64':
    case 'complex128':
      return { type: 'object' };

    // Unknown type - treat as reference to another struct
    default:
      // If it contains a dot, it's a package-qualified type
      if (goType.includes('.')) {
        // Could be a known stdlib type or external type
        return { type: 'object' };
      }
      // Otherwise it's likely a reference to another struct
      return { type: 'object' };
  }
}

/**
 * TypeConverter class for stateful type conversion operations
 */
export class TypeConverter {
  private typeAliases: Map<string, string> = new Map();

  /**
   * Register a type alias
   */
  registerAlias(alias: GoTypeAlias): void {
    this.typeAliases.set(alias.name, alias.underlyingType);
  }

  /**
   * Register multiple type aliases
   */
  registerAliases(aliases: GoTypeAlias[]): void {
    for (const alias of aliases) {
      this.registerAlias(alias);
    }
  }

  /**
   * Convert a Go type to JSON Schema property
   */
  convert(goType: string): GoProperty {
    return convertGoType(goType, this.typeAliases);
  }

  /**
   * Convert a GoStruct to a GoSchema
   */
  structToSchema(struct: GoStruct, allStructs?: Map<string, GoStruct>): GoSchema {
    const properties: Record<string, GoProperty> = {};
    const required: string[] = [];

    // Process embedded types first if we have access to all structs
    if (allStructs) {
      for (const embeddedName of struct.embeddedTypes) {
        const baseName = embeddedName.replace(/^\*/, ''); // Remove pointer prefix
        const embeddedStruct = allStructs.get(baseName);
        if (embeddedStruct) {
          // Merge embedded struct fields
          for (const field of embeddedStruct.fields) {
            if (field.skip) continue;
            const prop = this.convert(field.goType);
            if (field.description) {
              prop.description = field.description;
            }
            properties[field.jsonName] = prop;
            // Embedded fields are never required by themselves
          }
        }
      }
    }

    // Process direct fields (may override embedded fields)
    for (const field of struct.fields) {
      if (field.skip) continue;

      const prop = this.convert(field.goType);
      if (field.description) {
        prop.description = field.description;
      }
      properties[field.jsonName] = prop;

      // Field is required if it doesn't have omitempty AND
      // (has validate:"required" OR doesn't have omitempty)
      if (!field.omitempty) {
        // For validation, only add to required if validate:"required" is present
        // OR if there's no omitempty and it's a request struct (heuristic)
        if (field.validateRequired) {
          required.push(field.jsonName);
        } else if (!field.omitempty) {
          // For CreateUserRequest-style structs, non-omitempty fields are required
          // But we need to check if validateRequired is explicitly set
          if (struct.name.includes('Request') || struct.name.includes('Input')) {
            // For request/input structs, fields without omitempty are required
            if (!field.omitempty && field.jsonName) {
              required.push(field.jsonName);
            }
          }
        }
      }
    }

    return {
      name: struct.name,
      type: 'object',
      description: struct.description,
      properties,
      required, // Always include required array for consistent checking
      sourceLocation: struct.sourceLocation,
    };
  }
}
