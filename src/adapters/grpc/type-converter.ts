/**
 * Proto Type Converter
 * 
 * Converts protobuf types to NormalizedSchema types.
 */

import type {
  NormalizedSchema,
  NormalizedType,
  PropertyDef,
  SchemaRef,
} from '../../core/types.js';

import type {
  ProtoMessage,
  ProtoField,
  ProtoEnum,
} from './types.js';

/**
 * Well-known Google protobuf types that need special handling
 */
const WELL_KNOWN_TYPES: Record<string, NormalizedType> = {
  'google.protobuf.Timestamp': { kind: 'primitive', value: 'string' },
  'google.protobuf.Duration': { kind: 'primitive', value: 'string' },
  'google.protobuf.Any': { kind: 'any' },
  'google.protobuf.Struct': { kind: 'object', schema: { 
    name: 'Struct', 
    properties: {}, 
    required: [], 
    additionalProperties: { kind: 'any' },
    source: { source: 'grpc', id: 'message:google.protobuf.Struct' } 
  }},
  'google.protobuf.Value': { kind: 'any' },
  'google.protobuf.ListValue': { kind: 'array', element: { kind: 'any' } },
  'google.protobuf.Empty': { kind: 'object', schema: {
    name: 'Empty',
    properties: {},
    required: [],
    source: { source: 'grpc', id: 'message:google.protobuf.Empty' }
  }},
  'google.protobuf.FieldMask': { kind: 'primitive', value: 'string' },
  // Wrapper types - nullable versions of primitives
  'google.protobuf.StringValue': { kind: 'union', variants: [
    { kind: 'primitive', value: 'string' },
    { kind: 'primitive', value: 'null' }
  ]},
  'google.protobuf.Int32Value': { kind: 'union', variants: [
    { kind: 'primitive', value: 'number' },
    { kind: 'primitive', value: 'null' }
  ]},
  'google.protobuf.Int64Value': { kind: 'union', variants: [
    { kind: 'primitive', value: 'number' },
    { kind: 'primitive', value: 'null' }
  ]},
  'google.protobuf.UInt32Value': { kind: 'union', variants: [
    { kind: 'primitive', value: 'number' },
    { kind: 'primitive', value: 'null' }
  ]},
  'google.protobuf.UInt64Value': { kind: 'union', variants: [
    { kind: 'primitive', value: 'number' },
    { kind: 'primitive', value: 'null' }
  ]},
  'google.protobuf.FloatValue': { kind: 'union', variants: [
    { kind: 'primitive', value: 'number' },
    { kind: 'primitive', value: 'null' }
  ]},
  'google.protobuf.DoubleValue': { kind: 'union', variants: [
    { kind: 'primitive', value: 'number' },
    { kind: 'primitive', value: 'null' }
  ]},
  'google.protobuf.BoolValue': { kind: 'union', variants: [
    { kind: 'primitive', value: 'boolean' },
    { kind: 'primitive', value: 'null' }
  ]},
  'google.protobuf.BytesValue': { kind: 'union', variants: [
    { kind: 'primitive', value: 'string' },
    { kind: 'primitive', value: 'null' }
  ]},
};

/**
 * Proto scalar type to NormalizedType mapping
 */
const SCALAR_TYPES: Record<string, NormalizedType> = {
  // Integer types
  'int32': { kind: 'primitive', value: 'number' },
  'int64': { kind: 'primitive', value: 'number' },
  'uint32': { kind: 'primitive', value: 'number' },
  'uint64': { kind: 'primitive', value: 'number' },
  'sint32': { kind: 'primitive', value: 'number' },
  'sint64': { kind: 'primitive', value: 'number' },
  'fixed32': { kind: 'primitive', value: 'number' },
  'fixed64': { kind: 'primitive', value: 'number' },
  'sfixed32': { kind: 'primitive', value: 'number' },
  'sfixed64': { kind: 'primitive', value: 'number' },
  // Floating point
  'float': { kind: 'primitive', value: 'number' },
  'double': { kind: 'primitive', value: 'number' },
  // Boolean
  'bool': { kind: 'primitive', value: 'boolean' },
  // String and bytes
  'string': { kind: 'primitive', value: 'string' },
  'bytes': { kind: 'primitive', value: 'string' }, // Base64 encoded
};

/**
 * Converts protobuf types to NormalizedSchema
 */
export class ProtoTypeConverter {
  private messages: Map<string, ProtoMessage> = new Map();
  private enums: Map<string, ProtoEnum> = new Map();

  /**
   * Register messages for type resolution
   */
  registerMessages(messages: ProtoMessage[]): void {
    for (const msg of messages) {
      this.messages.set(msg.fullName, msg);
      this.messages.set(msg.name, msg);
      
      // Register nested messages
      for (const nested of msg.nestedMessages) {
        this.messages.set(nested.fullName, nested);
        this.messages.set(nested.name, nested);
      }
    }
  }

  /**
   * Register enums for type resolution
   */
  registerEnums(enums: ProtoEnum[]): void {
    for (const e of enums) {
      this.enums.set(e.fullName, e);
      this.enums.set(e.name, e);
    }
  }

  /**
   * Convert a ProtoMessage to NormalizedSchema
   */
  messageToSchema(message: ProtoMessage): NormalizedSchema {
    const properties: Record<string, PropertyDef> = {};
    const required: string[] = [];
    
    // Track which fields are part of oneofs
    const oneofFields = new Set<string>();
    for (const oneof of message.oneofs) {
      for (const fieldName of oneof.fieldNames) {
        oneofFields.add(fieldName);
      }
    }

    // Process regular fields (not in oneofs)
    for (const field of message.fields) {
      if (oneofFields.has(field.name)) {
        continue; // Skip oneof fields, they'll be handled separately
      }
      
      properties[field.name] = this.fieldToPropertyDef(field);
      
      // In proto3, singular fields are not required (have default values)
      // Only fields explicitly marked as optional are considered optional
      if (!field.optional && field.rule !== 'repeated' && field.rule !== 'map') {
        // In proto3, all fields have defaults, but non-optional singular fields
        // are considered "required" in the sense that they always have a value
      }
    }
    
    // Process oneofs as union properties
    for (const oneof of message.oneofs) {
      const variants: NormalizedType[] = [];
      
      for (const fieldName of oneof.fieldNames) {
        const field = message.fields.find(f => f.name === fieldName);
        if (field) {
          // Create an object type for each variant
          const variantType = this.fieldTypeToNormalizedType(field);
          variants.push({
            kind: 'object',
            schema: {
              name: fieldName,
              properties: {
                [fieldName]: {
                  type: variantType,
                  optional: false,
                  nullable: false,
                  readonly: false,
                  deprecated: false,
                }
              },
              required: [fieldName],
              source: { source: 'grpc', id: `message:${message.fullName}:${fieldName}` }
            }
          });
        }
      }
      
      properties[oneof.name] = {
        type: { kind: 'union', variants },
        optional: true, // oneofs are always optional
        nullable: false,
        readonly: false,
        deprecated: false,
      };
    }

    return {
      name: message.name,
      properties,
      required,
      source: { source: 'grpc', id: `message:${message.fullName}` }
    };
  }

  /**
   * Convert a ProtoField to PropertyDef
   */
  private fieldToPropertyDef(field: ProtoField): PropertyDef {
    let type = this.fieldTypeToNormalizedType(field);
    
    return {
      type,
      optional: field.optional,
      nullable: false,
      readonly: false,
      deprecated: false,
    };
  }

  /**
   * Convert a field's type to NormalizedType
   */
  private fieldTypeToNormalizedType(field: ProtoField): NormalizedType {
    // Handle map types
    if (field.rule === 'map' && field.keyType) {
      const valueType = this.resolveTypeName(field.type);
      return {
        kind: 'object',
        schema: {
          name: `Map<${field.keyType}, ${field.type}>`,
          properties: {},
          required: [],
          additionalProperties: valueType,
          source: { source: 'grpc', id: `map:${field.keyType}:${field.type}` }
        }
      };
    }
    
    // Handle repeated types
    if (field.rule === 'repeated') {
      const elementType = this.resolveTypeName(field.type);
      return {
        kind: 'array',
        element: elementType,
      };
    }
    
    // Handle regular types
    return this.resolveTypeName(field.type);
  }

  /**
   * Resolve a type name to NormalizedType
   */
  private resolveTypeName(typeName: string): NormalizedType {
    // Check well-known types first
    if (WELL_KNOWN_TYPES[typeName]) {
      return WELL_KNOWN_TYPES[typeName];
    }
    
    // Check scalar types
    if (SCALAR_TYPES[typeName]) {
      return SCALAR_TYPES[typeName];
    }
    
    // Check if it's a known enum
    const protoEnum = this.enums.get(typeName);
    if (protoEnum) {
      return this.enumToNormalizedType(protoEnum);
    }
    
    // Check if it's a known message
    const protoMessage = this.messages.get(typeName);
    if (protoMessage) {
      // Return a reference type to avoid infinite recursion
      return { kind: 'ref', name: protoMessage.name };
    }
    
    // Unknown type - return as reference
    return { kind: 'ref', name: typeName };
  }

  /**
   * Convert a ProtoEnum to NormalizedType
   */
  enumToNormalizedType(protoEnum: ProtoEnum): NormalizedType {
    const variants: NormalizedType[] = protoEnum.values.map(v => ({
      kind: 'literal' as const,
      value: v.name,
    }));
    
    return {
      kind: 'union',
      variants,
    };
  }
}
