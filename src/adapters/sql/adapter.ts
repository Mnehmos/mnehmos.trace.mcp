/**
 * SQL DDL Adapter
 *
 * Extracts schemas from SQL DDL files (CREATE TABLE, CREATE TYPE, etc.)
 * and converts them to normalized schema format.
 *
 * @module adapters/sql/adapter
 */

import { readFileSync } from 'fs';
import { glob } from 'glob';
import { resolve, basename } from 'path';
import type {
  SchemaAdapter,
  SchemaRef,
  NormalizedSchema,
  NormalizedType,
  PropertyDef,
} from '../../core/types.js';
import { DDLParser, parseDDL } from './ddl-parser.js';
import { SQL_TYPE_MAP } from './types.js';
import type { SQLTable, SQLColumn, SQLEnum, SQLDialect } from './types.js';

/**
 * Adapter for SQL DDL schema extraction
 */
export class SQLAdapter implements SchemaAdapter {
  readonly kind = 'sql_ddl' as const;

  /**
   * Check if this adapter supports the given schema reference
   */
  supports(ref: SchemaRef): boolean {
    return ref.source === 'sql_ddl';
  }

  /**
   * Extract schema from a SQL file or table reference
   *
   * @param ref Schema reference with id format: "file:/path/to/file.sql" or "table:tablename"
   */
  async extract(ref: SchemaRef): Promise<NormalizedSchema> {
    const { id, options } = ref;
    const dialect = (options?.dialect as SQLDialect) || 'postgresql';

    // Parse the reference ID
    if (id.startsWith('file:')) {
      const filePath = id.slice(5);
      return this.extractFromFile(filePath, dialect, options?.table as string);
    } else if (id.startsWith('table:')) {
      const tableName = id.slice(6);
      const filePath = options?.file as string;
      if (!filePath) {
        throw new Error('SQL table reference requires "file" option');
      }
      return this.extractFromFile(filePath, dialect, tableName);
    }

    throw new Error(`Invalid SQL schema reference: ${id}`);
  }

  /**
   * List all available schemas in a directory
   */
  async list(basePath: string): Promise<SchemaRef[]> {
    const refs: SchemaRef[] = [];

    // Find all .sql files
    const sqlFiles = await glob('**/*.sql', {
      cwd: basePath,
      absolute: true,
      ignore: ['**/node_modules/**'],
    });

    for (const file of sqlFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const result = parseDDL(content);

        // Add a ref for each table
        for (const table of result.tables) {
          refs.push({
            source: 'sql_ddl',
            id: `table:${table.name}`,
            options: { file, table: table.name },
          });
        }
      } catch {
        // Skip files that can't be parsed
      }
    }

    return refs;
  }

  /**
   * Extract schema from a SQL file
   */
  private extractFromFile(
    filePath: string,
    dialect: SQLDialect,
    tableName?: string
  ): NormalizedSchema {
    const absolutePath = resolve(filePath);
    const content = readFileSync(absolutePath, 'utf-8');
    const result = parseDDL(content, dialect);

    if (tableName) {
      // Find specific table
      const table = result.tables.find(
        t => t.name.toLowerCase() === tableName.toLowerCase()
      );
      if (!table) {
        throw new Error(`Table "${tableName}" not found in ${filePath}`);
      }
      return this.tableToSchema(table, result.enums, filePath);
    }

    // Return all tables as a combined schema
    if (result.tables.length === 0) {
      throw new Error(`No tables found in ${filePath}`);
    }

    if (result.tables.length === 1) {
      return this.tableToSchema(result.tables[0], result.enums, filePath);
    }

    // Multiple tables - create a schema with each table as a property
    const properties: Record<string, PropertyDef> = {};
    for (const table of result.tables) {
      properties[table.name] = {
        type: {
          kind: 'object',
          schema: this.tableToSchema(table, result.enums, filePath),
        },
        optional: false,
        nullable: false,
        readonly: false,
        deprecated: false,
      };
    }

    return {
      name: basename(filePath, '.sql'),
      properties,
      required: result.tables.map(t => t.name),
      source: { source: 'sql_ddl', id: `file:${filePath}` },
      location: { file: absolutePath, line: 1 },
    };
  }

  /**
   * Convert a SQL table to normalized schema
   */
  private tableToSchema(
    table: SQLTable,
    enums: SQLEnum[],
    filePath: string
  ): NormalizedSchema {
    const properties: Record<string, PropertyDef> = {};
    const required: string[] = [];

    for (const column of table.columns) {
      const type = this.columnToType(column, enums);
      const optional = column.nullable && !column.isPrimaryKey;

      properties[column.name] = {
        type,
        optional,
        nullable: column.nullable,
        readonly: false,
        deprecated: false,
        description: this.buildColumnDescription(column),
        constraints: this.extractConstraints(column),
      };

      if (!optional) {
        required.push(column.name);
      }
    }

    return {
      name: table.name,
      properties,
      required,
      source: {
        source: 'sql_ddl',
        id: `table:${table.name}`,
        options: { file: filePath },
      },
      location: { file: resolve(filePath), line: 1 },
    };
  }

  /**
   * Convert a SQL column to normalized type
   */
  private columnToType(column: SQLColumn, enums: SQLEnum[]): NormalizedType {
    let { dataType } = column;
    let isArray = false;

    // Check for array type
    if (dataType.endsWith('[]')) {
      isArray = true;
      dataType = dataType.slice(0, -2);
    }

    // Check for enum type
    if (dataType.startsWith('enum:')) {
      const enumName = dataType.slice(5);
      const enumDef = enums.find(e => e.name === enumName);
      if (enumDef) {
        const enumType: NormalizedType = {
          kind: 'union',
          variants: enumDef.values.map(v => ({ kind: 'literal' as const, value: v })),
        };
        return isArray ? { kind: 'array', element: enumType } : enumType;
      }
    }

    // Remove size specification for lookup (e.g., varchar(255) -> varchar)
    const baseType = dataType.replace(/\s*\([^)]+\)/, '').toLowerCase();

    // Look up type mapping
    const mapped = SQL_TYPE_MAP[baseType];
    let normalizedType: NormalizedType;

    if (mapped) {
      if (mapped.kind === 'primitive' && mapped.value) {
        normalizedType = { kind: 'primitive', value: mapped.value as 'string' | 'number' | 'boolean' | 'null' };
      } else if (mapped.kind === 'any') {
        normalizedType = { kind: 'any' };
      } else {
        normalizedType = { kind: 'unknown' };
      }
    } else {
      // Unknown type - might be a custom enum or type
      normalizedType = { kind: 'ref', name: dataType };
    }

    // Wrap in array if needed
    if (isArray) {
      return { kind: 'array', element: normalizedType };
    }

    // Handle nullable
    if (column.nullable) {
      return {
        kind: 'union',
        variants: [normalizedType, { kind: 'primitive', value: 'null' }],
      };
    }

    return normalizedType;
  }

  /**
   * Build a description for a column
   */
  private buildColumnDescription(column: SQLColumn): string | undefined {
    const parts: string[] = [];

    if (column.isPrimaryKey) {
      parts.push('Primary key');
    }
    if (column.isUnique) {
      parts.push('Unique');
    }
    if (column.references) {
      parts.push(`References ${column.references.table}(${column.references.column})`);
    }
    if (column.defaultValue) {
      parts.push(`Default: ${column.defaultValue}`);
    }

    return parts.length > 0 ? parts.join('. ') : undefined;
  }

  /**
   * Extract constraints from column definition
   */
  private extractConstraints(column: SQLColumn): Record<string, unknown> | undefined {
    const constraints: Record<string, unknown> = {};

    // Check for varchar/char length constraint
    const lengthMatch = column.dataType.match(/\((\d+)\)/);
    if (lengthMatch) {
      constraints.maxLength = parseInt(lengthMatch[1], 10);
    }

    // Check for numeric precision
    const precisionMatch = column.dataType.match(/\((\d+),\s*(\d+)\)/);
    if (precisionMatch) {
      constraints.precision = parseInt(precisionMatch[1], 10);
      constraints.scale = parseInt(precisionMatch[2], 10);
    }

    // Check constraints
    for (const constraint of column.constraints) {
      if (constraint.type === 'CHECK' && constraint.expression) {
        constraints.check = constraint.expression;
      }
    }

    return Object.keys(constraints).length > 0 ? constraints : undefined;
  }
}
