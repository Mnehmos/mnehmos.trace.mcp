/**
 * SQL DDL Types
 *
 * Type definitions for SQL DDL parsing.
 * Supports PostgreSQL, MySQL, and SQLite dialects.
 *
 * @module adapters/sql/types
 */

/**
 * Supported SQL dialects
 */
export type SQLDialect = 'postgresql' | 'mysql' | 'sqlite';

/**
 * SQL column definition
 */
export interface SQLColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isUnique: boolean;
  references?: SQLForeignKey;
  constraints: SQLConstraint[];
}

/**
 * SQL foreign key reference
 */
export interface SQLForeignKey {
  table: string;
  column: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';
}

/**
 * SQL constraint
 */
export interface SQLConstraint {
  type: 'CHECK' | 'UNIQUE' | 'PRIMARY KEY' | 'FOREIGN KEY' | 'NOT NULL' | 'DEFAULT';
  name?: string;
  expression?: string;
}

/**
 * SQL table definition
 */
export interface SQLTable {
  name: string;
  schema?: string;
  columns: SQLColumn[];
  primaryKey?: string[];
  uniqueConstraints: string[][];
  foreignKeys: SQLForeignKey[];
  checkConstraints: string[];
}

/**
 * SQL enum type definition
 */
export interface SQLEnum {
  name: string;
  schema?: string;
  values: string[];
}

/**
 * Parsed SQL DDL result
 */
export interface SQLParseResult {
  tables: SQLTable[];
  enums: SQLEnum[];
  dialect: SQLDialect;
}

/**
 * Map SQL types to normalized types
 */
export const SQL_TYPE_MAP: Record<string, { kind: string; value?: string }> = {
  // String types
  'text': { kind: 'primitive', value: 'string' },
  'varchar': { kind: 'primitive', value: 'string' },
  'char': { kind: 'primitive', value: 'string' },
  'character varying': { kind: 'primitive', value: 'string' },
  'character': { kind: 'primitive', value: 'string' },
  'uuid': { kind: 'primitive', value: 'string' },
  'citext': { kind: 'primitive', value: 'string' },

  // Numeric types
  'integer': { kind: 'primitive', value: 'number' },
  'int': { kind: 'primitive', value: 'number' },
  'int4': { kind: 'primitive', value: 'number' },
  'int8': { kind: 'primitive', value: 'number' },
  'smallint': { kind: 'primitive', value: 'number' },
  'bigint': { kind: 'primitive', value: 'number' },
  'serial': { kind: 'primitive', value: 'number' },
  'bigserial': { kind: 'primitive', value: 'number' },
  'smallserial': { kind: 'primitive', value: 'number' },
  'decimal': { kind: 'primitive', value: 'number' },
  'numeric': { kind: 'primitive', value: 'number' },
  'real': { kind: 'primitive', value: 'number' },
  'float': { kind: 'primitive', value: 'number' },
  'float4': { kind: 'primitive', value: 'number' },
  'float8': { kind: 'primitive', value: 'number' },
  'double precision': { kind: 'primitive', value: 'number' },
  'money': { kind: 'primitive', value: 'number' },

  // Boolean types
  'boolean': { kind: 'primitive', value: 'boolean' },
  'bool': { kind: 'primitive', value: 'boolean' },

  // Date/Time types (represented as strings in JSON)
  'date': { kind: 'primitive', value: 'string' },
  'time': { kind: 'primitive', value: 'string' },
  'timestamp': { kind: 'primitive', value: 'string' },
  'timestamptz': { kind: 'primitive', value: 'string' },
  'timestamp with time zone': { kind: 'primitive', value: 'string' },
  'timestamp without time zone': { kind: 'primitive', value: 'string' },
  'interval': { kind: 'primitive', value: 'string' },

  // JSON types
  'json': { kind: 'any' },
  'jsonb': { kind: 'any' },

  // Binary types
  'bytea': { kind: 'primitive', value: 'string' },
  'blob': { kind: 'primitive', value: 'string' },

  // Array types (handled specially in parser)
  // Network types
  'inet': { kind: 'primitive', value: 'string' },
  'cidr': { kind: 'primitive', value: 'string' },
  'macaddr': { kind: 'primitive', value: 'string' },

  // Geometric types
  'point': { kind: 'any' },
  'line': { kind: 'any' },
  'box': { kind: 'any' },
  'circle': { kind: 'any' },
  'polygon': { kind: 'any' },
};
