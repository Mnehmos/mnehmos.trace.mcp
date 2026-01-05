/**
 * Go Language Parser - Main Entry Point
 * 
 * Exports:
 * - GoParser: Main parser class for Go source files
 * - Types: GoSchema, GoRoute, GoStruct, etc.
 * - Utilities: StructExtractor, TagParser, TypeConverter
 * - Handlers: StdlibHandler, ChiHandler, GinHandler
 */

// Main parser
export { GoParser } from './parser.js';

// Types
export type {
  GoField,
  GoStruct,
  GoMethod,
  GoInterface,
  GoRoute,
  ParsedTag,
  GoParseOptions,
  GoSchema,
  GoProperty,
  GoTypeAlias,
} from './types.js';

// Utilities
export { StructExtractor } from './struct-extractor.js';
export { TagParser, parseJsonTag, parseStructTags, extractTagString } from './tag-parser.js';
export { TypeConverter, convertGoType } from './type-converter.js';

// HTTP Handler detectors
export { StdlibHandler, detectStdlibHandlers } from './handlers/stdlib.js';
export { ChiHandler, detectChiRoutes, extractChiParams } from './handlers/chi.js';
export { GinHandler, detectGinRoutes, extractGinParams } from './handlers/gin.js';
