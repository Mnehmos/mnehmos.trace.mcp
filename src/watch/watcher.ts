/**
 * File Watcher
 * Watches producer/consumer directories and triggers revalidation on changes
 */

import chokidar, { type FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { relative, join } from 'path';
import type { TraceProject } from './project.js';
import { SchemaCache } from './cache.js';
import { extractProducerSchemas } from '../extract/index.js';
import { traceConsumerUsage } from '../trace/index.js';
import { compareSchemas } from '../compare/index.js';
import type { TraceResult } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export type WatchEventType = 
  | 'ready'
  | 'file_changed'
  | 'revalidating'
  | 'result'
  | 'error'
  | 'stopped';

export interface WatchEvent {
  type: WatchEventType;
  timestamp: string;
  data?: unknown;
}

export interface FileChangeData {
  file: string;
  side: 'producer' | 'consumer';
  changeType: 'add' | 'change' | 'unlink';
}

export interface ResultData {
  result: TraceResult;
  triggeredBy: string;
  cached: boolean;
}

// ============================================================================
// TraceWatcher Class
// ============================================================================

export class TraceWatcher extends EventEmitter {
  private project: TraceProject;
  private cache: SchemaCache;
  private producerWatcher: FSWatcher | null = null;
  private consumerWatcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingChanges: Map<string, FileChangeData> = new Map();
  private isRunning = false;
  private lastResult: TraceResult | null = null;

  constructor(project: TraceProject) {
    super();
    this.project = project;
    this.cache = new SchemaCache(project);
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /**
   * Start watching files
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Watcher is already running');
    }

    const config = this.project.config;
    this.isRunning = true;

    // Build glob patterns for producer
    const producerPatterns = config.producer.include.map(
      p => join(this.project.producerPath, p)
    );
    const producerIgnore = config.producer.exclude.map(
      p => join(this.project.producerPath, p)
    );

    // Build glob patterns for consumer  
    const consumerPatterns = config.consumer.include.map(
      p => join(this.project.consumerPath, p)
    );
    const consumerIgnore = config.consumer.exclude.map(
      p => join(this.project.consumerPath, p)
    );

    // Start producer watcher
    this.producerWatcher = chokidar.watch(producerPatterns, {
      ignored: producerIgnore,
      persistent: true,
      ignoreInitial: true,
    });

    this.producerWatcher.on('add', (path: string) => this.onFileChange(path, 'producer', 'add'));
    this.producerWatcher.on('change', (path: string) => this.onFileChange(path, 'producer', 'change'));
    this.producerWatcher.on('unlink', (path: string) => this.onFileChange(path, 'producer', 'unlink'));
    this.producerWatcher.on('error', (err: unknown) => this.onError(err instanceof Error ? err : new Error(String(err))));

    // Start consumer watcher
    this.consumerWatcher = chokidar.watch(consumerPatterns, {
      ignored: consumerIgnore,
      persistent: true,
      ignoreInitial: true,
    });

    this.consumerWatcher.on('add', (path: string) => this.onFileChange(path, 'consumer', 'add'));
    this.consumerWatcher.on('change', (path: string) => this.onFileChange(path, 'consumer', 'change'));
    this.consumerWatcher.on('unlink', (path: string) => this.onFileChange(path, 'consumer', 'unlink'));
    this.consumerWatcher.on('error', (err: unknown) => this.onError(err instanceof Error ? err : new Error(String(err))));

    // Initial validation
    await this.runValidation('initial');

    this.emitEvent('ready', {
      producerPath: this.project.producerPath,
      consumerPath: this.project.consumerPath,
    });
  }

  /**
   * Stop watching files
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.producerWatcher) {
      await this.producerWatcher.close();
      this.producerWatcher = null;
    }

    if (this.consumerWatcher) {
      await this.consumerWatcher.close();
      this.consumerWatcher = null;
    }

    this.isRunning = false;
    this.emitEvent('stopped', {});
  }

  // --------------------------------------------------------------------------
  // Event Handlers
  // --------------------------------------------------------------------------

  private onFileChange(
    filePath: string,
    side: 'producer' | 'consumer',
    changeType: 'add' | 'change' | 'unlink'
  ): void {
    const relPath = relative(this.project.rootDir, filePath);
    
    this.emitEvent('file_changed', {
      file: relPath,
      side,
      changeType,
    } as FileChangeData);

    // Accumulate changes
    this.pendingChanges.set(filePath, { file: relPath, side, changeType });

    // Invalidate cache for this file
    this.cache.invalidateFiles([filePath]);

    // Debounce revalidation
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    const debounceMs = this.project.config.options.debounceMs ?? 300;
    this.debounceTimer = setTimeout(() => {
      this.processPendingChanges();
    }, debounceMs);
  }

  private onError(error: Error): void {
    this.emitEvent('error', {
      message: error.message,
      stack: error.stack,
    });
  }

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------

  private async processPendingChanges(): Promise<void> {
    const changes = Array.from(this.pendingChanges.values());
    this.pendingChanges.clear();

    if (changes.length === 0) return;

    const triggeredBy = changes.map(c => c.file).join(', ');
    await this.runValidation(triggeredBy);
  }

  private async runValidation(triggeredBy: string): Promise<void> {
    this.emitEvent('revalidating', { triggeredBy });

    try {
      // Extract and trace using configured languages
      const producers = await extractProducerSchemas({
        rootDir: this.project.producerPath,
        language: this.project.config.producer.language,
        include: this.project.config.producer.include,
        exclude: this.project.config.producer.exclude,
      });

      const consumers = await traceConsumerUsage({
        rootDir: this.project.consumerPath,
        language: this.project.config.consumer.language,
        include: this.project.config.consumer.include,
        exclude: this.project.config.consumer.exclude,
      });

      // Compare
      const result = compareSchemas(producers, consumers, {
        strict: this.project.config.options.strict,
        direction: this.project.config.options.direction,
      });

      this.lastResult = result;

      this.emitEvent('result', {
        result,
        triggeredBy,
        cached: false,
      } as ResultData);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emitEvent('error', { message, triggeredBy });
    }
  }

  // --------------------------------------------------------------------------
  // Utility
  // --------------------------------------------------------------------------

  private emitEvent(type: WatchEventType, data: unknown): void {
    const event: WatchEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };
    this.emit('watch-event', event);
  }

  /**
   * Get the last validation result
   */
  getLastResult(): TraceResult | null {
    return this.lastResult;
  }

  /**
   * Get current watcher status
   */
  getStatus(): {
    running: boolean;
    lastResult: TraceResult | null;
    pendingChanges: number;
  } {
    return {
      running: this.isRunning,
      lastResult: this.lastResult,
      pendingChanges: this.pendingChanges.size,
    };
  }

  /**
   * Force a revalidation
   */
  async forceRevalidation(): Promise<TraceResult> {
    await this.runValidation('manual');
    return this.lastResult!;
  }
}

// ============================================================================
// Singleton Registry
// ============================================================================

// Track active watchers by project path
const activeWatchers = new Map<string, TraceWatcher>();

/**
 * Get or create a watcher for a project
 */
export function getWatcher(project: TraceProject): TraceWatcher {
  const key = project.rootDir;
  
  if (!activeWatchers.has(key)) {
    activeWatchers.set(key, new TraceWatcher(project));
  }
  
  return activeWatchers.get(key)!;
}

/**
 * Stop and remove a watcher
 */
export async function stopWatcher(project: TraceProject): Promise<void> {
  const key = project.rootDir;
  const watcher = activeWatchers.get(key);
  
  if (watcher) {
    await watcher.stop();
    activeWatchers.delete(key);
  }
}

/**
 * List all active watchers
 */
export function listActiveWatchers(): string[] {
  return Array.from(activeWatchers.keys());
}
