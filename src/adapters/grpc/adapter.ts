/**
 * gRPC Adapter
 * 
 * Schema adapter for gRPC/Protobuf files.
 */

import type {
  SchemaAdapter,
  SchemaRef,
  NormalizedSchema,
  PropertyDef,
  NormalizedType,
} from '../../core/types.js';

import { ProtoParser } from './proto-parser.js';
import { ProtoTypeConverter } from './type-converter.js';
import type { ProtoFile, ProtoService, ProtoMessage, ProtoMethod, StreamingMode } from './types.js';

/**
 * Valid gRPC schema ref types
 */
type GrpcRefType = 'message' | 'enum' | 'service';

/**
 * Parsed gRPC ref id
 */
interface ParsedGrpcRef {
  type: GrpcRefType;
  fullName: string;
  methodName?: string;
}

/**
 * gRPC Schema Adapter
 */
export class GrpcAdapter implements SchemaAdapter {
  readonly kind = 'grpc' as const;
  
  private parser: ProtoParser;
  private converter: ProtoTypeConverter;
  
  constructor() {
    this.parser = new ProtoParser();
    this.converter = new ProtoTypeConverter();
  }

  /**
   * Check if this adapter supports the given schema reference
   */
  supports(ref: SchemaRef): boolean {
    if (ref.source !== 'grpc') {
      return false;
    }
    
    const parsed = this.parseRefId(ref.id);
    return parsed !== null;
  }

  /**
   * Extract a schema from a gRPC ref
   */
  async extract(ref: SchemaRef): Promise<NormalizedSchema> {
    const path = ref.options?.path as string | undefined;
    if (!path) {
      throw new Error('gRPC adapter requires a path option');
    }
    
    const parsed = this.parseRefId(ref.id);
    if (!parsed) {
      throw new Error(`Invalid gRPC ref id: ${ref.id}`);
    }
    
    const protoFile = await this.parser.parseFile(path);
    
    // Register all messages and enums for type resolution
    this.converter.registerMessages(protoFile.messages);
    this.converter.registerEnums(protoFile.enums);
    
    // Also register nested enums from messages
    for (const msg of protoFile.messages) {
      this.converter.registerEnums(msg.nestedEnums);
      for (const nestedMsg of msg.nestedMessages) {
        this.converter.registerEnums(nestedMsg.nestedEnums);
      }
    }
    
    switch (parsed.type) {
      case 'message':
        return this.extractMessageSchema(protoFile, parsed.fullName, ref);
        
      case 'enum':
        return this.extractEnumSchema(protoFile, parsed.fullName, ref);
        
      case 'service':
        if (parsed.methodName) {
          return this.extractMethodSchema(protoFile, parsed.fullName, parsed.methodName, ref);
        }
        return this.extractServiceSchema(protoFile, parsed.fullName, ref);
        
      default:
        throw new Error(`Unsupported gRPC ref type: ${parsed.type}`);
    }
  }

  /**
   * List all available schemas in a proto file
   */
  async list(basePath: string): Promise<SchemaRef[]> {
    try {
      const protoFile = await this.parser.parseFile(basePath);
      const refs: SchemaRef[] = [];
      
      // List all messages
      for (const msg of protoFile.messages) {
        refs.push({
          source: 'grpc',
          id: `message:${msg.fullName}`,
          options: { path: basePath },
        });
        
        // Add nested messages
        for (const nested of msg.nestedMessages) {
          refs.push({
            source: 'grpc',
            id: `message:${nested.fullName}`,
            options: { path: basePath },
          });
        }
      }
      
      // List all enums
      for (const e of protoFile.enums) {
        refs.push({
          source: 'grpc',
          id: `enum:${e.fullName}`,
          options: { path: basePath },
        });
      }
      
      // List all services
      for (const svc of protoFile.services) {
        refs.push({
          source: 'grpc',
          id: `service:${svc.fullName}`,
          options: { path: basePath },
        });
      }
      
      return refs;
    } catch {
      // Return empty array for non-existent or invalid files
      return [];
    }
  }

  /**
   * Parse a gRPC ref id
   */
  private parseRefId(id: string): ParsedGrpcRef | null {
    // Format: type:fullName or type:fullName:methodName
    const match = id.match(/^(message|enum|service):([^:]+)(?::(.+))?$/);
    if (!match) {
      return null;
    }
    
    return {
      type: match[1] as GrpcRefType,
      fullName: match[2],
      methodName: match[3],
    };
  }

  /**
   * Extract message schema
   */
  private extractMessageSchema(
    protoFile: ProtoFile,
    fullName: string,
    ref: SchemaRef
  ): NormalizedSchema {
    const message = this.findMessage(protoFile, fullName);
    if (!message) {
      throw new Error(`Message not found: ${fullName}`);
    }
    
    const schema = this.converter.messageToSchema(message);
    schema.source = ref;
    
    return schema;
  }

  /**
   * Extract enum schema
   */
  private extractEnumSchema(
    protoFile: ProtoFile,
    fullName: string,
    ref: SchemaRef
  ): NormalizedSchema {
    const protoEnum = this.findEnum(protoFile, fullName);
    if (!protoEnum) {
      throw new Error(`Enum not found: ${fullName}`);
    }
    
    const enumType = this.converter.enumToNormalizedType(protoEnum);
    
    return {
      name: protoEnum.name,
      properties: {
        value: {
          type: enumType,
          optional: false,
          nullable: false,
          readonly: false,
          deprecated: false,
        }
      },
      required: ['value'],
      source: ref,
    };
  }

  /**
   * Extract service schema (all methods)
   */
  private extractServiceSchema(
    protoFile: ProtoFile,
    fullName: string,
    ref: SchemaRef
  ): NormalizedSchema {
    const service = this.findService(protoFile, fullName);
    if (!service) {
      throw new Error(`Service not found: ${fullName}`);
    }
    
    const properties: Record<string, PropertyDef> = {};
    
    for (const method of service.methods) {
      properties[method.name] = {
        type: this.methodToType(method),
        optional: false,
        nullable: false,
        readonly: false,
        deprecated: false,
      };
    }
    
    return {
      name: service.name,
      properties,
      required: Object.keys(properties),
      source: ref,
    };
  }

  /**
   * Extract specific method schema
   */
  private extractMethodSchema(
    protoFile: ProtoFile,
    serviceFullName: string,
    methodName: string,
    ref: SchemaRef
  ): NormalizedSchema {
    const service = this.findService(protoFile, serviceFullName);
    if (!service) {
      throw new Error(`Service not found: ${serviceFullName}`);
    }
    
    const method = service.methods.find(m => m.name === methodName);
    if (!method) {
      throw new Error(`Method not found: ${methodName} in ${serviceFullName}`);
    }
    
    const streamingMode = this.getStreamingMode(method);
    
    return {
      name: `${service.name}.${method.name}`,
      properties: {
        request: {
          type: { kind: 'ref', name: method.requestType },
          optional: false,
          nullable: false,
          readonly: false,
          deprecated: false,
        },
        response: {
          type: { kind: 'ref', name: method.responseType },
          optional: false,
          nullable: false,
          readonly: false,
          deprecated: false,
        },
        streaming: {
          type: { kind: 'literal', value: streamingMode },
          optional: false,
          nullable: false,
          readonly: false,
          deprecated: false,
        },
      },
      required: ['request', 'response', 'streaming'],
      source: ref,
    };
  }

  /**
   * Convert a method to a type
   */
  private methodToType(method: ProtoMethod): NormalizedType {
    const streamingMode = this.getStreamingMode(method);
    
    return {
      kind: 'object',
      schema: {
        name: method.name,
        properties: {
          request: {
            type: { kind: 'ref', name: method.requestType },
            optional: false,
            nullable: false,
            readonly: false,
            deprecated: false,
          },
          response: {
            type: { kind: 'ref', name: method.responseType },
            optional: false,
            nullable: false,
            readonly: false,
            deprecated: false,
          },
          streaming: {
            type: { kind: 'literal', value: streamingMode },
            optional: false,
            nullable: false,
            readonly: false,
            deprecated: false,
          },
        },
        required: ['request', 'response', 'streaming'],
        source: { source: 'grpc', id: `method:${method.name}` },
      },
    };
  }

  /**
   * Get the streaming mode of a method
   */
  private getStreamingMode(method: ProtoMethod): StreamingMode {
    if (method.clientStreaming && method.serverStreaming) {
      return 'bidirectional';
    } else if (method.clientStreaming) {
      return 'client_streaming';
    } else if (method.serverStreaming) {
      return 'server_streaming';
    }
    return 'unary';
  }

  /**
   * Find a message by full name or short name
   */
  private findMessage(protoFile: ProtoFile, name: string): ProtoMessage | undefined {
    // Try exact match first
    for (const msg of protoFile.messages) {
      if (msg.fullName === name || msg.name === name) {
        return msg;
      }
      
      // Check nested messages
      const nested = this.findNestedMessage(msg, name);
      if (nested) {
        return nested;
      }
    }
    
    return undefined;
  }

  /**
   * Find a nested message
   */
  private findNestedMessage(parent: ProtoMessage, name: string): ProtoMessage | undefined {
    for (const nested of parent.nestedMessages) {
      if (nested.fullName === name || nested.name === name) {
        return nested;
      }
      
      const deeper = this.findNestedMessage(nested, name);
      if (deeper) {
        return deeper;
      }
    }
    
    return undefined;
  }

  /**
   * Find an enum by full name or short name
   */
  private findEnum(protoFile: ProtoFile, name: string): import('./types.js').ProtoEnum | undefined {
    // Check top-level enums
    for (const e of protoFile.enums) {
      if (e.fullName === name || e.name === name) {
        return e;
      }
    }
    
    // Check nested enums in messages
    for (const msg of protoFile.messages) {
      const nested = this.findNestedEnum(msg, name);
      if (nested) {
        return nested;
      }
    }
    
    return undefined;
  }

  /**
   * Find a nested enum
   */
  private findNestedEnum(parent: ProtoMessage, name: string): import('./types.js').ProtoEnum | undefined {
    for (const e of parent.nestedEnums) {
      if (e.fullName === name || e.name === name) {
        return e;
      }
    }
    
    for (const nested of parent.nestedMessages) {
      const found = this.findNestedEnum(nested, name);
      if (found) {
        return found;
      }
    }
    
    return undefined;
  }

  /**
   * Find a service by full name or short name
   */
  private findService(protoFile: ProtoFile, name: string): ProtoService | undefined {
    for (const svc of protoFile.services) {
      if (svc.fullName === name || svc.name === name) {
        return svc;
      }
    }
    
    return undefined;
  }
}
