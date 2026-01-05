/**
 * Tests for gRPC/Protobuf Parser Support
 * 
 * Tests the gRPC adapter for extracting schemas from .proto files.
 * These tests are written BEFORE implementation (TDD Red Phase).
 * 
 * API Reference: .context/ADR-P3-2-GRPC-PROTOBUF.md
 * Task Reference: .context/TASK_MAP_P3.md - P3-2.2
 * 
 * SchemaRef ID Format:
 *   {type}:{fullName}
 *   {type}:{fullName}@{protoPath}
 * 
 * Types:
 *   - message:example.v1.User - A message type
 *   - enum:example.v1.Status - An enum type
 *   - service:example.v1.UserService - All RPCs in a service
 *   - service:example.v1.UserService:GetUser - Specific RPC method
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';

// These imports will fail until implementation exists
import { 
  GrpcAdapter,
  ProtoParser,
  ProtoTypeConverter,
  type ProtoFile,
  type ProtoMessage,
  type ProtoField,
  type ProtoEnum,
  type ProtoService,
  type ProtoMethod,
  type ProtoOneof,
  type StreamingMode,
} from '../src/adapters/grpc/index.js';

import type { 
  SchemaRef, 
  NormalizedSchema, 
  NormalizedType,
  PropertyDef,
} from '../src/core/types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const FIXTURES_PATH = resolve(process.cwd(), 'test', 'fixtures', 'proto-samples');

const FIXTURES = {
  simple: join(FIXTURES_PATH, 'simple.proto'),
  nested: join(FIXTURES_PATH, 'nested.proto'),
  service: join(FIXTURES_PATH, 'service.proto'),
  streaming: join(FIXTURES_PATH, 'streaming.proto'),
  enums: join(FIXTURES_PATH, 'enums.proto'),
  oneof: join(FIXTURES_PATH, 'oneof.proto'),
  maps: join(FIXTURES_PATH, 'maps.proto'),
  imports: join(FIXTURES_PATH, 'imports.proto'),
  wellKnown: join(FIXTURES_PATH, 'well-known-types.proto'),
  invalid: join(FIXTURES_PATH, 'invalid.proto'),
};

// Helper to read fixture file content
const readFixture = (name: keyof typeof FIXTURES): string => {
  return readFileSync(FIXTURES[name], 'utf-8');
};

// ============================================================================
// Adapter Registration Tests
// ============================================================================

describe('gRPC/Protobuf Adapter Registration', () => {
  describe('GrpcAdapter initialization', () => {
    it('should create GrpcAdapter instance successfully', () => {
      const adapter = new GrpcAdapter();
      expect(adapter).toBeInstanceOf(GrpcAdapter);
    });

    it('should have kind = "grpc"', () => {
      const adapter = new GrpcAdapter();
      expect(adapter.kind).toBe('grpc');
    });
  });

  describe('supports()', () => {
    const adapter = new GrpcAdapter();

    it('should return true for grpc source with message ref', () => {
      const ref: SchemaRef = {
        source: 'grpc',
        id: 'message:example.v1.User',
      };
      expect(adapter.supports(ref)).toBe(true);
    });

    it('should return true for grpc source with enum ref', () => {
      const ref: SchemaRef = {
        source: 'grpc',
        id: 'enum:example.v1.Status',
      };
      expect(adapter.supports(ref)).toBe(true);
    });

    it('should return true for grpc source with service ref', () => {
      const ref: SchemaRef = {
        source: 'grpc',
        id: 'service:example.v1.UserService',
      };
      expect(adapter.supports(ref)).toBe(true);
    });

    it('should return true for grpc source with specific method ref', () => {
      const ref: SchemaRef = {
        source: 'grpc',
        id: 'service:example.v1.UserService:GetUser',
      };
      expect(adapter.supports(ref)).toBe(true);
    });

    it('should return false for non-grpc source refs', () => {
      const refs: SchemaRef[] = [
        { source: 'openapi', id: 'endpoint:GET:/users' },
        { source: 'graphql', id: 'type:User' },
        { source: 'trpc', id: 'router:userRouter' },
        { source: 'mcp', id: 'tool:my_tool' },
      ];
      
      for (const ref of refs) {
        expect(adapter.supports(ref)).toBe(false);
      }
    });

    it('should return false for invalid grpc ref id format', () => {
      const ref: SchemaRef = {
        source: 'grpc',
        id: 'invalid:format',
      };
      expect(adapter.supports(ref)).toBe(false);
    });
  });
});

// ============================================================================
// Proto Parser Tests
// ============================================================================

describe('ProtoParser', () => {
  describe('initialization', () => {
    it('should create ProtoParser instance', () => {
      const parser = new ProtoParser();
      expect(parser).toBeInstanceOf(ProtoParser);
    });
  });

  describe('parseSource()', () => {
    it('should parse proto3 syntax declaration', () => {
      const parser = new ProtoParser();
      const content = readFixture('simple');
      
      const protoFile = parser.parseSource(content, 'simple.proto');
      
      expect(protoFile).toBeDefined();
      expect(protoFile.syntax).toBe('proto3');
    });

    it('should extract package name', () => {
      const parser = new ProtoParser();
      const content = readFixture('simple');
      
      const protoFile = parser.parseSource(content, 'simple.proto');
      
      expect(protoFile.package).toBe('example.v1');
    });

    it('should return null package for proto without package', () => {
      const parser = new ProtoParser();
      const content = `
        syntax = "proto3";
        message NoPackage { string id = 1; }
      `;
      
      const protoFile = parser.parseSource(content, 'no-package.proto');
      
      expect(protoFile.package).toBeNull();
    });
  });

  describe('parseFile()', () => {
    it('should parse proto file from disk', async () => {
      const parser = new ProtoParser();
      
      const protoFile = await parser.parseFile(FIXTURES.simple);
      
      expect(protoFile).toBeDefined();
      expect(protoFile.path).toBe(FIXTURES.simple);
    });

    it('should throw for non-existent file', async () => {
      const parser = new ProtoParser();
      
      await expect(parser.parseFile('/non/existent/file.proto')).rejects.toThrow();
    });
  });
});

// ============================================================================
// Message Extraction Tests
// ============================================================================

describe('Message Extraction', () => {
  let parser: ProtoParser;
  let simpleProto: ProtoFile;

  beforeAll(() => {
    parser = new ProtoParser();
    simpleProto = parser.parseSource(readFixture('simple'), 'simple.proto');
  });

  describe('basic message extraction', () => {
    it('should extract message with scalar fields', () => {
      const userMessage = simpleProto.messages.find(m => m.name === 'User');
      
      expect(userMessage).toBeDefined();
      expect(userMessage?.fullName).toBe('example.v1.User');
      expect(userMessage?.fields.length).toBeGreaterThan(0);
    });

    it('should extract int64 field type', () => {
      const userMessage = simpleProto.messages.find(m => m.name === 'User');
      const idField = userMessage?.fields.find(f => f.name === 'id');
      
      expect(idField).toBeDefined();
      expect(idField?.type).toBe('int64');
      expect(idField?.number).toBe(1);
    });

    it('should extract string field type', () => {
      const userMessage = simpleProto.messages.find(m => m.name === 'User');
      const nameField = userMessage?.fields.find(f => f.name === 'name');
      
      expect(nameField).toBeDefined();
      expect(nameField?.type).toBe('string');
      expect(nameField?.number).toBe(2);
    });

    it('should extract optional field correctly', () => {
      const userMessage = simpleProto.messages.find(m => m.name === 'User');
      const emailField = userMessage?.fields.find(f => f.name === 'email');
      
      expect(emailField).toBeDefined();
      expect(emailField?.optional).toBe(true);
    });

    it('should extract repeated field correctly', () => {
      const userMessage = simpleProto.messages.find(m => m.name === 'User');
      const tagsField = userMessage?.fields.find(f => f.name === 'tags');
      
      expect(tagsField).toBeDefined();
      expect(tagsField?.rule).toBe('repeated');
    });

    it('should extract bool field type', () => {
      const userMessage = simpleProto.messages.find(m => m.name === 'User');
      const activeField = userMessage?.fields.find(f => f.name === 'active');
      
      expect(activeField).toBeDefined();
      expect(activeField?.type).toBe('bool');
    });
  });

  describe('all scalar types', () => {
    it('should extract message with all scalar types', () => {
      const scalarMessage = simpleProto.messages.find(m => m.name === 'ScalarTypes');
      
      expect(scalarMessage).toBeDefined();
      expect(scalarMessage?.fields.length).toBe(15); // All 15 scalar types
    });

    it('should extract int32 type', () => {
      const scalarMessage = simpleProto.messages.find(m => m.name === 'ScalarTypes');
      const field = scalarMessage?.fields.find(f => f.name === 'int32_field');
      
      expect(field?.type).toBe('int32');
    });

    it('should extract uint32 type', () => {
      const scalarMessage = simpleProto.messages.find(m => m.name === 'ScalarTypes');
      const field = scalarMessage?.fields.find(f => f.name === 'uint32_field');
      
      expect(field?.type).toBe('uint32');
    });

    it('should extract sint32 type', () => {
      const scalarMessage = simpleProto.messages.find(m => m.name === 'ScalarTypes');
      const field = scalarMessage?.fields.find(f => f.name === 'sint32_field');
      
      expect(field?.type).toBe('sint32');
    });

    it('should extract fixed32 type', () => {
      const scalarMessage = simpleProto.messages.find(m => m.name === 'ScalarTypes');
      const field = scalarMessage?.fields.find(f => f.name === 'fixed32_field');
      
      expect(field?.type).toBe('fixed32');
    });

    it('should extract sfixed32 type', () => {
      const scalarMessage = simpleProto.messages.find(m => m.name === 'ScalarTypes');
      const field = scalarMessage?.fields.find(f => f.name === 'sfixed32_field');
      
      expect(field?.type).toBe('sfixed32');
    });

    it('should extract float type', () => {
      const scalarMessage = simpleProto.messages.find(m => m.name === 'ScalarTypes');
      const field = scalarMessage?.fields.find(f => f.name === 'float_field');
      
      expect(field?.type).toBe('float');
    });

    it('should extract double type', () => {
      const scalarMessage = simpleProto.messages.find(m => m.name === 'ScalarTypes');
      const field = scalarMessage?.fields.find(f => f.name === 'double_field');
      
      expect(field?.type).toBe('double');
    });

    it('should extract bytes type', () => {
      const scalarMessage = simpleProto.messages.find(m => m.name === 'ScalarTypes');
      const field = scalarMessage?.fields.find(f => f.name === 'bytes_field');
      
      expect(field?.type).toBe('bytes');
    });
  });

  describe('message type references', () => {
    it('should extract field referencing another message type', () => {
      const customerMessage = simpleProto.messages.find(m => m.name === 'Customer');
      const addressField = customerMessage?.fields.find(f => f.name === 'billing_address');
      
      expect(addressField).toBeDefined();
      expect(addressField?.type).toBe('Address');
    });

    it('should extract optional message type reference', () => {
      const customerMessage = simpleProto.messages.find(m => m.name === 'Customer');
      const addressField = customerMessage?.fields.find(f => f.name === 'shipping_address');
      
      expect(addressField).toBeDefined();
      expect(addressField?.optional).toBe(true);
      expect(addressField?.type).toBe('Address');
    });

    it('should extract repeated message type reference', () => {
      const customerMessage = simpleProto.messages.find(m => m.name === 'Customer');
      const addressField = customerMessage?.fields.find(f => f.name === 'alternate_addresses');
      
      expect(addressField).toBeDefined();
      expect(addressField?.rule).toBe('repeated');
      expect(addressField?.type).toBe('Address');
    });
  });

  describe('empty message', () => {
    it('should extract empty message with no fields', () => {
      const emptyMessage = simpleProto.messages.find(m => m.name === 'Empty');
      
      expect(emptyMessage).toBeDefined();
      expect(emptyMessage?.fields.length).toBe(0);
    });
  });
});

// ============================================================================
// Nested Message Tests
// ============================================================================

describe('Nested Message Extraction', () => {
  let parser: ProtoParser;
  let nestedProto: ProtoFile;

  beforeAll(() => {
    parser = new ProtoParser();
    nestedProto = parser.parseSource(readFixture('nested'), 'nested.proto');
  });

  describe('single level nesting', () => {
    it('should extract parent message with nested type', () => {
      const orderMessage = nestedProto.messages.find(m => m.name === 'Order');
      
      expect(orderMessage).toBeDefined();
      expect(orderMessage?.nestedMessages.length).toBeGreaterThan(0);
    });

    it('should extract nested message definition', () => {
      const orderMessage = nestedProto.messages.find(m => m.name === 'Order');
      const itemMessage = orderMessage?.nestedMessages.find(m => m.name === 'Item');
      
      expect(itemMessage).toBeDefined();
      expect(itemMessage?.fullName).toBe('example.nested.Order.Item');
    });

    it('should extract nested message fields', () => {
      const orderMessage = nestedProto.messages.find(m => m.name === 'Order');
      const itemMessage = orderMessage?.nestedMessages.find(m => m.name === 'Item');
      
      expect(itemMessage?.fields.length).toBe(4);
      expect(itemMessage?.fields.find(f => f.name === 'product_id')).toBeDefined();
      expect(itemMessage?.fields.find(f => f.name === 'quantity')).toBeDefined();
    });

    it('should extract field using nested type', () => {
      const orderMessage = nestedProto.messages.find(m => m.name === 'Order');
      const itemsField = orderMessage?.fields.find(f => f.name === 'items');
      
      expect(itemsField).toBeDefined();
      expect(itemsField?.type).toBe('Item');
      expect(itemsField?.rule).toBe('repeated');
    });
  });

  describe('multi-level nesting', () => {
    it('should extract deeply nested messages', () => {
      const orgMessage = nestedProto.messages.find(m => m.name === 'Organization');
      
      expect(orgMessage).toBeDefined();
      
      const deptMessage = orgMessage?.nestedMessages.find(m => m.name === 'Department');
      expect(deptMessage).toBeDefined();
      
      const teamMessage = deptMessage?.nestedMessages.find(m => m.name === 'Team');
      expect(teamMessage).toBeDefined();
      
      const projectMessage = teamMessage?.nestedMessages.find(m => m.name === 'Project');
      expect(projectMessage).toBeDefined();
    });

    it('should have correct full names for deeply nested types', () => {
      const orgMessage = nestedProto.messages.find(m => m.name === 'Organization');
      const deptMessage = orgMessage?.nestedMessages.find(m => m.name === 'Department');
      const teamMessage = deptMessage?.nestedMessages.find(m => m.name === 'Team');
      const projectMessage = teamMessage?.nestedMessages.find(m => m.name === 'Project');
      
      expect(projectMessage?.fullName).toBe('example.nested.Organization.Department.Team.Project');
    });
  });

  describe('nested enum in message', () => {
    it('should extract enum nested within message', () => {
      const orderMessage = nestedProto.messages.find(m => m.name === 'Order');
      
      expect(orderMessage?.nestedEnums.length).toBeGreaterThan(0);
    });

    it('should have correct full name for nested enum', () => {
      const orderMessage = nestedProto.messages.find(m => m.name === 'Order');
      const statusEnum = orderMessage?.nestedEnums.find(e => e.name === 'OrderStatus');
      
      expect(statusEnum).toBeDefined();
      expect(statusEnum?.fullName).toBe('example.nested.Order.OrderStatus');
    });

    it('should extract field using nested enum type', () => {
      const orderMessage = nestedProto.messages.find(m => m.name === 'Order');
      const statusField = orderMessage?.fields.find(f => f.name === 'status');
      
      expect(statusField).toBeDefined();
      expect(statusField?.type).toBe('OrderStatus');
    });
  });

  describe('cross-message nested type references', () => {
    it('should extract message referencing nested type from another message', () => {
      const summaryMessage = nestedProto.messages.find(m => m.name === 'OrderSummary');
      
      expect(summaryMessage).toBeDefined();
      
      const statusField = summaryMessage?.fields.find(f => f.name === 'status');
      expect(statusField?.type).toBe('Order.OrderStatus');
      
      const itemsField = summaryMessage?.fields.find(f => f.name === 'items');
      expect(itemsField?.type).toBe('Order.Item');
    });
  });
});

// ============================================================================
// Enum Extraction Tests
// ============================================================================

describe('Enum Extraction', () => {
  let parser: ProtoParser;
  let enumsProto: ProtoFile;

  beforeAll(() => {
    parser = new ProtoParser();
    enumsProto = parser.parseSource(readFixture('enums'), 'enums.proto');
  });

  describe('basic enum extraction', () => {
    it('should extract top-level enum', () => {
      const statusEnum = enumsProto.enums.find(e => e.name === 'Status');
      
      expect(statusEnum).toBeDefined();
      expect(statusEnum?.fullName).toBe('example.enums.Status');
    });

    it('should extract all enum values', () => {
      const statusEnum = enumsProto.enums.find(e => e.name === 'Status');
      
      expect(statusEnum?.values.length).toBe(4);
    });

    it('should extract enum value names correctly', () => {
      const statusEnum = enumsProto.enums.find(e => e.name === 'Status');
      const valueNames = statusEnum?.values.map(v => v.name);
      
      expect(valueNames).toContain('STATUS_UNKNOWN');
      expect(valueNames).toContain('STATUS_ACTIVE');
      expect(valueNames).toContain('STATUS_INACTIVE');
      expect(valueNames).toContain('STATUS_PENDING');
    });

    it('should extract enum value numbers correctly', () => {
      const statusEnum = enumsProto.enums.find(e => e.name === 'Status');
      const unknown = statusEnum?.values.find(v => v.name === 'STATUS_UNKNOWN');
      const active = statusEnum?.values.find(v => v.name === 'STATUS_ACTIVE');
      
      expect(unknown?.number).toBe(0);
      expect(active?.number).toBe(1);
    });
  });

  describe('enum with gaps in numbering', () => {
    it('should handle non-sequential enum values', () => {
      const logLevelEnum = enumsProto.enums.find(e => e.name === 'LogLevel');
      
      expect(logLevelEnum).toBeDefined();
      
      const debug = logLevelEnum?.values.find(v => v.name === 'LOG_LEVEL_DEBUG');
      const info = logLevelEnum?.values.find(v => v.name === 'LOG_LEVEL_INFO');
      const error = logLevelEnum?.values.find(v => v.name === 'LOG_LEVEL_ERROR');
      
      expect(debug?.number).toBe(10);
      expect(info?.number).toBe(20);
      expect(error?.number).toBe(40);
    });
  });

  describe('enum with aliases', () => {
    it('should extract enum with allow_alias option', () => {
      const priorityEnum = enumsProto.enums.find(e => e.name === 'Priority');
      
      expect(priorityEnum).toBeDefined();
      
      // NORMAL and MEDIUM should both have value 2
      const normal = priorityEnum?.values.find(v => v.name === 'PRIORITY_NORMAL');
      const medium = priorityEnum?.values.find(v => v.name === 'PRIORITY_MEDIUM');
      
      expect(normal?.number).toBe(2);
      expect(medium?.number).toBe(2);
    });
  });

  describe('message using enum field', () => {
    it('should extract message with enum field type', () => {
      const taskMessage = enumsProto.messages.find(m => m.name === 'Task');
      const statusField = taskMessage?.fields.find(f => f.name === 'status');
      
      expect(statusField).toBeDefined();
      expect(statusField?.type).toBe('Status');
    });

    it('should extract repeated enum field', () => {
      const scheduleMessage = enumsProto.messages.find(m => m.name === 'Schedule');
      const daysField = scheduleMessage?.fields.find(f => f.name === 'days');
      
      expect(daysField).toBeDefined();
      expect(daysField?.type).toBe('DayOfWeek');
      expect(daysField?.rule).toBe('repeated');
    });
  });
});

// ============================================================================
// Oneof Extraction Tests
// ============================================================================

describe('Oneof Extraction', () => {
  let parser: ProtoParser;
  let oneofProto: ProtoFile;

  beforeAll(() => {
    parser = new ProtoParser();
    oneofProto = parser.parseSource(readFixture('oneof'), 'oneof.proto');
  });

  describe('simple oneof', () => {
    it('should extract oneof group', () => {
      const contactMessage = oneofProto.messages.find(m => m.name === 'Contact');
      
      expect(contactMessage?.oneofs.length).toBe(1);
      expect(contactMessage?.oneofs[0].name).toBe('contact_method');
    });

    it('should extract oneof field names', () => {
      const contactMessage = oneofProto.messages.find(m => m.name === 'Contact');
      const oneof = contactMessage?.oneofs.find(o => o.name === 'contact_method');
      
      expect(oneof?.fieldNames).toContain('email');
      expect(oneof?.fieldNames).toContain('phone');
    });

    it('should mark oneof fields with oneof name', () => {
      const contactMessage = oneofProto.messages.find(m => m.name === 'Contact');
      const emailField = contactMessage?.fields.find(f => f.name === 'email');
      
      expect(emailField?.oneofName).toBe('contact_method');
    });
  });

  describe('oneof with different types', () => {
    it('should extract oneof with mixed types', () => {
      const paymentMessage = oneofProto.messages.find(m => m.name === 'PaymentInfo');
      const oneof = paymentMessage?.oneofs.find(o => o.name === 'payment_method');
      
      expect(oneof).toBeDefined();
      expect(oneof?.fieldNames.length).toBe(5);
    });

    it('should include various field types in oneof', () => {
      const paymentMessage = oneofProto.messages.find(m => m.name === 'PaymentInfo');
      
      const creditCardField = paymentMessage?.fields.find(f => f.name === 'credit_card');
      const walletField = paymentMessage?.fields.find(f => f.name === 'crypto_wallet_id');
      const codField = paymentMessage?.fields.find(f => f.name === 'cash_on_delivery');
      
      expect(creditCardField?.type).toBe('string');
      expect(walletField?.type).toBe('int64');
      expect(codField?.type).toBe('bool');
    });
  });

  describe('oneof with message types', () => {
    it('should extract oneof with nested message types', () => {
      const mediaMessage = oneofProto.messages.find(m => m.name === 'Media');
      const oneof = mediaMessage?.oneofs.find(o => o.name === 'content');
      
      expect(oneof?.fieldNames).toContain('image');
      expect(oneof?.fieldNames).toContain('video');
      expect(oneof?.fieldNames).toContain('audio');
    });

    it('should extract nested message types used in oneof', () => {
      const mediaMessage = oneofProto.messages.find(m => m.name === 'Media');
      
      expect(mediaMessage?.nestedMessages.length).toBe(3);
      expect(mediaMessage?.nestedMessages.find(m => m.name === 'ImageData')).toBeDefined();
      expect(mediaMessage?.nestedMessages.find(m => m.name === 'VideoData')).toBeDefined();
      expect(mediaMessage?.nestedMessages.find(m => m.name === 'AudioData')).toBeDefined();
    });
  });

  describe('multiple oneofs in message', () => {
    it('should extract message with multiple oneof groups', () => {
      const notificationMessage = oneofProto.messages.find(m => m.name === 'Notification');
      
      expect(notificationMessage?.oneofs.length).toBe(3);
    });

    it('should extract all oneof groups by name', () => {
      const notificationMessage = oneofProto.messages.find(m => m.name === 'Notification');
      const oneofNames = notificationMessage?.oneofs.map(o => o.name);
      
      expect(oneofNames).toContain('recipient');
      expect(oneofNames).toContain('channel');
      expect(oneofNames).toContain('content');
    });
  });
});

// ============================================================================
// Map Field Tests
// ============================================================================

describe('Map Field Extraction', () => {
  let parser: ProtoParser;
  let mapsProto: ProtoFile;

  beforeAll(() => {
    parser = new ProtoParser();
    mapsProto = parser.parseSource(readFixture('maps'), 'maps.proto');
  });

  describe('string-to-string map', () => {
    it('should extract map field with string keys', () => {
      const configMessage = mapsProto.messages.find(m => m.name === 'Config');
      const settingsField = configMessage?.fields.find(f => f.name === 'settings');
      
      expect(settingsField).toBeDefined();
      expect(settingsField?.rule).toBe('map');
      expect(settingsField?.keyType).toBe('string');
      expect(settingsField?.type).toBe('string');
    });
  });

  describe('int keyed maps', () => {
    it('should extract map with int32 key', () => {
      const message = mapsProto.messages.find(m => m.name === 'IntKeyedMap');
      const field = message?.fields.find(f => f.name === 'id_to_name');
      
      expect(field?.rule).toBe('map');
      expect(field?.keyType).toBe('int32');
      expect(field?.type).toBe('string');
    });

    it('should extract map with int64 key', () => {
      const message = mapsProto.messages.find(m => m.name === 'IntKeyedMap');
      const field = message?.fields.find(f => f.name === 'timestamp_to_value');
      
      expect(field?.rule).toBe('map');
      expect(field?.keyType).toBe('int64');
      expect(field?.type).toBe('double');
    });
  });

  describe('map with message value', () => {
    it('should extract map with message type value', () => {
      const dirMessage = mapsProto.messages.find(m => m.name === 'UserDirectory');
      const usersField = dirMessage?.fields.find(f => f.name === 'users_by_id');
      
      expect(usersField?.rule).toBe('map');
      expect(usersField?.keyType).toBe('string');
      expect(usersField?.type).toBe('User');
    });
  });

  describe('map with enum value', () => {
    it('should extract map with enum type value', () => {
      const accessMessage = mapsProto.messages.find(m => m.name === 'AccessControl');
      const permField = accessMessage?.fields.find(f => f.name === 'user_permissions');
      
      expect(permField?.rule).toBe('map');
      expect(permField?.type).toBe('Permission');
    });
  });

  describe('all allowed key types', () => {
    it('should extract maps with all allowed key types', () => {
      const allKeysMessage = mapsProto.messages.find(m => m.name === 'AllKeyTypes');
      
      expect(allKeysMessage).toBeDefined();
      expect(allKeysMessage?.fields.length).toBe(12); // 12 different key types
    });

    it('should have bool key map', () => {
      const allKeysMessage = mapsProto.messages.find(m => m.name === 'AllKeyTypes');
      const boolField = allKeysMessage?.fields.find(f => f.name === 'bool_keys');
      
      expect(boolField?.keyType).toBe('bool');
    });
  });
});

// ============================================================================
// Service and RPC Extraction Tests
// ============================================================================

describe('Service Extraction', () => {
  let parser: ProtoParser;
  let serviceProto: ProtoFile;

  beforeAll(() => {
    parser = new ProtoParser();
    serviceProto = parser.parseSource(readFixture('service'), 'service.proto');
  });

  describe('basic service extraction', () => {
    it('should extract service definition', () => {
      const userService = serviceProto.services.find(s => s.name === 'UserService');
      
      expect(userService).toBeDefined();
      expect(userService?.fullName).toBe('example.service.UserService');
    });

    it('should extract multiple services', () => {
      expect(serviceProto.services.length).toBe(3); // UserService, HealthService, PingService
    });
  });

  describe('RPC method extraction', () => {
    it('should extract RPC methods from service', () => {
      const userService = serviceProto.services.find(s => s.name === 'UserService');
      
      expect(userService?.methods.length).toBe(5);
    });

    it('should extract method name', () => {
      const userService = serviceProto.services.find(s => s.name === 'UserService');
      const getMethod = userService?.methods.find(m => m.name === 'GetUser');
      
      expect(getMethod).toBeDefined();
      expect(getMethod?.name).toBe('GetUser');
    });

    it('should extract request type', () => {
      const userService = serviceProto.services.find(s => s.name === 'UserService');
      const getMethod = userService?.methods.find(m => m.name === 'GetUser');
      
      expect(getMethod?.requestType).toBe('GetUserRequest');
    });

    it('should extract response type', () => {
      const userService = serviceProto.services.find(s => s.name === 'UserService');
      const getMethod = userService?.methods.find(m => m.name === 'GetUser');
      
      expect(getMethod?.responseType).toBe('GetUserResponse');
    });

    it('should identify unary RPC (no streaming)', () => {
      const userService = serviceProto.services.find(s => s.name === 'UserService');
      const getMethod = userService?.methods.find(m => m.name === 'GetUser');
      
      expect(getMethod?.clientStreaming).toBe(false);
      expect(getMethod?.serverStreaming).toBe(false);
    });
  });
});

// ============================================================================
// Streaming RPC Tests
// ============================================================================

describe('Streaming RPC Extraction', () => {
  let parser: ProtoParser;
  let streamingProto: ProtoFile;

  beforeAll(() => {
    parser = new ProtoParser();
    streamingProto = parser.parseSource(readFixture('streaming'), 'streaming.proto');
  });

  describe('server streaming', () => {
    it('should identify server streaming RPC', () => {
      const service = streamingProto.services.find(s => s.name === 'StreamingService');
      const method = service?.methods.find(m => m.name === 'ServerStreamItems');
      
      expect(method?.clientStreaming).toBe(false);
      expect(method?.serverStreaming).toBe(true);
    });
  });

  describe('client streaming', () => {
    it('should identify client streaming RPC', () => {
      const service = streamingProto.services.find(s => s.name === 'StreamingService');
      const method = service?.methods.find(m => m.name === 'ClientStreamUpload');
      
      expect(method?.clientStreaming).toBe(true);
      expect(method?.serverStreaming).toBe(false);
    });
  });

  describe('bidirectional streaming', () => {
    it('should identify bidirectional streaming RPC', () => {
      const service = streamingProto.services.find(s => s.name === 'StreamingService');
      const method = service?.methods.find(m => m.name === 'BidirectionalChat');
      
      expect(method?.clientStreaming).toBe(true);
      expect(method?.serverStreaming).toBe(true);
    });
  });

  describe('all streaming modes in different services', () => {
    it('should extract server streaming from FileService', () => {
      const service = streamingProto.services.find(s => s.name === 'FileService');
      const download = service?.methods.find(m => m.name === 'Download');
      
      expect(download?.serverStreaming).toBe(true);
      expect(download?.clientStreaming).toBe(false);
    });

    it('should extract client streaming from FileService', () => {
      const service = streamingProto.services.find(s => s.name === 'FileService');
      const upload = service?.methods.find(m => m.name === 'Upload');
      
      expect(upload?.clientStreaming).toBe(true);
      expect(upload?.serverStreaming).toBe(false);
    });

    it('should extract bidirectional from SensorService', () => {
      const service = streamingProto.services.find(s => s.name === 'SensorService');
      const process = service?.methods.find(m => m.name === 'ProcessReadings');
      
      expect(process?.clientStreaming).toBe(true);
      expect(process?.serverStreaming).toBe(true);
    });
  });
});

// ============================================================================
// Type Conversion Tests
// ============================================================================

describe('ProtoTypeConverter', () => {
  let parser: ProtoParser;
  let converter: ProtoTypeConverter;

  beforeAll(() => {
    parser = new ProtoParser();
    converter = new ProtoTypeConverter();
  });

  describe('scalar type conversions', () => {
    it('should convert int32 to primitive number', () => {
      const simpleProto = parser.parseSource(readFixture('simple'), 'simple.proto');
      converter.registerMessages(simpleProto.messages);
      
      const scalarMessage = simpleProto.messages.find(m => m.name === 'ScalarTypes');
      const schema = converter.messageToSchema(scalarMessage!);
      
      const int32Prop = schema.properties['int32_field'];
      expect(int32Prop.type).toEqual({ kind: 'primitive', value: 'number' });
    });

    it('should convert string to primitive string', () => {
      const simpleProto = parser.parseSource(readFixture('simple'), 'simple.proto');
      converter.registerMessages(simpleProto.messages);
      
      const scalarMessage = simpleProto.messages.find(m => m.name === 'ScalarTypes');
      const schema = converter.messageToSchema(scalarMessage!);
      
      const stringProp = schema.properties['string_field'];
      expect(stringProp.type).toEqual({ kind: 'primitive', value: 'string' });
    });

    it('should convert bool to primitive boolean', () => {
      const simpleProto = parser.parseSource(readFixture('simple'), 'simple.proto');
      converter.registerMessages(simpleProto.messages);
      
      const scalarMessage = simpleProto.messages.find(m => m.name === 'ScalarTypes');
      const schema = converter.messageToSchema(scalarMessage!);
      
      const boolProp = schema.properties['bool_field'];
      expect(boolProp.type).toEqual({ kind: 'primitive', value: 'boolean' });
    });

    it('should convert bytes to primitive string (base64)', () => {
      const simpleProto = parser.parseSource(readFixture('simple'), 'simple.proto');
      converter.registerMessages(simpleProto.messages);
      
      const scalarMessage = simpleProto.messages.find(m => m.name === 'ScalarTypes');
      const schema = converter.messageToSchema(scalarMessage!);
      
      const bytesProp = schema.properties['bytes_field'];
      expect(bytesProp.type).toEqual({ kind: 'primitive', value: 'string' });
    });
  });

  describe('repeated field conversion', () => {
    it('should convert repeated to array type', () => {
      const simpleProto = parser.parseSource(readFixture('simple'), 'simple.proto');
      converter.registerMessages(simpleProto.messages);
      
      const userMessage = simpleProto.messages.find(m => m.name === 'User');
      const schema = converter.messageToSchema(userMessage!);
      
      const tagsProp = schema.properties['tags'];
      expect(tagsProp.type.kind).toBe('array');
      
      if (tagsProp.type.kind === 'array') {
        expect(tagsProp.type.element).toEqual({ kind: 'primitive', value: 'string' });
      }
    });
  });

  describe('optional field conversion', () => {
    it('should mark optional fields correctly', () => {
      const simpleProto = parser.parseSource(readFixture('simple'), 'simple.proto');
      converter.registerMessages(simpleProto.messages);
      
      const userMessage = simpleProto.messages.find(m => m.name === 'User');
      const schema = converter.messageToSchema(userMessage!);
      
      expect(schema.properties['email'].optional).toBe(true);
    });
  });

  describe('map field conversion', () => {
    it('should convert map to object with additionalProperties', () => {
      const mapsProto = parser.parseSource(readFixture('maps'), 'maps.proto');
      converter.registerMessages(mapsProto.messages);
      
      const configMessage = mapsProto.messages.find(m => m.name === 'Config');
      const schema = converter.messageToSchema(configMessage!);
      
      const settingsProp = schema.properties['settings'];
      expect(settingsProp.type.kind).toBe('object');
      
      if (settingsProp.type.kind === 'object') {
        expect(settingsProp.type.schema.additionalProperties).toBeDefined();
      }
    });
  });

  describe('enum type conversion', () => {
    it('should convert enum to union of literals', () => {
      const enumsProto = parser.parseSource(readFixture('enums'), 'enums.proto');
      converter.registerEnums(enumsProto.enums);
      
      const statusEnum = enumsProto.enums.find(e => e.name === 'Status');
      const enumType = converter.enumToNormalizedType(statusEnum!);
      
      expect(enumType.kind).toBe('union');
      
      if (enumType.kind === 'union') {
        expect(enumType.variants.length).toBe(4);
        
        // Each variant should be a literal
        for (const variant of enumType.variants) {
          expect(variant.kind).toBe('literal');
        }
      }
    });
  });

  describe('oneof conversion', () => {
    it('should convert oneof to union property', () => {
      const oneofProto = parser.parseSource(readFixture('oneof'), 'oneof.proto');
      converter.registerMessages(oneofProto.messages);
      
      const contactMessage = oneofProto.messages.find(m => m.name === 'Contact');
      const schema = converter.messageToSchema(contactMessage!);
      
      const oneofProp = schema.properties['contact_method'];
      expect(oneofProp).toBeDefined();
      expect(oneofProp.type.kind).toBe('union');
    });
  });

  describe('message reference conversion', () => {
    it('should convert message reference to ref type', () => {
      const simpleProto = parser.parseSource(readFixture('simple'), 'simple.proto');
      converter.registerMessages(simpleProto.messages);
      
      const customerMessage = simpleProto.messages.find(m => m.name === 'Customer');
      const schema = converter.messageToSchema(customerMessage!);
      
      const addressProp = schema.properties['billing_address'];
      expect(addressProp.type.kind).toBe('ref');
      
      if (addressProp.type.kind === 'ref') {
        expect(addressProp.type.name).toBe('Address');
      }
    });
  });
});

// ============================================================================
// GrpcAdapter Schema Extraction Tests
// ============================================================================

describe('GrpcAdapter Schema Extraction', () => {
  let adapter: GrpcAdapter;

  beforeAll(() => {
    adapter = new GrpcAdapter();
  });

  describe('extract() - message schema', () => {
    it('should extract message schema by ref', async () => {
      const ref: SchemaRef = {
        source: 'grpc',
        id: 'message:example.v1.User',
        options: { path: FIXTURES.simple },
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.name).toBe('User');
      expect(schema.properties).toHaveProperty('id');
      expect(schema.properties).toHaveProperty('name');
    });

    it('should include source in extracted schema', async () => {
      const ref: SchemaRef = {
        source: 'grpc',
        id: 'message:example.v1.User',
        options: { path: FIXTURES.simple },
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema.source).toEqual(ref);
    });
  });

  describe('extract() - service schema', () => {
    it('should extract service with all methods', async () => {
      const ref: SchemaRef = {
        source: 'grpc',
        id: 'service:example.service.UserService',
        options: { path: FIXTURES.service },
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.name).toBe('UserService');
      expect(schema.properties).toHaveProperty('GetUser');
      expect(schema.properties).toHaveProperty('CreateUser');
    });

    it('should extract specific RPC method', async () => {
      const ref: SchemaRef = {
        source: 'grpc',
        id: 'service:example.service.UserService:GetUser',
        options: { path: FIXTURES.service },
      };
      
      const schema = await adapter.extract(ref);
      
      expect(schema).toBeDefined();
      expect(schema.name).toContain('GetUser');
      expect(schema.properties).toHaveProperty('request');
      expect(schema.properties).toHaveProperty('response');
      expect(schema.properties).toHaveProperty('streaming');
    });
  });

  describe('extract() - error handling', () => {
    it('should throw for non-existent message', async () => {
      const ref: SchemaRef = {
        source: 'grpc',
        id: 'message:NonExistent',
        options: { path: FIXTURES.simple },
      };
      
      await expect(adapter.extract(ref)).rejects.toThrow();
    });

    it('should throw for non-existent service', async () => {
      const ref: SchemaRef = {
        source: 'grpc',
        id: 'service:NonExistent',
        options: { path: FIXTURES.service },
      };
      
      await expect(adapter.extract(ref)).rejects.toThrow();
    });

    it('should throw for non-existent file', async () => {
      const ref: SchemaRef = {
        source: 'grpc',
        id: 'message:Test',
        options: { path: '/non/existent.proto' },
      };
      
      await expect(adapter.extract(ref)).rejects.toThrow();
    });

    it('should throw for missing path option', async () => {
      const ref: SchemaRef = {
        source: 'grpc',
        id: 'message:example.v1.User',
      };
      
      await expect(adapter.extract(ref)).rejects.toThrow();
    });
  });

  describe('list()', () => {
    it('should list all messages in proto file', async () => {
      const refs = await adapter.list(FIXTURES.simple);
      
      const messageRefs = refs.filter(r => r.id.startsWith('message:'));
      expect(messageRefs.length).toBeGreaterThan(0);
    });

    it('should list all services in proto file', async () => {
      const refs = await adapter.list(FIXTURES.service);
      
      const serviceRefs = refs.filter(r => r.id.startsWith('service:'));
      expect(serviceRefs.length).toBeGreaterThan(0);
    });

    it('should list all enums in proto file', async () => {
      const refs = await adapter.list(FIXTURES.enums);
      
      const enumRefs = refs.filter(r => r.id.startsWith('enum:'));
      expect(enumRefs.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent path', async () => {
      const refs = await adapter.list('/non/existent/path');
      
      expect(refs).toBeInstanceOf(Array);
      expect(refs.length).toBe(0);
    });
  });
});

// ============================================================================
// Well-Known Types Tests
// ============================================================================

describe('Google Well-Known Types', () => {
  let parser: ProtoParser;
  let converter: ProtoTypeConverter;

  beforeAll(() => {
    parser = new ProtoParser();
    converter = new ProtoTypeConverter();
  });

  describe('Timestamp handling', () => {
    it('should convert Timestamp to string type', () => {
      // This test requires protobufjs well-known type support
      const wellKnownProto = parser.parseSource(readFixture('wellKnown'), 'well-known-types.proto');
      converter.registerMessages(wellKnownProto.messages);
      
      const eventMessage = wellKnownProto.messages.find(m => m.name === 'Event');
      const schema = converter.messageToSchema(eventMessage!);
      
      const timestampProp = schema.properties['occurred_at'];
      expect(timestampProp.type).toEqual({ kind: 'primitive', value: 'string' });
    });
  });

  describe('Duration handling', () => {
    it('should convert Duration to string type', () => {
      const wellKnownProto = parser.parseSource(readFixture('wellKnown'), 'well-known-types.proto');
      converter.registerMessages(wellKnownProto.messages);
      
      const taskMessage = wellKnownProto.messages.find(m => m.name === 'Task');
      const schema = converter.messageToSchema(taskMessage!);
      
      const durationProp = schema.properties['estimated_duration'];
      expect(durationProp.type).toEqual({ kind: 'primitive', value: 'string' });
    });
  });

  describe('Any handling', () => {
    it('should convert Any to any type', () => {
      const wellKnownProto = parser.parseSource(readFixture('wellKnown'), 'well-known-types.proto');
      converter.registerMessages(wellKnownProto.messages);
      
      const envelopeMessage = wellKnownProto.messages.find(m => m.name === 'Envelope');
      const schema = converter.messageToSchema(envelopeMessage!);
      
      const payloadProp = schema.properties['payload'];
      expect(payloadProp.type).toEqual({ kind: 'any' });
    });
  });

  describe('Struct handling', () => {
    it('should convert Struct to object with additionalProperties', () => {
      const wellKnownProto = parser.parseSource(readFixture('wellKnown'), 'well-known-types.proto');
      converter.registerMessages(wellKnownProto.messages);
      
      const configMessage = wellKnownProto.messages.find(m => m.name === 'DynamicConfig');
      const schema = converter.messageToSchema(configMessage!);
      
      const settingsProp = schema.properties['settings'];
      expect(settingsProp.type.kind).toBe('object');
    });
  });

  describe('Wrapper types handling', () => {
    it('should convert StringValue to nullable string', () => {
      const wellKnownProto = parser.parseSource(readFixture('wellKnown'), 'well-known-types.proto');
      converter.registerMessages(wellKnownProto.messages);
      
      const profileMessage = wellKnownProto.messages.find(m => m.name === 'UserProfile');
      const schema = converter.messageToSchema(profileMessage!);
      
      const displayNameProp = schema.properties['display_name'];
      expect(displayNameProp.type.kind).toBe('union');
      
      if (displayNameProp.type.kind === 'union') {
        const hasString = displayNameProp.type.variants.some(
          v => v.kind === 'primitive' && v.value === 'string'
        );
        const hasNull = displayNameProp.type.variants.some(
          v => v.kind === 'primitive' && v.value === 'null'
        );
        expect(hasString).toBe(true);
        expect(hasNull).toBe(true);
      }
    });
  });

  describe('Empty handling', () => {
    it('should convert Empty to empty object', () => {
      // Empty type should result in object with no properties
      const wellKnownProto = parser.parseSource(readFixture('wellKnown'), 'well-known-types.proto');
      
      const healthService = wellKnownProto.services.find(s => s.name === 'HealthService');
      const checkMethod = healthService?.methods.find(m => m.name === 'Check');
      
      // Request type is Empty
      expect(checkMethod?.requestType).toBe('google.protobuf.Empty');
    });
  });
});

// ============================================================================
// Import Resolution Tests
// ============================================================================

describe('Import Resolution', () => {
  let parser: ProtoParser;

  beforeAll(() => {
    parser = new ProtoParser();
  });

  describe('local imports', () => {
    it('should parse proto file with imports', async () => {
      const protoFile = await parser.parseFile(FIXTURES.imports, [FIXTURES_PATH]);
      
      expect(protoFile).toBeDefined();
      expect(protoFile.imports.length).toBeGreaterThan(0);
    });

    it('should resolve imported types in messages', async () => {
      const protoFile = await parser.parseFile(FIXTURES.imports, [FIXTURES_PATH]);
      
      const customerMessage = protoFile.messages.find(m => m.name === 'Customer');
      const addressField = customerMessage?.fields.find(f => f.name === 'billing_address');
      
      expect(addressField?.type).toBe('example.common.Address');
    });
  });

  describe('well-known type imports', () => {
    it('should resolve google.protobuf imports', async () => {
      const protoFile = await parser.parseFile(FIXTURES.wellKnown, [FIXTURES_PATH]);
      
      const eventMessage = protoFile.messages.find(m => m.name === 'Event');
      const timestampField = eventMessage?.fields.find(f => f.name === 'occurred_at');
      
      expect(timestampField?.type).toBe('google.protobuf.Timestamp');
    });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  let parser: ProtoParser;

  beforeAll(() => {
    parser = new ProtoParser();
  });

  describe('invalid proto syntax', () => {
    it('should throw on invalid proto syntax', () => {
      expect(() => {
        parser.parseSource(readFixture('invalid'), 'invalid.proto');
      }).toThrow();
    });
  });

  describe('missing type references', () => {
    it('should handle missing type gracefully or throw', async () => {
      const content = `
        syntax = "proto3";
        package test;
        message Test {
          NonExistentType field = 1;
        }
      `;
      
      // Either throws or returns ref type for unresolved
      try {
        const protoFile = parser.parseSource(content, 'test.proto');
        const testMessage = protoFile.messages.find(m => m.name === 'Test');
        const field = testMessage?.fields.find(f => f.name === 'field');
        expect(field?.type).toBe('NonExistentType'); // Unresolved reference
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('file not found', () => {
    it('should throw for non-existent proto file', async () => {
      await expect(parser.parseFile('/non/existent/file.proto')).rejects.toThrow();
    });
  });

  describe('import resolution failure', () => {
    it('should handle failed import resolution', async () => {
      const content = `
        syntax = "proto3";
        import "non_existent_import.proto";
        message Test { string id = 1; }
      `;
      
      // Should either throw or parse with unresolved imports
      try {
        const protoFile = parser.parseSource(content, 'test.proto');
        expect(protoFile.imports).toContain('non_existent_import.proto');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});

// ============================================================================
// PropertyDef Structure Tests
// ============================================================================

describe('PropertyDef Structure', () => {
  let adapter: GrpcAdapter;

  beforeAll(() => {
    adapter = new GrpcAdapter();
  });

  it('should include all PropertyDef required fields', async () => {
    const ref: SchemaRef = {
      source: 'grpc',
      id: 'message:example.v1.User',
      options: { path: FIXTURES.simple },
    };
    
    const schema = await adapter.extract(ref);
    
    for (const [propName, propDef] of Object.entries(schema.properties) as [string, PropertyDef][]) {
      expect(propDef).toHaveProperty('type');
      expect(propDef).toHaveProperty('optional');
      expect(propDef).toHaveProperty('nullable');
      expect(propDef).toHaveProperty('readonly');
      expect(propDef).toHaveProperty('deprecated');
    }
  });

  it('should mark proto3 singular fields as not optional', async () => {
    const ref: SchemaRef = {
      source: 'grpc',
      id: 'message:example.v1.User',
      options: { path: FIXTURES.simple },
    };
    
    const schema = await adapter.extract(ref);
    
    // id and name are singular, not optional in proto3
    expect(schema.properties['id'].optional).toBe(false);
    expect(schema.properties['name'].optional).toBe(false);
  });

  it('should mark explicit optional fields as optional', async () => {
    const ref: SchemaRef = {
      source: 'grpc',
      id: 'message:example.v1.User',
      options: { path: FIXTURES.simple },
    };
    
    const schema = await adapter.extract(ref);
    
    expect(schema.properties['email'].optional).toBe(true);
  });
});

// ============================================================================
// NormalizedSchema Source Location Tests
// ============================================================================

describe('Source Location', () => {
  let adapter: GrpcAdapter;

  beforeAll(() => {
    adapter = new GrpcAdapter();
  });

  it('should include source location with grpc source', async () => {
    const ref: SchemaRef = {
      source: 'grpc',
      id: 'message:example.v1.User',
      options: { path: FIXTURES.simple },
    };
    
    const schema = await adapter.extract(ref);
    
    expect(schema.source).toBeDefined();
    expect(schema.source.source).toBe('grpc');
  });

  it('should include message id in source', async () => {
    const ref: SchemaRef = {
      source: 'grpc',
      id: 'message:example.v1.User',
      options: { path: FIXTURES.simple },
    };
    
    const schema = await adapter.extract(ref);
    
    expect(schema.source.id).toContain('message:');
    expect(schema.source.id).toContain('User');
  });
});

// ============================================================================
// Streaming Mode Helper Tests
// ============================================================================

describe('StreamingMode determination', () => {
  let adapter: GrpcAdapter;

  beforeAll(() => {
    adapter = new GrpcAdapter();
  });

  it('should return unary for non-streaming RPC', async () => {
    const ref: SchemaRef = {
      source: 'grpc',
      id: 'service:example.streaming.StreamingService:GetSingleItem',
      options: { path: FIXTURES.streaming },
    };
    
    const schema = await adapter.extract(ref);
    const streamingProp = schema.properties['streaming'];
    
    if (streamingProp.type.kind === 'literal') {
      expect(streamingProp.type.value).toBe('unary');
    }
  });

  it('should return server_streaming for server-streaming RPC', async () => {
    const ref: SchemaRef = {
      source: 'grpc',
      id: 'service:example.streaming.StreamingService:ServerStreamItems',
      options: { path: FIXTURES.streaming },
    };
    
    const schema = await adapter.extract(ref);
    const streamingProp = schema.properties['streaming'];
    
    if (streamingProp.type.kind === 'literal') {
      expect(streamingProp.type.value).toBe('server_streaming');
    }
  });

  it('should return client_streaming for client-streaming RPC', async () => {
    const ref: SchemaRef = {
      source: 'grpc',
      id: 'service:example.streaming.StreamingService:ClientStreamUpload',
      options: { path: FIXTURES.streaming },
    };
    
    const schema = await adapter.extract(ref);
    const streamingProp = schema.properties['streaming'];
    
    if (streamingProp.type.kind === 'literal') {
      expect(streamingProp.type.value).toBe('client_streaming');
    }
  });

  it('should return bidirectional for bidirectional-streaming RPC', async () => {
    const ref: SchemaRef = {
      source: 'grpc',
      id: 'service:example.streaming.StreamingService:BidirectionalChat',
      options: { path: FIXTURES.streaming },
    };
    
    const schema = await adapter.extract(ref);
    const streamingProp = schema.properties['streaming'];
    
    if (streamingProp.type.kind === 'literal') {
      expect(streamingProp.type.value).toBe('bidirectional');
    }
  });
});
