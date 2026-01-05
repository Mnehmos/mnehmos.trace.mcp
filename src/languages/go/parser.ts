/**
 * Go Language Parser
 * Main parser class for Go struct/interface extraction and route detection
 */

import type { GoSchema, GoRoute, GoParseOptions, GoStruct } from './types.js';

import { StructExtractor } from './struct-extractor.js';
import { TagParser } from './tag-parser.js';
import { TypeConverter } from './type-converter.js';
import { StdlibHandler } from './handlers/stdlib.js';
import { ChiHandler } from './handlers/chi.js';
import { GinHandler } from './handlers/gin.js';

/**
 * GoParser - Parses Go source code to extract schemas and routes
 * 
 * Note: This parser is designed for Go-specific extraction and
 * implements its own interface rather than the generic LanguageParser.
 */
export class GoParser {
  readonly name = 'go';
  readonly filePatterns = ['**/*.go'];
  readonly extensions = ['.go'];

  private structExtractor: StructExtractor;
  private typeConverter: TypeConverter;
  private tagParser: TagParser;

  constructor() {
    this.tagParser = new TagParser();
    this.structExtractor = new StructExtractor(this.tagParser);
    this.typeConverter = new TypeConverter();
  }

  /**
   * Check if this parser can handle the given file
   */
  canParse(filePath: string): boolean {
    return filePath.endsWith('.go') && !filePath.endsWith('.go.bak');
  }

  /**
   * Extract schemas (structs and interfaces) from Go source content
   */
  async extractSchemas(options: GoParseOptions): Promise<GoSchema[]> {
    const { content, filePath } = options;
    const schemas: GoSchema[] = [];

    // Handle empty or invalid content
    if (!content || content.trim() === '') {
      return [];
    }

    // Extract type aliases first for type resolution
    const typeAliases = this.structExtractor.extractTypeAliases(content);
    this.typeConverter.registerAliases(typeAliases);

    // Extract structs
    const structs = this.structExtractor.extract(content, filePath);
    const structMap = new Map<string, GoStruct>(structs.map(s => [s.name, s]));

    // Convert structs to schemas
    for (const struct of structs) {
      const schema = this.typeConverter.structToSchema(struct, structMap);
      schemas.push(schema);
    }

    // Extract interfaces
    const interfaces = this.structExtractor.extractInterfaces(content, filePath);
    for (const iface of interfaces) {
      schemas.push({
        name: iface.name,
        type: 'interface',
        description: iface.description,
        methods: iface.methods,
        sourceLocation: iface.sourceLocation,
      });
    }

    return schemas;
  }

  /**
   * Extract HTTP routes from Go source content
   */
  async extractRoutes(options: GoParseOptions): Promise<GoRoute[]> {
    const { content } = options;
    const routes: GoRoute[] = [];

    if (!content || content.trim() === '') {
      return [];
    }

    try {
      // Detect stdlib routes
      const stdlibRoutes = StdlibHandler.detect(content);
      routes.push(...stdlibRoutes);

      // Detect Chi routes
      const chiRoutes = ChiHandler.detect(content);
      routes.push(...chiRoutes);

      // Detect Gin routes
      const ginRoutes = GinHandler.detect(content);
      routes.push(...ginRoutes);
    } catch {
      // Return partial results on error
    }

    return routes;
  }
}
