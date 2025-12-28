/**
 * Project Configuration Management
 * Handles .trace-mcp directory and config files
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { z } from 'zod';

// ============================================================================
// Config Schema
// ============================================================================

export const ProjectConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  producer: z.object({
    path: z.string(),
    language: z.enum(['typescript', 'python', 'go', 'rust', 'json_schema']).default('typescript'),
    include: z.array(z.string()).optional().default(['**/*.ts']),
    exclude: z.array(z.string()).optional().default(['**/*.test.ts', '**/node_modules/**', '**/dist/**']),
  }),
  consumer: z.object({
    path: z.string(),
    language: z.enum(['typescript', 'python', 'go', 'rust', 'json_schema']).default('typescript'),
    include: z.array(z.string()).optional().default(['**/*.ts', '**/*.tsx']),
    exclude: z.array(z.string()).optional().default(['**/*.test.ts', '**/node_modules/**', '**/dist/**']),
  }),
  options: z.object({
    strict: z.boolean().default(false),
    direction: z.enum(['producer_to_consumer', 'consumer_to_producer', 'bidirectional']).default('producer_to_consumer'),
    debounceMs: z.number().default(300),
    autoWatch: z.boolean().default(true),
  }).default({}),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// ============================================================================
// Constants
// ============================================================================

const TRACE_DIR = '.trace-mcp';
const CONFIG_FILE = 'config.json';
const CACHE_DIR = 'cache';
const CONTRACTS_DIR = 'contracts';
const REPORTS_DIR = 'reports';

// ============================================================================
// Project Class
// ============================================================================

export class TraceProject {
  readonly rootDir: string;
  readonly traceDir: string;
  private _config: ProjectConfig | null = null;

  constructor(projectRoot: string) {
    this.rootDir = resolve(projectRoot);
    this.traceDir = join(this.rootDir, TRACE_DIR);
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  /**
   * Check if a .trace-mcp directory exists
   */
  exists(): boolean {
    return existsSync(this.traceDir) && existsSync(this.configPath);
  }

  /**
   * Initialize a new trace project
   */
  init(config: Partial<ProjectConfig>): ProjectConfig {
    // Create directories
    mkdirSync(this.traceDir, { recursive: true });
    mkdirSync(this.cachePath, { recursive: true });
    mkdirSync(this.contractsPath, { recursive: true });
    mkdirSync(this.reportsPath, { recursive: true });

    // Create config with defaults
    const fullConfig = ProjectConfigSchema.parse(config);
    
    // Write config
    writeFileSync(this.configPath, JSON.stringify(fullConfig, null, 2));
    this._config = fullConfig;

    // Create .gitignore for cache
    writeFileSync(
      join(this.traceDir, '.gitignore'),
      '# Trace MCP cache (regenerated)\ncache/\nreports/\n'
    );

    return fullConfig;
  }

  // --------------------------------------------------------------------------
  // Config Access
  // --------------------------------------------------------------------------

  get config(): ProjectConfig {
    if (!this._config) {
      if (!this.exists()) {
        throw new Error(`No trace project found at ${this.rootDir}. Run init_project first.`);
      }
      const raw = readFileSync(this.configPath, 'utf-8');
      this._config = ProjectConfigSchema.parse(JSON.parse(raw));
    }
    return this._config;
  }

  get configPath(): string {
    return join(this.traceDir, CONFIG_FILE);
  }

  get cachePath(): string {
    return join(this.traceDir, CACHE_DIR);
  }

  get contractsPath(): string {
    return join(this.traceDir, CONTRACTS_DIR);
  }

  get reportsPath(): string {
    return join(this.traceDir, REPORTS_DIR);
  }

  // --------------------------------------------------------------------------
  // Resolved Paths
  // --------------------------------------------------------------------------

  get producerPath(): string {
    return resolve(this.rootDir, this.config.producer.path);
  }

  get consumerPath(): string {
    return resolve(this.rootDir, this.config.consumer.path);
  }

  // --------------------------------------------------------------------------
  // Config Updates
  // --------------------------------------------------------------------------

  updateConfig(updates: Partial<ProjectConfig>): ProjectConfig {
    const current = this.config;
    const updated = ProjectConfigSchema.parse({
      ...current,
      ...updates,
      producer: { ...current.producer, ...updates.producer },
      consumer: { ...current.consumer, ...updates.consumer },
      options: { ...current.options, ...updates.options },
    });
    
    writeFileSync(this.configPath, JSON.stringify(updated, null, 2));
    this._config = updated;
    
    return updated;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Find the nearest trace project by walking up directories
 */
export function findProject(startDir: string): TraceProject | null {
  let current = resolve(startDir);
  
  while (current !== resolve(current, '..')) {
    const project = new TraceProject(current);
    if (project.exists()) {
      return project;
    }
    current = resolve(current, '..');
  }
  
  return null;
}

/**
 * Create or load a trace project
 */
export function loadProject(projectRoot: string): TraceProject {
  return new TraceProject(projectRoot);
}
