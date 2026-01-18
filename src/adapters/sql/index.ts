/**
 * SQL DDL Adapter
 *
 * Exports for SQL DDL schema extraction.
 * Supports PostgreSQL, MySQL, and SQLite dialects.
 *
 * @module adapters/sql
 */

export { SQLAdapter } from './adapter.js';
export { DDLParser, parseDDL } from './ddl-parser.js';
export type {
  SQLDialect,
  SQLTable,
  SQLColumn,
  SQLEnum,
  SQLParseResult,
  SQLForeignKey,
  SQLConstraint,
} from './types.js';
export { SQL_TYPE_MAP } from './types.js';
