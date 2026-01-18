/**
 * SQL DDL Parser
 *
 * Parses SQL DDL statements (CREATE TABLE, CREATE TYPE, ALTER TABLE)
 * and extracts schema information.
 *
 * Supports PostgreSQL, MySQL, and SQLite dialects.
 *
 * @module adapters/sql/ddl-parser
 */

import type {
  SQLDialect,
  SQLTable,
  SQLColumn,
  SQLEnum,
  SQLParseResult,
  SQLForeignKey,
  SQLConstraint,
} from './types.js';

/**
 * DDL Parser for SQL schema extraction
 */
export class DDLParser {
  private dialect: SQLDialect;

  constructor(dialect: SQLDialect = 'postgresql') {
    this.dialect = dialect;
  }

  /**
   * Parse SQL DDL content and extract schema information
   */
  parse(content: string): SQLParseResult {
    const tables: SQLTable[] = [];
    const enums: SQLEnum[] = [];

    // Normalize content: remove comments, normalize whitespace
    const normalized = this.normalizeSQL(content);

    // Extract CREATE TYPE (enums) - PostgreSQL
    const enumMatches = normalized.matchAll(
      /CREATE\s+TYPE\s+(?:(?:"([^"]+)"|(\w+))\.)?(?:"([^"]+)"|(\w+))\s+AS\s+ENUM\s*\(\s*([^)]+)\s*\)/gi
    );
    for (const match of enumMatches) {
      const schema = match[1] || match[2];
      const name = match[3] || match[4];
      const valuesStr = match[5];
      const values = this.parseEnumValues(valuesStr);
      enums.push({ name, schema, values });
    }

    // Extract CREATE TABLE statements
    const tableMatches = normalized.matchAll(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"([^"]+)"|(\w+))\.)?(?:"([^"]+)"|(\w+))\s*\(\s*([\s\S]*?)\s*\)(?:\s*;|\s*$)/gi
    );
    for (const match of tableMatches) {
      const schema = match[1] || match[2];
      const name = match[3] || match[4];
      const columnsStr = match[5];
      const table = this.parseTableBody(name, schema, columnsStr, enums);
      tables.push(table);
    }

    // Handle ALTER TABLE ADD COLUMN
    const alterMatches = normalized.matchAll(
      /ALTER\s+TABLE\s+(?:(?:"([^"]+)"|(\w+))\.)?(?:"([^"]+)"|(\w+))\s+ADD\s+(?:COLUMN\s+)?(?:"([^"]+)"|(\w+))\s+([^;,]+)/gi
    );
    for (const match of alterMatches) {
      const tableName = match[3] || match[4];
      const columnName = match[5] || match[6];
      const columnDef = match[7];

      const table = tables.find(t => t.name === tableName);
      if (table) {
        const column = this.parseColumnDefinition(columnName, columnDef.trim(), enums);
        table.columns.push(column);
      }
    }

    return { tables, enums, dialect: this.dialect };
  }

  /**
   * Normalize SQL content for easier parsing
   */
  private normalizeSQL(content: string): string {
    return content
      // Remove single-line comments
      .replace(/--[^\n]*/g, '')
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Parse enum values from string
   */
  private parseEnumValues(valuesStr: string): string[] {
    const values: string[] = [];
    const matches = valuesStr.matchAll(/'([^']+)'/g);
    for (const match of matches) {
      values.push(match[1]);
    }
    return values;
  }

  /**
   * Parse table body (columns and constraints)
   */
  private parseTableBody(
    name: string,
    schema: string | undefined,
    body: string,
    enums: SQLEnum[]
  ): SQLTable {
    const columns: SQLColumn[] = [];
    const primaryKey: string[] = [];
    const uniqueConstraints: string[][] = [];
    const foreignKeys: SQLForeignKey[] = [];
    const checkConstraints: string[] = [];

    // Split by comma, but respect parentheses
    const parts = this.splitTableBody(body);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Check for table-level constraints
      if (/^PRIMARY\s+KEY/i.test(trimmed)) {
        const pkMatch = trimmed.match(/PRIMARY\s+KEY\s*\(\s*([^)]+)\s*\)/i);
        if (pkMatch) {
          const cols = this.parseColumnList(pkMatch[1]);
          primaryKey.push(...cols);
        }
      } else if (/^UNIQUE/i.test(trimmed)) {
        const ukMatch = trimmed.match(/UNIQUE\s*\(\s*([^)]+)\s*\)/i);
        if (ukMatch) {
          const cols = this.parseColumnList(ukMatch[1]);
          uniqueConstraints.push(cols);
        }
      } else if (/^FOREIGN\s+KEY/i.test(trimmed)) {
        const fkMatch = trimmed.match(
          /FOREIGN\s+KEY\s*\(\s*([^)]+)\s*\)\s*REFERENCES\s+(?:"([^"]+)"|(\w+))\s*\(\s*([^)]+)\s*\)/i
        );
        if (fkMatch) {
          foreignKeys.push({
            table: fkMatch[2] || fkMatch[3],
            column: this.parseColumnList(fkMatch[4])[0],
          });
        }
      } else if (/^CHECK/i.test(trimmed)) {
        const checkMatch = trimmed.match(/CHECK\s*\(\s*(.+)\s*\)/i);
        if (checkMatch) {
          checkConstraints.push(checkMatch[1]);
        }
      } else if (/^CONSTRAINT/i.test(trimmed)) {
        // Named constraint - parse the type
        if (/PRIMARY\s+KEY/i.test(trimmed)) {
          const pkMatch = trimmed.match(/PRIMARY\s+KEY\s*\(\s*([^)]+)\s*\)/i);
          if (pkMatch) {
            primaryKey.push(...this.parseColumnList(pkMatch[1]));
          }
        } else if (/UNIQUE/i.test(trimmed)) {
          const ukMatch = trimmed.match(/UNIQUE\s*\(\s*([^)]+)\s*\)/i);
          if (ukMatch) {
            uniqueConstraints.push(this.parseColumnList(ukMatch[1]));
          }
        } else if (/FOREIGN\s+KEY/i.test(trimmed)) {
          const fkMatch = trimmed.match(
            /FOREIGN\s+KEY\s*\(\s*([^)]+)\s*\)\s*REFERENCES\s+(?:"([^"]+)"|(\w+))\s*\(\s*([^)]+)\s*\)/i
          );
          if (fkMatch) {
            foreignKeys.push({
              table: fkMatch[2] || fkMatch[3],
              column: this.parseColumnList(fkMatch[4])[0],
            });
          }
        } else if (/CHECK/i.test(trimmed)) {
          const checkMatch = trimmed.match(/CHECK\s*\(\s*(.+)\s*\)/i);
          if (checkMatch) {
            checkConstraints.push(checkMatch[1]);
          }
        }
      } else {
        // Column definition
        const column = this.parseColumnFromPart(trimmed, enums);
        if (column) {
          columns.push(column);
          if (column.isPrimaryKey) {
            primaryKey.push(column.name);
          }
        }
      }
    }

    return {
      name,
      schema,
      columns,
      primaryKey: primaryKey.length > 0 ? primaryKey : undefined,
      uniqueConstraints,
      foreignKeys,
      checkConstraints,
    };
  }

  /**
   * Split table body by commas, respecting parentheses
   */
  private splitTableBody(body: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of body) {
      if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  /**
   * Parse column list from string
   */
  private parseColumnList(str: string): string[] {
    return str
      .split(',')
      .map(s => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  }

  /**
   * Parse a column from table body part
   */
  private parseColumnFromPart(part: string, enums: SQLEnum[]): SQLColumn | null {
    // Match column name and type
    const match = part.match(/^(?:"([^"]+)"|(\w+))\s+(.+)$/i);
    if (!match) return null;

    const name = match[1] || match[2];
    const rest = match[3];

    return this.parseColumnDefinition(name, rest, enums);
  }

  /**
   * Parse column definition
   */
  private parseColumnDefinition(
    name: string,
    definition: string,
    enums: SQLEnum[]
  ): SQLColumn {
    const constraints: SQLConstraint[] = [];
    let nullable = true;
    let isPrimaryKey = false;
    let isUnique = false;
    let defaultValue: string | undefined;
    let references: SQLForeignKey | undefined;

    // Extract data type (first word or type with parentheses)
    const typeMatch = definition.match(/^(\w+(?:\s*\([^)]+\))?(?:\s*\[\])?)/i);
    let dataType = typeMatch ? typeMatch[1].trim().toLowerCase() : 'text';

    // Check for array type
    const isArray = /\[\]$/.test(dataType);
    if (isArray) {
      dataType = dataType.replace(/\[\]$/, '');
    }

    // Check for enum type
    const enumType = enums.find(
      e => e.name.toLowerCase() === dataType.toLowerCase()
    );

    // Parse constraints from rest of definition
    const rest = definition.slice(typeMatch?.[0].length || 0).trim();

    if (/\bNOT\s+NULL\b/i.test(rest)) {
      nullable = false;
      constraints.push({ type: 'NOT NULL' });
    }

    if (/\bNULL\b/i.test(rest) && !/\bNOT\s+NULL\b/i.test(rest)) {
      nullable = true;
    }

    if (/\bPRIMARY\s+KEY\b/i.test(rest)) {
      isPrimaryKey = true;
      nullable = false;
      constraints.push({ type: 'PRIMARY KEY' });
    }

    if (/\bUNIQUE\b/i.test(rest)) {
      isUnique = true;
      constraints.push({ type: 'UNIQUE' });
    }

    const defaultMatch = rest.match(/\bDEFAULT\s+([^,\s]+(?:\([^)]*\))?)/i);
    if (defaultMatch) {
      defaultValue = defaultMatch[1];
      constraints.push({ type: 'DEFAULT', expression: defaultValue });
    }

    const refMatch = rest.match(
      /\bREFERENCES\s+(?:"([^"]+)"|(\w+))\s*\(\s*(?:"([^"]+)"|(\w+))\s*\)/i
    );
    if (refMatch) {
      references = {
        table: refMatch[1] || refMatch[2],
        column: refMatch[3] || refMatch[4],
      };
      constraints.push({ type: 'FOREIGN KEY' });
    }

    const checkMatch = rest.match(/\bCHECK\s*\(\s*(.+?)\s*\)/i);
    if (checkMatch) {
      constraints.push({ type: 'CHECK', expression: checkMatch[1] });
    }

    return {
      name,
      dataType: enumType ? `enum:${enumType.name}` : (isArray ? `${dataType}[]` : dataType),
      nullable,
      defaultValue,
      isPrimaryKey,
      isUnique,
      references,
      constraints,
    };
  }
}

/**
 * Convenience function to parse SQL DDL
 */
export function parseDDL(content: string, dialect: SQLDialect = 'postgresql'): SQLParseResult {
  const parser = new DDLParser(dialect);
  return parser.parse(content);
}
