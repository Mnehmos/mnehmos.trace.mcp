/**
 * Protobuf Parser
 * 
 * Regex-based parser for proto3 syntax files.
 */

import { readFileSync } from 'fs';
import {
  ProtoFile,
  ProtoMessage,
  ProtoField,
  ProtoEnum,
  ProtoEnumValue,
  ProtoService,
  ProtoMethod,
  ProtoOneof,
} from './types.js';

/**
 * Parser for protobuf files
 */
export class ProtoParser {
  /**
   * Parse protobuf source content
   */
  parseSource(content: string, filePath: string): ProtoFile {
    const result: ProtoFile = {
      path: filePath,
      syntax: 'proto3',
      package: null,
      imports: [],
      messages: [],
      enums: [],
      services: [],
    };

    // Remove comments (single-line and multi-line)
    const cleanedContent = this.removeComments(content);

    // Check for invalid syntax patterns that should throw
    this.validateSyntax(cleanedContent);

    // Parse syntax
    const syntaxMatch = cleanedContent.match(/syntax\s*=\s*"([^"]+)"\s*;/);
    if (syntaxMatch) {
      result.syntax = syntaxMatch[1];
    }

    // Parse package
    const packageMatch = cleanedContent.match(/package\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*;/);
    if (packageMatch) {
      result.package = packageMatch[1];
    }

    // Parse imports
    const importRegex = /import\s+"([^"]+)"\s*;/g;
    let importMatch;
    while ((importMatch = importRegex.exec(cleanedContent)) !== null) {
      result.imports.push(importMatch[1]);
    }

    // Parse top-level enums
    result.enums = this.parseTopLevelEnums(cleanedContent, result.package);

    // Parse top-level messages
    result.messages = this.parseTopLevelMessages(cleanedContent, result.package);

    // Parse services
    result.services = this.parseServices(cleanedContent, result.package);

    return result;
  }

  /**
   * Parse a protobuf file from disk
   */
  async parseFile(filePath: string, includePaths?: string[]): Promise<ProtoFile> {
    const content = readFileSync(filePath, 'utf-8');
    const protoFile = this.parseSource(content, filePath);
    return protoFile;
  }

  /**
   * Remove all comments from protobuf content
   */
  private removeComments(content: string): string {
    // Remove multi-line comments
    let result = content.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove single-line comments
    result = result.replace(/\/\/[^\n]*/g, '');
    return result;
  }

  /**
   * Validate proto syntax and throw for invalid patterns
   */
  private validateSyntax(content: string): void {
    // Check for required keyword (not valid in proto3)
    if (/\brequired\s+\w+\s+\w+\s*=/.test(content)) {
      throw new Error("'required' is not valid in proto3");
    }

    // Check for incomplete message (missing closing brace)
    // Count braces after 'message X {'
    const messageStarts = content.match(/\bmessage\s+\w+\s*\{/g) || [];
    const enumStarts = content.match(/\benum\s+\w+\s*\{/g) || [];
    const serviceStarts = content.match(/\bservice\s+\w+\s*\{/g) || [];
    
    const totalOpens = messageStarts.length + enumStarts.length + serviceStarts.length;
    
    // Count braces more carefully
    let braceDepth = 0;
    let inDefinition = false;
    
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '{') {
        braceDepth++;
        inDefinition = true;
      } else if (content[i] === '}') {
        braceDepth--;
        if (braceDepth < 0) {
          throw new Error('Unmatched closing brace');
        }
      }
    }
    
    if (braceDepth !== 0) {
      throw new Error('Unmatched opening brace - missing closing brace');
    }

    // Check for invalid RPC (incomplete method signature)
    if (/\brpc\s+\w+\s*\([^)]*$/.test(content.replace(/\n/g, ' '))) {
      throw new Error('Incomplete RPC method signature');
    }
  }

  /**
   * Parse top-level enums
   */
  private parseTopLevelEnums(content: string, packageName: string | null): ProtoEnum[] {
    const enums: ProtoEnum[] = [];
    
    // Find enum blocks that are NOT inside message blocks
    // First, identify all top-level enum positions
    const lines = content.split('\n');
    let depth = 0;
    let currentEnumStart = -1;
    let currentEnumName = '';
    let enumContent = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Track brace depth
      for (const char of line) {
        if (char === '{') depth++;
        else if (char === '}') depth--;
      }
      
      // Look for enum start at depth 0 (before opening brace)
      const enumMatch = line.match(/^\s*enum\s+(\w+)\s*\{?/);
      if (enumMatch && depth <= 1) {
        // Check if this is truly a top-level enum (depth was 0 before this line)
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        const previousDepth = depth - openBraces + closeBraces;
        
        if (previousDepth === 0) {
          currentEnumName = enumMatch[1];
          currentEnumStart = i;
          enumContent = line;
        }
      } else if (currentEnumStart >= 0) {
        enumContent += '\n' + line;
        
        // Check if enum is complete
        const openCount = (enumContent.match(/\{/g) || []).length;
        const closeCount = (enumContent.match(/\}/g) || []).length;
        
        if (openCount > 0 && openCount === closeCount) {
          const fullName = packageName ? `${packageName}.${currentEnumName}` : currentEnumName;
          const values = this.parseEnumValues(enumContent);
          enums.push({
            name: currentEnumName,
            fullName,
            values,
          });
          currentEnumStart = -1;
          enumContent = '';
        }
      }
    }

    return enums;
  }

  /**
   * Parse enum values from enum block content
   */
  private parseEnumValues(content: string): ProtoEnumValue[] {
    const values: ProtoEnumValue[] = [];
    
    // Match: VALUE_NAME = number;
    const valueRegex = /(\w+)\s*=\s*(-?\d+)\s*;/g;
    let match;
    
    while ((match = valueRegex.exec(content)) !== null) {
      values.push({
        name: match[1],
        number: parseInt(match[2], 10),
      });
    }
    
    return values;
  }

  /**
   * Parse top-level messages
   */
  private parseTopLevelMessages(content: string, packageName: string | null): ProtoMessage[] {
    const messages: ProtoMessage[] = [];
    
    // Find message blocks that are NOT inside other message blocks
    const lines = content.split('\n');
    let depth = 0;
    let currentMessageStart = -1;
    let currentMessageName = '';
    let messageContent = '';
    let inMessage = false;
    let messageStartDepth = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for message start at depth 0
      const messageMatch = line.match(/^\s*message\s+(\w+)\s*\{?/);
      if (messageMatch && depth === 0 && !inMessage) {
        currentMessageName = messageMatch[1];
        currentMessageStart = i;
        messageContent = line;
        messageStartDepth = 0;
        inMessage = true;
      } else if (inMessage) {
        messageContent += '\n' + line;
      }
      
      // Track brace depth
      for (const char of line) {
        if (char === '{') depth++;
        else if (char === '}') depth--;
      }
      
      // Check if message is complete (depth returns to 0)
      if (inMessage && depth === 0) {
        const fullName = packageName ? `${packageName}.${currentMessageName}` : currentMessageName;
        const parsedMessage = this.parseMessageContent(messageContent, currentMessageName, fullName);
        messages.push(parsedMessage);
        currentMessageStart = -1;
        messageContent = '';
        inMessage = false;
      }
    }

    return messages;
  }

  /**
   * Parse a single message content
   */
  private parseMessageContent(content: string, name: string, fullName: string): ProtoMessage {
    const message: ProtoMessage = {
      name,
      fullName,
      fields: [],
      nestedMessages: [],
      nestedEnums: [],
      oneofs: [],
    };

    // Extract the body between first { and last }
    const bodyMatch = content.match(/\{([\s\S]*)\}/);
    if (!bodyMatch) {
      return message;
    }
    
    const body = bodyMatch[1];
    
    // Parse nested messages first (to exclude them from field parsing)
    message.nestedMessages = this.parseNestedMessages(body, fullName);
    
    // Parse nested enums
    message.nestedEnums = this.parseNestedEnums(body, fullName);
    
    // Parse oneofs
    message.oneofs = this.parseOneofs(body);
    
    // Build a map of field names to oneof names
    const fieldToOneof: Record<string, string> = {};
    for (const oneof of message.oneofs) {
      for (const fieldName of oneof.fieldNames) {
        fieldToOneof[fieldName] = oneof.name;
      }
    }
    
    // Parse fields from the full body (parseFields handles oneof blocks internally)
    message.fields = this.parseFields(body, fieldToOneof);

    return message;
  }

  /**
   * Parse nested messages within a message body
   */
  private parseNestedMessages(body: string, parentFullName: string): ProtoMessage[] {
    const messages: ProtoMessage[] = [];
    
    const lines = body.split('\n');
    let depth = 0;
    let currentMessageName = '';
    let messageContent = '';
    let inMessage = false;
    
    for (const line of lines) {
      // Look for message start
      const messageMatch = line.match(/^\s*message\s+(\w+)\s*\{?/);
      if (messageMatch && !inMessage) {
        currentMessageName = messageMatch[1];
        messageContent = line;
        inMessage = true;
        depth = 0;
      } else if (inMessage) {
        messageContent += '\n' + line;
      }
      
      // Track brace depth while in message
      if (inMessage) {
        for (const char of line) {
          if (char === '{') depth++;
          else if (char === '}') depth--;
        }
        
        // Check if message is complete
        if (depth === 0 && messageContent.includes('{')) {
          const fullName = `${parentFullName}.${currentMessageName}`;
          const parsedMessage = this.parseMessageContent(messageContent, currentMessageName, fullName);
          messages.push(parsedMessage);
          messageContent = '';
          inMessage = false;
        }
      }
    }

    return messages;
  }

  /**
   * Parse nested enums within a message body
   */
  private parseNestedEnums(body: string, parentFullName: string): ProtoEnum[] {
    const enums: ProtoEnum[] = [];
    
    const lines = body.split('\n');
    let depth = 0;
    let currentEnumName = '';
    let enumContent = '';
    let inEnum = false;
    
    for (const line of lines) {
      // Don't parse enums that are inside nested messages
      const messageMatch = line.match(/^\s*message\s+\w+\s*\{?/);
      if (messageMatch && !inEnum) {
        // Skip until message closes
        continue;
      }
      
      // Look for enum start
      const enumMatch = line.match(/^\s*enum\s+(\w+)\s*\{?/);
      if (enumMatch && !inEnum) {
        currentEnumName = enumMatch[1];
        enumContent = line;
        inEnum = true;
        depth = 0;
      } else if (inEnum) {
        enumContent += '\n' + line;
      }
      
      // Track brace depth while in enum
      if (inEnum) {
        for (const char of line) {
          if (char === '{') depth++;
          else if (char === '}') depth--;
        }
        
        // Check if enum is complete
        if (depth === 0 && enumContent.includes('{')) {
          const fullName = `${parentFullName}.${currentEnumName}`;
          const values = this.parseEnumValues(enumContent);
          enums.push({
            name: currentEnumName,
            fullName,
            values,
          });
          enumContent = '';
          inEnum = false;
        }
      }
    }

    return enums;
  }

  /**
   * Parse oneof definitions
   */
  private parseOneofs(body: string): ProtoOneof[] {
    const oneofs: ProtoOneof[] = [];
    
    const oneofRegex = /oneof\s+(\w+)\s*\{([^}]*)\}/g;
    let match;
    
    while ((match = oneofRegex.exec(body)) !== null) {
      const name = match[1];
      const oneofBody = match[2];
      
      // Extract field names from the oneof body
      const fieldNames: string[] = [];
      const fieldRegex = /(?:optional\s+)?(\w+(?:\.\w+)*)\s+(\w+)\s*=\s*\d+\s*;/g;
      let fieldMatch;
      
      while ((fieldMatch = fieldRegex.exec(oneofBody)) !== null) {
        fieldNames.push(fieldMatch[2]);
      }
      
      oneofs.push({ name, fieldNames });
    }

    return oneofs;
  }

  /**
   * Remove nested message, enum, and oneof definitions from body
   */
  private removeNestedDefinitions(body: string): string {
    let result = body;
    
    // Remove message blocks
    result = this.removeBlockDefinitions(result, 'message');
    
    // Remove enum blocks
    result = this.removeBlockDefinitions(result, 'enum');
    
    // Remove oneof blocks (but keep the fields parsed separately)
    result = this.removeBlockDefinitions(result, 'oneof');
    
    return result;
  }

  /**
   * Remove block definitions (message, enum, oneof, etc.)
   */
  private removeBlockDefinitions(content: string, keyword: string): string {
    const regex = new RegExp(`${keyword}\\s+\\w+\\s*\\{`, 'g');
    let result = content;
    let match;
    
    while ((match = regex.exec(result)) !== null) {
      const startIndex = match.index;
      let depth = 0;
      let endIndex = startIndex;
      
      for (let i = match.index + match[0].length - 1; i < result.length; i++) {
        if (result[i] === '{') depth++;
        else if (result[i] === '}') {
          depth--;
          if (depth === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }
      
      result = result.slice(0, startIndex) + result.slice(endIndex);
      regex.lastIndex = startIndex;
    }
    
    return result;
  }

  /**
   * Parse fields from a message body
   */
  private parseFields(body: string, fieldToOneof: Record<string, string>): ProtoField[] {
    const fields: ProtoField[] = [];
    
    // Parse map fields: map<KeyType, ValueType> field_name = number;
    const mapRegex = /map\s*<\s*(\w+)\s*,\s*(\w+(?:\.\w+)*)\s*>\s+(\w+)\s*=\s*(\d+)\s*;/g;
    let mapMatch;
    while ((mapMatch = mapRegex.exec(body)) !== null) {
      fields.push({
        name: mapMatch[3],
        type: mapMatch[2],
        number: parseInt(mapMatch[4], 10),
        rule: 'map',
        optional: false,
        keyType: mapMatch[1],
        oneofName: fieldToOneof[mapMatch[3]],
      });
    }
    
    // Remove map fields from body to avoid double-parsing
    const bodyWithoutMaps = body.replace(mapRegex, '');
    
    // Parse regular fields: [optional|repeated] type name = number;
    const fieldRegex = /(optional|repeated)?\s*(\w+(?:\.\w+)*)\s+(\w+)\s*=\s*(\d+)\s*;/g;
    let match;
    
    while ((match = fieldRegex.exec(bodyWithoutMaps)) !== null) {
      const modifier = match[1];
      const typeName = match[2];
      const fieldName = match[3];
      const fieldNumber = parseInt(match[4], 10);
      
      // Skip if this looks like an enum value (VALUE = number;)
      if (typeName.toUpperCase() === typeName && !typeName.includes('.')) {
        continue;
      }
      
      const field: ProtoField = {
        name: fieldName,
        type: typeName,
        number: fieldNumber,
        optional: modifier === 'optional',
        oneofName: fieldToOneof[fieldName],
      };
      
      if (modifier === 'repeated') {
        field.rule = 'repeated';
      }
      
      fields.push(field);
    }
    
    // Also parse fields from oneof blocks
    const oneofRegex = /oneof\s+\w+\s*\{([^}]*)\}/g;
    let oneofMatch;
    while ((oneofMatch = oneofRegex.exec(body)) !== null) {
      const oneofBody = oneofMatch[1];
      const oneofFieldRegex = /(optional\s+)?(\w+(?:\.\w+)*)\s+(\w+)\s*=\s*(\d+)\s*;/g;
      let oneofFieldMatch;
      
      while ((oneofFieldMatch = oneofFieldRegex.exec(oneofBody)) !== null) {
        const typeName = oneofFieldMatch[2];
        const fieldName = oneofFieldMatch[3];
        const fieldNumber = parseInt(oneofFieldMatch[4], 10);
        
        // Check if already added
        if (!fields.find(f => f.name === fieldName)) {
          fields.push({
            name: fieldName,
            type: typeName,
            number: fieldNumber,
            optional: false, // oneof fields are implicitly optional
            oneofName: fieldToOneof[fieldName],
          });
        }
      }
    }
    
    return fields;
  }

  /**
   * Parse services
   */
  private parseServices(content: string, packageName: string | null): ProtoService[] {
    const services: ProtoService[] = [];
    
    const serviceRegex = /service\s+(\w+)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
    let match;
    
    while ((match = serviceRegex.exec(content)) !== null) {
      const serviceName = match[1];
      const serviceBody = match[2];
      const fullName = packageName ? `${packageName}.${serviceName}` : serviceName;
      
      const methods = this.parseRpcMethods(serviceBody);
      
      services.push({
        name: serviceName,
        fullName,
        methods,
      });
    }

    return services;
  }

  /**
   * Parse RPC methods from service body
   */
  private parseRpcMethods(body: string): ProtoMethod[] {
    const methods: ProtoMethod[] = [];
    
    // Match: rpc MethodName(stream? RequestType) returns (stream? ResponseType);
    const rpcRegex = /rpc\s+(\w+)\s*\(\s*(stream\s+)?(\w+(?:\.\w+)*)\s*\)\s*returns\s*\(\s*(stream\s+)?(\w+(?:\.\w+)*)\s*\)\s*[;{]/g;
    let match;
    
    while ((match = rpcRegex.exec(body)) !== null) {
      methods.push({
        name: match[1],
        requestType: match[3],
        responseType: match[5],
        clientStreaming: !!match[2],
        serverStreaming: !!match[4],
      });
    }

    return methods;
  }
}
