/**
 * gRPC/Protobuf Type Definitions
 * 
 * Types for representing parsed protobuf structures.
 */

/**
 * Streaming mode for RPC methods
 */
export type StreamingMode = 'unary' | 'server_streaming' | 'client_streaming' | 'bidirectional';

/**
 * Represents a parsed .proto file
 */
export interface ProtoFile {
  path: string;
  syntax: string;
  package: string | null;
  imports: string[];
  messages: ProtoMessage[];
  enums: ProtoEnum[];
  services: ProtoService[];
}

/**
 * Represents a protobuf message definition
 */
export interface ProtoMessage {
  name: string;
  fullName: string;
  fields: ProtoField[];
  nestedMessages: ProtoMessage[];
  nestedEnums: ProtoEnum[];
  oneofs: ProtoOneof[];
}

/**
 * Represents a field in a protobuf message
 */
export interface ProtoField {
  name: string;
  type: string;
  number: number;
  rule?: 'repeated' | 'map' | 'optional';
  optional: boolean;
  keyType?: string; // For map fields
  oneofName?: string; // If part of a oneof
}

/**
 * Represents a protobuf enum definition
 */
export interface ProtoEnum {
  name: string;
  fullName: string;
  values: ProtoEnumValue[];
}

/**
 * Represents a value in a protobuf enum
 */
export interface ProtoEnumValue {
  name: string;
  number: number;
}

/**
 * Represents a oneof group in a protobuf message
 */
export interface ProtoOneof {
  name: string;
  fieldNames: string[];
}

/**
 * Represents a protobuf service definition
 */
export interface ProtoService {
  name: string;
  fullName: string;
  methods: ProtoMethod[];
}

/**
 * Represents an RPC method in a protobuf service
 */
export interface ProtoMethod {
  name: string;
  requestType: string;
  responseType: string;
  clientStreaming: boolean;
  serverStreaming: boolean;
}
