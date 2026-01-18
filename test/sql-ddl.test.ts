/**
 * SQL DDL Parser Tests
 *
 * Tests for SQL DDL parsing and schema extraction.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DDLParser, parseDDL, SQLAdapter } from '../src/adapters/sql/index.js';
import { bootstrapAdapters, hasAdapter, getAdapter } from '../src/adapters/index.js';
import type { SQLTable, SQLEnum } from '../src/adapters/sql/types.js';

describe('SQL DDL Parser', () => {
  describe('DDLParser', () => {
    describe('CREATE TABLE parsing', () => {
      it('should parse a simple CREATE TABLE statement', () => {
        const sql = `
          CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email TEXT UNIQUE
          );
        `;

        const result = parseDDL(sql);

        expect(result.tables).toHaveLength(1);
        expect(result.tables[0].name).toBe('users');
        expect(result.tables[0].columns).toHaveLength(3);
      });

      it('should parse column types correctly', () => {
        const sql = `
          CREATE TABLE test (
            id INTEGER PRIMARY KEY,
            name VARCHAR(100),
            amount DECIMAL(10,2),
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT now()
          );
        `;

        const result = parseDDL(sql);
        const table = result.tables[0];

        expect(table.columns.find(c => c.name === 'id')?.dataType).toBe('integer');
        expect(table.columns.find(c => c.name === 'name')?.dataType).toBe('varchar(100)');
        expect(table.columns.find(c => c.name === 'amount')?.dataType).toBe('decimal(10,2)');
        expect(table.columns.find(c => c.name === 'active')?.dataType).toBe('boolean');
        expect(table.columns.find(c => c.name === 'created_at')?.dataType).toBe('timestamptz');
      });

      it('should parse NOT NULL constraints', () => {
        const sql = `
          CREATE TABLE test (
            required_field TEXT NOT NULL,
            optional_field TEXT
          );
        `;

        const result = parseDDL(sql);
        const table = result.tables[0];

        expect(table.columns.find(c => c.name === 'required_field')?.nullable).toBe(false);
        expect(table.columns.find(c => c.name === 'optional_field')?.nullable).toBe(true);
      });

      it('should parse PRIMARY KEY constraint', () => {
        const sql = `
          CREATE TABLE test (
            id UUID PRIMARY KEY,
            name TEXT
          );
        `;

        const result = parseDDL(sql);
        const table = result.tables[0];

        expect(table.columns.find(c => c.name === 'id')?.isPrimaryKey).toBe(true);
        expect(table.primaryKey).toContain('id');
      });

      it('should parse UNIQUE constraint', () => {
        const sql = `
          CREATE TABLE test (
            email TEXT UNIQUE NOT NULL,
            phone TEXT
          );
        `;

        const result = parseDDL(sql);
        const table = result.tables[0];

        expect(table.columns.find(c => c.name === 'email')?.isUnique).toBe(true);
        expect(table.columns.find(c => c.name === 'phone')?.isUnique).toBe(false);
      });

      it('should parse DEFAULT values', () => {
        const sql = `
          CREATE TABLE test (
            status TEXT DEFAULT 'pending',
            count INTEGER DEFAULT 0,
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `;

        const result = parseDDL(sql);
        const table = result.tables[0];

        expect(table.columns.find(c => c.name === 'status')?.defaultValue).toBe("'pending'");
        expect(table.columns.find(c => c.name === 'count')?.defaultValue).toBe('0');
        expect(table.columns.find(c => c.name === 'active')?.defaultValue).toBe('true');
      });

      it('should parse REFERENCES (foreign key)', () => {
        const sql = `
          CREATE TABLE orders (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            product_id INTEGER REFERENCES products(id)
          );
        `;

        const result = parseDDL(sql);
        const table = result.tables[0];

        const userIdCol = table.columns.find(c => c.name === 'user_id');
        expect(userIdCol?.references?.table).toBe('users');
        expect(userIdCol?.references?.column).toBe('id');

        const productIdCol = table.columns.find(c => c.name === 'product_id');
        expect(productIdCol?.references?.table).toBe('products');
        expect(productIdCol?.references?.column).toBe('id');
      });

      it('should parse table with schema prefix', () => {
        const sql = `
          CREATE TABLE public.users (
            id SERIAL PRIMARY KEY
          );
        `;

        const result = parseDDL(sql);

        expect(result.tables[0].name).toBe('users');
        expect(result.tables[0].schema).toBe('public');
      });

      it('should parse quoted identifiers', () => {
        const sql = `
          CREATE TABLE "User Profile" (
            "user id" SERIAL PRIMARY KEY,
            "full name" TEXT NOT NULL
          );
        `;

        const result = parseDDL(sql);

        expect(result.tables[0].name).toBe('User Profile');
        expect(result.tables[0].columns[0].name).toBe('user id');
        expect(result.tables[0].columns[1].name).toBe('full name');
      });

      it('should parse IF NOT EXISTS', () => {
        const sql = `
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY
          );
        `;

        const result = parseDDL(sql);

        expect(result.tables).toHaveLength(1);
        expect(result.tables[0].name).toBe('users');
      });

      it('should parse array types', () => {
        const sql = `
          CREATE TABLE test (
            tags TEXT[],
            scores INTEGER[]
          );
        `;

        const result = parseDDL(sql);
        const table = result.tables[0];

        expect(table.columns.find(c => c.name === 'tags')?.dataType).toBe('text[]');
        expect(table.columns.find(c => c.name === 'scores')?.dataType).toBe('integer[]');
      });

      it('should parse table-level PRIMARY KEY constraint', () => {
        const sql = `
          CREATE TABLE test (
            user_id INTEGER,
            role_id INTEGER,
            PRIMARY KEY (user_id, role_id)
          );
        `;

        const result = parseDDL(sql);
        const table = result.tables[0];

        expect(table.primaryKey).toContain('user_id');
        expect(table.primaryKey).toContain('role_id');
      });

      it('should parse table-level UNIQUE constraint', () => {
        const sql = `
          CREATE TABLE test (
            email TEXT,
            phone TEXT,
            UNIQUE (email, phone)
          );
        `;

        const result = parseDDL(sql);
        const table = result.tables[0];

        expect(table.uniqueConstraints).toHaveLength(1);
        expect(table.uniqueConstraints[0]).toContain('email');
        expect(table.uniqueConstraints[0]).toContain('phone');
      });

      it('should parse table-level FOREIGN KEY constraint', () => {
        const sql = `
          CREATE TABLE orders (
            id SERIAL,
            user_id INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id)
          );
        `;

        const result = parseDDL(sql);
        const table = result.tables[0];

        expect(table.foreignKeys).toHaveLength(1);
        expect(table.foreignKeys[0].table).toBe('users');
        expect(table.foreignKeys[0].column).toBe('id');
      });

      it('should parse named constraints', () => {
        const sql = `
          CREATE TABLE test (
            id SERIAL,
            email TEXT,
            CONSTRAINT pk_test PRIMARY KEY (id),
            CONSTRAINT uk_email UNIQUE (email)
          );
        `;

        const result = parseDDL(sql);
        const table = result.tables[0];

        expect(table.primaryKey).toContain('id');
        expect(table.uniqueConstraints[0]).toContain('email');
      });

      it('should parse CHECK constraints', () => {
        const sql = `
          CREATE TABLE test (
            age INTEGER CHECK (age >= 0),
            status TEXT,
            CONSTRAINT valid_status CHECK (status IN ('active', 'inactive'))
          );
        `;

        const result = parseDDL(sql);
        const table = result.tables[0];

        expect(table.columns.find(c => c.name === 'age')?.constraints).toContainEqual(
          expect.objectContaining({ type: 'CHECK' })
        );
        expect(table.checkConstraints).toHaveLength(1);
      });
    });

    describe('CREATE TYPE (ENUM) parsing', () => {
      it('should parse a simple ENUM type', () => {
        const sql = `
          CREATE TYPE status AS ENUM ('pending', 'active', 'completed');
        `;

        const result = parseDDL(sql);

        expect(result.enums).toHaveLength(1);
        expect(result.enums[0].name).toBe('status');
        expect(result.enums[0].values).toEqual(['pending', 'active', 'completed']);
      });

      it('should parse ENUM with schema prefix', () => {
        const sql = `
          CREATE TYPE public.user_role AS ENUM ('admin', 'user', 'guest');
        `;

        const result = parseDDL(sql);

        expect(result.enums[0].name).toBe('user_role');
        expect(result.enums[0].schema).toBe('public');
        expect(result.enums[0].values).toEqual(['admin', 'user', 'guest']);
      });

      it('should parse quoted ENUM type name', () => {
        const sql = `
          CREATE TYPE "User Status" AS ENUM ('pending', 'active');
        `;

        const result = parseDDL(sql);

        expect(result.enums[0].name).toBe('User Status');
      });

      it('should use ENUM in table column', () => {
        const sql = `
          CREATE TYPE status AS ENUM ('pending', 'active', 'completed');
          CREATE TABLE tasks (
            id SERIAL PRIMARY KEY,
            status status DEFAULT 'pending'
          );
        `;

        const result = parseDDL(sql);

        expect(result.enums).toHaveLength(1);
        expect(result.tables).toHaveLength(1);
        expect(result.tables[0].columns.find(c => c.name === 'status')?.dataType).toBe('enum:status');
      });
    });

    describe('ALTER TABLE parsing', () => {
      it('should parse ALTER TABLE ADD COLUMN', () => {
        const sql = `
          CREATE TABLE users (
            id SERIAL PRIMARY KEY
          );
          ALTER TABLE users ADD COLUMN email TEXT NOT NULL;
          ALTER TABLE users ADD name VARCHAR(255);
        `;

        const result = parseDDL(sql);

        expect(result.tables[0].columns).toHaveLength(3);
        expect(result.tables[0].columns.map(c => c.name)).toContain('email');
        expect(result.tables[0].columns.map(c => c.name)).toContain('name');
      });
    });

    describe('Comment handling', () => {
      it('should ignore single-line comments', () => {
        const sql = `
          -- This is a comment
          CREATE TABLE users (
            id SERIAL PRIMARY KEY -- inline comment
          );
        `;

        const result = parseDDL(sql);

        expect(result.tables).toHaveLength(1);
        expect(result.tables[0].columns).toHaveLength(1);
      });

      it('should ignore multi-line comments', () => {
        const sql = `
          /*
           * Multi-line comment
           */
          CREATE TABLE users (
            id SERIAL PRIMARY KEY
          );
        `;

        const result = parseDDL(sql);

        expect(result.tables).toHaveLength(1);
      });
    });

    describe('Multiple statements', () => {
      it('should parse multiple CREATE TABLE statements', () => {
        const sql = `
          CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            name TEXT
          );

          CREATE TABLE posts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            title TEXT
          );

          CREATE TABLE comments (
            id SERIAL PRIMARY KEY,
            post_id INTEGER REFERENCES posts(id),
            body TEXT
          );
        `;

        const result = parseDDL(sql);

        expect(result.tables).toHaveLength(3);
        expect(result.tables.map(t => t.name)).toEqual(['users', 'posts', 'comments']);
      });
    });

    describe('Supabase migration format', () => {
      it('should parse typical Supabase migration', () => {
        const sql = `
          -- Create enum for connection intent
          CREATE TYPE connection_intent_type AS ENUM (
            'not_looking',
            'seeking_sponsor',
            'open_to_sponsoring',
            'open_to_both'
          );

          -- Add columns to profiles
          ALTER TABLE profiles ADD COLUMN connection_intent connection_intent_type DEFAULT 'not_looking';
          ALTER TABLE profiles ADD COLUMN external_handles JSONB DEFAULT '{}';

          -- Create relationships table
          CREATE TABLE IF NOT EXISTS relationships (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sponsor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            sponsee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            sponsor_reveal_consent BOOLEAN DEFAULT false,
            sponsee_reveal_consent BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT unique_relationship UNIQUE (sponsor_id, sponsee_id)
          );
        `;

        const result = parseDDL(sql);

        // Check enum
        expect(result.enums).toHaveLength(1);
        expect(result.enums[0].name).toBe('connection_intent_type');
        expect(result.enums[0].values).toContain('seeking_sponsor');

        // Check table
        expect(result.tables).toHaveLength(1);
        expect(result.tables[0].name).toBe('relationships');
        expect(result.tables[0].columns.find(c => c.name === 'sponsor_reveal_consent')?.defaultValue).toBe('false');
      });
    });
  });

  describe('SQLAdapter', () => {
    beforeAll(() => {
      bootstrapAdapters();
    });

    it('should be registered in adapter registry', () => {
      expect(hasAdapter('sql_ddl')).toBe(true);
    });

    it('should support sql_ddl refs', () => {
      const adapter = getAdapter('sql_ddl');
      expect(adapter.supports({ source: 'sql_ddl', id: 'file:test.sql' })).toBe(true);
      expect(adapter.supports({ source: 'openapi', id: 'file:test.yaml' })).toBe(false);
    });

    describe('Schema conversion', () => {
      it('should convert SQL table to NormalizedSchema', async () => {
        const adapter = new SQLAdapter();

        // Create a temp SQL file for testing
        const sql = `
          CREATE TABLE users (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email TEXT UNIQUE,
            age INTEGER,
            active BOOLEAN DEFAULT true,
            metadata JSONB,
            created_at TIMESTAMPTZ DEFAULT now()
          );
        `;

        // Write to temp file
        const fs = await import('fs');
        const path = await import('path');
        const os = await import('os');

        const tmpDir = os.tmpdir();
        const tmpFile = path.join(tmpDir, 'test-users.sql');
        fs.writeFileSync(tmpFile, sql);

        try {
          const schema = await adapter.extract({
            source: 'sql_ddl',
            id: `file:${tmpFile}`,
          });

          expect(schema.name).toBe('users');
          expect(schema.properties).toHaveProperty('id');
          expect(schema.properties).toHaveProperty('name');
          expect(schema.properties).toHaveProperty('email');
          expect(schema.properties).toHaveProperty('age');
          expect(schema.properties).toHaveProperty('active');
          expect(schema.properties).toHaveProperty('metadata');
          expect(schema.properties).toHaveProperty('created_at');

          // Check required fields
          expect(schema.required).toContain('id');
          expect(schema.required).toContain('name');

          // Check types
          expect(schema.properties.id.type).toMatchObject({ kind: 'primitive', value: 'string' });
          expect(schema.properties.name.type).toMatchObject({ kind: 'primitive', value: 'string' });
          expect(schema.properties.active.type.kind).toBe('union'); // boolean | null for nullable
          expect(schema.properties.metadata.type.kind).toBe('union'); // any | null for nullable JSONB
        } finally {
          fs.unlinkSync(tmpFile);
        }
      });

      it('should convert ENUM types to union literals', async () => {
        const adapter = new SQLAdapter();

        const sql = `
          CREATE TYPE status AS ENUM ('pending', 'active', 'completed');
          CREATE TABLE tasks (
            id UUID PRIMARY KEY,
            status status NOT NULL
          );
        `;

        const fs = await import('fs');
        const path = await import('path');
        const os = await import('os');

        const tmpDir = os.tmpdir();
        const tmpFile = path.join(tmpDir, 'test-enum.sql');
        fs.writeFileSync(tmpFile, sql);

        try {
          const schema = await adapter.extract({
            source: 'sql_ddl',
            id: `file:${tmpFile}`,
            options: { table: 'tasks' },
          });

          expect(schema.properties.status.type.kind).toBe('union');
          const variants = (schema.properties.status.type as { kind: 'union'; variants: unknown[] }).variants;
          expect(variants).toHaveLength(3);
          expect(variants).toContainEqual({ kind: 'literal', value: 'pending' });
          expect(variants).toContainEqual({ kind: 'literal', value: 'active' });
          expect(variants).toContainEqual({ kind: 'literal', value: 'completed' });
        } finally {
          fs.unlinkSync(tmpFile);
        }
      });

      it('should include column descriptions', async () => {
        const adapter = new SQLAdapter();

        const sql = `
          CREATE TABLE test (
            id UUID PRIMARY KEY,
            user_id UUID REFERENCES users(id),
            status TEXT UNIQUE DEFAULT 'pending'
          );
        `;

        const fs = await import('fs');
        const path = await import('path');
        const os = await import('os');

        const tmpDir = os.tmpdir();
        const tmpFile = path.join(tmpDir, 'test-desc.sql');
        fs.writeFileSync(tmpFile, sql);

        try {
          const schema = await adapter.extract({
            source: 'sql_ddl',
            id: `file:${tmpFile}`,
          });

          expect(schema.properties.id.description).toContain('Primary key');
          expect(schema.properties.user_id.description).toContain('References users(id)');
          expect(schema.properties.status.description).toContain('Unique');
          expect(schema.properties.status.description).toContain("Default: 'pending'");
        } finally {
          fs.unlinkSync(tmpFile);
        }
      });
    });
  });
});
