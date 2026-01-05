/**
 * Go Struct Extractor
 * Extracts struct and interface definitions from Go source code
 * Updated: 2024-12-31 CRLF handling and pointer stripping
 */

import type {
  GoStruct,
  GoField,
  GoInterface,
  GoMethod,
  GoTypeAlias,
} from './types.js';
import { TagParser } from './tag-parser.js';

/**
 * StructExtractor class for parsing Go structs from source code
 */
export class StructExtractor {
  private tagParser: TagParser;

  constructor(tagParser?: TagParser) {
    this.tagParser = tagParser || new TagParser();
  }

  /**
   * Extract all structs from Go source code
   */
  extract(content: string, filePath?: string): GoStruct[] {
    const structs: GoStruct[] = [];
    const lines = content.split('\n');

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Match struct definition: type Name struct {
      // Handle Windows CRLF by stripping trailing \r
      const cleanLine = line.replace(/\r$/, '');
      const structMatch = cleanLine.match(
        /^\s*type\s+([A-Z][a-zA-Z0-9_]*)\s+struct\s*\{/
      );
      if (structMatch) {
        const name = structMatch[1];
        const description = this.extractComment(lines, i);
        const startLine = i + 1;

        // Find the closing brace
        let braceCount = 1;
        let j = i;

        // Count opening brace on this line
        const firstBraceIdx = line.indexOf('{');
        if (firstBraceIdx >= 0) {
          // Count any additional braces on the same line
          for (let k = firstBraceIdx + 1; k < line.length; k++) {
            if (line[k] === '{') braceCount++;
            if (line[k] === '}') braceCount--;
          }
        }

        j++;
        while (j < lines.length && braceCount > 0) {
          const currentLine = lines[j];
          for (const char of currentLine) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
          }
          j++;
        }

        // Extract struct body (lines between opening and closing brace)
        const bodyLines = lines.slice(i + 1, j - 1);
        const fields = this.parseStructFields(bodyLines);
        const embeddedTypes = this.parseEmbeddedTypes(bodyLines);

        structs.push({
          name,
          fields,
          embeddedTypes,
          description,
          sourceLocation: filePath
            ? { file: filePath, line: startLine }
            : undefined,
        });

        i = j;
        continue;
      }

      // Also match simple struct on one line: type Name struct{}
      // Use cleanLine which has CRLF stripped
      const emptyStructMatch = cleanLine.match(
        /^\s*type\s+([A-Z][a-zA-Z0-9_]*)\s+struct\s*\{\s*\}/
      );
      if (emptyStructMatch) {
        const name = emptyStructMatch[1];
        const description = this.extractComment(lines, i);

        structs.push({
          name,
          fields: [],
          embeddedTypes: [],
          description,
          sourceLocation: filePath ? { file: filePath, line: i + 1 } : undefined,
        });
      }

      i++;
    }

    return structs;
  }

  /**
   * Extract all interfaces from Go source code
   */
  extractInterfaces(content: string, filePath?: string): GoInterface[] {
    const interfaces: GoInterface[] = [];
    const lines = content.split('\n');

    let i = 0;
    while (i < lines.length) {
      // Handle Windows CRLF by stripping trailing \r
      const line = lines[i].replace(/\r$/, '');

      // Match empty interface FIRST: type Name interface{} (with or without space before {})
      // Must check before multi-line interface to avoid mismatching
      const emptyInterfaceMatch = line.match(
        /^\s*type\s+([A-Z][a-zA-Z0-9_]*)\s+interface\s*\{\}\s*$/
      );
      if (emptyInterfaceMatch) {
        const name = emptyInterfaceMatch[1];
        const description = this.extractComment(lines, i);

        interfaces.push({
          name,
          methods: [],
          embeddedInterfaces: [],
          description,
          sourceLocation: filePath ? { file: filePath, line: i + 1 } : undefined,
        });
        i++;
        continue;
      }

      // Match interface definition: type Name interface {
      const interfaceMatch = line.match(
        /^\s*type\s+([A-Z][a-zA-Z0-9_]*)\s+interface\s*\{/
      );
      if (interfaceMatch) {
        const name = interfaceMatch[1];
        const description = this.extractComment(lines, i);
        const startLine = i + 1;

        // Find the closing brace
        let braceCount = 1;
        let j = i + 1;
        while (j < lines.length && braceCount > 0) {
          const currentLine = lines[j];
          for (const char of currentLine) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
          }
          j++;
        }

        // Extract interface body
        const bodyLines = lines.slice(i + 1, j - 1);
        const { methods, embeddedInterfaces } =
          this.parseInterfaceMethods(bodyLines);

        interfaces.push({
          name,
          methods,
          embeddedInterfaces,
          description,
          sourceLocation: filePath
            ? { file: filePath, line: startLine }
            : undefined,
        });

        i = j;
        continue;
      }

      i++;
    }

    return interfaces;
  }

  /**
   * Extract type aliases from Go source code
   */
  extractTypeAliases(content: string): GoTypeAlias[] {
    const aliases: GoTypeAlias[] = [];
    const lines = content.split('\n');

    for (const rawLine of lines) {
      // Trim to handle Windows line endings (\r\n)
      const line = rawLine.trim();
      
      // Match type alias: type Name = OtherType
      const aliasMatch = line.match(
        /^type\s+([A-Z][a-zA-Z0-9_]*)\s*=\s*(.+)$/
      );
      if (aliasMatch) {
        aliases.push({
          name: aliasMatch[1],
          underlyingType: aliasMatch[2].trim(),
        });
        continue;
      }

      // Match type definition: type Name OtherType (not struct/interface)
      // This handles simple types like: type UserID int64
      // And complex types like: type MetaMap map[string]interface{}
      const typeDefMatch = line.match(
        /^type\s+([A-Z][a-zA-Z0-9_]*)\s+(.+)$/
      );
      if (typeDefMatch) {
        const underlying = typeDefMatch[2].trim();
        // Skip if it's a struct or interface definition
        if (underlying === 'struct' || underlying === 'interface' ||
            underlying === 'struct {' || underlying === 'interface {' ||
            underlying.startsWith('struct{') || underlying.startsWith('interface{') ||
            underlying.startsWith('struct {') || underlying.startsWith('interface {')) {
          continue;
        }
        aliases.push({
          name: typeDefMatch[1],
          underlyingType: underlying,
        });
      }
    }

    return aliases;
  }

  /**
   * Parse struct fields from lines of struct body
   */
  private parseStructFields(bodyLines: string[]): GoField[] {
    const fields: GoField[] = [];

    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i];

      // Skip empty lines and comments - also handle CRLF
      const trimmed = line.replace(/\r$/, '').trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed === '}') {
        continue;
      }

      // Try to parse field with struct tag
      const field = this.parseFieldLine(line, bodyLines, i);
      if (field) {
        fields.push(field);
      }
    }

    return fields;
  }

  /**
   * Parse a single field line
   */
  private parseFieldLine(line: string, bodyLines: string[], lineIndex: number): GoField | null {
    const trimmed = line.trim();

    // Skip unexported (lowercase) fields, empty lines, closing brace
    if (!trimmed || trimmed === '}' || trimmed.startsWith('//')) {
      return null;
    }

    // Check if line contains a field (starts with uppercase letter)
    const firstChar = trimmed[0];
    if (!(firstChar >= 'A' && firstChar <= 'Z')) {
      // Private field or embedded type - skip for now
      return null;
    }

    // Parse field line - can have backtick tags
    // Format: FieldName   Type   `tags`
    // Or: FieldName   Type // comment
    // Or: FieldName   Type
    
    let goName: string;
    let goType: string;
    let tagString = '';

    // Check if line has backtick tags
    const backtickIndex = trimmed.indexOf('`');
    if (backtickIndex > 0) {
      // Extract tag string between backticks
      const lastBacktickIndex = trimmed.lastIndexOf('`');
      if (lastBacktickIndex > backtickIndex) {
        tagString = trimmed.substring(backtickIndex + 1, lastBacktickIndex);
      }
      
      // Parse name and type before the backtick
      const beforeTag = trimmed.substring(0, backtickIndex).trim();
      const parts = beforeTag.split(/\s+/);
      if (parts.length >= 2) {
        goName = parts[0];
        goType = parts.slice(1).join(' ').trim();
      } else {
        return null;
      }
    } else {
      // No tags - just name and type
      // Check for inline comment
      let lineWithoutComment = trimmed;
      const commentIdx = trimmed.indexOf('//');
      if (commentIdx > 0) {
        lineWithoutComment = trimmed.substring(0, commentIdx).trim();
      }
      
      const parts = lineWithoutComment.split(/\s+/);
      if (parts.length >= 2) {
        goName = parts[0];
        goType = parts.slice(1).join(' ').trim();
      } else {
        return null;
      }
    }

    // Verify it's an exported field (starts with uppercase)
    if (!goName || !(goName[0] >= 'A' && goName[0] <= 'Z')) {
      return null;
    }

    // Parse tags if present
    const tags = tagString ? this.tagParser.parseFieldTags('`' + tagString + '`') : {
      json: undefined,
      validate: undefined,
    };

    // Skip if json:"-"
    if (tags.json?.skip) {
      return {
        name: goName,
        jsonName: goName,
        goType,
        isPointer: goType.startsWith('*'),
        omitempty: false,
        skip: true,
        validateRequired: false,
      };
    }

    // Determine JSON name
    let jsonName = goName;
    if (tags.json?.name) {
      jsonName = tags.json.name;
    }

    return {
      name: goName,
      jsonName,
      goType,
      isPointer: goType.startsWith('*'),
      omitempty: tags.json?.omitempty ?? false,
      skip: false,
      validateRequired: tags.validate?.required ?? false,
      description: this.extractFieldComment(bodyLines, lineIndex),
    };
  }

  /**
   * Parse embedded types from lines of struct body
   */
  private parseEmbeddedTypes(bodyLines: string[]): string[] {
    const embedded: string[] = [];

    for (const line of bodyLines) {
      // Remove trailing \r for Windows CRLF line endings
      const trimmed = line.replace(/\r$/, '').trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('//') || trimmed === '}') {
        continue;
      }

      // Match embedded type: just a type name (or *TypeName)
      // An embedded type line has only the type name, possibly with a pointer prefix
      // Must not have a second word (that would be a field name followed by type)
      // May have a trailing comment after the type name
      
      // First, strip any trailing comment
      let lineForEmbedCheck = trimmed;
      const commentIdx = trimmed.indexOf('//');
      if (commentIdx > 0) {
        lineForEmbedCheck = trimmed.substring(0, commentIdx).trim();
      }
      
      const embeddedMatch = lineForEmbedCheck.match(
        /^(\*?[A-Z][a-zA-Z0-9_]*(?:\.[A-Z][a-zA-Z0-9_]*)?)\s*$/
      );
      if (embeddedMatch) {
        embedded.push(embeddedMatch[1]);
        continue;
      }

      // Also match embedded interface types like io.Reader
      const pkgEmbeddedMatch = trimmed.match(
        /^([a-z]+\.[A-Z][a-zA-Z0-9_]*)\s*$/
      );
      if (pkgEmbeddedMatch) {
        embedded.push(pkgEmbeddedMatch[1]);
      }
    }

    return embedded;
  }

  /**
   * Parse interface methods from lines of interface body
   */
  private parseInterfaceMethods(
    bodyLines: string[]
  ): { methods: GoMethod[]; embeddedInterfaces: string[] } {
    const methods: GoMethod[] = [];
    const embeddedInterfaces: string[] = [];

    for (const line of bodyLines) {
      // Skip empty lines and comments
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed === '}') {
        continue;
      }

      // Match method: MethodName(params) (returns)
      const methodMatch = trimmed.match(
        /^([A-Z][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*(?:\(([^)]*)\)|([^\s(][^\s]*))?/
      );
      if (methodMatch) {
        const methodName = methodMatch[1];
        const paramsStr = methodMatch[2];
        const returnsMulti = methodMatch[3];
        const returnsSingle = methodMatch[4];

        // Parse parameters
        const parameters = this.parseMethodParams(paramsStr);

        // Parse return types
        let returnType: string[] | undefined;
        if (returnsMulti) {
          returnType = this.parseReturnTypes(returnsMulti);
        } else if (returnsSingle) {
          returnType = [returnsSingle.trim()];
        }

        methods.push({
          name: methodName,
          parameters: parameters.length > 0 ? parameters : undefined,
          returnType,
        });
        continue;
      }

      // Match embedded interface: just a type name (io.Reader, Closer, etc.)
      const embeddedMatch = trimmed.match(
        /^([a-zA-Z]+(?:\.[A-Z][a-zA-Z0-9_]*)?)$/
      );
      if (embeddedMatch && !trimmed.includes('(')) {
        embeddedInterfaces.push(embeddedMatch[1]);
      }
    }

    return { methods, embeddedInterfaces };
  }

  /**
   * Parse method parameters from parameter string
   */
  private parseMethodParams(paramsStr: string): string[] {
    if (!paramsStr.trim()) {
      return [];
    }

    const params: string[] = [];
    const parts = paramsStr.split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Match "name Type" or "name, name2 Type"
      const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (match) {
        params.push(match[1]);
      }
    }

    return params;
  }

  /**
   * Parse return types from return string
   */
  private parseReturnTypes(returnsStr: string): string[] {
    if (!returnsStr.trim()) {
      return [];
    }

    const returns: string[] = [];
    const parts = returnsStr.split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Return might be "name Type" or just "Type"
      // Extract the type (last word, or pointer type, or interface type)
      const typeMatch = trimmed.match(
        /(?:[a-zA-Z_][a-zA-Z0-9_]*\s+)?(\*?[a-zA-Z_][a-zA-Z0-9_]*(?:\[[^\]]*\])?)/
      );
      if (typeMatch) {
        let typeName = typeMatch[1];
        // Strip pointer prefix for cleaner type representation
        // The test expects 'UserEntity' not '*UserEntity'
        if (typeName.startsWith('*')) {
          typeName = typeName.slice(1);
        }
        returns.push(typeName);
      }
    }

    return returns;
  }

  /**
   * Extract comment above a struct/interface definition
   */
  private extractComment(lines: string[], lineIndex: number): string | undefined {
    const comments: string[] = [];
    let i = lineIndex - 1;

    while (i >= 0) {
      const line = lines[i].trim();
      if (line.startsWith('//')) {
        comments.unshift(line.slice(2).trim());
        i--;
      } else if (line.startsWith('/*') || line.endsWith('*/')) {
        // Skip block comments for now
        break;
      } else if (line === '') {
        // Empty line - stop looking
        break;
      } else {
        break;
      }
    }

    return comments.length > 0 ? comments.join(' ') : undefined;
  }

  /**
   * Extract inline comment for a field
   */
  private extractFieldComment(
    bodyLines: string[],
    lineIndex: number
  ): string | undefined {
    const line = bodyLines[lineIndex];
    // Check for inline comment: Field Type // comment
    const inlineMatch = line.match(/\/\/\s*(.+)$/);
    if (inlineMatch) {
      return inlineMatch[1].trim();
    }

    // Check for comment on previous line
    if (lineIndex > 0) {
      const prevLine = bodyLines[lineIndex - 1].trim();
      if (prevLine.startsWith('//')) {
        return prevLine.slice(2).trim();
      }
    }

    return undefined;
  }
}
