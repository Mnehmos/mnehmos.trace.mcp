/**
 * gRPC/Protobuf Adapter Module
 * 
 * Exports for the gRPC schema adapter.
 */

// Types
export {
  type ProtoFile,
  type ProtoMessage,
  type ProtoField,
  type ProtoEnum,
  type ProtoEnumValue,
  type ProtoService,
  type ProtoMethod,
  type ProtoOneof,
  type StreamingMode,
} from './types.js';

// Parser
export { ProtoParser } from './proto-parser.js';

// Type Converter
export { ProtoTypeConverter } from './type-converter.js';

// Adapter
export { GrpcAdapter } from './adapter.js';
